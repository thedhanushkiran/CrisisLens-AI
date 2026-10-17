import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from backend.app.api import accounts, misinformation, reports, responder, triage
from backend.app.config import get_settings
from backend.app.database import SessionLocal

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("crisislens")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("CrisisLens API started; database configuration loaded")
    yield


app = FastAPI(
    title="CrisisLens AI API",
    description="Prototype disaster-report intake, offline synchronization, and human responder review API.",
    version="1.0.0",
    lifespan=lifespan,
)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

_rate_window: dict[str, deque[float]] = defaultdict(deque)
_RATE_LIMIT_PATHS = {
    "/api/v1/reports",
    "/api/v1/reports/sync",
    "/api/v1/misinformation/claims",
    "/api/v1/accounts/register",
    "/api/v1/accounts/login",
}


@app.middleware("http")
async def development_rate_limit(request: Request, call_next):
    if request.method == "POST" and request.url.path in _RATE_LIMIT_PATHS:
        now = time.monotonic()
        key = f"{request.client.host if request.client else 'unknown'}:{request.url.path}"
        requests = _rate_window[key]
        while requests and now - requests[0] >= 60:
            requests.popleft()
        limit = 10 if request.url.path in {
            "/api/v1/accounts/register",
            "/api/v1/accounts/login",
        } else settings.rate_limit_per_minute
        if len(requests) >= limit:
            return JSONResponse(status_code=429, content={"detail": "Request rate limit exceeded"})
        requests.append(now)
    return await call_next(request)


@app.get("/api/v1/health", tags=["health"])
def health():
    return {"status": "ok", "service": "crisislens-api"}


@app.get("/api/v1/ready", tags=["health"])
def readiness():
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Readiness database check failed")
        return JSONResponse(status_code=503, content={"status": "not_ready", "database": "unavailable"})
    return {"status": "ready", "database": "available"}


app.include_router(reports.router)
app.include_router(accounts.router)
app.include_router(responder.router)
app.include_router(responder.admin_router)
app.include_router(triage.router)
app.include_router(misinformation.router)
