from keras.models import Sequential
from keras.layers import LSTM, Dense
from windows import TIMESTEPS


def build_model(timesteps=TIMESTEPS):
    model = Sequential([
        LSTM(150, return_sequences=True, input_shape=(timesteps, 1)),
        LSTM(64, return_sequences=False),
        Dense(32),
        Dense(16),
        Dense(1)
    ])
    model.compile(optimizer="adam", loss="mse")
    return model


def train_model(model, x_train, y_train, epochs=5, batch_size=16, verbose=1):
    return model.fit(x_train, y_train, epochs=epochs, batch_size=batch_size, verbose=verbose)


if __name__ == "__main__":
    import sys
    from windows import make_windows

    w = make_windows(sys.argv[1])
    model = build_model()
    history = train_model(model, w["x_train"], w["y_train"])
    print(history.history["loss"])