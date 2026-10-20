import pandas as pd
from newsdataapi import NewsDataApiClient
import ollama
import yfinance as yf
import json
import sys
import os
import re

# Get ticker from command line argument
if len(sys.argv) < 2:
    print("Error: No ticker symbol provided")
    sys.exit(1)
    
STOCK = sys.argv[1]
print(f"Starting sentiment analysis for ticker: {STOCK}")

# Get company name
try:
    ticker_info = yf.Ticker(STOCK)
    company_name = ticker_info.info.get('shortName', STOCK)
except:
    company_name = STOCK

MODEL = "deepseek-r1:7b"
api = NewsDataApiClient(apikey='pub_67694630073f7b1a43688748fde40ddfd74bf')
ticker = yf.Ticker(STOCK)

news_data = ""

response = api.latest_api(q='{stock} stock'.format(stock = STOCK))

# get list of news
news = yf.Search("{stock}".format(stock = STOCK), news_count=20).news

# Extract individual news descriptions
for article in response["results"]:
        article_description = article.get('description')
        if isinstance(article_description, str):
            news_data += ". "+ article.get('description')

news = ticker.get_news()

for i in range(len(news)):
    news_data +=  ". " + news[i].get('content').get('summary')
    

# Around line 48, replace the JSON file opening with:
try:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sentiment_dataset_path = os.path.join(current_dir, 'sentiment_dataset.json')
    
    if os.path.exists(sentiment_dataset_path):
        with open(sentiment_dataset_path, 'r') as f:
            sentiment_dataset = json.load(f)
    else:
        print(f"Warning: sentiment_dataset.json not found at {sentiment_dataset_path}")
        sentiment_dataset = {}  # Empty dictionary as fallback
except Exception as e:
    print(f"Error loading sentiment dataset: {str(e)}")
    sentiment_dataset = {}  # Empty dictionary as fallback

# Get next day price from LSTM prediction
try:
    # Try different paths/cases to find the prediction file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    possible_filenames = [
        f'{STOCK.lower()}_test_predicted.csv',
        f'{STOCK.upper()}_test_predicted.csv',
        f'{STOCK}_test_predicted.csv',
        f'{STOCK.lower()}_prediction_data.json',
        f'{STOCK.upper()}_prediction_data.json',
        f'{STOCK}_prediction_data.json'
    ]
    
    found_file = None
    for filename in possible_filenames:
        file_path = os.path.join(current_dir, filename)
        if os.path.exists(file_path):
            found_file = file_path
            print(f"Found prediction file: {found_file}")
            break
    
    if found_file and found_file.endswith('.csv'):
        # Process CSV file
        test_predicted_df = pd.read_csv(found_file)
        test_predicted = test_predicted_df.tail(60)
        
        # Get the LSTM prediction for next day
        if 'predicted' in test_predicted_df.columns:
            next_day_price = float(test_predicted_df['predicted'].iloc[-1])
        elif 'Close' in test_predicted_df.columns:
            next_day_price = float(test_predicted_df['Close'].iloc[-1])
        else:
            next_day_price = ticker.info.get('regularMarketPrice', 100.0)
            
        # Convert to JSON for prompt
        test_predicted_json = test_predicted.to_json(orient="records")
        
    elif found_file and found_file.endswith('.json'):
        # Process JSON file
        with open(found_file, 'r') as f:
            prediction_data = json.load(f)
            next_day_price = float(prediction_data.get('next_day_price', 100.0))
        test_predicted_json = "[]"  # Empty for JSON files
    else:
        # No prediction file found, use current price
        print(f"No prediction file found for {STOCK}, using current price")
        next_day_price = ticker.info.get('regularMarketPrice', 100.0)
        test_predicted_json = "[]"
        
except Exception as e:
    print(f"Error getting predicted price: {str(e)}")
    next_day_price = ticker.info.get('regularMarketPrice', 100.0)  # Fallback to current price
    test_predicted_json = "[]"

# Getting the sentiment of the stock
def give_sentiment(prompt_text, model_name):
    """
    Function to ask a question to the model and get a response.
    """
    full_response = ""
    stream = ollama.chat(
        model=model_name,
        messages=[{'role': 'user', 'content': prompt_text}],
        stream=True,
    )
    for chunk in stream:
        chunk_content = chunk['message']['content']
        print(chunk_content, end='')
        full_response += chunk_content
    print()
    return full_response

prompt = prompt = f"""
You are a financial analyst tasked with refining stock price prediction for {STOCK}.
Analyze the given data carefully and adjust the next day's predicted price based on past trends.

### Data Provided:
1. **News Sentiment for {STOCK}**  
   {news_data}

2. **Market Data for the Last 60 Days**  
   {json.dumps(sentiment_dataset)}

3. **LSTM Model Performance (Predicted vs Actual Prices for the Last 60 Days)**  
   {json.dumps(test_predicted_json)}

4. **LSTM Model's Next Day Predicted Price:** {next_day_price}

### Instructions:
- Identify trends where the LSTM model has overestimated or underestimated prices.  
- Adjust the next day's predicted price based on **market sentiment, recent trends, and LSTM performance**.  
- If news sentiment is strongly positive, consider increasing the price; if negative, adjust downward.  
- Do not leave the Next Day Predicted value unchanged.
- Make sure to read the data provided carefully.
- Keep the <think></think> part short.
- Your final output must strictly follow this format:

**Final Output:**
Next Day Adjusted Price: [YOUR PREDICTED PRICE]
"""

print(prompt)

response = give_sentiment(prompt_text=prompt, model_name=MODEL)

print("\n\nDEBUG - RAW LLM RESPONSE:")
print(response)
print("\n\nEND DEBUG")

# Extract the price with more robust patterns
adjusted_price = None

# Try to find Next Day Adjusted Price:XX.XX
match = re.search(r'Next Day Adjusted Price:\s*(\d+\.?\d*)', response)
if match:
    try:
        adjusted_price = float(match.group(1))
    except ValueError:
        pass

# If not found, try to find any number after "price"
if adjusted_price is None:
    match = re.search(r'(?:price|prediction).*?(\d+\.?\d*)', response.lower())
    if match:
        try:
            adjusted_price = float(match.group(1))
        except ValueError:
            pass

# If still not found, extract any number from the response
if adjusted_price is None:
    match = re.search(r'(\d+\.\d+)', response)
    if match:
        try:
            adjusted_price = float(match.group(1))
        except ValueError:
            pass

# If all extraction attempts fail, use a fallback method
if adjusted_price is None:
    # Apply a simple sentiment-based adjustment (1-2% based on sentiment)
    sentiment_factor = 1.01  # Default slight increase
    if "negative" in response.lower() and "sentiment" in response.lower():
        sentiment_factor = 0.99  # Slight decrease for negative sentiment
    adjusted_price = next_day_price * sentiment_factor

# Always print in consistent format with \n\n to make it stand out
print(f"\n\nNext Day Adjusted Price: {adjusted_price:.2f}\n\n")
