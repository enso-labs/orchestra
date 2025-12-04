import yaml
import yfinance as yf
from typing import Literal
from pydantic import BaseModel, Field
from langchain_core.tools import tool
import plotly.express as px
import pandas as pd

########################################################
## Get Stock Price History
########################################################
type Period = Literal[
    "1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"
]
class GetStockPriceSchema(BaseModel):
    ticker: str = Field(..., description="The ticker of the stock to get the price of")
    period: Period = Field(
        default="1mo", description="The period of the stock to get the price of"
    )

@tool(args_schema=GetStockPriceSchema, response_format="content_and_artifact")
def get_stock_price_history(ticker: str, period: str = "1mo") -> str:
    """Get the stock price history of a given ticker and return a Plotly chart as JSON."""
    # Fetch historical data
    ticker_obj = yf.Ticker(ticker)
    hist = ticker_obj.history(period=period)

    # Reset index so 'Date' is a column
    hist = hist.reset_index()
    # Create interactive Plotly chart
    fig = px.line(
        hist,
        x="Date",
        y="Close",
        title=f"{ticker} Closing Price - {period}",
        labels={"Close": "Price (USD)", "Date": "Date"},
    )

    # Return Plotly figure as JSON
    return hist.to_csv(index=False), fig.to_json()


########################################################
## Get Earnings History
########################################################
@tool(response_format="content_and_artifact", parse_docstring=True)
def get_earnings_history(ticker: str) -> tuple[str, dict]:
    """Get the earnings history for a ticker.
    
    Args:
        ticker: The ticker symbol of the company or currency.
    """
    ticker_obj = yf.Ticker(ticker)
    earnings = ticker_obj.get_earnings_history()
    df = pd.DataFrame(earnings)
    return df.to_csv(), df.to_json()


########################################################
## Get Market Summary
########################################################
type Market = Literal[
    "US", "GB", "ASIA", "EUROPE", "RATES", "COMMODITIES", "CURRENCIES", "CRYPTOCURRENCIES"
]

@tool(response_format="content_and_artifact", parse_docstring=True)
def get_market_summary(market: Market = "US") -> tuple[str, dict]:
    """Get the market summary for a given market.
    Available markets: US, GB, ASIA, EUROPE, RATES, COMMODITIES, CURRENCIES, CRYPTOCURRENCIES

    Args:
        market: The market to get the summary for.
    """
    market_obj = yf.Market(market)

    # Build DataFrames
    df_market_status = pd.DataFrame([market_obj.status])
    df_market_summary = pd.DataFrame(market_obj.summary)

    # Helper: make DataFrame JSON-serializable (convert everything to str)
    def df_to_serializable_records(df: pd.DataFrame):
        df_copy = df.copy()
        for col in df_copy.columns:
            df_copy[col] = df_copy[col].astype(str)
        return df_copy.to_dict(orient="records")

    # This is what you feed back into the model as textual context
    model_ctx = (
        "MARKET STATUS:\n" + df_market_status.to_markdown(index=False) + "\n\n"
        "MARKET SUMMARY:\n" + df_market_summary.to_markdown()
    )

    # This is structured data, safe for JSON / Pydantic
    raw_data = {
        "market_status": df_to_serializable_records(df_market_status),
        "market_summary": df_to_serializable_records(df_market_summary),
    }

    return model_ctx, raw_data


FINANCE_TOOLS = [get_stock_price_history, get_market_summary, get_earnings_history]
