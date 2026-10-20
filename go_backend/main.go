package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"sync"
	"time"
	"errors"
)

type PythonPredictor struct {
	mu sync.Mutex
}

type Prediction struct {
	NextDayPrice float64   `json:"next_day_price"`
	RMSE         float64   `json:"rmse"`
	Timestamp    time.Time `json:"timestamp"`
}

type Predictor interface {
	Predict(ticker string) (Prediction, error)
}

type Server struct {
	predictor Predictor
}

var ErrInvalidTicker = errors.New("invalid ticker")
var ErrInsufficientData = errors.New("insufficient market data")
var ErrMarketDataUnavailable = errors.New("market data unavailable")

func pythonErr(err error) error {
	var exitError *exec.ExitError

    if errors.As(err, &exitError) {
        switch exitError.ExitCode() {
			case 2:
				return ErrInvalidTicker
			case 3:
				return ErrInsufficientData
			case 4:
				return ErrMarketDataUnavailable
        }
    }
    return err
}
func (p *PythonPredictor) Predict(ticker string) (Prediction, error) {

	p.mu.Lock()
	defer p.mu.Unlock()
	modelFile := fmt.Sprintf("../backend/lstm_files/%s_model.keras", ticker)
	script := "C:/Users/Hussain/Documents/Projects/NeuroTrade/backend/lstm_files/.venv/Scripts/python.exe"
	_, err := os.Stat(modelFile)

	if os.IsNotExist(err) {
		// Model doesn't exist, so train it.
		output, err := exec.Command(
			script,
			"../backend/v2/train.py",
			ticker,
		).CombinedOutput()
		if err != nil {
		// Something else went wrong while checking the model file.
			log.Println("Python training error:", err)
    		log.Println("Python output:", string(output))

			return Prediction{}, pythonErr(err)
		}

	} else if err != nil {
		log.Println("Error checking model file:", err)
		return Prediction{}, err
	}
	
	output, err := exec.Command(
		script,
		"../backend/v2/predict.py",
		ticker,
	).CombinedOutput()

	if err != nil {
		log.Println("Python prediction error:", err)
    	log.Println("Python output:", string(output))

		return Prediction{}, pythonErr(err)
	}
	file := fmt.Sprintf("../backend/lstm_files/%s_prediction_data.json", ticker)
	data, err := os.ReadFile(file)

	if err != nil {
		return Prediction{}, err
	}
	var prediction Prediction

	if err := json.Unmarshal(data, &prediction); err != nil {
		return Prediction{}, err
	}

	return prediction, nil
}

func (s *Server) stockHandler(w http.ResponseWriter, r *http.Request) {
	ticker := r.URL.Query().Get("ticker")

	if ticker == "" {
		http.Error(
			w, "Ticker is required", http.StatusBadRequest,
		)
		return
	}
	prediction, err := s.predictor.Predict(ticker)

	if errors.Is(err, ErrInvalidTicker) {
		http.Error(w, "invalid ticker", http.StatusBadRequest)
		return
	}

	if errors.Is(err, ErrMarketDataUnavailable){
		http.Error(w, "market data not available", http.StatusServiceUnavailable)
		return
	}

	if errors.Is(err, ErrInsufficientData){
		http.Error(w, "insufficient data", http.StatusUnprocessableEntity)
		return
	}
	if err != nil {
		http.Error(w, "prediction failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(prediction); err != nil {
		http.Error(w, "failed to encode prediction", http.StatusInternalServerError)
		return
	}
}

func main() {

	server := &Server{
		predictor: &PythonPredictor{},
	}
	http.HandleFunc("GET /stock-info", server.stockHandler)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
