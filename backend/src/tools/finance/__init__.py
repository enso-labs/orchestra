from src.tools.finance.correlation import get_correlation_matrix
from src.tools.finance.earnings import get_earnings_report
from src.tools.finance.news import get_financial_news, get_sec_filings
from src.tools.finance.macro import get_market_summary
from src.tools.finance.price import get_stock_price_history

FINANCE_TOOLS = [
    get_stock_price_history,
    get_correlation_matrix,
    get_market_summary,
    get_earnings_report,
    get_sec_filings,
    get_financial_news,
]
