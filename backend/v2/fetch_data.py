import yfinance as yf
import sys

def fetch(ticker, period="2y"):
    data = yf.download(ticker, period=period, interval="1d")
    return data

if __name__ == "__main__":
    ticker = sys.argv[1]
    data = fetch(ticker)
    print("rows:", data.shape[0])
    print("range:", data.index.min(), "→", data.index.max())
    print(data.tail(5))
