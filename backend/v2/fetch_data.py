import yfinance as yf
import sys
from curl_cffi.requests.exceptions import HTTPError, DNSError
class NoMarketData (Exception):
    pass

class InsuffcientMarketData (Exception):
    pass

class MarketDataUnavailable(Exception):
    pass

def fetch(ticker, period="2y"):
    min_rows = 252
    yf.config.debug.hide_exceptions = False
    if not ticker or not str(ticker).strip():
        raise ValueError("ticker is required")
    try:
        ticker_data = yf.Ticker(ticker)
        data = ticker_data.history(period=period, interval="1d")
    except DNSError as err:
        raise MarketDataUnavailable(
            "market data service unavailable"
        ) from err
    except NoMarketData as err:
        raise NoMarketData(
           f"no price data for ticker: {ticker}"
         ) from err
    except HTTPError as err:
        raise NoMarketData(
            f"no price data for ticker: {ticker}"
        ) from err
    if data.empty:
        raise NoMarketData(f"no price data for ticker: {ticker}")
    if len(data) < min_rows:
        raise InsuffcientMarketData(f"not enough market data for ticker: {ticker}") 
    
    return data

 
if __name__ == "__main__":
    ticker = sys.argv[1]
    data = fetch(ticker)
    print("rows:", data.shape[0])
    print("range:", data.index.min(), "→", data.index.max())
    print(data.tail(5))
