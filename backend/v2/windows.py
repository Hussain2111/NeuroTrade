from sklearn.preprocessing import MinMaxScaler
from fetch_data import fetch
import numpy as np

TIMESTEPS = 14


def build_windows(series):
    x, y = [], []
    for i in range(TIMESTEPS, len(series)):
        x.append(series[i - TIMESTEPS:i, 0])
        y.append(series[i, 0])
    return np.array(x).reshape(-1, TIMESTEPS, 1), np.array(y)


def make_windows(ticker):
    data = fetch(ticker)
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled = scaler.fit_transform(data[["Close"]].values)

    train_size = int(len(scaled) * 0.75)

    x_train, y_train = build_windows(scaled[:train_size, 0:1])
    x_test, y_test = build_windows(scaled[train_size - TIMESTEPS:, 0:1])

    return {
        "scaler": scaler,
        "scaled": scaled,
        "x_train": x_train,
        "y_train": y_train,
        "x_test": x_test,
        "y_test": y_test,
    }


if __name__ == "__main__":
    import sys

    w = make_windows(sys.argv[1])
    print(w["x_train"].shape, w["y_train"].shape, w["x_test"].shape, w["y_test"].shape)