"""Data Prep Studio backend.

In-memory session-based dataframe cache. Every mutation appends a Pandas code
line to an ordered "code recorder" buffer that can be exported as a runnable
Python script.
"""
from __future__ import annotations

import io
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("dataprep")

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB

# ---------------------------------------------------------------------------
# Session store (in-memory)
# ---------------------------------------------------------------------------
class Session:
    def __init__(self, filename: str, df: pd.DataFrame):
        self.id: str = str(uuid.uuid4())
        self.filename: str = filename
        self.df: pd.DataFrame = df
        self.created_at: datetime = datetime.now(timezone.utc)
        self.code_lines: List[str] = []
        # Seed with imports + read line
        self.code_lines.append("import pandas as pd")
        self.code_lines.append("import numpy as np")
        ext = filename.rsplit(".", 1)[-1].lower()
        reader = {
            "csv": f"df = pd.read_csv('{filename}')",
            "xls": f"df = pd.read_excel('{filename}')",
            "xlsx": f"df = pd.read_excel('{filename}')",
            "json": f"df = pd.read_json('{filename}')",
            "tsv": f"df = pd.read_csv('{filename}', sep='\\t')",
        }.get(ext, f"df = pd.read_csv('{filename}')")
        self.code_lines.append(reader)

    def record(self, line: str) -> None:
        self.code_lines.append(line)


SESSIONS: Dict[str, Session] = {}


def get_session(sid: str) -> Session:
    if sid not in SESSIONS:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    return SESSIONS[sid]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _sanitize_cell(v: Any) -> Any:
    if isinstance(v, float):
        if pd.isna(v) or np.isinf(v):
            return None
        return v
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        f = float(v)
        return None if (np.isnan(f) or np.isinf(f)) else f
    if isinstance(v, (pd.Timestamp, datetime)):
        return v.isoformat()
    if v is pd.NA:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return v


def df_preview(df: pd.DataFrame, n: int = 50) -> Dict[str, Any]:
    head = df.head(n)
    rows = [[_sanitize_cell(v) for v in row] for row in head.itertuples(index=False, name=None)]
    return {
        "columns": [str(c) for c in df.columns],
        "dtypes": [str(t) for t in df.dtypes],
        "rows": rows,
        "shape": [int(df.shape[0]), int(df.shape[1])],
    }


def _infer_semantic_type(s: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(s):
        return "boolean"
    if pd.api.types.is_numeric_dtype(s):
        return "numeric"
    if pd.api.types.is_datetime64_any_dtype(s):
        return "datetime"
    # try coerce to numeric on a sample to detect "dirty numeric"
    sample = s.dropna().astype(str).head(200)
    if len(sample) == 0:
        return "text"
    cleaned = sample.str.replace(r"[\$,%\s]", "", regex=True)
    coerced = pd.to_numeric(cleaned, errors="coerce")
    if coerced.notna().mean() > 0.85:
        return "dirty_numeric"
    # datetime-ish?
    dt = pd.to_datetime(sample, errors="coerce", format="mixed")
    if dt.notna().mean() > 0.85:
        return "dirty_datetime"
    return "text"


def df_health(df: pd.DataFrame) -> Dict[str, Any]:
    rows, cols = df.shape
    total = int(df.isna().sum().sum())
    duplicates = int(df.duplicated().sum())

    per_col: List[Dict[str, Any]] = []
    for c in df.columns:
        s = df[c]
        missing = int(s.isna().sum())
        semantic = _infer_semantic_type(s)
        unique = int(s.nunique(dropna=True))
        col_info: Dict[str, Any] = {
            "name": str(c),
            "dtype": str(s.dtype),
            "semantic": semantic,
            "missing": missing,
            "missing_pct": round(missing / max(rows, 1) * 100, 2),
            "unique": unique,
            "anomaly": semantic in ("dirty_numeric", "dirty_datetime") or missing > 0,
        }
        if semantic == "numeric":
            desc = s.dropna()
            if len(desc) > 0:
                col_info["min"] = _sanitize_cell(desc.min())
                col_info["max"] = _sanitize_cell(desc.max())
                col_info["mean"] = _sanitize_cell(float(desc.mean()))
        per_col.append(col_info)

    return {
        "rows": int(rows),
        "cols": int(cols),
        "total_missing": total,
        "duplicates": duplicates,
        "columns": per_col,
    }


def _read_upload(filename: str, data: bytes) -> pd.DataFrame:
    name = filename.lower()
    buf = io.BytesIO(data)
    if name.endswith(".csv"):
        return pd.read_csv(buf)
    if name.endswith(".tsv"):
        return pd.read_csv(buf, sep="\t")
    if name.endswith((".xls", ".xlsx")):
        return pd.read_excel(buf)
    if name.endswith(".json"):
        return pd.read_json(buf)
    if name.endswith(".parquet"):
        return pd.read_parquet(buf)
    raise HTTPException(status_code=400, detail=f"Unsupported file type: {filename}")


# ---------------------------------------------------------------------------
# App / routes
# ---------------------------------------------------------------------------
app = FastAPI(title="Data Prep Studio")
api = APIRouter(prefix="/api")


class ImputeBody(BaseModel):
    column: str
    strategy: str  # mean | median | mode | zero | constant | drop_rows
    value: Optional[Any] = None


class ColumnBody(BaseModel):
    column: str


class CastBody(BaseModel):
    column: str
    target: str  # numeric | datetime | string | integer | boolean


class RenameBody(BaseModel):
    column: str
    new_name: str


class ChartQuery(BaseModel):
    kind: Optional[str] = None
    columns: List[str]


@api.get("/")
async def root() -> Dict[str, str]:
    return {"service": "Data Prep Studio", "status": "ok"}


@api.post("/sessions/upload")
async def upload(file: UploadFile = File(...)) -> Dict[str, Any]:
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 50MB limit")
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        df = _read_upload(file.filename or "upload.csv", data)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        log.exception("parse failed")
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")
    sess = Session(file.filename or "upload.csv", df)
    SESSIONS[sess.id] = sess
    return {
        "session_id": sess.id,
        "filename": sess.filename,
        "health": df_health(df),
        "preview": df_preview(df),
        "code": sess.code_lines,
    }


@api.get("/sessions/{sid}")
async def get_state(sid: str) -> Dict[str, Any]:
    s = get_session(sid)
    return {
        "session_id": s.id,
        "filename": s.filename,
        "health": df_health(s.df),
        "preview": df_preview(s.df),
        "code": s.code_lines,
    }


@api.post("/sessions/{sid}/impute")
async def impute(sid: str, body: ImputeBody) -> Dict[str, Any]:
    s = get_session(sid)
    col = body.column
    if col not in s.df.columns:
        raise HTTPException(400, f"Unknown column: {col}")
    strat = body.strategy
    series = s.df[col]
    if strat == "mean":
        if not pd.api.types.is_numeric_dtype(series):
            raise HTTPException(400, "Mean requires numeric column")
        v = float(series.mean())
        s.df[col] = series.fillna(v)
        s.record(f"df[{col!r}] = df[{col!r}].fillna(df[{col!r}].mean())")
    elif strat == "median":
        if not pd.api.types.is_numeric_dtype(series):
            raise HTTPException(400, "Median requires numeric column")
        s.df[col] = series.fillna(float(series.median()))
        s.record(f"df[{col!r}] = df[{col!r}].fillna(df[{col!r}].median())")
    elif strat == "mode":
        mode = series.mode(dropna=True)
        if len(mode) == 0:
            raise HTTPException(400, "No mode value")
        s.df[col] = series.fillna(mode.iloc[0])
        s.record(f"df[{col!r}] = df[{col!r}].fillna(df[{col!r}].mode().iloc[0])")
    elif strat == "zero":
        s.df[col] = series.fillna(0)
        s.record(f"df[{col!r}] = df[{col!r}].fillna(0)")
    elif strat == "constant":
        val = body.value if body.value is not None else ""
        s.df[col] = series.fillna(val)
        s.record(f"df[{col!r}] = df[{col!r}].fillna({val!r})")
    elif strat == "drop_rows":
        before = len(s.df)
        s.df = s.df.dropna(subset=[col]).reset_index(drop=True)
        s.record(f"df = df.dropna(subset=[{col!r}]).reset_index(drop=True)")
        return {"removed": before - len(s.df), **_state_payload(s)}
    else:
        raise HTTPException(400, f"Unknown strategy: {strat}")
    return _state_payload(s)


@api.post("/sessions/{sid}/sanitize")
async def sanitize(sid: str, body: ColumnBody) -> Dict[str, Any]:
    s = get_session(sid)
    col = body.column
    if col not in s.df.columns:
        raise HTTPException(400, f"Unknown column: {col}")
    s.df[col] = s.df[col].astype(str).str.replace(r"[\$,%\s]", "", regex=True).replace({"nan": np.nan, "": np.nan, "N/A": np.nan, "NA": np.nan, "None": np.nan})
    s.record(
        f"df[{col!r}] = df[{col!r}].astype(str).str.replace(r'[\\$,%\\s]', '', regex=True)"
        f".replace({{'nan': np.nan, '': np.nan, 'N/A': np.nan, 'NA': np.nan, 'None': np.nan}})"
    )
    return _state_payload(s)


@api.post("/sessions/{sid}/cast")
async def cast(sid: str, body: CastBody) -> Dict[str, Any]:
    s = get_session(sid)
    col, tgt = body.column, body.target
    if col not in s.df.columns:
        raise HTTPException(400, f"Unknown column: {col}")
    if tgt == "numeric":
        s.df[col] = pd.to_numeric(s.df[col], errors="coerce")
        s.record(f"df[{col!r}] = pd.to_numeric(df[{col!r}], errors='coerce')")
    elif tgt == "integer":
        s.df[col] = pd.to_numeric(s.df[col], errors="coerce").astype("Int64")
        s.record(f"df[{col!r}] = pd.to_numeric(df[{col!r}], errors='coerce').astype('Int64')")
    elif tgt == "datetime":
        s.df[col] = pd.to_datetime(s.df[col], errors="coerce", format="mixed")
        s.record(f"df[{col!r}] = pd.to_datetime(df[{col!r}], errors='coerce', format='mixed')")
    elif tgt == "string":
        s.df[col] = s.df[col].astype(str)
        s.record(f"df[{col!r}] = df[{col!r}].astype(str)")
    elif tgt == "boolean":
        s.df[col] = s.df[col].astype("boolean")
        s.record(f"df[{col!r}] = df[{col!r}].astype('boolean')")
    else:
        raise HTTPException(400, f"Unknown cast target: {tgt}")
    return _state_payload(s)


@api.post("/sessions/{sid}/drop_column")
async def drop_column(sid: str, body: ColumnBody) -> Dict[str, Any]:
    s = get_session(sid)
    if body.column not in s.df.columns:
        raise HTTPException(400, f"Unknown column: {body.column}")
    s.df = s.df.drop(columns=[body.column])
    s.record(f"df = df.drop(columns=[{body.column!r}])")
    return _state_payload(s)


@api.post("/sessions/{sid}/rename_column")
async def rename_column(sid: str, body: RenameBody) -> Dict[str, Any]:
    s = get_session(sid)
    if body.column not in s.df.columns:
        raise HTTPException(400, f"Unknown column: {body.column}")
    s.df = s.df.rename(columns={body.column: body.new_name})
    s.record(f"df = df.rename(columns={{{body.column!r}: {body.new_name!r}}})")
    return _state_payload(s)


@api.post("/sessions/{sid}/drop_duplicates")
async def drop_dupes(sid: str) -> Dict[str, Any]:
    s = get_session(sid)
    before = len(s.df)
    s.df = s.df.drop_duplicates().reset_index(drop=True)
    s.record("df = df.drop_duplicates().reset_index(drop=True)")
    return {"removed": before - len(s.df), **_state_payload(s)}


@api.post("/sessions/{sid}/strip_whitespace")
async def strip_ws(sid: str, body: ColumnBody) -> Dict[str, Any]:
    s = get_session(sid)
    col = body.column
    if col not in s.df.columns:
        raise HTTPException(400, f"Unknown column: {col}")
    s.df[col] = s.df[col].astype(str).str.strip()
    s.record(f"df[{col!r}] = df[{col!r}].astype(str).str.strip()")
    return _state_payload(s)


@api.get("/sessions/{sid}/script", response_class=PlainTextResponse)
async def script(sid: str) -> str:
    s = get_session(sid)
    header = [
        "# ------------------------------------------------------------",
        "# Generated by Data Prep Studio",
        f"# Session: {s.id}",
        f"# Source file: {s.filename}",
        f"# Generated: {datetime.now(timezone.utc).isoformat()}",
        "# ------------------------------------------------------------",
        "",
    ]
    return "\n".join(header + s.code_lines) + "\n"


@api.get("/sessions/{sid}/download_csv")
async def download_csv(sid: str) -> StreamingResponse:
    s = get_session(sid)
    buf = io.StringIO()
    s.df.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="cleaned_{s.filename}.csv"'},
    )


@api.post("/sessions/{sid}/chart")
async def chart(sid: str, body: ChartQuery) -> Dict[str, Any]:
    s = get_session(sid)
    cols = body.columns
    for c in cols:
        if c not in s.df.columns:
            raise HTTPException(400, f"Unknown column: {c}")

    if len(cols) == 1:
        col = cols[0]
        series = s.df[col].dropna()
        if pd.api.types.is_numeric_dtype(series):
            # histogram
            if len(series) == 0:
                return {"kind": "histogram", "column": col, "bins": []}
            counts, edges = np.histogram(series, bins=20)
            bins = [
                {"bin": f"{edges[i]:.2f}", "start": float(edges[i]), "end": float(edges[i + 1]), "count": int(counts[i])}
                for i in range(len(counts))
            ]
            return {"kind": "histogram", "column": col, "bins": bins}
        # categorical bar
        vc = series.astype(str).value_counts().head(25)
        return {
            "kind": "bar",
            "column": col,
            "bars": [{"category": k, "count": int(v)} for k, v in vc.items()],
        }

    if len(cols) == 2:
        a, b = cols
        sa, sb = s.df[a], s.df[b]
        a_num = pd.api.types.is_numeric_dtype(sa)
        b_num = pd.api.types.is_numeric_dtype(sb)
        if a_num and b_num:
            # scatter (sample up to 2000)
            df2 = s.df[[a, b]].dropna()
            if len(df2) > 2000:
                df2 = df2.sample(2000, random_state=42)
            points = [{"x": float(x), "y": float(y)} for x, y in df2.itertuples(index=False, name=None)]
            return {"kind": "scatter", "x": a, "y": b, "points": points}
        # box plot: pick numeric + categorical
        num_col, cat_col = (a, b) if a_num else (b, a)
        if not pd.api.types.is_numeric_dtype(s.df[num_col]):
            raise HTTPException(400, "Need at least one numeric column for box plot")
        groups = []
        for cat, grp in s.df[[cat_col, num_col]].dropna().groupby(cat_col):
            vals = grp[num_col].astype(float)
            if len(vals) == 0:
                continue
            q1, q2, q3 = np.percentile(vals, [25, 50, 75])
            groups.append(
                {
                    "category": str(cat),
                    "min": float(vals.min()),
                    "q1": float(q1),
                    "median": float(q2),
                    "q3": float(q3),
                    "max": float(vals.max()),
                    "n": int(len(vals)),
                }
            )
        groups = sorted(groups, key=lambda g: g["median"], reverse=True)[:20]
        return {"kind": "box", "x": cat_col, "y": num_col, "groups": groups}

    raise HTTPException(400, "Select 1 or 2 columns")


def _state_payload(s: Session) -> Dict[str, Any]:
    return {
        "health": df_health(s.df),
        "preview": df_preview(s.df),
        "code": s.code_lines,
    }


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
