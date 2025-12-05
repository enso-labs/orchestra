import yfinance as yf
import pandas as pd
from langchain_core.tools import tool
from typing import Literal

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