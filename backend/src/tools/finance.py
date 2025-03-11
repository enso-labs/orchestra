import yfinance as yf
from langchain_core.tools import tool

# @tool
# def get_stock_price(symbol: str):
#     """Get the current price of a stock from Yahoo Finance."""
#     stock = yf.Ticker(symbol)
#     return stock.info['currentPrice']

# @tool
# def get_stock_info(symbol: str):
#     """Get information about a stock from Yahoo Finance."""
#     stock = yf.Ticker(symbol)
#     return stock.info

@tool
def get_stock_news(symbol: str):
    """Get news about a stock from Yahoo Finance."""
    stock = yf.Ticker(symbol)
    return stock.news

@tool
def get_stock_history(symbol: str, period: str = "1mo", interval: str = "1d"):
    """Get historical data for a stock from Yahoo Finance.
    
    Args:
        symbol (str): Stock ticker symbol
        period (str): Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
        interval (str): Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
    """
    stock = yf.Ticker(symbol)
    return stock.history(period=period, interval=interval).to_dict()

@tool
def get_stock_dividends(symbol: str):
    """Get dividend history for a stock from Yahoo Finance."""
    stock = yf.Ticker(symbol)
    return stock.dividends.to_dict()

@tool
def get_stock_actions(symbol: str):
    """Get stock splits and dividend events from Yahoo Finance."""
    stock = yf.Ticker(symbol)
    return stock.actions.to_dict()

@tool
def get_stock_financials(symbol: str):
    """Get financial statements for a stock from Yahoo Finance."""
    stock = yf.Ticker(symbol)
    return {
        "income_statement": stock.income_stmt.to_dict(),
        "balance_sheet": stock.balance_sheet.to_dict(),
        "cash_flow": stock.cashflow.to_dict()
    }

@tool
def get_stock_recommendations(symbol: str):
    """Get analyst recommendations for a stock from Yahoo Finance."""
    stock = yf.Ticker(symbol)
    return stock.recommendations.to_dict()

@tool
def get_stock_holders(symbol: str):
    """Get major holders and institutional holders of a stock from Yahoo Finance."""
    stock = yf.Ticker(symbol)
    return {
        "major_holders": stock.major_holders,
        "institutional_holders": stock.institutional_holders.to_dict() if stock.institutional_holders is not None else None
    }
