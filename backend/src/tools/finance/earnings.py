import yfinance as yf
import pandas as pd
from langchain_core.tools import tool

########################################################
## Get Earnings History
########################################################
@tool(response_format="content_and_artifact", parse_docstring=True)
def get_earnings_report(ticker: str) -> tuple[str, dict]:
    """Get the earnings report for a ticker.
    
    Args:
        ticker: The ticker symbol of the company or currency.
    """
    ticker_obj = yf.Ticker(ticker)

    # yfinance properties / attributes (often DataFrames or dict-like)
    earnings_dates_df = pd.DataFrame(ticker_obj.earnings_dates)
    earnings_estimate_df = pd.DataFrame(ticker_obj.earnings_estimate)
    earnings_history_df = pd.DataFrame(ticker_obj.earnings_history)

    # Helper: safe markdown for possibly-empty DataFrames
    def df_to_section(title: str, df: pd.DataFrame) -> str:
        if df is None or df.empty:
            return f"## {title}\nNo data available.\n\n"
        return f"## {title}\n" + df.to_markdown(index=False) + "\n\n"

    # Build content string for the model
    content = ""
    content += df_to_section("Earnings Dates", earnings_dates_df)
    content += df_to_section("Earnings Estimate", earnings_estimate_df)
    content += df_to_section("Earnings History", earnings_history_df)

    # JSON-serializable artifact with all three
    artifact = {
        "earnings_dates": (
            [] if earnings_dates_df is None else earnings_dates_df.to_dict(orient="records")
        ),
        "earnings_estimate": (
            [] if earnings_estimate_df is None else earnings_estimate_df.to_dict(orient="records")
        ),
        "earnings_history": (
            [] if earnings_history_df is None else earnings_history_df.to_dict(orient="records")
        ),
    }

    return content, artifact