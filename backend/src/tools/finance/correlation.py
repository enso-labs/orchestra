import numpy as np
import pandas as pd
import yfinance as yf
from langchain_core.tools import tool
from typing import Literal
from pydantic import BaseModel, Field
import plotly.express as px

########################################################
## Get Correlation Matrix
########################################################
type Period = Literal["1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]


class GetCorrelationMatrixSchema(BaseModel):
    tickers: list[str] = Field(..., description="List of ticker symbols to compute correlation for (minimum 2)")
    period: Period = Field(default="1y", description="The time period for historical data")


@tool(args_schema=GetCorrelationMatrixSchema, response_format="content_and_artifact")
def get_correlation_matrix(tickers: list[str], period: str = "1y") -> tuple[str, str]:
    """Get the correlation matrix for a list of stock tickers and return a Plotly heatmap as JSON."""
    # Validate minimum tickers
    if len(tickers) < 2:
        return (
            "Error: At least 2 tickers are required to compute a correlation matrix.",
            "",
        )

    # Fetch historical closing prices for each ticker using yf.Ticker().history()
    prices_dict = {}
    for ticker in tickers:
        ticker_obj = yf.Ticker(ticker)
        hist = ticker_obj.history(period=period)
        if not hist.empty:
            prices_dict[ticker] = hist["Close"]

    # Check if we have at least 2 valid tickers
    if len(prices_dict) < 2:
        return (
            f"Error: Not enough valid tickers with data. Only found: {list(prices_dict.keys())}",
            "",
        )

    # Combine into a single DataFrame
    prices = pd.DataFrame(prices_dict)

    # Drop rows with any NaN to ensure clean data for correlation
    prices = prices.dropna()

    # Compute daily log-returns
    returns = np.log(prices / prices.shift(1)).dropna()

    # Calculate correlation matrix
    corr = returns.corr()

    # Create Plotly heatmap
    fig = px.imshow(
        corr,
        text_auto=".2f",
        aspect="square",
        title=f"Correlation Matrix ({period})",
        labels=dict(color="ρ"),
        color_continuous_scale="RdBu_r",
        zmin=-1,
        zmax=1,
    )

    # Return CSV data for model context and Plotly JSON for visualization
    return corr.to_csv(), fig.to_json()
