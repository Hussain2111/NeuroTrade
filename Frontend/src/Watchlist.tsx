import { useState, useEffect } from "react";
import Header from "./components/Header";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useWatchlist } from "./context/WatchlistContext";

interface StockData {
  ticker: string;
  companyName: string;
  currentPrice: number;
  priceChange: number;
  percentChange: number;
}

const Watchlist = () => {
  const {
    watchlist,
    removeFromWatchlist,
    loading: watchlistLoading,
  } = useWatchlist();
  const [stocksData, setStocksData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Only start fetching stock data once the watchlist has been loaded
    if (watchlistLoading) return;

    const fetchStocksData = async () => {
      if (watchlist.length === 0) {
        setStocksData([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Join all tickers and fetch them in a batch for efficiency
        const tickers = watchlist.join(",");
        const batchResponse = await fetch(
          `http://localhost:5001/api/stocks?symbols=${tickers}`
        );

        if (!batchResponse.ok) {
          throw new Error("Failed to fetch stock data in batch");
        }

        const batchData = await batchResponse.json();

        if (
          !batchData ||
          !batchData.stocks ||
          !Array.isArray(batchData.stocks)
        ) {
          throw new Error("Invalid response format from stocks API");
        }

        console.log("Batch data received:", batchData);

        // Map the watchlist to stock data
        const results = watchlist.map((ticker) => {
          // Find matching stock in batch data
          const stockData = batchData.stocks.find(
            (s: any) => s.symbol === ticker || s.symbol === ticker.toUpperCase()
          );

          if (stockData) {
            const currentPrice = parseFloat(stockData.regularMarketPrice || 0);

            // Use the actual change values from Yahoo Finance API instead of calculating them
            // These values are more reliable than local calculations and already
            // account for daily changes
            const priceChange = parseFloat(stockData.regularMarketChange || 0);
            const percentChange = parseFloat(
              stockData.regularMarketChangePercent || 0
            );

            console.log(`${ticker} batch data:`, {
              currentPrice,
              priceChange,
              percentChange,
              // Log the raw values to debug
              rawPriceChange: stockData.regularMarketChange,
              rawPercentChange: stockData.regularMarketChangePercent,
            });

            return {
              ticker,
              companyName: stockData.longName || stockData.shortName || ticker,
              currentPrice,
              priceChange,
              percentChange,
            };
          } else {
            console.warn(`No data found for ${ticker} in batch response`);
            // Fallback to individual fetch if stock not found in batch
            return fetchIndividualStock(ticker);
          }
        });

        // Resolve any promises from individual fetches
        const resolvedResults = await Promise.all(results);
        setStocksData(resolvedResults);
      } catch (error) {
        console.error("Error fetching watchlist data:", error);

        // Fallback to fetching stocks individually if batch fetch fails
        try {
          const individualPromises = watchlist.map((ticker) =>
            fetchIndividualStock(ticker)
          );
          const individualResults = await Promise.all(individualPromises);
          setStocksData(individualResults);
        } catch (fallbackError) {
          console.error("Error fetching individual stock data:", fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    // Fetch a single stock's data
    const fetchIndividualStock = async (ticker: string): Promise<StockData> => {
      try {
        // Get basic stock info
        const infoResponse = await fetch(
          `http://localhost:5001/stock-info?ticker=${ticker}`
        );
        const infoData = await infoResponse.json();

        // Important: Create a fresh request for each ticker to prevent caching issues
        const priceResponse = await fetch(
          `http://localhost:5001/stock-price?ticker=${ticker}&_t=${Date.now()}`
        );
        const priceData = await priceResponse.json();

        console.log(`Individual price data for ${ticker}:`, priceData);

        let currentPrice = 0;
        let priceChange = 0;
        let percentChange = 0;

        if (priceData.success) {
          currentPrice = priceData.currentPrice || 0;

          // Get price change data
          const priceHistoryResponse = await fetch(
            `http://localhost:5001/stock-price-data?ticker=${ticker}&timeframe=1D&_t=${Date.now()}`
          );
          const priceHistoryData = await priceHistoryResponse.json();

          if (
            priceHistoryData.success &&
            priceHistoryData.priceData &&
            priceHistoryData.priceData.length >= 2
          ) {
            const prices = priceHistoryData.priceData.map(
              (item: { price: number }) => item.price
            );

            const openPrice = prices[0];
            const latestPrice = prices[prices.length - 1];

            priceChange = latestPrice - openPrice;
            percentChange = (priceChange / openPrice) * 100;

            // Add debug logging
            console.log(`${ticker} price change calculation:`, {
              openPrice,
              latestPrice,
              priceChange,
              percentChange,
            });
          } else {
            // If we can't get price history data, use regularMarketChange values
            // from the API instead of showing 0
            priceChange = 0;
            percentChange = 0;
          }
        }

        return {
          ticker,
          companyName: infoData.success ? infoData.company_name : ticker,
          currentPrice,
          priceChange,
          percentChange,
        };
      } catch (error) {
        console.error(`Error fetching data for ${ticker}:`, error);
        return {
          ticker,
          companyName: ticker,
          currentPrice: 0,
          priceChange: 0,
          percentChange: 0,
        };
      }
    };

    fetchStocksData();

    // Set up an interval to refresh data every minute
    const intervalId = setInterval(fetchStocksData, 60000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [watchlist, watchlistLoading]);

  const handleRemoveFromWatchlist = async (
    ticker: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    await removeFromWatchlist(ticker);
  };

  const navigateToAnalysis = (ticker: string) => {
    navigate(`/analysis?ticker=${ticker}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#111827] text-white flex flex-col">
      {/* Top Navigation Bar */}
      <Header />

      {/* Watchlist Content */}
      <main className="flex-1 px-6 py-10 relative">
        <h1 className="text-3xl font-bold text-center mb-6">Your Watchlist</h1>

        {loading || watchlistLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="text-center text-gray-400 mt-12">
            <p className="text-xl mb-4">Your watchlist is empty</p>
            <p className="mb-6">
              Bookmark stocks from the analysis page to add them to your
              watchlist
            </p>
            <button
              onClick={() => navigate("/analysis")}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              Go to Analysis
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {stocksData.map((stock, index) => {
              const isProfitable = stock.priceChange >= 0;

              return (
                <motion.div
                  key={stock.ticker}
                  className="bg-gray-900 p-5 rounded-2xl shadow-lg cursor-pointer relative group"
                  onClick={() => navigateToAnalysis(stock.ticker)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.05,
                  }}
                >
                  <button
                    onClick={(e) => handleRemoveFromWatchlist(stock.ticker, e)}
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/5 hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    aria-label="Remove from watchlist"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>

                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{stock.ticker}</h2>
                    <div className="mr-8">
                      {isProfitable ? (
                        <TrendingUp className="text-green-400 w-6 h-6" />
                      ) : (
                        <TrendingDown className="text-red-400 w-6 h-6" />
                      )}
                    </div>
                  </div>

                  <p className="text-gray-400 text-sm mt-1 truncate">
                    {stock.companyName}
                  </p>

                  <div className="flex justify-between items-start mt-4">
                    <div>
                      <div className="flex items-center">
                        <DollarSign className="text-yellow-400 w-5 h-5 mr-1" />
                        <p className="text-lg font-semibold">
                          ${stock.currentPrice?.toFixed(2) || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`text-right ${
                        isProfitable ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      <p className="font-medium">
                        {isProfitable ? "+" : ""}
                        {Math.abs(stock.percentChange || 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-800 flex justify-end">
                    <button
                      className="flex items-center text-emerald-400 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToAnalysis(stock.ticker);
                      }}
                    >
                      View Analysis <ExternalLink className="w-3 h-3 ml-1" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Watchlist;
