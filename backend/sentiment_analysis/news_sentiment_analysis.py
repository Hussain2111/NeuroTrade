import os
import sys
from newsdataapi import NewsDataApiClient
import yfinance as yf

# Standalone script, not called from the Flask app — add backend/ to sys.path
# to reach the shared groq_client module, same as sentiment_adjusted_price.py.
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import groq_client

MODEL = None  # let groq_client fall back to its configured default

api = NewsDataApiClient(apikey=os.environ.get("NEWSDATA_API_KEY"))
STOCK = "Starbucks"
ticker = yf.Ticker('SBUX')

news_data = ""

# Get the news response from newsdata api
response = api.latest_api(q='{stock} stock'.format(stock = STOCK))

# Get list of news
news = yf.Search("{stock}".format(stock = STOCK), news_count=20).news

# Extract individual descriptions
for article in response["results"]:
        article_description = article.get('description')
        if isinstance(article_description, str):
            news_data += article.get('description')

# Get news from yfinance
news = ticker.get_news()

# Extract summary of news articles
for i in range(10):
    news_data += news[i].get('content').get('summary')

def give_sentiment(prompt_text, model_name):
    """
    Function to pass the prompt and news to the model and get a response.
    """
    response = groq_client.chat(
        model=model_name,
        messages=[{'role': 'user', 'content': prompt_text}],
    )
    print(response)

prompt = """Give me a sentiment analysis in percentage 
            terms of negative and positive of {stock} based on 
            the following news articles. Give the percentages 
            on the last line of the output""".format(stock = STOCK)

prompt_complete = prompt + news_data

give_sentiment(prompt_text=prompt_complete, model_name=MODEL)