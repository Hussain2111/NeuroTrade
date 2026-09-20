from keras.models import Sequential
from keras.layers import LSTM, Dense
from windows import x_train, y_train

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

print(history.history['loss'])
