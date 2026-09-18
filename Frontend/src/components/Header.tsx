import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "./logo.jpg";
import { Home } from "lucide-react";
import AuthModal from "./AuthModal";
import ProfileIcon from "./ProfileIcon";

const Header = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!localStorage.getItem("authToken");
  });

  return (
    <>
      <header className="border-b border-gray-800 bg-black/20 backdrop-blur-sm">
        <div className="w-full flex items-center justify-between">
          {/* Left side: Logo and Navigation */}
          <div className="flex items-center gap-4 pl-1">
            <Link to="/" className="flex-shrink-0">
              <img src={logo} alt="Logo" className="h-12 w-auto" />
            </Link>
            <nav className="hidden md:flex gap-6">
              <Link
                to="/analysis"
                className="text-white hover:text-emerald-500 transition-colors text-base font-medium"
              >
                Analysis
              </Link>
              <Link
                to="/portfolio"
                className="text-white hover:text-emerald-500 transition-colors text-base font-medium"
              >
                Portfolio
              </Link>
              <Link
                to="/watchlist"
                className="text-white hover:text-emerald-500 transition-colors text-base font-medium"
              >
                Watchlist
              </Link>
              <Link
                to="/trade"
                className="text-white hover:text-emerald-500 transition-colors text-base font-medium"
              >
                Trade
              </Link>
              <Link
                to="/settings"
                className="text-white hover:text-emerald-500 transition-colors text-base font-medium"
              >
                Settings
              </Link>
            </nav>
          </div>

          {/* Right side icons */}
          <div className="flex items-center gap-5 pr-10">
            <Link
              to="/"
              className="text-white hover:text-emerald-500 transition-colors"
              aria-label="Go to homepage"
            >
              <Home className="w-6 h-6" />
            </Link>
            <ProfileIcon />
          </div>
        </div>
      </header>

      {/* Conditionally render the AuthModal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => {
            setShowAuthModal(false);
            // Check if user is logged in after modal closes
            if (localStorage.getItem("authToken")) {
              setIsLoggedIn(true);
            }
          }}
        />
      )}
    </>
  );
};

export default Header;
