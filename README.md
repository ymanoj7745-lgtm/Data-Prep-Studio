# Data Prep Studio

Data Prep Studio is a local web application for interactive dataset cleaning.
Users can upload tabular data, inspect data quality, apply common cleaning
operations, preview the result, generate quick visualizations, and export both
the cleaned CSV and the equivalent Pandas script.

The application is intentionally stateful and lightweight: uploaded datasets are
kept in memory for the active backend process, making it suitable for local
analysis workflows, demos, and rapid prototyping.

## Features

- Upload CSV, TSV, Excel, JSON, and Parquet files.
- Inspect row count, column count, missing values, duplicates, and inferred
  column types.
- Preview the current dataframe after each operation.
- Apply common cleaning steps:
  - impute missing values
  - sanitize numeric-looking text
  - cast column types
  - trim whitespace
  - drop duplicate rows
  - drop or rename columns
- Generate basic charts for one or two selected columns.
- Export the cleaned dataset as CSV.
- Export a replayable Pandas script for the performed operations.

## Tech Stack

### Backend

- Python
- FastAPI
- Pandas
- NumPy
- Uvicorn

### Frontend

- React
- CRACO / Create React App
- Axios
- Radix UI
- Recharts
- Sonner
- Lucide React

## Repository Structure

```text
.
+-- Backend/
|   +-- requirements.txt
|   +-- server.py
+-- Frontend/
|   +-- public/
|   +-- src/
|   +-- craco.config.js
|   +-- package.json
|   +-- package-lock.json
+-- .gitignore
+-- README.md
```

## Prerequisites

- Python 3.11 recommended
- Node.js and npm
- Git

Python 3.11 is recommended because some scientific Python packages and pinned
dependencies may not install cleanly on newer Python releases.

## Backend Setup

From the repository root:

```bash
cd Backend
python -m venv ../.venv311
../.venv311/Scripts/python -m pip install -r requirements.txt
../.venv311/Scripts/python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

On macOS or Linux, use:

```bash
../.venv311/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

The backend should be available at:

```text
http://127.0.0.1:8000
```

Health check:

```text
GET http://127.0.0.1:8000/api/
```

Expected response:

```json
{
  "service": "Data Prep Studio",
  "status": "ok"
}
```

## Frontend Setup

From the repository root:

```bash
cd Frontend
npm install --legacy-peer-deps
```

Start the frontend with the local backend URL:

```bash
set REACT_APP_BACKEND_URL=http://127.0.0.1:8000
set WDS_SOCKET_PORT=3000
set BROWSER=none
npm start
```

On macOS or Linux:

```bash
REACT_APP_BACKEND_URL=http://127.0.0.1:8000 \
WDS_SOCKET_PORT=3000 \
BROWSER=none \
npm start
```

The frontend should be available at:

```text
http://127.0.0.1:3000
```

## API Overview

All backend routes are prefixed with `/api`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Health check |
| `POST` | `/sessions/upload` | Upload a dataset and create an in-memory session |
| `GET` | `/sessions/{sid}` | Get current session state |
| `POST` | `/sessions/{sid}/impute` | Impute missing values in a column |
| `POST` | `/sessions/{sid}/sanitize` | Sanitize values in a column |
| `POST` | `/sessions/{sid}/cast` | Cast a column to a target type |
| `POST` | `/sessions/{sid}/drop_column` | Drop a column |
| `POST` | `/sessions/{sid}/rename_column` | Rename a column |
| `POST` | `/sessions/{sid}/drop_duplicates` | Drop duplicate rows |
| `POST` | `/sessions/{sid}/strip_whitespace` | Trim whitespace in a column |
| `POST` | `/sessions/{sid}/chart` | Generate chart-ready data |
| `GET` | `/sessions/{sid}/script` | Export generated Pandas script |
| `GET` | `/sessions/{sid}/download_csv` | Export cleaned CSV |

## Environment Variables

Backend:

```text
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
CORS_ORIGINS=*
```

Frontend:

```text
REACT_APP_BACKEND_URL=http://127.0.0.1:8000
WDS_SOCKET_PORT=3000
ENABLE_HEALTH_CHECK=false
```

The current backend workflow is in-memory and does not require MongoDB for the
core upload, cleaning, preview, chart, script export, or CSV export flows.

## Development Notes

- The frontend dependency tree currently requires `npm install --legacy-peer-deps`
  because some packages declare older peer ranges.
- If `emergentintegrations==0.2.0` is unavailable from your package index and
  you are only running the local data-prep workflow, it can be omitted because
  it is not used by the current backend code path.
- Runtime artifacts such as virtual environments, `node_modules`, local `.env`
  files, caches, and scratch data are intentionally ignored by Git.

## Verified Local Workflow

The following flows have been verified locally:

- Backend health check
- Dataset upload
- Session state retrieval
- Missing-value imputation
- Whitespace trimming
- Duplicate-row removal
- Chart data generation
- CSV export
- Pandas script export
- Frontend upload flow and dashboard update

## License

No license has been specified yet.
