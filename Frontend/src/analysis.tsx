import Papa from "papaparse";
import React, { useState, useEffect, useRef } from "react";
import Header from "@/components/Header";
import {
  Search,
  ArrowRight,
  Share2,
  Download,
  ExternalLink,
  BarChart as BarChartIcon,
  X,
  Bookmark,
  TrendingUp,
  TrendingDown,
  Brain,
  LineChart,
  DollarSign,
  MessageSquare,
  Activity,
  AlertTriangle,
  Home,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePrediction } from "@/components/context/PredictionContext";
import { useWatchlist } from "@/context/WatchlistContext";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Area,
  ComposedChart,
  LineChart as RechartsLineChart,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import ProtectedAnalysis from "./ProtectedAnalysis";
import { addAnalysisNotification } from "./utils/notificationService";
import { addToAnalysisHistory } from "./Settings/history";
import { PredictionData } from "@/components/context/PredictionContext";

interface NewsItem {
  title: string;
  source: string;
  sentiment?: "positive" | "negative" | "neutral";
  time: string;
  summary: string;
  impact?: "High" | "Medium" | "Low";
  url: string;
}

// HomeButton Component
const HomeButton = () => {
  const navigate = useNavigate();

  return (
    <div>
      <button
        onClick={() => navigate("/")}
        className="p-2 hover:bg-gray-100 hover:bg-opacity-10 rounded-full transition-colors"
        aria-label="Go to homepage"
      >
        <Home className="w-6 h-6" />
      </button>
    </div>
  );
};

interface Message {
  id: number;
  text: string;
  isBot: boolean;
}

const Chatbot = ({ currentTicker }: { currentTicker: string }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: `Hello! I can help you analyze ${currentTicker}. What would you like to know?`,
      isBot: true,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle escape key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Handle body scroll lock
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  // Handle sending a message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputRef.current || isLoading) return;

    const messageText = inputRef.current.value.trim();
    if (!messageText) return;

    // Add user message
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        id: Date.now(),
        text: messageText,
        isBot: false,
      },
    ]);

    // Clear input field
    inputRef.current.value = "";

    // Add thinking message
    const thinkingId = Date.now() + 1;
    setMessages((prevMessages) => [
      ...prevMessages,
      {
        id: thinkingId,
        text: "Thinking...",
        isBot: true,
      },
    ]);

    // Send to API
    sendToAPI(messageText, thinkingId);
  };

  // Send message to API
  const sendToAPI = async (message: string, thinkingId: number) => {
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:5001/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          symbol: currentTicker,
          userId: "user123",
        }),
      });

      const data = await response.json();

      // Remove thinking message
      setMessages((prev) => prev.filter((msg) => msg.id !== thinkingId));

      if (data.success) {
        // Add bot response
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            text: formatResponse(data.response),
            isBot: true,
          },
        ]);
      } else {
        // Add error message
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            text: `Sorry, I couldn't process your request. ${data.error || ""}`,
            isBot: true,
          },
        ]);
      }
    } catch (error) {
      // Handle error
      setMessages((prev) =>
        prev
          .filter((msg) => msg.id !== thinkingId)
          .concat({
            id: Date.now(),
            text: "Sorry, I encountered an error processing your request. Please try again.",
            isBot: true,
          })
      );
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);

      // Re-focus the input field
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  // Format response text
  const formatResponse = (response: string) => {
    // Format currency
    response = response.replace(/\$(\d+(\.\d+)?)/g, (match, price) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(parseFloat(price))
    );

    // Format market cap
    response = response.replace(/Market Cap: (\d+)/g, (match, cap) => {
      const value = parseInt(cap);
      if (value >= 1e12) return `Market Cap: ${(value / 1e12).toFixed(2)}T`;
      if (value >= 1e9) return `Market Cap: ${(value / 1e9).toFixed(2)}B`;
      if (value >= 1e6) return `Market Cap: ${(value / 1e6).toFixed(2)}M`;
      return `Market Cap: ${value.toLocaleString()}`;
    });

    // Format volume
    response = response.replace(/Volume: (\d+)/g, (match, vol) => {
      const value = parseInt(vol);
      if (value >= 1e9) return `Volume: ${(value / 1e9).toFixed(2)}T`;
      if (value >= 1e6) return `Volume: ${(value / 1e6).toFixed(2)}M`;
      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
      return value.toString();
    });

    // Format percentages
    response = response.replace(/([-+]?\d+(\.\d+)?%)/g, (match) => {
      const value = parseFloat(match);
      return `${value.toFixed(2)}%`;
    });

    return response;
  };

  // Chat component (shared between preview and fullscreen)
  const ChatUI = ({ isPreview = false }) => {
    // Focus the input field on mount
    useEffect(() => {
      if (!isPreview && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isPreview, isFullscreen]);

    return (
      <div className={`flex flex-col ${isPreview ? "h-full" : "h-[600px]"}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-xl font-bold">Aurora</h3>
          {isPreview ? (
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg ${
                msg.isBot ? "bg-gray-800" : "bg-emerald-500/20"
              } ${msg.text === "Thinking..." ? "animate-pulse" : ""}`}
            >
              {msg.text}
            </div>
          ))}
        </div>

        {/* Input form */}
        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-gray-800"
        >
          <div className="flex gap-2">
            <input
              type="text"
              ref={inputRef}
              className="flex-1 bg-black/20 rounded-lg px-4 py-2 border border-gray-700 focus:border-emerald-500 outline-none"
              placeholder="Ask about this stock..."
              disabled={isLoading}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 py-2 bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors ${
                isLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Main component render
  return (
    <>
      {/* Sidebar preview */}
      <div className="w-[350px] border-l border-gray-800 bg-black/20 h-full">
        <ChatUI isPreview={true} />
      </div>

      {/* Fullscreen modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ duration: 0.15 }}
              className="bg-[#111827] rounded-xl w-full max-w-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <ChatUI isPreview={false} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Interface for the stock data
interface StockPriceData {
  date: string;
  price: number;
  volume: number;
}

// Chart component for the stock price chart
const StockPriceChart = ({
  data,
  timeframe,
}: {
  data: StockPriceData[];
  timeframe: string;
}) => {
  const [chartType, setChartType] = useState<"line" | "candlestick" | "area">(
    "line"
  );
  const [showVolume, setShowVolume] = useState(true);

  // Filter out any invalid data points
  const validData = data.map((point) => ({
    ...point,
    volume: point.volume || 0,
    price: point.price || 0,
  }));

  return (
    <div className="w-full h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setChartType("line")}
            className={`px-3 py-1 rounded ${
              chartType === "line" ? "bg-emerald-500" : "bg-white/5"
            }`}
          >
            Line
          </button>
          <button
            onClick={() => setChartType("area")}
            className={`px-3 py-1 rounded ${
              chartType === "area" ? "bg-emerald-500" : "bg-white/5"
            }`}
          >
            Area
          </button>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={showVolume}
              onChange={(e) => setShowVolume(e.target.checked)}
              className="text-emerald-500"
            />
            Volume
          </label>
        </div>
      </div>

      <div className="h-[calc(100%-60px)]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={validData}
            margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
          >
            <XAxis
              dataKey="date"
              stroke="#9CA3AF"
              tickFormatter={(value) => {
                const date = new Date(value);
                switch (timeframe) {
                  case "1D":
                    return date.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  case "1W":
                  case "1M":
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  case "3M":
                  case "1Y":
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      year: "2-digit",
                    });
                  case "ALL":
                    return date.toLocaleDateString("en-US", {
                      year: "numeric",
                    });
                  default:
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                }
              }}
              angle={-45}
              textAnchor="end"
              height={50}
              interval="preserveStartEnd"
              tick={{ fontSize: 12 }}
            />

            <YAxis
              yAxisId="price"
              stroke="#9CA3AF"
              domain={["auto", "auto"]}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
              tick={{ fontSize: 12 }}
              width={80}
            />

            {showVolume && (
              <YAxis
                yAxisId="volume"
                orientation="right"
                stroke="#4B5563"
                tickFormatter={(value) => {
                  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
                  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
                  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
                  return value.toString();
                }}
                tick={{ fontSize: 12 }}
                width={60}
              />
            )}

            <Tooltip
              contentStyle={{
                backgroundColor: "#1F2937",
                border: "1px solid #374151",
                borderRadius: "0.375rem",
                padding: "8px",
              }}
              labelStyle={{ color: "#9CA3AF", marginBottom: "4px" }}
              labelFormatter={(label) => {
                const date = new Date(label);
                return date.toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: timeframe === "1D" ? "short" : undefined,
                });
              }}
              formatter={(value: number, name: string) => {
                if (name === "volume") {
                  if (value >= 1e9)
                    return [`${(value / 1e9).toFixed(2)}B`, "Volume"];
                  if (value >= 1e6)
                    return [`${(value / 1e6).toFixed(2)}M`, "Volume"];
                  return [value.toLocaleString(), "Volume"];
                }
                return [
                  `$${value.toFixed(2)}`,
                  name === "price" ? "Price" : name,
                ];
              }}
            />

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#374151"
              opacity={0.5}
            />

            {/* Price Line/Area with improved styling */}
            {chartType === "line" ? (
              <Line
                type="monotone"
                dataKey="price"
                stroke="#10B981"
                dot={false}
                strokeWidth={2}
                yAxisId="price"
                connectNulls={true}
                animationDuration={750}
              />
            ) : (
              <Area
                type="monotone"
                dataKey="price"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.1}
                yAxisId="price"
                connectNulls={true}
                animationDuration={750}
              />
            )}

            {/* Volume Bars styling */}
            {showVolume && (
              <Bar
                dataKey="volume"
                fill="#374151"
                yAxisId="volume"
                opacity={0.3}
                barSize={timeframe === "1D" ? 3 : 6}
              />
            )}

            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => {
                switch (value) {
                  case "price":
                    return "Price";
                  case "volume":
                    return "Volume";
                  default:
                    return value;
                }
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// Type for prediction chart
interface StockData {
  Date: string;
  Close: number;
  Predicted_Close: number;
}

interface ChartProps {
  data: StockData[];
}

// Chart component for the stock prediction chart
const StockPredictionChart: React.FC<ChartProps> = ({ data }) => {
  console.log("StockPredictionChart received data:", data);
  const minValue = Math.min(
    ...data.map((item) => Math.min(item.Close, item.Predicted_Close))
  );
  const maxValue = Math.max(
    ...data.map((item) => Math.max(item.Close, item.Predicted_Close))
  );
  const padding = (maxValue - minValue) * 0.1; // 10% padding

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
        <XAxis dataKey="Date" />
        <YAxis domain={[minValue - padding, maxValue + padding]} />
        <Tooltip />
        <Legend verticalAlign="top" height={36} />
        <Line
          type="monotone"
          stroke="#2563EB"
          dot={false}
          strokeWidth={2}
          connectNulls={true}
          animationDuration={750}
          dataKey="Close"
          name="Actual Close Price"
        />
        <Line
          type="monotone"
          dataKey="Predicted_Close"
          dot={false}
          strokeWidth={2}
          connectNulls={true}
          animationDuration={750}
          stroke="#10B800"
          name="Predicted Close Price"
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
};

const AnalysisDashboard = () => {
  // Extract all hooks and context values
  const {
    predictionImage,
    setPredictionImage,
    priceHistoryImage,
    setPriceHistoryImage,
    currentTicker,
    setCurrentTicker,
    predictionData,
    setPredictionData,
  } = usePrediction();
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();

  // Define state variables
  const [ticker, setTicker] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTicker = params.get("ticker");
    const initialTicker =
      urlTicker || localStorage.getItem("currentTicker") || "AAPL";
    localStorage.setItem("currentTicker", initialTicker);
    return initialTicker;
  });

  const tickerState = ticker;

  // useEffect hooks for safely using all variables
  useEffect(() => {
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.get("ticker") !== ticker) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("ticker", ticker);
      window.history.pushState({}, "", newUrl.toString());
    }
  }, [ticker]);

  useEffect(() => {
    localStorage.setItem("currentTicker", ticker);
    setCurrentTicker(ticker);
  }, [ticker, setCurrentTicker]);

  // State declarations
  const [stockName, setStockName] = useState("");
  const [stockPrice, setStockPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);
  const [sentimentData, setSentimentData] = useState([
    {
      period: "Current",
      positive: 0,
      negative: 0,
      neutral: 0,
      totalMentions: 0,
      averageSentiment: 0,
    },
  ]);

  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(true);

  const [technicalIndicators, setTechnicalIndicators] = useState({
    rsi: 0,
    macd: 0,
    bollinger: {
      upper: 0,
      middle: 0,
      lower: 0,
    },
  });

  const [fundamentalData, setFundamentalData] = useState({
    peRatio: 0,
    pbRatio: 0,
    debtEquity: 0,
    quickRatio: 0,
    currentRatio: 0,
    returnOnEquity: 0,
    returnOnAssets: 0,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [timeframe, setTimeframe] = useState("1M");
  const [activeTab, setActiveTab] = useState("prediction");
  const [isAlertSet, setIsAlertSet] = useState(false);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [error, setError] = useState<string | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  // State for stock price data
  const [stockPriceData, setStockPriceData] = useState<StockPriceData[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState("1M");

  // State variable for sentiment loading specifically
  const [isLoadingSentiment, setIsLoadingSentiment] = useState(false);

  const [testData, setTestData] = useState<StockData[]>([]);

  const Redirect_Search = () => {
    // Navigate to second component
    navigate("/analysis");
  };
  const priceAlertThresholds = {
    upper: 190,
    lower: 175,
  };

  // Authentication Modal
  const AuthModal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <div className="bg-[#111827] rounded-xl p-8 w-full max-w-md relative">
        <button
          onClick={() => setShowAuthModal(false)}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold mb-6">
          {isLogin ? "Login" : "Sign Up"}
        </h2>
        <form className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Full Name"
              className="w-full p-3 rounded-lg bg-black/20 border border-gray-700 focus:border-emerald-500 outline-none"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 rounded-lg bg-black/20 border border-gray-700 focus:border-emerald-500 outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded-lg bg-black/20 border border-gray-700 focus:border-emerald-500 outline-none"
          />
          <button className="w-full py-3 bg-emerald-500 rounded-lg font-medium hover:bg-emerald-600 transition-colors">
            {isLogin ? "Login" : "Create Account"}
          </button>
        </form>
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="mt-4 text-sm text-gray-400 hover:text-white"
        >
          {isLogin
            ? "Need an account? Sign up"
            : "Already have an account? Login"}
        </button>
      </div>
    </motion.div>
  );

  // Separate useEffect to fetch stock info and price immediately
  useEffect(() => {
    // Set loading state
    setIsLoading(true);

    // First immediately fetch and display the stock info
    const fetchStockInfo = async () => {
      try {
        // Get company name using yfinance
        const info = await fetch(
          `http://localhost:5001/stock-info?ticker=${tickerState}`
        );
        const infoData = await info.json();

        if (infoData.success) {
          setStockName(infoData.company_name);

          // Get price change data from stock-price-data endpoint
          const priceDataResponse = await fetch(
            `http://localhost:5001/stock-price-data?ticker=${tickerState}&timeframe=1D`
          );
          const priceData = await priceDataResponse.json();

          console.log("Price history data:", priceData);

          if (
            priceData.success &&
            priceData.priceData &&
            priceData.priceData.length >= 2
          ) {
            const prices = priceData.priceData.map(
              (item: { price: number }) => item.price
            );

            // Use the opening price (first price) and latest price for calculation
            const openPrice = prices[0];
            const latestPrice = prices[prices.length - 1];

            const change = latestPrice - openPrice;
            const changePercent = (change / openPrice) * 100;

            console.log("Calculated price change:", {
              openPrice,
              latestPrice,
              change,
              changePercent,
            });

            setPriceChange(change);
            setPriceChangePercent(changePercent);
          } else {
            // If can't get price history, set to 0
            setPriceChange(0);
            setPriceChangePercent(0);
          }
        }

        // Get current price immediately
        // Set the global ticker to ensure we get the right price
        await fetch(`http://localhost:5001/stock-info?ticker=${tickerState}`);
        const priceResponse = await fetch(`http://localhost:5001/stock-price`);
        const priceData = await priceResponse.json();

        if (priceData.success) {
          setStockPrice(priceData.currentPrice);
        }
      } catch (error) {
        console.error("Error fetching stock info:", error);
      } finally {
        // Set loading to false for just the price section
        setIsLoading(false);
      }
    };

    fetchStockInfo();
  }, [tickerState]);

  useEffect(() => {
    const fetchPriceHistory = async (retryCount = 0) => {
      // If already have prediction data for this ticker, don't reload it
      if (predictionImage && currentTicker === ticker) {
        console.log("Using cached prediction data for ticker:", ticker);
        setIsLoadingGraph(false);
        return;
      }

      setIsLoadingGraph(true);

      try {
        console.log(`Starting analysis for ticker: ${tickerState}`);

        // Making the request to run LSTM
        const analysisResponse = await fetch("http://localhost:5001/run-lstm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ticker: tickerState,
          }),
        });

        const analysisData = await analysisResponse.json();
        console.log("Analysis response:", analysisData);

        if (!analysisData.success) {
          throw new Error(analysisData.error || "Analysis failed");
        }

        // Fetch prediction immediately after analysis is complete
        const predictionResponse = await fetch(
          `http://localhost:5001/get-prediction?ticker=${tickerState}`
        );
        const predictionData = await predictionResponse.json();

        console.log("Prediction response:", predictionData);

        if (!predictionData.success) {
          throw new Error("Failed to load prediction plot");
        }

        setPredictionImage(predictionData.image);
        setTestData(predictionData.test_data);
        // Store the current ticker in context
        setCurrentTicker(ticker);

        // Save prediction data if available
        if (predictionData.prediction_data) {
          setPredictionData(predictionData.prediction_data);
          console.log(
            "Updated prediction data:",
            predictionData.prediction_data
          );
        }

        // Add analysis notification when a stock has been analyzed
        addAnalysisNotification(tickerState);

        // After successful analysis, add to history
        if (tickerState) {
          console.log(
            `Analysis completed for ${tickerState}, adding to history`
          );
          addToAnalysisHistory(tickerState);
        }
      } catch (error) {
        console.error("Error in fetchPriceHistory:", error);
        const errorMessage =
          error instanceof Error ? error.message : "An unknown error occurred";

        // Automatically retry once for encoding errors
        if (errorMessage.includes("charmap") && retryCount < 1) {
          console.log("Encoding error detected, retrying...");
          setTimeout(() => fetchPriceHistory(retryCount + 1), 1000);
          return;
        }

        setError(errorMessage);
      } finally {
        setIsLoadingGraph(false);
      }
    };

    fetchPriceHistory();
  }, [
    tickerState,
    predictionImage,
    currentTicker,
    setPredictionImage,
    setTestData,
    setCurrentTicker,
    ticker,
  ]);

  useEffect(() => {
    const fetchTechnicalFundamental = async () => {
      try {
        setIsLoading(true);
        // Pass the ticker as a query parameter
        const response = await fetch(
          `http://localhost:5001/get-technical-fundamental?ticker=${tickerState}`
        );
        const data = await response.json();

        if (data.success) {
          console.log("Technical data received:", data.technical);
          console.log("Fundamental data received:", data.fundamental);
          setTechnicalIndicators(data.technical);
          setFundamentalData(data.fundamental);
        } else {
          console.error("API returned error:", data.error || "Unknown error");
        }
      } catch (error) {
        console.error("Error fetching technical/fundamental data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (tickerState) {
      fetchTechnicalFundamental();
    }
  }, [tickerState]);

  useEffect(() => {
    const fetchSentimentData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `http://localhost:5001/get-sentiment?ticker=${tickerState}`
        );
        const data = await response.json();

        if (data.success) {
          console.log("Sentiment data received:", data);

          // Format the data for our chart
          const formattedData = [data.current];

          setSentimentData(formattedData);
        } else {
          console.error("API returned error:", data.error || "Unknown error");
        }
      } catch (error) {
        console.error("Error fetching sentiment data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (tickerState) {
      fetchSentimentData();
    }
  }, [tickerState]);

  // Add this useEffect to fetch stock price data
  useEffect(() => {
    const fetchStockPriceData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `http://localhost:5001/stock-price-data?ticker=${tickerState}&timeframe=${selectedTimeframe}`
        );

        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setStockPriceData(data.priceData || []);
        } else {
          console.error("Failed to fetch stock price data:", data.error);
          // Show a more user-friendly error
          setError(data.error || "Could not load price data");
        }
      } catch (error) {
        console.error("Error fetching stock price data:", error);
        setError(
          error instanceof Error ? error.message : "Failed to load price data"
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (tickerState) {
      fetchStockPriceData();
    }
  }, [tickerState, selectedTimeframe]);

  // Add this useEffect for fetching news
  useEffect(() => {
    const fetchNews = async () => {
      if (!tickerState) return;

      setIsLoadingNews(true);
      // Clear any previous errors
      setError(null);

      try {
        const response = await fetch(
          `http://localhost:5001/api/stock-news?ticker=${tickerState}`
        );

        if (!response.ok) {
          throw new Error(`News API returned status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setNewsData(data.news || []);
        } else {
          console.error("Failed to fetch news:", data.error);
          // Don't show error to user as news is not critical
        }
      } catch (error) {
        console.error("Error fetching news:", error);
        // Don't show error to user as news is not critical
      } finally {
        setIsLoadingNews(false);
      }
    };

    fetchNews();
  }, [tickerState]);

  // useEffect to fetch sentiment adjusted price
  const fetchSentimentAdjustedPrice = async () => {
    // If already have the sentiment adjusted price for this ticker, don't re-fetch it
    if (
      predictionData.sentiment_adjusted_price &&
      predictionData.ticker === tickerState &&
      !isLoadingSentiment
    ) {
      console.log("Using cached sentiment adjusted price");
      return;
    }

    try {
      // Change this line to use the specific sentiment loading state
      setIsLoadingSentiment(true);
      const response = await fetch(
        `http://localhost:5001/get-sentiment-adjusted-price?ticker=${tickerState}`
      );
      const data = await response.json();

      if (data.success) {
        console.log("Sentiment adjusted price received:", data);

        // Update the prediction data with sentiment adjusted price and cache the ticker
        setPredictionData((prevData) => ({
          ...prevData,
          sentiment_adjusted_price: data.adjusted_price,
          ticker: tickerState, // Store the ticker we fetched this for
          last_updated: Date.now(), // Add timestamp for cache invalidation
        }));
      } else {
        console.error("API returned error:", data.error || "Unknown error");

        // Create a fallback price based on the current prediction data (1% above LSTM price)
        const fallbackPrice = predictionData.next_day_price
          ? predictionData.next_day_price * 1.01
          : stockPrice
          ? stockPrice * 1.01
          : 0;

        setPredictionData((prevData) => ({
          ...prevData,
          sentiment_adjusted_price: fallbackPrice,
          ticker: tickerState, // Store the ticker we fetched this for
          is_fallback_sentiment: true,
          last_updated: Date.now(), // Add timestamp for cache invalidation
        }));
      }
    } catch (error) {
      console.error("Error fetching sentiment adjusted price:", error);

      // Set a fallback price even after exception - use current stock price if available
      const fallbackPrice = predictionData.next_day_price
        ? predictionData.next_day_price * 1.01
        : stockPrice
        ? stockPrice * 1.01
        : 0;

      setPredictionData((prevData) => ({
        ...prevData,
        sentiment_adjusted_price: fallbackPrice,
        ticker: tickerState, // Store the ticker we fetched this for
        is_fallback_sentiment: true,
        last_updated: Date.now(), // Add timestamp for cache invalidation
      }));
    } finally {
      // NOTE: Change this line to use the specific sentiment loading state
      setIsLoadingSentiment(false);
    }
  };

  useEffect(() => {
    // Only fetch sentiment adjusted price if:
    // 1. We have a ticker
    // 2. We have prediction data with next_day_price
    // 3. The cached ticker doesn't match the current ticker, or we don't have a cached sentiment price
    if (
      tickerState &&
      predictionData.next_day_price &&
      (predictionData.ticker !== tickerState ||
        !predictionData.sentiment_adjusted_price)
    ) {
      fetchSentimentAdjustedPrice();
    }
  }, [tickerState, predictionData.next_day_price]);

  // useEffect to handle cache invalidation - refresh data after 30 minutes
  useEffect(() => {
    const CACHE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    if (
      predictionData.last_updated &&
      predictionData.ticker === tickerState &&
      Date.now() - predictionData.last_updated > CACHE_TIMEOUT
    ) {
      console.log("Cache expired, refreshing sentiment adjusted price");
      fetchSentimentAdjustedPrice();
    }
  }, []);

  // Add a memory leak prevention for cleanup
  useEffect(() => {
    // Cleanup function to prevent memory leaks
    return () => {
      // Cancel any pending async tasks or timers here if needed
    };
  }, []);

  const mockData = Array.from({ length: 30 }, (_, i) => ({
    date: `2024-${String(i + 1).padStart(2, "0")}-01`,
    price: Math.random() * 50 + 150,
    volume: Math.floor(Math.random() * 1000000),
  }));

  // Handle bookmark toggle
  const handleBookmarkToggle = () => {
    if (isInWatchlist(tickerState)) {
      removeFromWatchlist(tickerState);
    } else {
      addToWatchlist(tickerState);
    }
  };

  // useEffect to update the document title with the current ticker
  useEffect(() => {
    document.title = `${tickerState} - Stock Analysis`;
  }, [tickerState]);

  // Add this near the top of the component
  useEffect(() => {
    console.log("Current ticker value:", ticker);
    console.log(
      "URL params:",
      new URLSearchParams(window.location.search).toString()
    );
    console.log("localStorage ticker:", localStorage.getItem("currentTicker"));
  }, [ticker]);

  return (
    <ProtectedAnalysis>
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#111827] text-white flex">
        <div className="flex-1">
          <Header />
          <main className="container mx-auto px-6 py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <h1 className="text-3xl font-bold">{tickerState}</h1>
                    <span className="text-gray-400">{stockName}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleBookmarkToggle}
                        className={`p-2 rounded-full bg-white/5 hover:bg-white/10 ${
                          isInWatchlist(tickerState) ? "text-emerald-500" : ""
                        }`}
                      >
                        <Bookmark className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold">
                      ${stockPrice?.toFixed(2) || "0.00"}
                    </span>
                    <span className="flex items-center">
                      {priceChange > 0 ? (
                        <span className="flex items-center gap-1 text-green-500">
                          <TrendingUp className="w-4 h-4" />
                          +${Math.abs(priceChange).toFixed(2)} (
                          {priceChangePercent.toFixed(2)}%)
                        </span>
                      ) : priceChange < 0 ? (
                        <span className="flex items-center gap-1 text-red-500">
                          <TrendingDown className="w-4 h-4" />
                          -${Math.abs(priceChange).toFixed(2)} (
                          {Math.abs(priceChangePercent).toFixed(2)}%)
                        </span>
                      ) : (
                        <span className="text-gray-400">$0.00 (0.00%)</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex mt-8 h-[600px] bg-white/5 rounded-xl">
                <div className="flex-1 p-6">
                  <Tabs defaultValue="history" className="h-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="history" className="text-black">
                        Price History
                      </TabsTrigger>
                      <TabsTrigger value="prediction" className="text-black">
                        Prediction
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="history"
                      className="h-[calc(100%-40px)]"
                    >
                      <div className="mb-4 flex gap-2">
                        {["1D", "1W", "1M", "3M", "1Y", "ALL"].map((tf) => (
                          <button
                            key={tf}
                            onClick={() => setSelectedTimeframe(tf)}
                            className={`px-3 py-1 rounded ${
                              selectedTimeframe === tf
                                ? "bg-emerald-500"
                                : "bg-white/5"
                            }`}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                      {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                        </div>
                      ) : (
                        <div className="h-[calc(100%-40px)]">
                          <StockPriceChart
                            data={stockPriceData}
                            timeframe={selectedTimeframe}
                          />
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="prediction" className="h-full">
                      {isLoadingGraph ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                          <p className="text-gray-400">
                            Generating AI prediction...
                          </p>
                        </div>
                      ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                          <AlertTriangle className="w-8 h-8 text-red-500" />
                          <p className="text-red-400">{error}</p>
                          <button
                            onClick={() => {
                              setError(null);
                              setIsLoadingGraph(true);
                              // Retry prediction
                              fetch(
                                `http://localhost:5001/get-prediction?ticker=${tickerState}`
                              )
                                .then((res) => res.json())
                                .then((data) => {
                                  if (data.success) {
                                    setPredictionImage(data.image);
                                    setStockPrice(data.current_price);
                                  } else {
                                    throw new Error(
                                      data.error || "Failed to load prediction"
                                    );
                                  }
                                })
                                .catch((err) => setError(err.message))
                                .finally(() => setIsLoadingGraph(false));
                            }}
                            className="px-4 py-2 bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-colors"
                          >
                            Retry
                          </button>
                        </div>
                      ) : testData.length > 0 ? (
                        <StockPredictionChart data={testData} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          No prediction data available
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
                <Chatbot currentTicker={tickerState} />
              </div>
            </motion.div>

            <Tabs defaultValue="prediction" className="space-y-8">
              <TabsList className="grid grid-cols-5 gap-2 bg-transparent">
                {[
                  {
                    value: "prediction",
                    icon: <Brain className="w-4 h-4" />,
                    label: "AI Prediction",
                  },
                  {
                    value: "technical",
                    icon: <LineChart className="w-4 h-4" />,
                    label: "Technical",
                  },
                  {
                    value: "fundamental",
                    icon: <DollarSign className="w-4 h-4" />,
                    label: "Fundamental",
                  },
                  {
                    value: "sentiment",
                    icon: <MessageSquare className="w-4 h-4" />,
                    label: "Sentiment",
                  },
                  {
                    value: "News",
                    icon: <Activity className="w-4 h-4" />,
                    label: "News",
                  },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex items-center gap-2 p-4 bg-white/5 hover:bg-white/10 data-[state=active]:bg-emerald-500"
                  >
                    {tab.icon}
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="prediction">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    {
                      title: "LSTM Prediction",
                      value: `$${
                        predictionData.next_day_price?.toFixed(2) || "0.00"
                      }`,
                      subtext:
                        predictionData.price_change_text || "0.00% Change",
                    },
                    {
                      title: "Sentiment Adjusted Prediction",
                      value: isLoadingSentiment
                        ? "Loading..."
                        : `$${
                            predictionData.sentiment_adjusted_price?.toFixed(
                              2
                            ) || "0.00"
                          }`,
                      subtext: isLoadingSentiment
                        ? "Analyzing market sentiment..."
                        : predictionData.is_fallback_sentiment
                        ? "Using estimated sentiment value"
                        : predictionData.sentiment_adjusted_price &&
                          predictionData.next_day_price
                        ? `${(
                            ((predictionData.sentiment_adjusted_price -
                              (predictionData.next_day_price || 0)) /
                              (predictionData.next_day_price || 1)) *
                            100
                          ).toFixed(2)}% ${
                            predictionData.sentiment_adjusted_price >
                            (predictionData.next_day_price || 0)
                              ? "higher"
                              : "lower"
                          } than LSTM`
                        : "Awaiting sentiment analysis",
                    },
                    {
                      title: "Risk Level",
                      value: predictionData.risk_level || "Medium",
                      subtext:
                        predictionData.risk_description ||
                        "Moderate Volatility",
                    },
                  ].map((metric, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <Card className="bg-white/5 border-gray-800">
                        <CardHeader>
                          <CardTitle className="text-gray-200">
                            {metric.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-emerald-400">
                            {metric.value}
                          </div>
                          <div className="text-sm text-gray-200">
                            {metric.subtext}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="technical">
                <div className="grid grid-cols-2 gap-6">
                  <Card className="bg-white/5 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Technical Indicators
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-white">RSI (14)</span>
                          <span
                            className={`font-bold ${
                              technicalIndicators.rsi > 70
                                ? "text-red-500"
                                : technicalIndicators.rsi < 30
                                ? "text-green-500"
                                : "text-gray-200"
                            }`}
                          >
                            {technicalIndicators.rsi}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white">MACD</span>
                          <span
                            className={`font-bold ${
                              technicalIndicators.macd > 0
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          >
                            {technicalIndicators.macd}
                          </span>
                        </div>
                        <div>
                          <span className="block mb-2 text-white">
                            Bollinger Bands
                          </span>
                          <div className="space-y-2 pl-4">
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-200">
                                Upper
                              </span>
                              <span className="font-bold text-white">
                                ${technicalIndicators.bollinger.upper}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-200">
                                Middle
                              </span>
                              <span className="font-bold text-white">
                                ${technicalIndicators.bollinger.middle}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-200">
                                Lower
                              </span>
                              <span className="font-bold text-white">
                                ${technicalIndicators.bollinger.lower}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/5 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Volume Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer>
                        <BarChart data={mockData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#374151"
                          />
                          <XAxis dataKey="date" stroke="#FFFFFF" />
                          <YAxis stroke="#FFFFFF" />
                          <Tooltip
                            contentStyle={{
                              background: "#1F2937",
                              border: "none",
                              color: "#FFFFFF",
                            }}
                          />
                          <Bar dataKey="volume" fill="#10B981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="fundamental">
                <div className="grid grid-cols-3 gap-6">
                  <Card className="bg-white/5 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Valuation Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-white">P/E Ratio</span>
                          <span className="font-bold text-white">
                            {fundamentalData.peRatio}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white">P/B Ratio</span>
                          <span className="font-bold text-white">
                            {fundamentalData.pbRatio}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/5 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Liquidity Ratios
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-white">Quick Ratio</span>
                          <span className="font-bold text-white">
                            {fundamentalData.quickRatio}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white">Current Ratio</span>
                          <span className="font-bold text-white">
                            {fundamentalData.currentRatio}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/5 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Profitability
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-white">ROE</span>
                          <span className="font-bold text-white">
                            {(fundamentalData.returnOnEquity * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white">ROA</span>
                          <span className="font-bold text-white">
                            {(fundamentalData.returnOnAssets * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="sentiment">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="bg-white/5 border-gray-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <BarChartIcon className="w-5 h-5" /> Sentiment
                        Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer>
                        <ComposedChart data={sentimentData}>
                          <XAxis dataKey="period" stroke="#FFFFFF" />
                          <YAxis stroke="#FFFFFF" />
                          <Tooltip
                            contentStyle={{
                              background: "#1F2937",
                              border: "none",
                              color: "white",
                            }}
                          />
                          <Bar
                            dataKey="positive"
                            fill="#10B981"
                            stackId="sentiment"
                          />
                          <Bar
                            dataKey="neutral"
                            fill="#6B7280"
                            stackId="sentiment"
                          />
                          <Bar
                            dataKey="negative"
                            fill="#EF4444"
                            stackId="sentiment"
                          />
                          <Line
                            type="monotone"
                            dataKey="averageSentiment"
                            stroke="#FBBF24"
                            strokeWidth={2}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="bg-white/5 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Sentiment Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {sentimentData.map((data, index) => (
                          <div
                            key={index}
                            className="bg-white/10 p-4 rounded-lg"
                          >
                            <div className="flex justify-between mb-2">
                              <span className="font-medium text-white">
                                {data.period}
                              </span>
                              <span className="text-emerald-400">
                                {(data.averageSentiment * 100).toFixed(1)}%
                                Positive
                              </span>
                            </div>
                            <div className="flex space-x-4">
                              <div className="flex-1">
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-white">Positive</span>
                                  <span className="text-green-500">
                                    {data.positive}%
                                  </span>
                                </div>
                                <div className="h-2 bg-green-500/30 rounded-full">
                                  <div
                                    className="h-full bg-green-500 rounded-full"
                                    style={{ width: `${data.positive}%` }}
                                  />
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-white">Negative</span>
                                  <span className="text-red-500">
                                    {data.negative}%
                                  </span>
                                </div>
                                <div className="h-2 bg-red-500/30 rounded-full">
                                  <div
                                    className="h-full bg-red-500 rounded-full"
                                    style={{ width: `${data.negative}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-gray-200">
                              Total Mentions: {data.totalMentions}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="News">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-6">
                    {isLoadingNews ? (
                      <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                      </div>
                    ) : newsData.length === 0 ? (
                      <Card className="bg-white/5 border-gray-800">
                        <CardContent className="p-4">
                          <div className="text-center text-white">
                            No recent news available for {tickerState}
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      newsData.map((news, i) => (
                        <Card
                          key={i}
                          className={`bg-white/5 border-gray-800 hover:bg-white/10 transition-colors ${
                            news.sentiment === "positive"
                              ? "border-l-4 border-green-500"
                              : news.sentiment === "negative"
                              ? "border-l-4 border-red-500"
                              : "border-l-4 border-gray-500"
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-1">
                                <h4 className="font-medium text-lg mb-1 flex justify-between items-start text-white">
                                  {news.title || "Untitled"}
                                  {news.url && (
                                    <a
                                      href={news.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-400 hover:text-emerald-300"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                  )}
                                </h4>
                                <p className="text-gray-200 mb-2">
                                  {news.summary || "No summary available"}
                                </p>
                                <div className="flex items-center justify-between text-sm text-gray-300">
                                  <div className="flex items-center gap-2">
                                    <span>{news.source}</span>
                                    <span>•</span>
                                    <span>{news.time}</span>
                                  </div>
                                  <div
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      news.impact === "High"
                                        ? "bg-red-500/20 text-red-400"
                                        : news.impact === "Medium"
                                        ? "bg-yellow-500/20 text-yellow-400"
                                        : "bg-green-500/20 text-green-400"
                                    }`}
                                  >
                                    {news.impact} Impact
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>

                  <Card className="bg-white/5 border-gray-800">
                    <CardHeader>
                      <CardTitle className="text-white">News Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-white">Total News Items</span>
                          <span className="font-bold text-white">
                            {newsData.length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white">Positive News</span>
                          <span className="text-green-500 font-bold">
                            {
                              newsData.filter((n) => n.sentiment === "positive")
                                .length
                            }
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white">Negative News</span>
                          <span className="text-red-500 font-bold">
                            {
                              newsData.filter((n) => n.sentiment === "negative")
                                .length
                            }
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white">High Impact News</span>
                          <span className="text-red-400 font-bold">
                            {newsData.filter((n) => n.impact === "High").length}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </ProtectedAnalysis>
  );
};

export default AnalysisDashboard;
