import { useState, useEffect } from "react";
import {
  Search,
  TrendingUp,
  Brain,
  LineChart,
  ArrowRight,
  ChevronDown,
  Loader2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import logo from "./components/logo.jpg";
import { usePrediction } from "./components/context/PredictionContext";
import { authService } from "./authService";
import AuthModal from "./AuthModal";

interface Stock {
  symbol: string;
  name: string;
  change: string;
  price: string;
  isLoading?: boolean;
}

interface Step {
  title: string;
  description: string;
  icon: JSX.Element;
}

interface FAQ {
  question: string;
  answer: string;
}

interface Stat {
  value: string;
  label: string;
}

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [trendingStocks, setTrendingStocks] = useState<Stock[]>([
    { symbol: "NVDA", name: "NVIDIA", change: "", price: "", isLoading: true },
    { symbol: "AAPL", name: "Apple", change: "", price: "", isLoading: true },
    {
      symbol: "MSFT",
      name: "Microsoft",
      change: "",
      price: "",
      isLoading: true,
    },
    { symbol: "META", name: "Meta", change: "", price: "", isLoading: true },
  ]);

  // Add this new state near the other state declarations
  const [showDemoModal, setShowDemoModal] = useState(false);

  const navigate = useNavigate();
  const { currentTicker } = usePrediction();

  useEffect(() => {
    // Check if there's a valid token in localStorage
    const token = localStorage.getItem("authToken");
    if (token) {
      // If token exists, user is logged in
      setIsLoggedIn(true);
    }
  }, []);

  // Handle logout
  const handleLogout = () => {
    // Clear authentication data from localStorage
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");

    // Update logged in state
    setIsLoggedIn(false);
  };

  // Fetch stock data from Yahoo Finance
  const fetchStockData = async () => {
    try {
      const stockSymbols = trendingStocks
        .map((stock) => stock.symbol)
        .join(",");
      const response = await fetch(
        `http://localhost:5001/api/stocks?symbols=${stockSymbols}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch stock data");
      }

      const data = await response.json();

      if (data && data.stocks) {
        const updatedStocks = trendingStocks.map((stock) => {
          const stockData = data.stocks.find(
            (s: any) => s.symbol === stock.symbol
          );
          if (stockData) {
            const priceValue = parseFloat(stockData.regularMarketPrice);
            const changePercent = parseFloat(
              stockData.regularMarketChangePercent
            );

            return {
              ...stock,
              price: `$${priceValue.toFixed(2)}`,
              change: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(
                2
              )}%`,
              isLoading: false,
            };
          }
          return stock;
        });

        setTrendingStocks(updatedStocks);
      }
    } catch (error) {
      console.error("Error fetching stock data:", error);
      // Set isLoading to false even on error to show placeholder data
      setTrendingStocks((prevStocks) =>
        prevStocks.map((stock) => ({ ...stock, isLoading: false }))
      );
    }
  };

  // Fetch stock data when component mounts
  useEffect(() => {
    fetchStockData();
    // Refresh stock data every 5 minutes (300000 ms)
    const intervalId = setInterval(fetchStockData, 300000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const handleAnalysis = async (ticker: string) => {
    if (ticker) {
      try {
        console.log("Home page - Setting ticker:", ticker);
        // Store the ticker in localStorage before navigation
        localStorage.setItem("currentTicker", ticker);

        // Navigate to analysis page
        window.location.href = `/analysis?ticker=${encodeURIComponent(ticker)}`;

        // Note: The code below won't execute immediately due to the page navigation above
        // Only run LSTM if we don't have predictions for this ticker
        if (currentTicker !== ticker) {
          // This code will likely not run due to the page navigation above
          const response = await fetch("http://localhost:5001/run-lstm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ticker }),
          });

          const data = await response.json();
          if (!data.success) {
            console.error("LSTM analysis failed:", data.error);
          }
        }
      } catch (error) {
        console.error("Error during LSTM analysis:", error);
      }
    } else {
      console.error("Ticker is empty");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery) {
      console.log("Submitting search for:", searchQuery);
      handleAnalysis(searchQuery);
    }
  };

  const steps: Step[] = [
    {
      title: "Input Your Criteria",
      description: "Select stocks, timeframes, and analysis parameters",
      icon: <Search className="w-8 h-8" />,
    },
    {
      title: "AI Analysis",
      description: "Our models process market data and indicators in real-time",
      icon: <Brain className="w-8 h-8" />,
    },
    {
      title: "Get Insights",
      description: "Receive actionable predictions and confidence scores",
      icon: <LineChart className="w-8 h-8" />,
    },
  ];

  const stats: Stat[] = [
    { value: "$2.8T", label: "Assets Analyzed" },
    { value: "99.9%", label: "Uptime" },
    { value: "0.2s", label: "Average Response" },
  ];

  const features = [
    { icon: <Brain className="w-8 h-8" />, title: "AI Analysis" },
    { icon: <LineChart className="w-8 h-8" />, title: "Real-time Data" },
    { icon: <TrendingUp className="w-8 h-8" />, title: "Predictive Models" },
  ];

  const faqs: FAQ[] = [
    {
      question: "How accurate are the AI predictions?",
      answer:
        "Our AI model achieves 70-85% accuracy for short-term predictions, continuously improving through machine learning.",
    },
    {
      question: "What data sources do you use?",
      answer:
        "We aggregate data from market feeds, financial statements, news articles, and macroeconomic indicators.",
    },
    {
      question: "How often is the analysis updated?",
      answer:
        "Analysis updates in real-time during market hours, with daily reports after market close.",
    },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Ticker value:", searchQuery);
    handleAnalysis(searchQuery);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#111827] text-white">
      <AnimatePresence>
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        )}

        {showDemoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDemoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="relative w-full max-w-4xl bg-black rounded-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowDemoModal(false)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <iframe
                className="w-full aspect-video"
                src=""
                title="Demo Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-colors duration-300 ${
          scrolled
            ? "bg-black/20 backdrop-blur-sm border-b border-white/10"
            : ""
        }`}
      >
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <img src={logo} alt="Logo" className="h-20 w-26 w-auto" />
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <button
                onClick={handleLogout}
                className="px-4 py-2 border border-gray-700 rounded-lg font-medium hover:bg-white/5 transition-colors"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 bg-emerald-500 rounded-lg font-medium hover:bg-emerald-600 transition-colors"
              >
                Get Started
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center border-b border-gray-800 pt-20">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-blue-500">
              Market Intelligence,
              <br />
              Reimagined
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto">
              Advanced AI-powered analysis delivering institutional-grade market
              insights
            </p>

            <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-12">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter stock symbol (e.g., AAPL)"
                  className="w-full px-6 py-4 rounded-lg bg-black/20 border border-gray-700 focus:border-emerald-500 outline-none pl-12"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-emerald-500 rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                >
                  Analyze
                </button>
              </div>
            </form>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-8 py-4 bg-emerald-500 rounded-lg font-medium hover:bg-emerald-600 transition-colors"
              >
                Start Free Trial
              </button>
              <button
                onClick={() => setShowDemoModal(true)}
                className="px-8 py-4 border border-gray-700 rounded-lg font-medium hover:bg-white/5 transition-colors"
              >
                Watch Demo
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="p-6 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group cursor-pointer"
              >
                <div className="text-emerald-400 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 border-y border-gray-800">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-3xl font-bold text-center mb-16"
          >
            How It Works
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-12">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="relative"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 text-emerald-400">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-4">{step.title}</h3>
                  <p className="text-gray-400">{step.description}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-emerald-500/50 to-transparent" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Stocks Section */}
      <section className="py-20 border-b border-gray-800">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="flex items-center justify-center gap-3 mb-12"
          >
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            <h2 className="text-3xl font-bold">Trending Now</h2>
          </motion.div>
          <div className="grid md:grid-cols-4 gap-6">
            {trendingStocks.map((stock, i) => (
              <motion.div
                key={stock.symbol}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                onClick={() => handleAnalysis(stock.symbol)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold">{stock.symbol}</h3>
                    <p className="text-sm text-gray-400">{stock.name}</p>
                  </div>
                  {stock.isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  ) : (
                    <span
                      className={`${
                        parseFloat(stock.change) >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {stock.change}
                    </span>
                  )}
                </div>
                {stock.isLoading ? (
                  <div className="flex items-center">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    <span className="text-gray-400">Loading...</span>
                  </div>
                ) : (
                  <p className="text-2xl font-bold">{stock.price}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-3xl font-bold text-center mb-12"
          >
            Frequently Asked Questions
          </motion.h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-lg bg-white/5"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="w-full p-6 text-left flex justify-between items-center"
                >
                  <span className="font-medium">{faq.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform ${
                      activeFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {activeFaq === i && (
                  <div className="px-6 pb-6 text-gray-400">{faq.answer}</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
