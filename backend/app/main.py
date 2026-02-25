from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.utils import get_openapi
from fastapi.openapi.docs import get_swagger_ui_html
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.infrastructure.database.session import engine
from app.infrastructure.database import models  # noqa: F401
from app.infrastructure.database.session import Base
from app.api.routes import auth, tasks, planning, analytics, notifications, gdpr

# ──── Init ────────────────────────────────────────────────────────────────────
setup_logging()
logger = get_logger(__name__)
Base.metadata.create_all(bind=engine)
limiter = Limiter(key_func=get_remote_address)

# ──── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="DAILFOW API",
    version=settings.APP_VERSION,
    description="""
## 🧠 DAILFOW — Intelligent Daily Flow Manager

### 🔑 Comment s'authentifier dans Swagger

**Étape 1** — `POST /api/v1/auth/register` → créer un compte

**Étape 2** — `POST /api/v1/auth/login` → récupérer l'`access_token`

**Étape 3** — Cliquer **🔓 Authorize** (bouton en haut à droite)

**Étape 4** — Dans le champ **bearerAuth**, coller **uniquement le token** :
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0...
```
⚠️ **Ne pas écrire `Bearer` devant** — Swagger l'ajoute automatiquement.

**Étape 5** — Cliquer **Authorize** puis **Close** → toutes les routes protégées fonctionnent.
    """,
    docs_url=None,       # on définit notre propre /docs ci-dessous
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    swagger_ui_parameters={
        "persistAuthorization": True,
        "displayRequestDuration": True,
    },
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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", error=str(exc), path=request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# ──── Custom Swagger UI with Bearer auth ──────────────────────────────────────
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="DAILFOW API — Swagger UI",
        swagger_ui_parameters={
            "persistAuthorization": True,
            "displayRequestDuration": True,
            "defaultModelsExpandDepth": -1,
        },
    )


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )

    # ── Declare the bearerAuth scheme ─────────────────────────────────────────
    schema.setdefault("components", {})
    schema["components"]["securitySchemes"] = {
        "bearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Coller uniquement le access_token (sans 'Bearer ')",
        }
    }

    # ── Apply security only to routes that are NOT register/login/refresh/health
    public_paths = {
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/health",
        "/",
    }

    for path, path_data in schema["paths"].items():
        for method, operation in path_data.items():
            if path not in public_paths:
                operation["security"] = [{"bearerAuth": []}]
            else:
                # Explicitly mark public routes as no security needed
                operation["security"] = []

    app.openapi_schema = schema
    return app.openapi_schema


app.openapi = custom_openapi


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
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}


@app.get("/", tags=["System"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs": "/docs",
        "redoc": "/redoc",
        "version": settings.APP_VERSION,
    }