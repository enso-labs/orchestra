import yfinance as yf
import pandas as pd
from langchain_core.tools import tool

from src.utils.pandas import drop_columns

########################################################
## Get Financial News
########################################################
@tool(response_format="content_and_artifact", parse_docstring=True)
def get_financial_news(ticker: str) -> tuple[str, dict]:
    """Get the financial news for a given ticker.
    
    Args:
        ticker: The ticker symbol of the company or currency.
    """
    # Convert full results to DataFrame
    df_raw = pd.DataFrame(yf.Ticker(ticker).news)

    # Expand ONLY the "content" field
    df = pd.json_normalize(df_raw["content"])

    # 🔥 Remove columns where *every* row is null
    df = df.dropna(axis=1, how="all")

    df = drop_columns(df, [
        "id",
        "isHosted",
        "bypassModal",
        "canonicalUrl.*",
        "clickThroughUrl.site",
        "clickThroughUrl.region",
        "clickThroughUrl.lang",
        "metadata.*",
        "thumbnail.resolutions",
        "thumbnail.originalWidth",
        "thumbnail.originalHeight",
        "finance.*"
      ])

    # Convert to markdown (clean, no index)
    markdown = df.to_markdown(index=False)

    # JSON-safe dict
    json_data = df.to_dict(orient="records")

    return markdown, json_data

########################################################
## Get SEC Filings
########################################################
@tool(response_format="content_and_artifact", parse_docstring=True)
def get_sec_filings(ticker: str) -> tuple[str, dict]:
    """Get the SEC filings for a ticker.
    
    Args:
        ticker: The ticker symbol of the company or currency.
    """
    ticker_obj = yf.Ticker(ticker)
    filings = ticker_obj.get_sec_filings()
    df = pd.DataFrame(filings)
    return df.to_markdown(index=False)