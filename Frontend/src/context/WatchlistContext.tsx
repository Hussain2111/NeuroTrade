import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface WatchlistContextType {
  watchlist: string[];
  addToWatchlist: (ticker: string) => Promise<void>;
  removeFromWatchlist: (ticker: string) => Promise<void>;
  isInWatchlist: (ticker: string) => boolean;
  loading: boolean;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(
  undefined
);

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error("useWatchlist must be used within a WatchlistProvider");
  }
  return context;
};

interface WatchlistProviderProps {
  children: ReactNode;
}

export const WatchlistProvider: React.FC<WatchlistProviderProps> = ({
  children,
}) => {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load watchlist from database on component mount
  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        // Check for user authentication status first
        const userResponse = await fetch(
          "http://localhost:5001/api/user/current",
          {
            credentials: "include", // Important for sending cookies
          }
        );

        if (!userResponse.ok) {
          // If not authenticated, fall back to localStorage
          const savedWatchlist = localStorage.getItem("watchlist");
          if (savedWatchlist) {
            setWatchlist(JSON.parse(savedWatchlist));
          }
          setLoading(false);
          return;
        }

        // User is authenticated, fetch watchlist from database
        const response = await fetch("http://localhost:5001/api/watchlist", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setWatchlist(data.watchlist || []);
        } else {
          // If API fails, fall back to localStorage
          const savedWatchlist = localStorage.getItem("watchlist");
          if (savedWatchlist) {
            setWatchlist(JSON.parse(savedWatchlist));
          }
        }
      } catch (error) {
        console.error("Error fetching watchlist:", error);
        // Fall back to localStorage on error
        const savedWatchlist = localStorage.getItem("watchlist");
        if (savedWatchlist) {
          setWatchlist(JSON.parse(savedWatchlist));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
  }, []);

  // Save to both database and localStorage
  const addToWatchlist = async (ticker: string) => {
    if (!watchlist.includes(ticker)) {
      try {
        const response = await fetch(
          "http://localhost:5001/api/watchlist/add",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ ticker }),
          }
        );

        if (response.ok) {
          // Update local state
          const newWatchlist = [...watchlist, ticker];
          setWatchlist(newWatchlist);
          // Also save to localStorage as fallback
          localStorage.setItem("watchlist", JSON.stringify(newWatchlist));
        } else {
          console.error("Failed to add ticker to watchlist in database");
          // Still update localStorage for offline usage
          const newWatchlist = [...watchlist, ticker];
          setWatchlist(newWatchlist);
          localStorage.setItem("watchlist", JSON.stringify(newWatchlist));
        }
      } catch (error) {
        console.error("Error adding to watchlist:", error);
        // Still update localStorage for offline usage
        const newWatchlist = [...watchlist, ticker];
        setWatchlist(newWatchlist);
        localStorage.setItem("watchlist", JSON.stringify(newWatchlist));
      }
    }
  };

  const removeFromWatchlist = async (ticker: string) => {
    try {
      const response = await fetch(
        "http://localhost:5001/api/watchlist/remove",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ ticker }),
        }
      );

      // Update local state regardless of API response
      const newWatchlist = watchlist.filter((item) => item !== ticker);
      setWatchlist(newWatchlist);
      localStorage.setItem("watchlist", JSON.stringify(newWatchlist));

      if (!response.ok) {
        console.error("Failed to remove ticker from watchlist in database");
      }
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      // Still update local state
      const newWatchlist = watchlist.filter((item) => item !== ticker);
      setWatchlist(newWatchlist);
      localStorage.setItem("watchlist", JSON.stringify(newWatchlist));
    }
  };

  const isInWatchlist = (ticker: string) => {
    return watchlist.includes(ticker);
  };

  return (
    <WatchlistContext.Provider
      value={{
        watchlist,
        addToWatchlist,
        removeFromWatchlist,
        isInWatchlist,
        loading,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};
