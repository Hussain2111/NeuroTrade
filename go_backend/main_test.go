package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"encoding/json"
	"errors"
)

type FakePredictor struct {
	prediction Prediction
	err error
}

func (f *FakePredictor) Predict(ticker string) (Prediction, error) {
	return f.prediction, f.err
}
func TestStockHandler (t *testing.T){
	fake := &FakePredictor {
		prediction: Prediction{
			NextDayPrice: 329.43,
			RMSE:         11.82,
			Timestamp:    time.Date(2026, 10, 5, 13, 19, 34, 0, time.UTC),
		},
	}
	server := &Server{predictor: fake}

	request := httptest.NewRequest(
		http.MethodGet,
		"/stock-info?ticker=AAPL",
		nil,
	)

	response := httptest.NewRecorder()

	server.stockHandler(response, request)

	if response.Code != http.StatusOK {
		t.Errorf(
			"expected status %d but got %d",
			http.StatusOK,
			response.Code,
		)
	}

	var result Prediction

	err := json.NewDecoder(response.Body).Decode(&result)

	if err != nil {
		t.Fatalf("failed to decode response %v", err)
	}

	if result.NextDayPrice != fake.prediction.NextDayPrice {
		t.Errorf(
			"expected price %.2f, but got %.2f",
			fake.prediction.NextDayPrice,
			result.NextDayPrice,
		)
	}
}

func TestStockHandlerErrors(t *testing.T) {
	type Tests struct {
		name string
		err error
		wantStatus int
	}

	cases := []Tests{
		{"Invalid Ticker", ErrInvalidTicker, http.StatusBadRequest},
		{"Insufficient Data", ErrInsufficientData , http.StatusUnprocessableEntity},
		{"Market Data Unavailable", ErrMarketDataUnavailable, http.StatusServiceUnavailable},
		{"Unexpected Error", errors.New("Unexpected error"), 500},
	}

	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			fake := &FakePredictor {
				err: test.err,
			}
			server := &Server{predictor: fake}
			request := httptest.NewRequest(
				http.MethodGet,
				"/stock-info?ticker=AAPL",
				nil,
			)
			response := httptest.NewRecorder()
			server.stockHandler(response, request)
			got := response.Code
			if got != test.wantStatus {
				t.Errorf("expected %d, got %d", test.wantStatus, got)
			}
		})
	}
} 

func TestStockHandlerMissingTicker(t *testing.T) {
    server := &Server{}

    request := httptest.NewRequest(
        http.MethodGet,
        "/stock-info",
        nil,
    )

    response := httptest.NewRecorder()

    server.stockHandler(response, request)

    if response.Code != http.StatusBadRequest {
        t.Errorf(
            "expected status %d, got %d",
            http.StatusBadRequest,
            response.Code,
        )
    }
}