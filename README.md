NeuroTrade
Stock market prediction platform | Legacy project and independent rebuild

NeuroTrade is a project focused on using historical market data and machine learning to help individual investors explore next-day stock-price predictions. This repository contains the original university-era work and a newer, independently developed iteration.
Project status: The current iteration is focused exclusively on the Go backend and Python machine-learning pipeline. Frontend development is deferred. Predictions are experimental, not financial advice, and have not yet been validated as suitable for investment decisions.

Contents
- Part I — Original NeuroTrade (Legacy)
- Part II — NeuroTrade Rebuild (Current)
- Prioritized Development Backlog
- Proposed Sprint Roadmap
Part I — Original NeuroTrade (Legacy)
Background and objective
The original NeuroTrade was developed as a collaborative university project exploring stock-market analysis, visualization, and price forecasting. Its broader vision combined market-data processing, machine-learning experimentation, and a user-facing application.

The legacy work is preserved as a research and learning reference. The current iteration is not intended to copy another contributor's model implementation. Instead, it will examine the original design choices, assess their strengths and limitations, and independently implement justified improvements.
Originally documented capabilities
The original repository README describes the following areas of work or intended functionality:
- Collection and processing of financial market data.
- Exploratory data analysis and visualizations.
- Experimentation with traditional machine-learning and deep-learning approaches, including references to linear regression, random forests, LSTMs, and GRUs.
- Historical evaluation and backtesting workflows.
- A frontend-oriented vision for interacting with forecasts and analytics.
Important: These are capabilities described in the original README; they are not a verified inventory of fully implemented or production-ready features. The legacy code and notebooks need a dedicated audit to establish what was actually built and how it performed.
Legacy technology overview
The original documentation identifies Python and Jupyter for data science, with TypeScript/JavaScript for frontend development. The current rebuild also treats the older Python model work as a separate legacy reference.

The original README's setup instructions and directory overview may not accurately describe every file in the repository today. Review the relevant legacy directories before attempting to run older components.
How the legacy model will be used
1. Analyze: Document the original model architecture, input features, preprocessing, training, and evaluation.
2. Compare: Identify differences between the legacy approach and the current LSTM pipeline.
3. Evaluate: Distinguish evidence-supported design decisions from assumptions and potential weaknesses.
4. Redesign independently: Write new implementation code, with rationale and tests, rather than copying the original model's source.
No claim is made that the original model is more accurate than the rebuild. That must be determined through comparable evaluation.
Part II — NeuroTrade Rebuild (Current)
Current objective and scope
The rebuild is a backend-first stock-price prediction service. Given a ticker symbol, it obtains market data, ensures that a model artifact exists, performs inference, and returns a next-day predicted price, an RMSE value, and a UTC timestamp.

In scope: Go HTTP API, Python/Keras LSTM model, market-data retrieval, preprocessing, model lifecycle, performance, reliability, testing, and deployment preparation.

Out of scope for now: Frontend development, multi-day forecasts, advanced trading signals, Redis, and Kubernetes. A stock-specific news feature and visualization are future product ideas, not current backend deliverables.
Current technology stack
Layer	Technology	Role
HTTP API	Go (net/http)	Request handling and response serialization
Process orchestration	Go (os/exec)	Launch Python training and inference scripts
ML pipeline	Python, Keras/TensorFlow, NumPy	Preprocessing, LSTM training, and inference
Market data	yfinance	Historical price retrieval
Model artifacts	.keras files	Persist trained models for reuse
Development environment	Windows / PowerShell	Current local development workflow


Current architecture
HTTP client
    |
    | GET /stock-info?ticker=AAPL
    v
Go HTTP server (:8080)
    |
    v
PythonPredictor.Predict(ticker)
    |
    +-- acquire per-ticker mutex
    |
    +-- extractModel(ticker)
    |      |
    |      +-- check for saved .keras model
    |      +-- if absent: runPython(train.py, ticker)
    |
    +-- runPrediction(ticker)
    |      |
    |      +-- runPython(predict.py, ticker)
    |      +-- decode structured JSON from stdout
    |
    +-- release per-ticker mutex
    v
Go HTTP response (JSON)
runPython() centralizes Python process execution, stdout/stderr capture, JSON decoding, and application-error mapping. The model artifact remains on disk, but prediction results no longer require an intermediary JSON file.
Concurrency model
A short-lived mutex protects the map of ticker-specific mutexes. Each ticker has its own mutex, preventing overlapping operations for the same ticker while permitting work for different tickers to proceed concurrently. This does not yet limit overall training concurrency or resource consumption; those are planned improvements.
API contract
GET /stock-info?ticker={SYMBOL}
Example:
Invoke-RestMethod "http://localhost:8080/stock-info?ticker=AAPL"
Successful response shape (illustrative values):
{
  "next_day_price": 334.00,
  "rmse": 11.94,
  "timestamp": "2026-10-20T10:58:13Z"
}
HTTP status	Meaning
200	Prediction returned
400	Missing or invalid ticker
422	Insufficient market data
503	Market data unavailable
500	Unexpected prediction or execution failure


The exact prediction value depends on the available data and model state. RMSE is an evaluation metric, not a guarantee of future accuracy. The current evaluation pipeline is scheduled for correctness review.
Internal Go–Python communication protocol
Go passes the ticker as a command-line argument. Python emits exactly one JSON object on stdout; diagnostic output belongs on stderr. A nonzero process exit indicates an execution failure rather than a business-level error code.

Successful prediction:
{
  "status": "success",
  "data": {
    "next_day_price": 334.00,
    "rmse": 11.94,
    "timestamp": "2026-10-20T10:58:13Z"
  }
}
Successful training:
{"status": "success"}
Expected application error:
{
  "status": "error",
  "error": {
    "code": "INVALID_TICKER",
    "message": "No market data found for the requested ticker"
  }
}
Recognized application error codes: INVALID_TICKER, INSUFFICIENT_DATA, and MARKET_DATA_UNAVAILABLE. Go maps these to application errors and appropriate HTTP status codes. The Python scripts and their dependencies must avoid non-JSON stdout output.
Local setup (Windows / PowerShell)
Prerequisites
- Go installed and available on PATH.
- Python environment with the ML pipeline's required dependencies installed.
- Network access to the configured market-data provider.
- Repository checked out locally.
Install Python dependencies using the dependency specification appropriate to the current backend environment. The precise dependency-install command should be verified against the repository's current files.
Configure paths
Set these environment variables in the PowerShell session used to launch Go:
$env:NEUROTRADE_BACKEND = "C:\path\to\NeuroTrade\backend"
$env:NEUROTRADE_PYTHON  = "C:\path\to\python.exe"
Both must be absolute paths. NEUROTRADE_BACKEND points to the Python backend directory containing v2/ and lstm_files/. NEUROTRADE_PYTHON points to the Python executable in the environment containing the ML dependencies.
Run the API
cd "C:\path\to\NeuroTrade\go_backend"
go run .
In another terminal:
Invoke-RestMethod "http://localhost:8080/stock-info?ticker=AAPL"
For a standalone executable:
go build -o neurotrade.exe .
The environment variables must be set in the process environment used to start the executable.
Current implementation progress
ID	Change	Status
NT-001	Refactor PythonPredictor into focused methods	Implemented
NT-002	Use per-ticker mutexes	Implemented; concurrency verification pending
NT-003	Configure portable Python and backend paths	Implemented; cross-directory verification pending
NT-004	Use structured JSON over stdout for Go–Python communication	Implemented in shared code; integration verification pending
NT-005	Map Python application errors to HTTP responses	Implemented
NT-006	Add basic Go HTTP handler unit tests	Previously passed; expanded testing pending


Status note: Implementation does not imply that ML correctness, model accuracy, concurrency behavior, or end-to-end protocol handling has been fully verified.
Prioritized Development Backlog
This is the current planning backlog. Priorities reflect dependency and risk, not an estimate of task size. IDs are stable identifiers, not execution order.
P0 — Critical: Legacy model research and ML correctness
ID	Backlog item	Done when
NT-038	Analyze original NeuroTrade model	Architecture, training, preprocessing, and evaluation are documented
NT-039	Compare original and current models	Strengths, weaknesses, and design differences are documented without assuming superiority
NT-040	Design independent ML improvements	A justified redesign specification is approved; no original source is copied
NT-007	Eliminate data leakage	Chronological split; scaler fitted only on training data
NT-008	Persist and reuse the fitted scaler	Training and inference use the same fitted preprocessing artifact
NT-009	Standardize preprocessing	Training, evaluation, and inference share compatible transformations and window sizes
NT-010	Define model freshness/retraining	Training cutoff and retraining conditions are explicit
NT-011	Handle damaged/incompatible artifacts	Failures are controlled; recovery or retraining policy is defined
NT-012	Establish trustworthy evaluation	Chronological holdout, baseline comparison, and metrics are documented
NT-013	Correct market-data error classification	Invalid ticker, insufficient data, and provider failures are distinct


P1 — High: Performance and resource efficiency
ID	Backlog item	Done when
NT-014	Profile request latency	Fetch, preprocessing, training, loading, and inference times are measured
NT-015	Eliminate redundant fetching	Duplicate market-data retrieval is reduced or avoided
NT-016	Optimize inference startup/loading	Improvements are benchmarked against baseline latency
NT-017	Tune LSTM architecture and training	Candidate configurations are compared for accuracy and runtime
NT-018	Improve model caching	Compatible models are reused and stale models invalidated
NT-019	Improve concurrency management	Same-ticker work is serialized and cross-ticker resource use is bounded
NT-020	Add subprocess timeout/cancellation	Long-running Python work can be stopped safely
NT-021	Control CPU/memory consumption	Resource limits or scheduling prevent overload


P2 — Medium: Testing and observability (currently deferred)
ID	Backlog item	Done when
NT-022	Test JSON protocol	Success, application error, malformed output, and crashes are covered
NT-023	Test concurrency/races	Same-ticker and cross-ticker requests are verified
NT-024	Test preprocessing	Scaling, splits, and window construction are covered
NT-025	Add model regression checks	Meaningful model behavior changes are detectable
NT-026	Add end-to-end integration tests	Go → Python → data → model → HTTP flow is exercised
NT-027	Add performance benchmarks	Latency, memory, and training-time baselines are recorded
NT-028	Improve structured logging	Logs distinguish training, inference, provider, and process failures
NT-029	Validate/normalize ticker input	Invalid and unsafe inputs are rejected before processing


P3 — Lower: Production readiness
ID	Backlog item	Done when
NT-030	Containerize backend and model	Reproducible Docker execution is documented
NT-031	Persist model/scaler artifacts	Artifacts survive restarts and deployments
NT-032	Add CI	Automated checks run for pull requests
NT-033	Formalize configuration	Environment configuration and validation are documented
NT-034	Add health/readiness endpoints	Deployment infrastructure can assess service health
NT-035	Support graceful shutdown	Requests and subprocesses are handled on termination
NT-036	Plan AWS deployment	Compute, storage, security, and cost requirements are documented
NT-037	Maintain backend documentation	Architecture, setup, and API documentation remain current


Proposed Sprint Roadmap
Sprint	Focus	Backlog items
1	Legacy model research and independent redesign	NT-038–NT-040
2	ML data integrity	NT-007–NT-009
3	Evaluation and model lifecycle	NT-010–NT-013
4	Performance investigation	NT-014–NT-017
5	Runtime efficiency	NT-018–NT-021
6	Testing and observability	NT-022–NT-029
7	Deployment readiness	NT-030–NT-037


These are proposed sprint groupings, not fixed commitments. Sprint planning should consider effort, dependencies, and available capacity. Deferred testing should be brought forward where necessary to establish correctness or safely evaluate an implementation.
Engineering principles
- Correctness before speed: Establish sound preprocessing and evaluation before optimizing latency.
- Measure before optimizing: Use profiling and benchmarks to identify bottlenecks.
- Independent implementation: Learn from the legacy model without copying another contributor's code.
- Small, reviewable changes: Keep backend, model, and infrastructure improvements incremental.
- Explicit validation status: Distinguish implemented work from tested and verified work.
Project disclaimer
NeuroTrade is an experimental software and machine-learning project. Forecasts are uncertain and should not be treated as personalized financial advice or a guarantee of future market prices.