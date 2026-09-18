import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import ProtectedTrading from "./ProtectedTrading";
import { useParams } from "react-router-dom";
import AlgorithmRunner from "./components/AlgorithmRunner";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// StockData interface
interface StockData {
  symbol: string;
  name: string;
  currency: string;
  currentPrice: number;
  previousClose: number;
  marketCap: number;
  dayHigh: number;
  dayLow: number;
  priceData: {
    Date: string;
    Open: number;
    High: number;
    Low: number;
    Close: number;
    Volume: number;
  }[];
}

// API functions
const fetchStockData = async (
  symbol: string,
  period: string = "1y"
): Promise<StockData> => {
  try {
    const response = await fetch(
      `http://localhost:5001/api/stock?symbol=${symbol}&period=${period}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch stock data");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching stock data:", error);
    throw error;
  }
};

const searchStocks = async (
  query: string
): Promise<Array<{ symbol: string; name: string; exchange: string }>> => {
  try {
    if (!query || query.length < 2) return [];

    const response = await fetch(`http://localhost:5001/api/search?q=${query}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to search stocks");
    }

    return await response.json();
  } catch (error) {
    console.error("Error searching stocks:", error);
    throw error;
  }
};

const Trading = () => {
  const { ticker } = useParams<{ ticker?: string }>();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ symbol: string; name: string; exchange: string }>
  >([]);
  const [savedStocks, setSavedStocks] = useState([""]);
  const [selectedStock, setSelectedStock] = useState<string>("");
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timePeriod, setTimePeriod] = useState("1mo");
  const [showAnimation, setShowAnimation] = useState(false);

  // New state variables for the quantity popup
  const [showQuantityPopup, setShowQuantityPopup] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [transactionType, setTransactionType] = useState<"buy" | "sell">("buy");

  // New state for showing/hiding algorithm section
  const [showAlgorithms, setShowAlgorithms] = useState(false);

  useEffect(() => {
    if (ticker) {
      // Set selected stock when the URL includes a ticker
      setSelectedStock(ticker);
    }
  }, [ticker]);

  // Fetch stock data when selected stock or time period changes
  useEffect(() => {
    const getStockData = async () => {
      if (!selectedStock) return;

      setLoading(true);
      setError("");

      try {
        const data = await fetchStockData(selectedStock, timePeriod);
        setStockData(data);
      } catch (err) {
        setError("Failed to load stock data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getStockData();
  }, [selectedStock, timePeriod]);

  // Handle search input changes
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);

    if (value.length >= 2) {
      try {
        const results = await searchStocks(value);
        setSearchResults(results);
      } catch (err) {
        console.error("Search error:", err);
      }
    } else {
      setSearchResults([]);
    }
  };

  // Select a stock from search results
  const selectStock = (symbol: string) => {
    setSelectedStock(symbol);
    setSearch("");
    setSearchResults([]);

    // Add to saved stocks if not already there
    if (!savedStocks.includes(symbol)) {
      setSavedStocks([...savedStocks, symbol]);
    }
  };

  // Open quantity popup for buy
  const openBuyPopup = () => {
    setTransactionType("buy");
    setQuantity(1);
    setShowQuantityPopup(true);
  };

  // Open quantity popup for sell
  const openSellPopup = () => {
    setTransactionType("sell");
    setQuantity(1);
    setShowQuantityPopup(true);
  };

  // Close the quantity popup
  const closeQuantityPopup = () => {
    setShowQuantityPopup(false);
  };

  // Handle quantity change
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (value > 0) {
      setQuantity(value);
    }
  };

  // Process the transaction (buy/sell) after quantity is provided
  const processTransaction = async () => {
    if (!stockData) {
      alert("Stock data is unavailable.");
      return;
    }

    try {
      // Get the user ID from localStorage instead of hardcoded value
      const userId = localStorage.getItem("userId");

      if (!userId) {
        alert("You must be logged in to make transactions.");
        return;
      }

      const endpoint =
        transactionType === "buy"
          ? "http://localhost:5001/buy-stock"
          : "http://localhost:5001/sell-stock";

      const payload = {
        user_id: userId, // Use the actual user ID from auth
        ticker: selectedStock,
        currentPrice: stockData.currentPrice,
        quantity: quantity,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`, // Add auth token
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to ${transactionType} stock`
        );
      }

      const data = await response.json();
      if (data.success) {
        setShowQuantityPopup(false);
        setShowAnimation(true);
        setTimeout(() => setShowAnimation(false), 2000);
        alert(
          `Successfully ${
            transactionType === "buy" ? "purchased" : "sold"
          } ${quantity} shares of ${selectedStock}`
        );
      } else {
        alert(
          `Error ${transactionType === "buy" ? "buying" : "selling"} stock: ${
            data.error
          }`
        );
      }
    } catch (error) {
      console.error("Error:", error);
      alert(
        `Transaction failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const tradingContent = (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#111827] text-white flex">
      <div className="flex-1 flex flex-col">
        {/* Top Navigation Bar */}
        <Header />

        {/* Main Content Area */}
        <div className="flex flex-1">
          {/* Sidebar */}
          <div className="w-1/6 bg-gray-800/50 p-4">
            <h2 className="text-lg font-bold mb-4">Recent Stocks</h2>
            <ul>
              {savedStocks.map((stock, index) => (
                <li
                  key={index}
                  className={`py-2 border-b border-gray-700 cursor-pointer hover:text-emerald-500 ${
                    selectedStock === stock ? "text-emerald-500" : ""
                  }`}
                  onClick={() => setSelectedStock(stock)}
                >
                  {stock}
                </li>
              ))}
            </ul>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6">
            {/* Search Bar with Dropdown */}
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="Search stocks..."
                className="w-full p-3 bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                value={search}
                onChange={handleSearchChange}
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full bg-gray-800 text-white mt-1 rounded-lg shadow-lg border border-gray-700">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-b-0"
                      onClick={() => selectStock(result.symbol)}
                    >
                      <span className="font-bold text-emerald-500">
                        {result.symbol}
                      </span>{" "}
                      - {result.name} ({result.exchange})
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Time Period Selector */}
            <div className="flex gap-2 mb-6">
              {["1d", "1wk", "1mo", "3mo", "6mo", "1y", "5y"].map((period) => (
                <button
                  key={period}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    timePeriod === period
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-800/70 hover:bg-gray-700"
                  }`}
                  onClick={() => setTimePeriod(period)}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* Stock Info */}
            {stockData && (
              <div className="mb-6 bg-gray-800/40 p-4 rounded-lg border border-gray-700">
                <h2 className="text-2xl font-bold mb-2">
                  {stockData.name} ({stockData.symbol})
                </h2>
                <div className="flex gap-4 mb-4">
                  <div className="text-2xl">
                    ${stockData.currentPrice.toFixed(2)} {stockData.currency}
                  </div>
                  <div
                    className={`text-lg ${
                      stockData.currentPrice > stockData.previousClose
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {stockData.currentPrice > stockData.previousClose
                      ? "↑"
                      : "↓"}
                    {(
                      ((stockData.currentPrice - stockData.previousClose) /
                        stockData.previousClose) *
                      100
                    ).toFixed(2)}
                    %
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-gray-400 text-sm">Previous Close</div>
                    <div>${stockData.previousClose.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Day Range</div>
                    <div>
                      ${stockData.dayLow.toFixed(2)} - $
                      {stockData.dayHigh.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-sm">Market Cap</div>
                    <div>${(stockData.marketCap / 1000000000).toFixed(2)}B</div>
                  </div>
                </div>
              </div>
            )}

            {/* Stock Chart */}
            <div className="w-full h-80 mb-6 bg-gray-800/40 p-4 rounded-lg border border-gray-700">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div>
                </div>
              ) : error ? (
                <div className="w-full h-full flex items-center justify-center text-red-500">
                  <span>{error}</span>
                </div>
              ) : stockData && stockData.priceData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stockData.priceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis
                      dataKey="Date"
                      tick={{ fill: "#aaa" }}
                      tickFormatter={(value) => {
                        if (timePeriod === "1d") return value.split(" ")[1]; // Show time for 1d
                        if (["1wk", "1mo"].includes(timePeriod))
                          return value.split("-")[2]; // Show day for short periods
                        return value.split("-").slice(1).join("/"); // Show month/day for longer periods
                      }}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fill: "#aaa" }}
                      tickFormatter={(value) => `$${value.toFixed(0)}`}
                    />
                    <Tooltip
                      labelFormatter={(label) => `Date: ${label}`}
                      formatter={(value: any) => [
                        `$${Number(value).toFixed(2)}`,
                        "",
                      ]}
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        borderColor: "#374151",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Close"
                      stroke="#10b981"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span>Select a stock to view chart</span>
                </div>
              )}
            </div>

            {/* Buy & Sell Buttons */}
            <div className="flex gap-4">
              <button
                onClick={openBuyPopup}
                className="bg-green-500 px-8 py-3 rounded-lg hover:bg-green-600 font-medium transition-colors"
              >
                Buy
              </button>
              <button
                onClick={openSellPopup}
                className="bg-red-500 px-8 py-3 rounded-lg hover:bg-red-600 font-medium transition-colors"
              >
                Sell
              </button>
              {/* Button to toggle algorithm section */}
              <button
                onClick={() => setShowAlgorithms(!showAlgorithms)}
                className="ml-auto bg-blue-500 px-8 py-3 rounded-lg hover:bg-blue-600 font-medium transition-colors"
              >
                {showAlgorithms ? "Hide Algorithms" : "Show Algorithms"}
              </button>
            </div>
            {/* Algorithm Runner Component - IMPORTED */}
            {showAlgorithms && stockData && (
              <AlgorithmRunner
                stockData={stockData}
                symbol={selectedStock}
                timePeriod={timePeriod}
              />
            )}

            {/* Quantity Modal Popup */}
            {showQuantityPopup && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div className="bg-gray-900 p-6 rounded-lg shadow-lg border border-gray-700 w-full max-w-md">
                  <h3 className="text-xl font-bold mb-4">
                    {transactionType === "buy" ? "Buy" : "Sell"} {selectedStock}
                  </h3>

                  {stockData && (
                    <div className="mb-4 text-gray-300">
                      <p>Current Price: ${stockData.currentPrice.toFixed(2)}</p>
                      <p className="mt-2">
                        Total Value: $
                        {(stockData.currentPrice * quantity).toFixed(2)}
                      </p>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Quantity
                    </label>
                    <div className="flex items-center">
                      <button
                        className="bg-gray-700 px-3 py-2 rounded-l-lg border-r border-gray-600"
                        onClick={() =>
                          quantity > 1 && setQuantity(quantity - 1)
                        }
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={handleQuantityChange}
                        className="bg-gray-800 text-center py-2 w-20 focus:outline-none"
                      />
                      <button
                        className="bg-gray-700 px-3 py-2 rounded-r-lg border-l border-gray-600"
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 mt-6">
                    <button
                      onClick={closeQuantityPopup}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={processTransaction}
                      className={`px-6 py-2 rounded-lg transition-colors ${
                        transactionType === "buy"
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      Confirm {transactionType === "buy" ? "Purchase" : "Sale"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Success Animation */}
            {showAnimation && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div className="p-6 bg-white text-black rounded-lg shadow-lg animate-fade-in">
                  ✅ Transaction Successful!
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return <ProtectedTrading>{tradingContent}</ProtectedTrading>;
};

export default Trading;
