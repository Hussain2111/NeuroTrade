from keras.models import Sequential
from keras.layers import LSTM, Dense
from windows import x_train, y_train
import sys
from pathlib import Path

model = Sequential([
    LSTM(150, return_sequences=True, input_shape=(14,1)),
    LSTM(64, return_sequences=False),
    Dense(32),
    Dense(16),
    Dense(1)
])

model.compile(optimizer='adam', loss='mse')

history = model.fit(
    x_train,
    y_train,
    epochs=5,
    batch_size=16,
    verbose=1
)
ticker = sys.argv[1]
out_dir = Path(__file__).resolve().parent.parent / "lstm_files"
out_dir.mkdir(exist_ok=True)
model.save(out_dir / f"{sys.argv[1]}_model.keras")
print(f"Model saved to: {out_dir / (sys.argv[1] + '_model.keras')}")

print(history.history['loss'])
