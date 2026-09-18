import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface Preferences {
    emailAlerts: boolean;
    pushNotifications: boolean;
    smsAlerts: boolean;
    darkMode: boolean;
    autoRefresh: boolean;
    defaultTimeframe: string;
    predictionHorizon: string;
  }

interface PreferencesProps {
    activeTab: string;
    preferences: Preferences;
    setPreferences: React.Dispatch<React.SetStateAction<Preferences>>;
}

const Security = ({activeTab, preferences, setPreferences}: PreferencesProps) => {
    const [browserInfo, setBrowserInfo] = useState("");
    const [currentDateTime, setCurrentDateTime] = useState("");
    const [ipAddress, setIpAddress] = useState("192.168.1.1"); // Default IP
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    
    const navigate = useNavigate();

    useEffect(() => {
        // Get browser information
        const userAgent = navigator.userAgent;
        let browserName = "Unknown Browser";
        let osName = "Unknown OS";
        
        // Detect browser
        if (userAgent.indexOf("Chrome") > -1) {
            browserName = "Chrome";
        } else if (userAgent.indexOf("Safari") > -1) {
            browserName = "Safari";
        } else if (userAgent.indexOf("Firefox") > -1) {
            browserName = "Firefox";
        } else if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident") > -1) {
            browserName = "Internet Explorer";
        } else if (userAgent.indexOf("Edge") > -1) {
            browserName = "Edge";
        }
        
        // Detect OS
        if (userAgent.indexOf("Win") > -1) {
            osName = "Windows";
        } else if (userAgent.indexOf("Mac") > -1) {
            osName = "MacOS";
        } else if (userAgent.indexOf("Linux") > -1) {
            osName = "Linux";
        } else if (userAgent.indexOf("Android") > -1) {
            osName = "Android";
        } else if (userAgent.indexOf("iPhone") > -1 || userAgent.indexOf("iPad") > -1) {
            osName = "iOS";
        }
        
        setBrowserInfo(`${browserName} on ${osName}`);
        
        // Format current date and time
        const now = new Date();
        setCurrentDateTime(now.toLocaleString());
        
        // In a real app, you would fetch the IP address from an API
        // For demonstration, we're using a placeholder IP
    }, []);

    const handleDeleteAccount = async () => {
        try {
            setIsDeleting(true);
            setDeleteError("");
            
            // Get user ID from localStorage
            const userId = localStorage.getItem("userId");
            if (!userId) {
                throw new Error("User ID not found");
            }
            
            console.log("Attempting to delete account for user ID:", userId);
            
            // Try using the backend API first (app.py)
            try {
                // Try our regular backend first
                console.log("Trying to delete account using backend server...");
                const response = await fetch(`http://localhost:5001/api/user/delete`, {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ 
                        userId,
                        password: deletePassword
                    }),
                });
                
                if (response.ok) {
                    // Success with the backend API
                    console.log("Account successfully deleted via backend server");
                    
                    // Clear all localStorage items
                    localStorage.removeItem("authToken");
                    localStorage.removeItem("userId");
                    localStorage.removeItem("userEmail");
                    localStorage.removeItem("fullName");
                    localStorage.removeItem("watchlist");
                    
                    // Redirect to homepage/login page
                    navigate("/");
                    return;
                } else {
                    // If backend fails, try the auth server
                    console.log("Backend server failed, trying auth server...");
                    throw new Error("Backend server couldn't delete account");
                }
            } catch (backendError) {
                console.error("Error with backend server:", backendError);
                
                // Now try the auth server
                try {
                    console.log("Trying to delete account using auth server...");
                    const authResponse = await fetch(`http://localhost:5004/api/user/delete`, {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        // Don't use credentials for now since it's causing CORS issues
                        body: JSON.stringify({ 
                            userId,
                            password: deletePassword
                        }),
                    });
                    
                    if (!authResponse.ok) {
                        const errorData = await authResponse.json();
                        throw new Error(errorData.message || "Failed to delete account");
                    }
                    
                    console.log("Account successfully deleted via auth server");
                    
                    // Clear all localStorage items
                    localStorage.removeItem("authToken");
                    localStorage.removeItem("userId");
                    localStorage.removeItem("userEmail");
                    localStorage.removeItem("fullName");
                    localStorage.removeItem("watchlist");
                    
                    // Redirect to homepage/login page
                    navigate("/");
                    return;
                } catch (authError) {
                    console.error("Error with auth server:", authError);
                    
                    // Both servers failed, offer local deletion
                    const confirmLocalOnly = window.confirm(
                        "Unable to connect to servers to delete your account completely. Would you like to proceed with removing your local account data only?"
                    );
                    
                    if (confirmLocalOnly) {
                        // Clear all localStorage items
                        localStorage.removeItem("authToken");
                        localStorage.removeItem("userId");
                        localStorage.removeItem("userEmail");
                        localStorage.removeItem("fullName");
                        localStorage.removeItem("watchlist");
                        
                        // Redirect to homepage/login page
                        navigate("/");
                        return;
                    } else {
                        setDeleteError("Account deletion canceled. Please try again later.");
                        return;
                    }
                }
            }
        } catch (error) {
            console.error("Error deleting account:", error);
            setDeleteError(error instanceof Error ? error.message : "An unknown error occurred");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
        {activeTab === "security" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-2xl font-bold mb-6">Security Settings</h2>

                  <div className="space-y-6">
                    <div className="border-t border-gray-700 pt-6">
                      <h3 className="font-semibold mb-4">Current Login Session</h3>
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-white/5 flex justify-between items-center">
                          <div>
                            <div className="font-medium">Current Session</div>
                            <div className="text-sm text-gray-400">
                              {browserInfo} • IP: {ipAddress}
                            </div>
                            <div className="text-xs text-emerald-400 mt-1">
                              Login Time: {currentDateTime}
                            </div>
                          </div>
                          <div>
                            <button className="text-gray-400 hover:text-gray-300">
                              This is you
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-700 pt-6">
                      <h3 className="font-semibold mb-4 text-red-400">
                        Danger Zone
                      </h3>
                      <button 
                        className="px-4 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                        onClick={() => setShowDeleteConfirmation(true)}
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                  
                  {/* Delete Account Confirmation Modal */}
                  {showDeleteConfirmation && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                      <div className="bg-gray-900 p-6 rounded-lg w-full max-w-md border border-red-500/50">
                        <h3 className="text-xl font-bold text-red-500 mb-4">Delete Account</h3>
                        <p className="text-gray-300 mb-6">
                          This action is irreversible. All your data, including watchlists, portfolio, and analysis history will be permanently deleted.
                        </p>
                        
                        <div className="mb-6">
                          <label className="block text-sm text-gray-400 mb-2">
                            Enter your password to confirm:
                          </label>
                          <input
                            type="password"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                            placeholder="Your password"
                          />
                          {deleteError && (
                            <p className="text-red-500 text-sm mt-2">{deleteError}</p>
                          )}
                        </div>
                        
                        <div className="flex justify-end space-x-3">
                          <button
                            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700"
                            onClick={() => {
                              setShowDeleteConfirmation(false);
                              setDeletePassword("");
                              setDeleteError("");
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            onClick={handleDeleteAccount}
                            disabled={!deletePassword || isDeleting}
                          >
                            {isDeleting ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                              </>
                            ) : (
                              "Permanently Delete Account"
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
        </>
    );
    }

    export default Security;