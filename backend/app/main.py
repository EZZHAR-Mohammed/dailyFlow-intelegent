from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.infrastructure.database.session import engine
from app.infrastructure.database import models  # noqa: F401 - triggers model registration
from app.infrastructure.database.session import Base

from app.api.routes import auth, tasks, planning, analytics, notifications, gdpr

# ──── Init ────────────────────────────────────────────────────────────────────
setup_logging()
logger = get_logger(__name__)

# Create DB tables
Base.metadata.create_all(bind=engine)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# ──── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="DAILFOW API",
    description="""
## 🧠 DAILFOW — Intelligent Daily Flow Manager

Backend API for **DAILFOW**, an AI-powered daily productivity and task planning application.

### Features
- 🔐 **JWT Authentication** with refresh tokens
- ✅ **Smart Task Management** with priority scoring
- ⚡ **Classic Planning Engine** — energy-aligned, break-aware scheduling
- 🤖 **AI Smart Planner** — ML-powered slot recommendations with explainability
- 📊 **Analytics & Scores** — daily/weekly scores, burnout risk prediction
- 🔔 **Notifications** — contextual, smart notifications
- 🛡️ **GDPR Compliance** — data export and account deletion

### Architecture
Built with **Clean Architecture** principles:
- Domain logic is fully decoupled from framework
- Each module is independently testable
- AI decisions are fully explainable
    """,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ──── Middleware ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logger(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    logger.info(
        "HTTP request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=duration
    )
    return response


# ──── Exception handlers ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", error=str(exc), path=request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ──── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(planning.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(gdpr.router, prefix="/api/v1")


# ──── Health ──────────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health_check():
    """API health check endpoint."""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/", tags=["System"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs": "/docs",
        "redoc": "/redoc",
        "version": settings.APP_VERSION
    }
