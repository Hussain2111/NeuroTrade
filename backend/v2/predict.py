import json
import sys
import datetime
from pathlib import Path
from fetch_data import NoMarketData, InsuffcientMarketData, MarketDataUnavailable

try:
    from windows import test_data, scaler, scaled, timesteps
    import numpy as np
    from keras.models import load_model

    ticker = sys.argv[1]
    out_dir = Path(__file__).resolve().parent.parent / "lstm_files"
    out_dir.mkdir(exist_ok=True)

    model = load_model(out_dir / f"{ticker}_model.keras")

    x_test, y_test = [], []

    for i in range(14, len(test_data)):
        x_test.append(test_data[i-14:i, 0])
        y_test.append(test_data[i, 0])

    x_test, y_test = np.array(x_test), np.array(y_test)
    x_test = np.reshape(x_test, (x_test.shape[0], x_test.shape[1], 1))

    predictions = model.predict(x_test, verbose=0)

    predictions = scaler.inverse_transform(predictions)
    y_test = scaler.inverse_transform(y_test.reshape(-1, 1))

    RMSE = np.sqrt(np.mean((y_test-predictions)**2)).round(2)

    recent = scaled[-timesteps:, 0:1].reshape(1, timesteps, 1)
    next_day_scaled = model.predict(recent, verbose=0)
    next_day_price = scaler.inverse_transform(next_day_scaled)[0, 0]

    response = {
        "status": "success",
        "data": {
            "next_day_price": round(float(next_day_price), 2),
            "rmse": float(RMSE),
            "timestamp": datetime.datetime.now(
                datetime.timezone.utc
            ).isoformat(),
        },
    }

    print(json.dumps(response))

except MarketDataUnavailable as err:
    print(json.dumps({
            "status": "error",
            "error": {
                "code": "MARKET_DATA_UNAVAILABLE",
                "message": str(err)
            }
}))
except InsuffcientMarketData as err:
    print(json.dumps({
            "status": "error",
            "error": {
                "code": "INSUFFICIENT_DATA",
                "message": str(err)
            }
}))

except NoMarketData as err:
    print(json.dumps({
        "status": "error",
        "error": {
            "code": "INVALID_TICKER",
            "message": str(err)
        }
}))
