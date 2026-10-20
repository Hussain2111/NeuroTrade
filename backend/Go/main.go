package main

import (
	"bytes"
	"encoding/json"
	"errors"
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
	mu    sync.Mutex
	locks map[string]*sync.Mutex

	pythonPath  string
	backendPath string
}

type Prediction struct {
	NextDayPrice float64   `json:"next_day_price"`
	RMSE         float64   `json:"rmse"`
	Timestamp    time.Time `json:"timestamp"`
}

type PythonResponse struct {
	Status string       `json:"status"`
	Data   *Prediction  `json:"data,omitempty"`
	Error  *PythonError `json:"error,omitempty"`
}

type PythonError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
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

func pythonErr(code string) error {
	switch code {
	case "INVALID_TICKER":
		return ErrInvalidTicker
	case "INSUFFICIENT_DATA":
		return ErrInsufficientData
	case "MARKET_DATA_UNAVAILABLE":
		return ErrMarketDataUnavailable
	default:
		return fmt.Errorf("unknown Python error code: %s", code)
	}
}

func (p *PythonPredictor) tickerLock(ticker string) *sync.Mutex {

	p.mu.Lock()
	defer p.mu.Unlock()

	if p.locks == nil {
		p.locks = make(map[string]*sync.Mutex)
	}
	if p.locks[ticker] == nil {
		p.locks[ticker] = &sync.Mutex{}
	}
	return p.locks[ticker]
}

func (p *PythonPredictor) Predict(ticker string) (Prediction, error) {

	mutex := p.tickerLock(ticker)
	mutex.Lock()
	defer mutex.Unlock()

	if err := p.extractModel(ticker); err != nil {
		return Prediction{}, err
	}
	return p.runPrediction(ticker)
}

func NewPythonPredictor() (*PythonPredictor, error) {
	pythonPath := os.Getenv("NEUROTRADE_PYTHON")
	backendPath := os.Getenv("NEUROTRADE_BACKEND")

	if pythonPath == "" {
		return nil, fmt.Errorf("NEUROTRADE_PYTHON is not configured")
	}

	if backendPath == "" {
		return nil, fmt.Errorf("NEUROTRADE_BACKEND is not configured")
	}

	if !filepath.IsAbs(pythonPath) {
		return nil, fmt.Errorf("NEUROTRADE_PYTHON must be an absolute path")
	}

	if !filepath.IsAbs(backendPath) {
		return nil, fmt.Errorf("NEUROTRADE_BACKEND must be an absolute path")
	}

	return &PythonPredictor{
		pythonPath:  pythonPath,
		backendPath: backendPath,
	}, nil
}

func (p *PythonPredictor) modelPath(ticker string) string {
	return filepath.Join(
		p.backendPath,
		"Artifacts",
		ticker+"_model.keras",
	)
}

func (p *PythonPredictor) trainScriptPath() string {
	return filepath.Join(p.backendPath, "v2", "train.py")
}

func (p *PythonPredictor) predictScriptPath() string {
	return filepath.Join(p.backendPath, "v2", "predict.py")
}

func (p *PythonPredictor) runPython(scriptPath, ticker string) (PythonResponse, error) {
	output := exec.Command(
		p.pythonPath,
		scriptPath,
		ticker,
	)

	var response PythonResponse
	var stdout, stderr bytes.Buffer

	output.Stdout = &stdout
	output.Stderr = &stderr

	if err := output.Run(); err != nil {
		log.Println("Python stderr:", stderr.String())
		log.Println("Python process error:", err)
	return PythonResponse{}, fmt.Errorf("Python process failed: %w", err)	

	}
	if err := json.Unmarshal(stdout.Bytes(), &response); err != nil {
		return PythonResponse{}, fmt.Errorf("invalid Python JSON response: %w", err)
	}

	switch response.Status {
	case "success":
		return response, nil

	case "error":
		if response.Error == nil {
			return PythonResponse{}, fmt.Errorf("Python returned error without error details")
		}

		return PythonResponse{}, pythonErr(response.Error.Code)

	default:
		return PythonResponse{}, fmt.Errorf(
			"unexpected Python response status: %q",
			response.Status,
		)
	}
}

func (p *PythonPredictor) runPrediction(ticker string) (Prediction, error) {
	response, err := p.runPython(p.predictScriptPath(), ticker)

	if err != nil {
		return Prediction{}, err
	}

	if response.Data == nil {
		return Prediction{}, fmt.Errorf("Python returned success without prediction data")
	}
	return *response.Data, nil

}

func (p *PythonPredictor) extractModel(ticker string) error {

	_, err := os.Stat(p.modelPath(ticker))

	if os.IsNotExist(err) {
		_, err := p.runPython(p.trainScriptPath(), ticker)
		return err
	}
	if err != nil {
		return err
	}

	return nil
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

	if errors.Is(err, ErrMarketDataUnavailable) {
		http.Error(w, "market data not available", http.StatusServiceUnavailable)
		return
	}

	if errors.Is(err, ErrInsufficientData) {
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

	predictor, err := NewPythonPredictor()
	if err != nil {
		log.Fatal(err)
	}

	server := &Server{
		predictor: predictor,
	}
	http.HandleFunc("GET /stock-info", server.stockHandler)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
