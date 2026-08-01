import os
import uvicorn
import shutil

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.src.core.config_loader import CONFIG
from backend.src.core.limiter import limiter  
from backend.src.vector_store.vector_store_utils import get_collection_stats
from backend.app.routes import router

app = FastAPI(
    title=CONFIG.get("app", {}).get("name", "Research Mentor AI API"),
    description="Production-ready REST API server for AI-powered Research platform",
    version="1.0.0",

)

#  Attach Limiter State & Exception Handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

#  Middlewares Setup (CORS + Trusted Hosts)
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if ENVIRONMENT == "production":
    allowed_origins = [
        "https://research-mentor-rust.vercel.app",  
    ]
    allowed_hosts = [
        "research-mentor-rust.vercel.app",
        "*.onrender.com",  
        "127.0.0.1",
        "localhost",
    ]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    allowed_hosts = ["*"]

app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(router)

@app.get("/health", tags=["System Verification"])
async def health_check():
    """Production health check probing ChromaDB and Disk space."""
    health_status = "healthy"
    checks = {}

    #  Check ChromaDB Readability & Stats
    try:
        stats = get_collection_stats()
        if "error" in stats:
            checks["chromadb"] = {"status": "unhealthy", "details": stats["error"]}
            health_status = "degraded"
        else:
            checks["chromadb"] = {"status": "healthy", "collections": stats}
    except Exception as e:
        checks["chromadb"] = {"status": "unhealthy", "error": str(e)}
        health_status = "unhealthy"

    # Check Available Disk Space
    try:
        total, used, free = shutil.disk_usage("/")
        free_gb = round(free / (1024 ** 3), 2)
        checks["disk_space"] = {
            "status": "healthy" if free_gb > 1.0 else "warning",
            "free_gb": free_gb
        }
        if free_gb <= 0.5:
            health_status = "degraded"
    except Exception as e:
        checks["disk_space"] = {"status": "unknown", "error": str(e)}

    return {
        "status": health_status,
        "environment": ENVIRONMENT,
        "api_version": "1.0.0",
        "checks": checks
    }

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)