package main

import (
	"log"
	"net/http"
	"os"
	"os/exec"
	"sync"
	"fmt"
)

type Server struct {
	mu sync.Mutex
}

func (s *Server) stockHandler(w http.ResponseWriter, r *http.Request){

	ticker := r.URL.Query().Get("ticker")

	s.mu.Lock()
	defer s.mu.Unlock()
	
	if err := exec.Command(
	"../backend/lstm_files/.venv/Scripts/python.exe", // A: executable
	"../backend/v2/predict.py",     // B: script it runs
	ticker,                                           // C: script's argument
).Run(); err != nil {
		http.Error(w, "prediction failed", http.StatusInternalServerError)
        return
	}

	file := fmt.Sprintf("../backend/lstm_files/%s_prediction_data.json", ticker)
	data, err := os.ReadFile(file)

	if err != nil {
        http.Error(w, "prediction not found", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)

}

func main(){

	server := &Server{}
	http.HandleFunc("GET /stock-info", server.stockHandler)
	log.Fatal(http.ListenAndServe(":8080", nil))
}

