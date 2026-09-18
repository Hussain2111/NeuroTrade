from flask import Flask, jsonify, request
from newsdataapi import NewsDataApiClient
import ollama
from pymongo import MongoClient
import yfinance as yf
import os
import base64
from create_app import create_app
from lstm import init_lstm_routes
from app.chatbot_service import ChatbotService
import random
import pandas as pd
from datetime import datetime, timedelta
import numpy as np
from textblob import TextBlob
import logging
import json
import re
import traceback
# Fix JWT imports - use PyJWT instead of plain jwt
try:
    import jwt as pyjwt
except ImportError:
    print("PyJWT not installed, trying to install...")
    import pip
    pip.main(['install', 'PyJWT'])
    import jwt as pyjwt
from functools import wraps
from bson import ObjectId
from flask_cors import CORS
import sys
import bcrypt
from bson.objectid import ObjectId
import subprocess
import re

app = create_app()

# Configure CORS for browsers
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Initialise LSTM routes
init_lstm_routes(app)

# Initialise chatbot service
chatbot_service = ChatbotService()

# MongoDB connection - using the same DB as the login server
client = MongoClient("mongodb+srv://shayaanpk:QBlvNkoTYFQbXsq1@clusterlogin.mioes.mongodb.net/trading_app?retryWrites=true&w=majority&appName=ClusterLogin")
db = client["trading_app"]
investments_collection = db["investments"]
sales_collection = db["sold_stocks"]
# For auth token verification
users_collection = db["users"]

# JWT Secret key for verifying tokens
JWT_SECRET = os.environ.get('JWT_SECRET', 'fallback_secret_key_for_development')

# Authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get the token from the headers
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            
        if not token:
            return jsonify({
                'error': 'Token is missing',
                'success': False
            }), 401
            
        try:
            # Decode the token using PyJWT
            payload = pyjwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            user_id = payload['userId']
            
            # MongoDB IDs are ObjectIds, try to convert
            try:
                user_obj_id = ObjectId(user_id)
                # Verify the user exists
                user = users_collection.find_one({'_id': user_obj_id})
            except:
                # If conversion fails or user doesn't exist, try with string ID
                user = users_collection.find_one({'_id': user_id})
            
            if not user:
                return jsonify({
                    'error': 'Invalid token, user not found',
                    'success': False
                }), 401
                
            # Add user_id to keyword args
            kwargs['user_id'] = user_id
            
        except pyjwt.exceptions.ExpiredSignatureError:
            return jsonify({
                'error': 'Token has expired',
                'success': False
            }), 401
        except pyjwt.exceptions.InvalidTokenError:
            return jsonify({
                'error': 'Invalid token',
                'success': False
            }), 401
        except Exception as e:
            return jsonify({
                'error': f'Token verification error: {str(e)}',
                'success': False
            }), 401
            
        return f(*args, **kwargs)
    return decorated

@app.route('/stock-price', methods=['GET'])
def get_stock_price():
    try:
        ticker = app.config['GLOBAL_TICKER']
        
        if not ticker:
            # Return a default value instead of error when no ticker is set
            return jsonify({
                'currentPrice': 0,
                'ticker': None,
                'success': True
            })

        # Create a Ticker object
        stock = yf.Ticker(ticker)
        
        # Get the current price using fast info
        current_price = stock.fast_info['lastPrice']
        
        print(f"Successfully fetched price: {current_price}")  # Debug logging
        
        return jsonify({
            'currentPrice': round(current_price, 2),
            'ticker': ticker,
            'success': True
        })
    except Exception as e:
        print(f"Error fetching stock price: {str(e)}")  # Debug logging
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/get-price-history', methods=['GET'])
def get_price_history():
    try:
        ticker = app.config.get('GLOBAL_TICKER')
        if not ticker:
            return jsonify({
                'error': 'No ticker has been set yet',
                'success': False
            }), 400
            
        # Use the model loss plot as the price history visualisation
        image_path = os.path.join(os.path.dirname(__file__), 'lstm_files', f'{ticker}_model1_loss.png')
        print(f"Looking for image at: {image_path}")
        
        if not os.path.exists(image_path):
            print(f"Image not found at: {image_path}")
            return jsonify({
                'error': 'Price history plot not yet generated',
                'success': False
            }), 404
            
        with open(image_path, 'rb') as image_file:
            encoded_image = base64.b64encode(image_file.read()).decode('utf-8')
            
        # Get current price
        stock = yf.Ticker(ticker)
        current_price = stock.fast_info['lastPrice']
            
        return jsonify({
            'image': encoded_image,
            'current_price': round(current_price, 2),
            'success': True
        })
    except Exception as e:
        print(f"Error serving price history plot: {str(e)}")
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/get-prediction', methods=['GET'])
def get_prediction():
    try:
        ticker = app.config.get('GLOBAL_TICKER')
        if not ticker:
            return jsonify({
                'error': 'No ticker has been set yet',
                'success': False
            }), 400
        
        # Paths for prediction image and data
        base_path = os.path.join(os.path.dirname(__file__), 'lstm_files')
        image_path = os.path.join(base_path, f'{ticker}_prediction_plot.png')
        json_path = os.path.join(base_path, f'{ticker}_prediction_data.json')
        test_data_path = os.path.join(base_path, f'{ticker}_prediction_data.csv')  # Ensure test data is saved

        # Load prediction image
        if not os.path.exists(image_path):
            return jsonify({'error': 'Prediction plot not yet generated', 'success': False}), 404
        
        with open(image_path, 'rb') as image_file:
            encoded_image = base64.b64encode(image_file.read()).decode('utf-8')

        # Load stock current price
        stock = yf.Ticker(ticker)
        current_price = stock.info.get('regularMarketPrice', 0)

        # Load prediction data from JSON
        prediction_data = {}
        if os.path.exists(json_path):
            with open(json_path, 'r') as json_file:
                prediction_data = json.load(json_file)

        # Load the test dataset for prediction visualisation
        test_data = []
        if os.path.exists(test_data_path):
            df_test = pd.read_csv(test_data_path)
            test_data = df_test.to_dict(orient='records')  # Convert to JSON-friendly format

        return jsonify({
            'image': encoded_image,
            'current_price': round(current_price, 2) if current_price else 0,
            'prediction_data': prediction_data,
            'test_data': test_data,
            'success': True
        })
    
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        message = data.get('message')
        stock_symbol = data.get('symbol')
        user_id = data.get('userId')
        
        if not all([message, stock_symbol, user_id]):
            return jsonify({
                'error': 'Message, stock symbol, and user ID are required',
                'success': False
            }), 400
        
        result = chatbot_service.process_message(user_id, message, stock_symbol)
        
        if not result['success']:
            return jsonify(result), 500
            
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/chat/history/<user_id>', methods=['GET'])
def get_chat_history(user_id):
    try:
        history = chatbot_service.get_conversation_history(user_id)
        return jsonify({
            'history': history,
            'success': True
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/stock/news/<symbol>', methods=['GET'])
def get_stock_news(symbol):
    try:
        news = chatbot_service.get_stock_news(symbol)
        return jsonify({
            'news': news,
            'success': True
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/stock-info', methods=['GET'])
def get_stock_info():
    try:
        ticker = request.args.get('ticker')
        if not ticker:
            return jsonify({
                'error': 'No ticker provided',
                'success': False
            }), 400

        stock = yf.Ticker(ticker)
        info = stock.info
        
        return jsonify({
            'company_name': info.get('longName', ''),
            'price_change': f"{info.get('regularMarketChangePercent', 0):.2f}%",
            'success': True
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/get-sentiment', methods=['GET'])
def get_sentiment():
    try:
        ticker = request.args.get('ticker')
        if not ticker:
            return jsonify({
                'error': 'No ticker provided',
                'success': False
            }), 400

        # Get the stock info
        stock = yf.Ticker(ticker)
        
        # Get news data from two sources
        api = NewsDataApiClient(apikey='pub_736718e9399326ef93bc5d214d31ad00dec04')
        news_data = ""
        
        # Get the news response from newsdata api
        response = api.latest_api(q=f'{ticker} stock')
        
        # Extract individual news descriptions from newsdata
        article_count = 0
        for article in response.get("results", []):
            article_description = article.get('description')
            if isinstance(article_description, str):
                news_data += article_description
                article_count += 1
        
        # Get news from yfinance
        yf_news = stock.get_news()
        
        # Extract summary of news articles from yfinance
        yf_article_count = min(10, len(yf_news))
        for i in range(yf_article_count):
            try:
                summary = yf_news[i].get('content', {}).get('summary', '')
                if summary:
                    news_data += summary
                    article_count += 1
            except (IndexError, AttributeError):
                continue
        
        if not news_data:
            return jsonify({
                'error': 'No news data available for sentiment analysis',
                'success': False
            }), 404
        
        # Create a prompt for sentiment analysis
        prompt = f"""Give me a sentiment analysis in percentage 
                  terms of negative and positive of {ticker} stock based on 
                  the following news articles. Be very concise.
                  Just extract the exact percentage values for positive, negative, and neutral sentiment.
                  Make the percentages for positive, negative, and neutral add up to 100%.
                  Format your response in a clean JSON structure like this:
                  {{
                    "positive": Your positive sentiment value (without the %),
                    "negative": Your negative sentiment value (without the %), 
                    "neutral": Your neutral sentiment value (without the %),
                  }}
                  Only output the JSON."""
        
        # Call Ollama model for sentiment analysis
        MODEL = "llama2"
        response = ollama.chat(
            model=MODEL,
            messages=[{'role': 'user', 'content': prompt}]
        )
        
        sentiment_result = response['message']['content']
        
        # For Debugging: Print raw response
        print("Raw Ollama Response:", sentiment_result)
        
        # Extract the JSON part from the response
        json_match = re.search(r'\{\s*"positive"\s*:\s*\d+\s*,\s*"negative"\s*:\s*\d+\s*,\s*"neutral"\s*:\s*\d+\s*\}', sentiment_result)
        if json_match:
            sentiment_json = json_match.group(0)
            sentiment_data = json.loads(sentiment_json)
        else:
            # Fallback if JSON parsing fails
            sentiment_data = {
                "positive": 0,
                "negative": 0,
                "neutral": 0
            }
        
        # Calculate average sentiment
        average_sentiment = sentiment_data.get("positive", 0) / 100.0
        
        # Create a response with current and historical sentiment
        # If it fails, rely on placeholders to not get errors
        sentiment_response = {
            "current": {
                "period": "Current",
                "positive": sentiment_data.get("positive", 0),
                "negative": sentiment_data.get("negative", 0),
                "neutral": sentiment_data.get("neutral", 0),
                "totalMentions": article_count,
                "averageSentiment": average_sentiment
            },
            "success": True
        }
        
        return jsonify(sentiment_response)
        
    except Exception as e:
        traceback_str = traceback.format_exc()
        print(f"Error getting sentiment: {str(e)}\n{traceback_str}")
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/get-technical-fundamental', methods=['GET'])
def get_technical_fundamental():
    try:
        ticker = request.args.get('ticker')
        if not ticker:
            return jsonify({
                'error': 'No ticker provided',
                'success': False
            }), 400

        stock = yf.Ticker(ticker)
        
        # Get historical data for technical indicators
        hist = stock.history(period="3mo")
        
        if hist.empty:
            return jsonify({
                'error': 'No historical data available',
                'success': False
            }), 404
        
        # Calculate RSI (14)
        delta = hist['Close'].diff()
        gain = delta.where(delta > 0, 0).rolling(window=14).mean()
        loss = -delta.where(delta < 0, 0).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs.iloc[-1]))
        
        # Calculate MACD
        ema12 = hist['Close'].ewm(span=12, adjust=False).mean()
        ema26 = hist['Close'].ewm(span=26, adjust=False).mean()
        macd = ema12.iloc[-1] - ema26.iloc[-1]
        
        # Calculate Bollinger Bands
        sma20 = hist['Close'].rolling(window=20).mean()
        std20 = hist['Close'].rolling(window=20).std()
        upper_band = sma20 + (std20 * 2)
        lower_band = sma20 - (std20 * 2)
        
        # Get fundamental data
        info = stock.info
        
        technical = {
            'rsi': round(rsi, 2),
            'macd': round(macd, 2),
            'bollinger': {
                'upper': round(upper_band.iloc[-1], 2),
                'middle': round(sma20.iloc[-1], 2),
                'lower': round(lower_band.iloc[-1], 2)
            }
        }
        
        fundamental = {
            'peRatio': round(info.get('trailingPE', 0), 2),
            'pbRatio': round(info.get('priceToBook', 0), 2),
            'debtEquity': round(info.get('debtToEquity', 0), 2),
            'quickRatio': round(info.get('quickRatio', 0), 2),
            'currentRatio': round(info.get('currentRatio', 0), 2),
            'returnOnEquity': round(info.get('returnOnEquity', 0) * 100 if info.get('returnOnEquity') else 0, 2),
            'returnOnAssets': round(info.get('returnOnAssets', 0) * 100 if info.get('returnOnAssets') else 0, 2)
        }
        
        return jsonify({
            'technical': technical,
            'fundamental': fundamental,
            'success': True
        })
        
    except Exception as e:
        print(f"Error fetching technical/fundamental data: {str(e)}")
        return jsonify({
            'error': str(e),
            'success': False
        }), 500
        
@app.route('/api/stock', methods=['GET'])
def get_stock_data():
    try:
        # Get stock symbol from query parameter
        stock_symbol = request.args.get('symbol', '')
        
        if not stock_symbol:
            return jsonify({"error": "Stock symbol is required"}), 400
            
        # Default period - 1 year (if not specified)
        period = request.args.get('period', '1y')
        
        # Get data from yfinance
        stock = yf.Ticker(stock_symbol)
        hist = stock.history(period=period)
        
        # Reset index to make date a column and convert to string format
        hist = hist.reset_index()
        hist['Date'] = hist['Date'].dt.strftime('%Y-%m-%d')
        
        # Get current price (use regularMarketPrice as currentPrice might not be available)
        current_price = stock.info.get('regularMarketPrice', 0)
        
        # Preparing the response data
        stock_data = {
            "symbol": stock_symbol,
            "name": stock.info.get('shortName', stock_symbol),
            "currency": stock.info.get('currency', 'USD'),
            "currentPrice": current_price,
            "previousClose": stock.info.get('previousClose', 0),
            "marketCap": stock.info.get('marketCap', 0),
            "dayHigh": stock.info.get('dayHigh', 0),
            "dayLow": stock.info.get('dayLow', 0),
            "priceData": hist[['Date', 'Open', 'High', 'Low', 'Close', 'Volume']].to_dict('records')
        }
        
        return jsonify(stock_data)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/search', methods=['GET'])
def search_stocks():
    try:
        query = request.args.get('q', '')
        
        if not query or len(query) < 2:
            return jsonify([])
            
        # For matching the stock from yfinance, search functionality
        matches = []
            
        # Get a ticker directly with this name
        if not matches and len(query) >= 2:
            try:
                ticker = yf.Ticker(query.upper())
                info = ticker.info
                if info and 'shortName' in info:
                    matches.append({
                        "symbol": query.upper(),
                        "name": info.get('shortName', query.upper()),
                        "exchange": info.get('exchange', 'Unknown')
                    })
            except:
                pass
                
        return jsonify(matches)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/stock-price-data')
def get_stock_price_data():
    ticker = request.args.get('ticker', 'AAPL')
    timeframe = request.args.get('timeframe', '1M')
    
    timeframe_mapping = {
        '1D': ('1d', '5m'),
        '1W': ('1wk', '15m'),
        '1M': ('1mo', '1d'),
        '3M': ('3mo', '1d'),
        '1Y': ('1y', '1d'),
        'ALL': ('max', '1wk')
    }
    
    period, interval = timeframe_mapping.get(timeframe, ('1mo', '1d'))
    
    try:
        # Fetch stock data
        stock = yf.Ticker(ticker)
        df = stock.history(period=period, interval=interval)
        
        # Calculate moving averages
        if len(df) > 20:
            df['MA20'] = df['Close'].rolling(window=20).mean()
        if len(df) > 50:
            df['MA50'] = df['Close'].rolling(window=50).mean()
        if len(df) > 200:
            df['MA200'] = df['Close'].rolling(window=200).mean()
        
        # Convert NaN values to None (null in JSON)
        df = df.replace({np.nan: None})
        
        # Format data for frontend
        price_data = []
        for index, row in df.iterrows():
            price_data.append({
                'date': index.strftime('%Y-%m-%d %H:%M:%S'),
                'price': row['Close'],
                'volume': row['Volume'],
                'ma20': row.get('MA20'),
                'ma50': row.get('MA50'),
                'ma200': row.get('MA200')
            })
        
        return jsonify({
            'success': True,
            'priceData': price_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/api/stock-news', methods=['GET'])
def fetch_stock_news():
    try:
        ticker = request.args.get('ticker')
        if not ticker:
            return jsonify({'success': False, 'error': 'No ticker provided'})

        # Get stock info
        stock = yf.Ticker(ticker)
        raw_news = stock.news
        
        print(f"Fetched {len(raw_news)} raw news items for {ticker}")  # Debug print

        # Process and format news
        processed_news = []
        for item in raw_news:
            try:
                # Extract content from the nested structure
                content = item.get('content', item) 
                
                # Extract title and summary
                title = content.get('title', '').strip()
                summary = content.get('summary', '').strip()
                
                # Skip items without a title
                if not title:  
                    continue

                # Get publisher info
                provider = content.get('provider', {})
                source = provider.get('displayName', 'Unknown Source')

                # Get URL
                click_through = content.get('clickThroughUrl', {})
                url = click_through.get('url', '')

                # Get publish date and format time
                pub_date = content.get('pubDate')
                if pub_date:
                    try:
                        dt = datetime.strptime(pub_date, '%Y-%m-%dT%H:%M:%SZ')
                        now = datetime.utcnow()
                        diff = now - dt
                        
                        if diff.days > 0:
                            time_str = f"{diff.days}d ago"
                        elif diff.seconds >= 3600:
                            hours = diff.seconds // 3600
                            time_str = f"{hours}h ago"
                        else:
                            minutes = (diff.seconds // 60) or 1
                            time_str = f"{minutes}m ago"
                    except Exception as e:
                        print(f"Error parsing date: {e}")
                        time_str = "Recent"
                else:
                    time_str = "Recent"

                # Perform sentiment analysis
                text_for_analysis = f"{title} {summary}"
                analysis = TextBlob(text_for_analysis)
                sentiment_score = analysis.sentiment.polarity

                # Determine sentiment category
                if sentiment_score > 0.1:
                    sentiment = 'positive'
                elif sentiment_score < -0.1:
                    sentiment = 'negative'
                else:
                    sentiment = 'neutral'

                # Determine impact based on sentiment strength
                if abs(sentiment_score) > 0.5:
                    impact = 'High'
                elif abs(sentiment_score) > 0.2:
                    impact = 'Medium'
                else:
                    impact = 'Low'

                news_item = {
                    'title': title,
                    'source': source,
                    'sentiment': sentiment,
                    'time': time_str,
                    'summary': summary,
                    'impact': impact,
                    'url': url
                }
                processed_news.append(news_item)
                print(f"Processed news item: {title}")  # Debug print

            except Exception as e:
                print(f"Error processing individual news item: {str(e)}")
                continue

        print(f"Successfully processed {len(processed_news)} news items for {ticker}")

        return jsonify({
            'success': True,
            'news': processed_news
        })

    except Exception as e:
        print(f"Error in news processing: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/api/stocks', methods=['GET'])
def get_multiple_stocks():
    try:
        # Get comma-separated stock symbols from query params
        symbols_str = request.args.get('symbols')
        if not symbols_str:
            return jsonify({
                'error': 'No stock symbols provided',
                'success': False
            }), 400
            
        # Split symbols and create a list
        symbols = [sym.strip() for sym in symbols_str.split(',')]
        
        # Initialise result array
        result = []
        
        # Fetch data for each symbol
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                
                # Get the price data for the last 2 days to calculate percent change
                hist = ticker.history(period="2d")
                
                if len(hist) >= 2:
                    yesterday_close = hist['Close'].iloc[-2]
                    today_price = hist['Close'].iloc[-1]
                    price_change_percent = ((today_price - yesterday_close) / yesterday_close) * 100
                else:
                    # Fallback if we don't have enough history
                    today_price = hist['Close'].iloc[-1] if len(hist) > 0 else 0
                    price_change_percent = 0
                
                stock_data = {
                    'symbol': symbol,
                    'regularMarketPrice': round(today_price, 2),
                    'regularMarketChangePercent': round(price_change_percent, 2),
                    'name': ticker.info.get('shortName', symbol)
                }
                
                result.append(stock_data)
            except Exception as e:
                # If there's an error with one stock, log it but continue
                logging.error(f"Error fetching data for {symbol}: {str(e)}")
                result.append({
                    'symbol': symbol,
                    'error': str(e)
                })
        
        return jsonify({
            'stocks': result,
            'success': True
        })
        
    except Exception as e:
        logging.error(f"Error in get_multiple_stocks: {str(e)}")
        return jsonify({
            'error': str(e),
            'success': False
        }), 500

@app.route('/buy-stock', methods=['POST'])
@token_required
def buy_stock(user_id=None):
    try:
        data = request.get_json()
        request_user_id = data.get('user_id')
        ticker = data.get('ticker')
        currentPrice = data.get('currentPrice')
        quantity = data.get('quantity', 1)
        
        # Verify the user_id in the request matches the authenticated user
        if user_id != request_user_id:
            return jsonify({
                "error": "Unauthorized: User ID mismatch", 
                "success": False}), 401
        
        if not all([user_id, ticker, currentPrice]):
            return jsonify({
                "error": "Missing required fields", 
                "success": False}), 400
        
        # Update existing stocks with the same ticker to the new price
        investments_collection.update_many(
            # Find all stocks with the same user_id and ticker
            {"user_id": user_id, "ticker": ticker},  
            # Update the currentPrice field
            {"$set": {"currentPrice": currentPrice}}  
        )
        
        # Insert multiple entries based on quantity
        inserted_ids = []
        for _ in range(quantity):
            investment = {
                "user_id": user_id,
                "ticker": ticker,
                "priceBought": currentPrice,
                "currentPrice": currentPrice,
                "date": datetime.now()
            }
            result = investments_collection.insert_one(investment)
            inserted_ids.append(result.inserted_id)
        
        return jsonify({
            "message": f"Successfully purchased {quantity} shares of {ticker}!", 
            "inserted_ids": [str(id) for id in inserted_ids],
            "success": True
        })
    
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500
    
@app.route('/sell-stock', methods=['POST'])
@token_required
def sell_stock(user_id=None):
    try:
        data = request.json
        request_user_id = data.get("user_id")
        ticker = data.get("ticker")
        sell_price = float(data.get("currentPrice"))
        quantity = data.get("quantity", 1)

        # Verify the user_id in the request matches the authenticated user
        if user_id != request_user_id:
            return jsonify({
                "error": "Unauthorized: User ID mismatch", 
                "success": False}), 401

        if not ticker or not user_id:
            return jsonify({"success": False, "error": "Missing ticker or user ID"})

        # Find all stocks matching the criteria
        matching_stocks = list(investments_collection.find(
            {"ticker": ticker, "user_id": user_id}
        ).sort("date", 1))  # Sort by date to sell oldest shares first (FIFO)
        
        available_quantity = len(matching_stocks)
        
        if available_quantity == 0:
            return jsonify({
                "success": False,
                "error": f"No shares of {ticker} found in your portfolio"
            })
        
        if quantity > available_quantity:
            return jsonify({
                "success": False,
                "error": f"Insufficient shares. You have {available_quantity} shares of {ticker}, but tried to sell {quantity}."
            })
        
        # Delete the specified number of stocks (oldest first)
        stocks_to_sell = matching_stocks[:quantity]
        total_profit = 0
        deleted_count = 0
        
        for stock in stocks_to_sell:
            price_bought = stock["priceBought"]
            # Profit per share
            profit = sell_price - price_bought  
            total_profit += profit

            # Add sale record to sales_collection
            sales_collection.insert_one({
                "user_id": user_id,
                "ticker": ticker,
                "price_bought": price_bought,
                "sell_price": sell_price,
                "profit": profit,
                "date_sold": datetime.utcnow()
            })
            
            result = investments_collection.delete_one({"_id": stock["_id"]})
            if result.deleted_count > 0:
                deleted_count += 1
        
        return jsonify({
            "success": True, 
            "message": f"Successfully sold {deleted_count} shares of {ticker}!",
            "sold_quantity": deleted_count
        })
    
    except Exception as e:
        return jsonify({
            "success": False, 
            "error": str(e)}), 500
        
@app.route('/portfolio', methods=['GET'])
@token_required
def get_portfolio(user_id=None):
    try:
        request_user_id = request.args.get("user_id")
        
        # Verify the user_id in the request matches the authenticated user
        if user_id != request_user_id:
            return jsonify({
                "error": "Unauthorized: User ID mismatch", 
                "success": False}), 401
        
        if not user_id:
            return jsonify({"success": False, "error": "User ID required"}), 400

        # Find all unique tickers for the user
        unique_tickers = investments_collection.distinct("ticker", {"user_id": user_id})
        
        # Update prices for all stocks of this user
        for ticker in unique_tickers:
            try:
                # Use existing method to get stock data
                stock_data_response = request.get(
                    f'http://localhost:5001/api/stock?symbol={ticker}'
                )
                
                if stock_data_response.status_code == 200:
                    stock_data = stock_data_response.json()
                    current_price = stock_data.get('currentPrice', None)
                    
                    if current_price is not None:
                        # Update all documents with this ticker for the user
                        investments_collection.update_many(
                            {
                                "user_id": user_id, 
                                "ticker": ticker
                            },
                            {
                                "$set": {
                                    "currentPrice": current_price,
                                }
                            }
                        )
            except Exception as ticker_error:
                print(f"Error updating price for {ticker}: {ticker_error}")
                # Continue with other tickers even if one fails


        # Aggregation pipeline to group stocks by ticker, count the quantity, 
        # and calculate the total value
        pipeline = [
            {
                "$match": {"user_id": user_id}  # Filter by user_id
            },
            {
                "$group": {
                    # Group by ticker symbol
                    "_id": "$ticker",  
                    # Count the number of documents per ticker (equivalent to quantity)
                    "quantity": {"$sum": 1},  
                    # Calculate total value per ticker (currentPrice * quantity)
                    "currentPrice": {"$sum": {"$multiply": ["$currentPrice", 1]}}  
                }
            },
            {
                "$project": {
                    "_id": 0,  # Exclude the _id field
                    "ticker": "$_id",  # Rename _id to ticker
                    "quantity": 1,  # Keep the quantity
                    "currentPrice": 1  # Keep the total value of stocks
                }
            }
        ]

        # Execute the aggregation pipeline
        stocks = list(investments_collection.aggregate(pipeline))
        
        return jsonify({"success": True, "stocks": stocks})
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/individual-stock', methods=['GET'])
@token_required
def get_individual_stock(user_id=None):
    try:
        # Extract user_id and ticker from the query parameters
        request_user_id = request.args.get("user_id")
        ticker = request.args.get("ticker")
        
        # Verify the user_id in the request matches the authenticated user
        if user_id != request_user_id:
            return jsonify({
                "error": "Unauthorized: User ID mismatch", 
                "success": False}), 401
        
        if not user_id or not ticker:
            return jsonify({"success": False, "error": "User ID and Ticker are required"}), 400

        # Query to find all the individual stocks for the given user_id and ticker
        stocks = list(investments_collection.find({
            "user_id": user_id,
            "ticker": ticker  # Filter by user_id and ticker
        }, {
            "_id": 0  # Exclude the _id field from the result
        }))
        
        if not stocks:
            return jsonify({"success": False, "error": f"No stocks found for ticker {ticker}"}), 404

        return jsonify({"success": True, "stocks": stocks})
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/profit-or-loss', methods=['POST'])
def profit_or_loss():
    try:
        data = request.json
        user_id = data.get("user_id")

        if not user_id:
            return jsonify({"success": False, "error": "Missing user_id"}), 400

        # Fetch all currently owned stocks
        stocks = list(investments_collection.find({"user_id": user_id}))

        # Fetch realised profits from sold stocks
        realized_profits = list(sales_collection.find({"user_id": user_id}))
        total_realized_profit = sum(sale["profit"] for sale in realized_profits)

        if not stocks and not realized_profits:
            return jsonify({"success": False, "error": "No data found for user"}), 404

        total_cost = 0
        total_current_value = 0
        stock_results = []

        for stock in stocks:
            ticker = stock["ticker"]
            price_bought = stock["priceBought"]  # Initial purchase price
            current_price = stock["currentPrice"]  # Current market price

            investment = price_bought
            current_value = current_price
            profit_loss = current_value - investment
            profit_loss_percentage = (profit_loss / investment) * 100 if investment > 0 else 0

            total_cost += investment
            total_current_value += current_value

            stock_results.append({
                "ticker": ticker,
                "priceBought": price_bought,
                "currentPrice": current_price,
                "profit_loss": profit_loss,
                "profit_loss_percentage": round(profit_loss_percentage, 2)
            })

        # Calculate unrealised profit/loss
        overall_unrealized_profit = total_current_value - total_cost

        # Total profit = realised profit + unrealised profit
        overall_profit_loss = overall_unrealized_profit + total_realized_profit
        overall_profit_loss_percentage = (
            (overall_profit_loss / (total_cost if total_cost > 0 else 1)) * 100
        )

        return jsonify({
            "success": True,
            "total_investment": total_cost,
            "current_value": total_current_value,
            "realized_profit": total_realized_profit,
            "unrealized_profit": overall_unrealized_profit,
            "total_profit_loss": overall_profit_loss,
            "profit_loss_percentage": round(overall_profit_loss_percentage, 2),
            "stocks": stock_results
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    
@app.route('/stock-profit', methods=['GET'])
def stock_profit():
    try:
        user_id = request.args.get("user_id")
        ticker = request.args.get("ticker")

        if not user_id or not ticker:
            return jsonify({"success": False, "error": "Missing user_id or ticker"}), 400

        investments = list(investments_collection.find({"user_id": user_id, "ticker": ticker}))

        if not investments:
            return jsonify({"success": False, "message": "No stocks found for this user and ticker"}), 404

        total_profit = sum((stock["currentPrice"] - stock["priceBought"]) for stock in investments)

        return jsonify({
            "success": True,
            "ticker": ticker,
            "profit": total_profit
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/user/current', methods=['GET'])
def get_current_user():
    token = request.cookies.get('token')
    
    if not token:
        return jsonify({'success': False, 'message': 'Not authenticated'}), 401
    
    try:
        # Decode the token to get the user_id
        data = pyjwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        user_id = data['userId']
        
        # Get user from database
        try:
            user_obj_id = ObjectId(user_id)
            user = users_collection.find_one({'_id': user_obj_id})
        except:
            # If conversion fails, try with string ID
            user = users_collection.find_one({'_id': user_id})
        
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        # Don't send password back to client
        user.pop('password', None)
        # Convert ObjectId to string if it's an ObjectId
        if isinstance(user['_id'], ObjectId):
            user['_id'] = str(user['_id'])
        
        return jsonify({
            'success': True, 
            'user': user
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 401

@app.route('/api/watchlist', methods=['GET'])
@token_required
def get_watchlist(user_id=None):
    try:
        # Find user document
        try:
            user_obj_id = ObjectId(user_id)
            user = users_collection.find_one({'_id': user_obj_id})
        except:
            # If conversion fails, try with string ID
            user = users_collection.find_one({'_id': user_id})
        
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        # Get watchlist from user document or create an empty one if it doesn't exist
        watchlist = user.get('watchlist', [])
        
        return jsonify({
            'success': True,
            'watchlist': watchlist
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/watchlist/add', methods=['POST'])
@token_required
def add_to_watchlist(user_id=None):
    try:
        data = request.get_json()
        ticker = data.get('ticker')
        
        if not ticker:
            return jsonify({'success': False, 'message': 'Ticker is required'}), 400
        
        # Standardise ticker (uppercase to avoid duplicates)
        ticker = ticker.upper()
        
        try:
            # Try to convert user_id to ObjectId if it's a string
            user_obj_id = ObjectId(user_id)
            
            # Add ticker to watchlist if not already there
            result = users_collection.update_one(
                {'_id': user_obj_id, 'watchlist': {'$ne': ticker}},
                {'$push': {'watchlist': ticker}}
            )
        except:
            # If ObjectId conversion fails, use the string ID
            result = users_collection.update_one(
                {'_id': user_id, 'watchlist': {'$ne': ticker}},
                {'$push': {'watchlist': ticker}}
            )
        
        if result.modified_count == 0:
            # Ticker might already be in watchlist or user not found
            # Check if user exists
            try:
                user = users_collection.find_one({'_id': ObjectId(user_id)})
            except:
                user = users_collection.find_one({'_id': user_id})
                
            if not user:
                return jsonify({'success': False, 'message': 'User not found'}), 404
            
            # Ticker is already in watchlist - this is not an error
            return jsonify({
                'success': True,
                'message': 'Ticker is already in watchlist'
            })
        
        return jsonify({
            'success': True,
            'message': f'Added {ticker} to watchlist'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/watchlist/remove', methods=['DELETE'])
@token_required
def remove_from_watchlist(user_id=None):
    try:
        data = request.get_json()
        ticker = data.get('ticker')
        
        if not ticker:
            return jsonify({'success': False, 'message': 'Ticker is required'}), 400
        
        # Standardise ticker (uppercase for consistency)
        ticker = ticker.upper()
        
        try:
            # Try to convert user_id to ObjectId if it's a string
            user_obj_id = ObjectId(user_id)
            
            # Remove ticker from watchlist
            result = users_collection.update_one(
                {'_id': user_obj_id},
                {'$pull': {'watchlist': ticker}}
            )
        except:
            # If ObjectId conversion fails, use the string ID
            result = users_collection.update_one(
                {'_id': user_id},
                {'$pull': {'watchlist': ticker}}
            )
        
        if result.modified_count == 0:
            # User might not have this ticker or user not found
            # Check if user exists
            try:
                user = users_collection.find_one({'_id': ObjectId(user_id)})
            except:
                user = users_collection.find_one({'_id': user_id})
                
            if not user:
                return jsonify({'success': False, 'message': 'User not found'}), 404
                
            # Ticker not in watchlist - not an error, just informational
            return jsonify({
                'success': True,
                'message': 'Ticker was not in watchlist'
            })
        
        return jsonify({
            'success': True,
            'message': f'Removed {ticker} from watchlist'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# User deletion endpoint
@app.route('/api/user/delete', methods=['DELETE'])
def delete_user():
    try:
        data = request.get_json()
        user_id = data.get('userId')
        password = data.get('password')
        
        if not user_id or not password:
            return jsonify({
                'success': False,
                'message': 'User ID and password are required'
            }), 400
        
        # Verify user exists in MongoDB
        user_collection = client.db.users
        user = user_collection.find_one({'_id': ObjectId(user_id)})
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        # Verify password - passwords are stored with bcrypt
        if bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            # Delete user's watchlist
            watchlist_collection = client.db.watchlists
            watchlist_collection.delete_many({'userId': user_id})
            
            # Delete user's portfolio
            portfolio_collection = client.db.portfolios 
            portfolio_collection.delete_many({'userId': user_id})
            
            # Delete user's analysis history
            history_collection = client.db.analysis_history
            history_collection.delete_many({'userId': user_id})
            
            # Delete the user
            user_collection.delete_one({'_id': ObjectId(user_id)})
            
            return jsonify({
                'success': True,
                'message': 'User account and related data deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Invalid password'
            }), 401
            
    except Exception as e:
        print(f"Error deleting user: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error deleting user: {str(e)}'
        }), 500

@app.route('/get-sentiment-adjusted-price', methods=['GET'])
def get_sentiment_adjusted_price():
    try:
        ticker = request.args.get('ticker')
        
        if not ticker:
            return jsonify({
                'success': False,
                'error': 'No ticker provided'
            })
        
        # Set up paths
        current_dir = os.path.dirname(os.path.abspath(__file__))
        sentiment_script_path = os.path.join(current_dir, 'lstm_files', 'sentiment_adjusted_price.py')
        
        # Call the sentiment analysis script with the ticker as parameter
        result = subprocess.run(
            [sys.executable, sentiment_script_path, ticker],
            capture_output=True,
            text=True,
            check=False
        )
        
        # Extract the adjusted price from the output
        output = result.stdout
        print(f"Raw script output: {output}")  # Debug print
        
        # First try to find the exact pattern - done this way because chatbot
        # responses might differ
        match = re.search(r'Next Day Adjusted Price:\s*(\d+\.?\d*)', output)
        
        # If the exact pattern doesn't match, try more generic patterns
        if not match:
            # Try multiple patterns from most specific to most generic
            patterns = [
                r'Adjusted Price:?\s*(\d+\.?\d*)',
                r'adjusted price:?\s*(\d+\.?\d*)',
                r'price:?\s*(\d+\.?\d*)',
                r'prediction:?\s*(\d+\.?\d*)',
                r'(\d+\.\d+)'  # Just look for any decimal number as last resort
            ]
            
            for pattern in patterns:
                match = re.search(pattern, output, re.IGNORECASE)
                if match:
                    break
        
        # If we still don't have a match, check stderr
        if not match and result.stderr:
            print(f"Script stderr: {result.stderr}")  # Debug print
            for pattern in patterns:
                match = re.search(pattern, result.stderr, re.IGNORECASE)
                if match:
                    break
        
        # If we still don't have a match, check if the script exited with error
        if not match:
            # Provide a fallback price based on the ticker's last price
            try:
                stock = yf.Ticker(ticker)
                current_price = stock.fast_info['lastPrice']
                # Add a small adjustment (1% increase) as fallback
                adjusted_price = current_price * 1.01
                print(f"Using fallback price for {ticker}: {adjusted_price}")
                
                return jsonify({
                    'success': True,
                    'adjusted_price': round(adjusted_price, 2),
                    'note': 'Using fallback price due to script execution issue'
                })
            except Exception as e:
                print(f"Error getting fallback price: {str(e)}")
                return jsonify({
                    'success': False,
                    'error': 'Failed to extract adjusted price and fallback also failed'
                })
        
        # If we have a match, use it
        try:
            adjusted_price = float(match.group(1))
            return jsonify({
                'success': True,
                'adjusted_price': adjusted_price
            })
        except (ValueError, IndexError) as e:
            print(f"Error converting price: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Error converting price: {str(e)}'
            })
        
    except Exception as e:
        print(f"Error in sentiment adjusted price: {str(e)}")
        traceback_str = traceback.format_exc()
        print(f"Traceback: {traceback_str}")
        return jsonify({
            'success': False,
            'error': str(e)
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)