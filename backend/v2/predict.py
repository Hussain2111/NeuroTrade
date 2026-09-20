import numpy as np
import json
import sys
import datetime
from pathlib import Path

from windows import make_windows, TIMESTEPS
from train import build_model, train_model


def evaluate(model, scaler, x_test, y_test):
    predictions = scaler.inverse_transform(model.predict(x_test, verbose=0))
    y_test = scaler.inverse_transform(y_test.reshape(-1, 1))
    return float(np.sqrt(np.mean((y_test - predictions) ** 2)).round(2))


def predict_next_day(model, scaler, scaled):
    recent = scaled[-TIMESTEPS:, 0:1].reshape(1, TIMESTEPS, 1)
    next_day_scaled = model.predict(recent, verbose=0)
    return scaler.inverse_transform(next_day_scaled)[0, 0]


def main(ticker):
    w = make_windows(ticker)

    model = build_model()
    train_model(model, w["x_train"], w["y_train"], verbose=0)

    rmse = evaluate(model, w["scaler"], w["x_test"], w["y_test"])
    print(f"Root Mean Square Error: {rmse}")

    next_day_price = predict_next_day(model, w["scaler"], w["scaled"])
    print(f"Predicted next day price: ${next_day_price:.2f}")

    out_dir = Path(__file__).resolve().parent.parent / "lstm_files"
    out_dir.mkdir(exist_ok=True)

    prediction_data = {
        "next_day_price": round(float(next_day_price), 2),
        "rmse": rmse,
        "timestamp": datetime.datetime.now().isoformat(),
    }

    out_path = out_dir / f"{ticker}_prediction_data.json"
    with open(out_path, "w") as f:
        json.dump(prediction_data, f)
    print(f"Saved to: {out_path}")


if __name__ == "__main__":
    main(sys.argv[1])