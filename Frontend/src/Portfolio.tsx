import { useState, useEffect } from "react";
import Header from "./components/Header";
import { useNavigate } from "react-router-dom";
import { authService } from "./authService";

import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import Modal from "react-modal";
import { motion } from "framer-motion";

Modal.setAppElement("#root");

interface Stock {
  ticker: string;
  quantity: number;
  currentPrice: number;
  priceBought: number;
  date: Date;
  profit?: number; // Added profit field
}

const Portfolio = () => {
  const [portfolio, setPortfolio] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock[] | null>(null);
  const [profitLoss, setProfitLoss] = useState<number | null>(null);
  const [unrealisedProfit, setUnrealisedProfit] = useState<number | null>(null);
  const [realisedProfit, setRealisedProfit] = useState<number | null>(null);
  const [profitLossPercentage, setProfitLossPercentage] = useState<
    number | null
  >(null);
  const [stockProfits, setStockProfits] = useState<{ [key: string]: number }>(
    {}
  );
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the authenticated user ID and token
  const userId = authService.getUserId();
  const authToken = authService.getToken();

  useEffect(() => {
    // Check if user is logged in
    if (!userId || !authToken) {
      navigate("/");
      return;
    }

    // Fetch portfolio data
    fetch(`http://localhost:5001/portfolio?user_id=${userId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch portfolio: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.success && data.stocks) {
          setPortfolio(data.stocks);

          // After getting portfolio data, fetch profit for each stock
          data.stocks.forEach((stock: Stock) => {
            fetchStockProfit(stock.ticker);
          });
        } else {
          setPortfolio([]);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching portfolio:", error);
        setError("Failed to load portfolio data");
        setLoading(false);
      });

    // Fetch overall Profit/Loss
    fetch("http://localhost:5001/profit-or-loss", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ user_id: userId }),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch profit/loss: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setProfitLoss(data.total_profit_loss);
          setUnrealisedProfit(data.unrealized_profit);
          setRealisedProfit(data.realized_profit);
          setProfitLossPercentage(data.profit_loss_percentage);
        }
      })
      .catch((error) => {
        console.error("Error fetching profit/loss:", error);
        setError("Failed to load profit/loss data");
      });
  }, [userId, authToken, navigate]);

  // Function to fetch profit for a specific stock
  const fetchStockProfit = (ticker: string) => {
    if (!userId || !authToken) return;

    fetch(
      `http://localhost:5001/stock-profit?user_id=${userId}&ticker=${ticker}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch stock profit: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setStockProfits((prevProfits) => ({
            ...prevProfits,
            [ticker]: data.profit,
          }));
        }
      })
      .catch((error) =>
        console.error(`Error fetching profit for ${ticker}:`, error)
      );
  };

  const openModal = (ticker: string) => {
    if (!userId || !authToken) return;

    fetch(
      `http://localhost:5001/individual-stock?user_id=${userId}&ticker=${ticker}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch stock details: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setSelectedStock(data.stocks);
        } else {
          setSelectedStock([]);
        }
        setModalIsOpen(true);
      })
      .catch((error) => {
        console.error("Error fetching individual stocks:", error);
        setError("Failed to load stock details");
      });
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setSelectedStock(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#111827] text-white flex flex-col">
      {/* Top Navigation Bar */}
      <Header />

      {/* Portfolio Content */}
      <main className="flex-1 px-6 py-10 relative">
        <h1 className="text-3xl font-bold text-center mb-6">Your Portfolio</h1>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 p-4 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-400">Loading portfolio...</p>
        ) : portfolio.length === 0 ? (
          <p className="text-center text-gray-400">No stocks bought yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {portfolio.map((stock, index) => {
              const stockProfit = stockProfits[stock.ticker] || 0;
              const isProfitable = stockProfit > 0;

              return (
                <motion.div
                  key={index}
                  className="bg-gray-900 p-5 rounded-2xl shadow-lg cursor-pointer"
                  onClick={() => openModal(stock.ticker)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.09 }}
                  transition={{
                    duration: 0.3,
                    delay: index * 0.05,
                  }}
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">{stock.ticker}</h2>
                    {isProfitable ? (
                      <TrendingUp className="text-green-400 w-6 h-6" />
                    ) : (
                      <TrendingDown className="text-red-400 w-6 h-6" />
                    )}
                  </div>

                  <div className="flex justify-between items-start mt-4">
                    <div>
                      <p className="text-gray-400">
                        Quantity:{" "}
                        <span className="text-white font-medium">
                          {stock.quantity}
                        </span>
                      </p>
                      <div className="flex items-center mt-2">
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
                        {isProfitable ? "Profit" : "Loss"}
                      </p>
                      <p className="text-lg font-bold">
                        ${Math.abs(stockProfit).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Profit/Loss Display */}
        {profitLoss !== null && (
          <motion.div
            className={`fixed top-20 right-10 p-6 rounded-lg shadow-lg text-white text-xl font-bold ${
              profitLoss >= 0 ? "bg-green-600" : "bg-red-600"
            }`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            onMouseEnter={() => setIsHovered(true)} // On hover, show detailed info
            onMouseLeave={() => setIsHovered(false)} // On mouse leave, show only total profit/loss
          >
            {profitLoss >= 0 ? "📈 Profit" : "📉 Loss"}: $
            {Math.abs(profitLoss).toFixed(2)}
            <span className="ml-2 text-sm">
              ({profitLossPercentage?.toFixed(2)}%)
            </span>
            {/* Show unrealized and realized profit when hovered */}
            {isHovered && (
              <div className="mt-4 text-sm">
                <p>
                  Unrealized Profit / Loss: $
                  {(unrealisedProfit || 0).toFixed(2)}
                </p>
                <p>
                  Realized Profit / Loss: ${(realisedProfit || 0).toFixed(2)}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Modal for Stock Details */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Stock Details Modal"
        className="bg-[#111827] rounded-xl p-8 w-full max-w-4xl min-h-[30vh] relative shadow-lg"
        overlayClassName="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50"
      >
        <button
          onClick={closeModal}
          className="absolute right-6 top-6 text-gray-400 hover:text-white text-2xl"
        >
          ✕
        </button>
        <h2 className="text-2xl font-bold mb-6 text-emerald-400">
          {selectedStock && selectedStock.length > 0
            ? selectedStock[0].ticker
            : "Stock Details"}
        </h2>

        {selectedStock && selectedStock.length > 0 ? (
          <div className="overflow-y-auto max-h-[50vh]">
            <table className="w-full text-left table-auto mb-6">
              <thead>
                <tr>
                  <th className="px-6 py-3 border-b text-lg font-semibold text-gray-300">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 border-b text-lg font-semibold text-gray-300">
                    Purchase Price
                  </th>
                  <th className="px-6 py-3 border-b text-lg font-semibold text-gray-300">
                    Current Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedStock.map((stock, index) => {
                  return (
                    <tr key={index} className="border-b border-gray-700">
                      <td className="px-6 py-4 text-gray-300">
                        {new Date(stock.date).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-red-400">
                        ${stock.priceBought.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-green-400">
                        ${stock.currentPrice.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-300">
            No details available for this stock.
          </p>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() =>
              selectedStock && selectedStock.length > 0
                ? navigate(`/trade/${selectedStock[0].ticker}`)
                : null
            }
            className="bg-red-500 text-white py-3 px-8 rounded-lg hover:bg-red-600 transition-colors mr-4"
            disabled={
              !selectedStock ||
              selectedStock.length === 0 ||
              selectedStock[0].quantity <= 0
            }
          >
            Buy / Sell
          </button>
          <button
            onClick={closeModal}
            className="bg-emerald-500 text-white py-3 px-8 rounded-lg hover:bg-emerald-600 transition-colors"
          >
            Close
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default Portfolio;
