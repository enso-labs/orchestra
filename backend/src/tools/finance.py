import yaml
import yfinance as yf
from typing import Literal
from pydantic import BaseModel, Field
from langchain_core.tools import tool
import plotly.express as px
import pandas as pd

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


FINANCE_TOOLS = [get_stock_price_history]
