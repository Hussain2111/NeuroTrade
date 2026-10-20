import math
import datetime
import numpy as np
import pandas as pd
import seaborn as sns
import yfinance as yf
sns.set_style('whitegrid')
import matplotlib.pyplot as plt
plt.style.use("fivethirtyeight")
import os
import keras
import locale
import json
from keras.models import Sequential
from keras.callbacks import EarlyStopping
from keras.layers import Input, Dense, LSTM, Dropout
from keras.optimizers import Adam, SGD

from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, accuracy_score


# Set UTF-8 encoding for output
import sys
sys.stdout.reconfigure(encoding='utf-8')

# Get ticker from command line argument
if len(sys.argv) < 2:
    print("Error: No ticker symbol provided")
    sys.exit(1)
    
STOCK = sys.argv[1]
print(f"Starting multivariate prediction for ticker: {STOCK}")

# Getting today's date for the analysis
today = datetime.datetime.now()
date = "{year}-{month}-{day}".format(year=today.year, month=today.month, day=today.day)

# Choose the number of features used and the time steps for learning
FEATURES = 6
TIMESTEPS = 14

start = '2015-01-01'
end = date

# Get the current directory for absolute paths
current_dir = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(current_dir, 'data')

# Create data directory if it doesn't exist
os.makedirs(data_dir, exist_ok=True)

# Define file paths using absolute paths
vix_path = os.path.join(data_dir, 'vix_dataset.csv')
usdx_path = os.path.join(data_dir, 'usdx_dataset.csv')
test_data_path = os.path.join(data_dir, 'test_dataset.csv')
umcsent_path = os.path.join(data_dir, 'UMCSENT.csv')
unrate_path = os.path.join(data_dir, 'UNRATE.csv')
effr_path = os.path.join(data_dir, 'EFFR.csv')

try:
    # Download VIX data
    print("Downloading VIX data...")
    df = yf.download('^VIX', 
                    start=start,
                    end=end,
                    multi_level_index=False)
    df.to_csv(vix_path)
    
    # Download USD index data
    print("Downloading USD index data...")
    df = yf.download('DX-Y.NYB', 
                    start=start,
                    end=end,
                    multi_level_index=False)
    df.to_csv(usdx_path)
    
    # Download stock data for the requested ticker
    print(f"Downloading {STOCK} data...")
    df = yf.download(STOCK, 
                    start=start,
                    end=end,
                    multi_level_index=False)
    df.to_csv(test_data_path)
    
    # Copy other necessary data files if not exists
    # These files should be prepared beforehand
    necessary_files = [
        (umcsent_path, 'data/UMCSENT.csv'),
        (unrate_path, 'data/UNRATE.csv'),
        (effr_path, 'data/EFFR.csv')
    ]
    
    for file_path, default_path in necessary_files:
        if not os.path.exists(file_path):
            # Try to copy from the default relative path
            try:
                if os.path.exists(os.path.join(current_dir, default_path)):
                    import shutil
                    shutil.copy(os.path.join(current_dir, default_path), file_path)
                else:
                    # Create a simple placeholder with default values
                    # If files don't exist, create a simple version for now
                    print(f"Creating placeholder for missing file: {file_path}")
                    placeholder_df = pd.DataFrame({
                        'Date': pd.date_range(start=start, end=end, freq='D'),
                        os.path.basename(file_path).split('.')[0]: [1.0] * len(pd.date_range(start=start, end=end, freq='D'))
                    })
                    placeholder_df.to_csv(file_path, index=False)
            except Exception as e:
                print(f"Error preparing supplementary data file {file_path}: {str(e)}")
                sys.exit(1)
    
    # Load data from files (using absolute paths)
    print("Loading data files...")
    vix_temp = pd.read_csv(vix_path)
    vix_temp = vix_temp['Close']
    
    usdx_temp = pd.read_csv(usdx_path)
    usdx_temp = usdx_temp['Close']
    
    # Load supplementary data
    print("Loading supplementary data...")
    try:
        umcsent_temp = pd.read_csv(umcsent_path)
        umcsent_temp = umcsent_temp['UMCSENT']
        
        unrate_temp = pd.read_csv(unrate_path)
        unrate_temp = unrate_temp['UNRATE']
        
        effr_temp = pd.read_csv(effr_path)
        effr_temp = effr_temp['EFFR']
    except Exception as e:
        print(f"Error reading supplementary data: {str(e)}")
        print("Creating placeholder data...")
        # Create placeholder data if files cannot be read properly
        dates = pd.date_range(start=start, end=end, freq='D')
        umcsent_temp = pd.Series([75.0] * len(dates), index=dates)
        unrate_temp = pd.Series([3.5] * len(dates), index=dates)
        effr_temp = pd.Series([2.0] * len(dates), index=dates)
    
    # Load main stock data
    print("Processing main data...")
    df = pd.read_csv(test_data_path)
    
    # Add the supplementary data
    # Making sure all dataframes have the same length
    df_len = len(df)
    
    # Trim or extend supplementary data to match df length
    df['vix'] = vix_temp.iloc[:df_len] if len(vix_temp) >= df_len else pd.Series([vix_temp.mean()] * df_len)
    df['usdx'] = usdx_temp.iloc[:df_len] if len(usdx_temp) >= df_len else pd.Series([usdx_temp.mean()] * df_len)
    
    # For the remaining indicators, use a simple filling strategy
    df['UNRATE'] = [3.5] * df_len  # Placeholder unemployment rate
    df['UMCSENT'] = [75.0] * df_len  # Placeholder consumer sentiment
    df['EFFR'] = [2.0] * df_len  # Placeholder effective federal funds rate
    
    df = df.set_index('Date')
    
    print("Data preparation complete. Starting LSTM model...")
    
    # Prepare dataset for LSTM
    dataset = df[['Close', 'vix', 'usdx', 'UNRATE', 'UMCSENT', 'EFFR']]
    close_predictions = df[['Close']]
    
    dataset = pd.DataFrame(dataset)
    close_predictions = pd.DataFrame(close_predictions)
    
    data = dataset.values
    close = close_predictions.values
    
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(data)
    scaled_close = scaler.fit_transform(close)
    
    # 90% to Train, 10% to Test
    train_size = int(len(data)*.90)
    test_size = len(data) - train_size
    
    print(f"Train Size: {train_size}, Test Size: {test_size}")
    
    train_data = scaled_data[:train_size, :]
    train_y = scaled_close[:train_size, :]
    
    test_data = scaled_data[train_size-TIMESTEPS:, :]
    test_y = scaled_close[train_size-TIMESTEPS:, :]
    
    # Creating a Training set with TIMESTEPS time-steps and 1 output
    x_train = []
    y_train = []
    
    for i in range(TIMESTEPS, len(train_data)):
        x_train.append(train_data[i-TIMESTEPS:i, :])
        y_train.append(train_y[i, 0])
    
    # Convert to numpy array
    x_train, y_train = np.array(x_train), np.array(y_train)
    
    # Reshaping the input to LSTM format of (ROWS X TIMESTEPS X FEATURES)
    x_train = np.reshape(x_train, (x_train.shape[0], TIMESTEPS, FEATURES))
    
    # Creating a Testing set with TIMESTEPS time-steps and 1 output
    x_test = []
    y_test = []
    
    for i in range(TIMESTEPS, len(test_data)):
        x_test.append(test_data[i-TIMESTEPS:i, :])
        y_test.append(test_y[i, 0])
        
    x_test, y_test = np.array(x_test), np.array(y_test)
    
    x_test = np.reshape(x_test, (x_test.shape[0], TIMESTEPS, FEATURES))
    
    # MODEL DEFINITION AND TRAINING
    model = Sequential([
        Input(shape=(TIMESTEPS, FEATURES)),
        LSTM(150, return_sequences=True),
        LSTM(64, return_sequences=False),
        Dense(32),
        Dense(16),
        Dense(1)
    ])
    
    model.compile(optimizer='adam', loss='mse')
    model.summary()
    
    # Determine if we're running as a subprocess from Flask or directly
    # If called from the Flask app, there will be more than 2 command line arguments
    # or check if running in a subprocess by looking at environment variables
    is_subprocess = False

    # Check if the parent process ID is not the same as the init process (1)
    # or if specific environment variables from Flask are present
    import os
    if "FLASK_APP" in os.environ or "FLASK_ENV" in os.environ:
        is_subprocess = True
    
    # Alternatively, check for parent process type (if on Unix systems)
    if hasattr(os, 'getppid') and os.getppid() != 1:
        try:
            with open(f'/proc/{os.getppid()}/cmdline', 'r') as f:
                parent_cmd = f.read()
                if 'python' in parent_cmd and any(x in parent_cmd for x in ['flask', 'app.py']):
                    is_subprocess = True
        except (FileNotFoundError, PermissionError):
            # If can't read the parent process info, assume it might be a subprocess
            pass
    
    # METHOD FOR ADDING THE PROGRESS BAR
    callbacks_list = [EarlyStopping(monitor='loss', patience=10, restore_best_weights=True)]
    
    # Add TQDM callback if running directly, not as a subprocess
    use_tqdm = not is_subprocess
    
    if use_tqdm:
        try:
            from tqdm.auto import tqdm
            from tensorflow.keras.callbacks import Callback
            
            class TQDMCallback(Callback):
                def on_train_begin(self, logs=None):
                    self.epochs = self.params['epochs']
                    self.progress_bar = tqdm(total=self.epochs, desc="Training Progress", unit="epoch")
                
                def on_epoch_end(self, epoch, logs=None):
                    self.progress_bar.update(1)
                    self.progress_bar.set_postfix(loss=logs.get('loss', 0))
                
                def on_train_end(self, logs=None):
                    self.progress_bar.close()
            
            callbacks_list.append(TQDMCallback())
            print("Using TQDM progress bar for training visualization...")
            verbose_level = 0  # No verbose output when using TQDM
        except ImportError:
            print("TQDM not available, falling back to standard progress display...")
            verbose_level = 1  # Standard progress bar
    else:
        print("Running as subprocess, using standard progress display...")
        verbose_level = 1  # Standard progress bar
    
    # Fitting the LSTM to the Training set
    print("Training model...")
    history = model.fit(
        x_train, 
        y_train, 
        epochs=100,  # Reduced from 250 for faster execution
        batch_size=32, 
        callbacks=callbacks_list,
        verbose=verbose_level
    )
    
    model.summary()
    
    # Plotting the loss of MODEL
    print("Generating loss plot...")
    plt.figure(figsize=(10, 6))
    plt.plot(history.history["loss"])
    plt.legend(['Mean Squared Error'])
    plt.title("Training Losses")
    plt.xlabel("Epochs")
    plt.ylabel("Loss")
    model1_loss_path = os.path.join(current_dir, f'{STOCK}_model1_loss.png')
    plt.savefig(model1_loss_path, bbox_inches='tight', dpi=300)
    plt.close()
    
    # Make predictions
    print("Making predictions...")
    predictions = model.predict(x_test)
    
    # Inverse transform predictions
    predictions = scaler.inverse_transform(np.concatenate([
        predictions, 
        np.zeros((predictions.shape[0], FEATURES-1))
    ], axis=1))[:, 0]
    
    # Inverse scale the true values
    y_test = scaler.inverse_transform(np.concatenate([
        y_test.reshape(-1, 1), 
        np.zeros((y_test.shape[0], FEATURES-1))
    ], axis=1))[:, 0]
    
    # Calculate RMSE
    RMSE = np.sqrt(np.mean((y_test - predictions)**2)).round(2)
    print(f"Root Mean Square Error: {RMSE}")
    
    # Prepare data for plotting
    test = close_predictions.iloc[train_size:, 0:1]
    test['Predicted_Close'] = predictions
    
    # Generate prediction plot
    print("Generating prediction plot...")
    plt.figure(figsize=(20, 10))
    plt.title(f'{STOCK} Close Stock Price Prediction', fontsize=18)
    plt.xlabel('Date', fontsize=12)
    plt.ylabel('Close Price', fontsize=14)
    plt.plot(df['Close'], linewidth=2, color='blue')
    plt.plot(test["Predicted_Close"], linewidth=2, color='red')
    plt.legend(['Actual Close', 'Predicted Close'], fontsize=12)
    
    # Set the graph style for better visibility
    plt.grid(True, alpha=0.3)
    
    # Save the prediction plot
    prediction_plot_path = os.path.join(current_dir, f'{STOCK}_prediction_plot.png')
    plt.savefig(prediction_plot_path, bbox_inches='tight', dpi=300)
    plt.close()
    
    # Saving the test dataset to a file
    test_data_path = os.path.join(current_dir, f'{STOCK}_prediction_data.csv')
    test.to_csv(test_data_path, index=True)
    
    print(f"Plots saved as:")
    print(f"- Model 1 Loss: {model1_loss_path}")
    print(f"- Prediction Plot: {prediction_plot_path}")
    
    # CALCULATING THE AVERAGE DIFFERENCE BETWEEN CLOSING PRICE AND PREDICTED CLOSING PRICE
    averages = np.array([])
    
    for i in range(test.shape[0]):
        row = test.iloc[i]
        avg = abs(row.iloc[0] - row.iloc[1])
        averages = np.append(averages, avg)
    
    average_var = np.average(averages)
    
    print(f"The average value that the price deviates by is: {average_var}")
    
    # Predict the next day's price
    def predict_next_day():
        recent_data = scaled_data[-TIMESTEPS:, :]
        X_recent = recent_data.reshape(1, TIMESTEPS, FEATURES)
        next_day_scaled = model.predict(X_recent)
        
        inverse_pred = np.zeros((1, FEATURES))
        inverse_pred[0, 0] = next_day_scaled[0, 0]
        next_day_price = scaler.inverse_transform(inverse_pred)[0, 0]
        
        return next_day_price
    
    next_day_price = predict_next_day()
    print(f"Predicted price for the next trading day: ${next_day_price:.2f}")
    
    # Calculate the confidence based on RMSE relative to the price
    avg_price = np.mean(y_test)
    confidence_score = max(0, min(100, 100 - (RMSE / avg_price * 100)))
    
    # Determine risk level based on the deviation
    if average_var / avg_price < 0.02:  # Less than 2% deviation
        risk_level = "Low"
        risk_description = "Low Volatility"
    elif average_var / avg_price < 0.05:  # Less than 5% deviation
        risk_level = "Medium"
        risk_description = "Moderate Volatility"
    else:
        risk_level = "High"
        risk_description = "High Volatility"
    
    # Calculate the price change percentage
    price_change = next_day_price - df['Close'].iloc[-1]
    price_change_percent = (price_change / df['Close'].iloc[-1]) * 100
    price_change_text = f"{'+' if price_change >= 0 else ''}{price_change_percent:.2f}% {('Upside' if price_change >= 0 else 'Downside')}"
    
    # Save prediction info to JSON file for frontend use
    prediction_data = {
        "next_day_price": float(next_day_price),
        "average_deviation": float(average_var),
        "confidence_score": float(confidence_score),
        "risk_level": risk_level,
        "risk_description": risk_description,
        "price_change_percent": float(price_change_percent),
        "price_change_text": price_change_text,
        "rmse": float(RMSE),
        "timestamp": datetime.datetime.now().isoformat()
    }
    
    # Save to a ticker-specific JSON file
    prediction_json_path = os.path.join(current_dir, f'{STOCK}_prediction_data.json')
    with open(prediction_json_path, 'w') as json_file:
        json.dump(prediction_data, json_file)
    
    print(f"Prediction data saved to: {prediction_json_path}")

except Exception as e:
    import traceback
    print(f"Error during multivariate LSTM processing: {str(e)}")
    traceback.print_exc()
    sys.exit(1)