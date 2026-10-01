package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
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

func (p *PythonPredictor) Predict(ticker string) (Prediction, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	python := "../backend/lstm_files/.venv/Scripts/python.exe"
	model := filepath.Join("../backend/lstm_files", fmt.Sprintf("%s_model.keras", ticker))

	if _, err := os.Stat(model); os.IsNotExist(err) {
		if err := exec.Command(
			python,
			"../backend/v2/train.py",
			ticker,
		).Run(); err != nil {
			return Prediction{}, err
		}
	} else if err != nil {
		return Prediction{}, err
	}

	if err := exec.Command(
		python,
		"../backend/v2/predict.py",
		ticker,
	).Run(); err != nil {
		return Prediction{}, err
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

	prediction, err := s.predictor.Predict(ticker)
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
