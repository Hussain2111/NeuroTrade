from sklearn.preprocessing import MinMaxScaler
from fetch_data import fetch
import numpy as np
import sys

data = fetch(sys.argv[1])


df = data[["Close"]].values
scaler = MinMaxScaler(feature_range = (0,1))
scaled = scaler.fit_transform(df)

train_size = int(len(scaled)*0.75)
test_size = len(scaled) - train_size

timesteps = 14

train_data = scaled[:train_size, 0:1]
test_data = scaled[train_size-timesteps:, 0:1]

x_train, y_train = [], []

for i in range(timesteps, len(train_data)):
    x_train.append(train_data[i-timesteps:i, 0])
    y_train.append(train_data[i, 0])

x_train, y_train = np.array(x_train), np.array(y_train)
x_train = np.reshape(x_train, (x_train.shape[0], x_train.shape[1], 1))
print(x_train.shape, y_train.shape)







