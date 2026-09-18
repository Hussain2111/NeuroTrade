from flask import jsonify
import ollama
import yfinance as yf
from typing import Dict, List, Optional
from datetime import datetime

class ChatbotService:
    def __init__(self, model_name: str = "llama2"):
        self.model = model_name
        self.context = {}
        
    def get_stock_news(self, symbol: str) -> List[Dict]:
        """Fetch recent news for the stock"""
        try:
            stock = yf.Ticker(symbol)
            news = stock.news
            
            formatted_news = []
            for item in news[:5]:  # Get latest 5 news items
                formatted_news.append({
                    'title': item.get('title'),
                    'publisher': item.get('publisher'),
                    'link': item.get('link'),
                    'published': datetime.fromtimestamp(item.get('providerPublishTime', 0)).strftime('%Y-%m-%d %H:%M:%S')
                })
            return formatted_news
        except Exception as e:
            print(f"Error fetching news for {symbol}: {e}")
            return []

    def generate_response(self, message: str, stock_symbol: str, stock_data: Dict) -> str:
        """Generate a response using the LLM model with stock context and news"""
        
        # Get recent news
        news = self.get_stock_news(stock_symbol)
        news_context = "\n".join([f"- {item['title']} ({item['published']})" for item in news])
        
        # Create a comprehensive prompt
        prompt = f"""
        As a stock market expert assistant analyzing {stock_symbol}, with the following data:
        - Current Price: ${stock_data.get('price', 'N/A')}
        - Market Cap: ${stock_data.get('marketCap', 'N/A')}
        - Volume: {stock_data.get('volume', 'N/A')}
        - Daily Change: {stock_data.get('change', 'N/A')}%

        Recent News:
        {news_context}

        User question: {message}

        Provide a concise, professional response focusing on the stock analysis and relevant news.
        """
        
        try:
            response = ollama.chat(
                model=self.model,
                messages=[{'role': 'user', 'content': prompt}],
                stream=False
            )
            return response['message']['content']
        except Exception as e:
            return f"I apologize, but I encountered an error: {str(e)}"

    def process_message(self, user_id: str, message: str, stock_symbol: str) -> Dict:
        """Process a message and return a response with stock data and news"""
        try:
            # Get stock data
            stock = yf.Ticker(stock_symbol)
            stock_data = {
                'price': stock.info.get('currentPrice'),
                'marketCap': stock.info.get('marketCap'),
                'volume': stock.info.get('volume'),
                'change': stock.info.get('regularMarketChangePercent')
            }
            
            # Get response
            response = self.generate_response(message, stock_symbol, stock_data)
            
            # Get news
            news = self.get_stock_news(stock_symbol)
            
            # Update context
            if user_id not in self.context:
                self.context[user_id] = []
            
            self.context[user_id].append({
                'message': message,
                'response': response,
                'timestamp': datetime.now().isoformat()
            })
            
            return {
                'response': response,
                'news': news,
                'stock_data': stock_data,
                'success': True
            }
            
        except Exception as e:
            return {
                'error': str(e),
                'success': False
            }

    def get_conversation_history(self, user_id: str) -> List[Dict]:
        """Get conversation history for a user"""
        return self.context.get(user_id, []) 