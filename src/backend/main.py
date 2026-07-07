import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from src.common.config_loader import CONFIG
from src.backend.routes import router

# 1. Initialize FastAPI Application Instance
app = FastAPI(
    title=CONFIG.get("app", {}).get("name", "Research Mentor AI API"),
    description="Production-ready REST API server for AI-powered Research platform",
    version="1.0.0"
)

# 2. Configure CORS Guardrails (Allows frontend to talk to backend securely)
# Production Insight: Dashboard running on port 3000 needs explicit permissions
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://research-mentor-rust.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # Restricting access only to our frontend app
    allow_credentials=True,
    allow_methods=["*"],          # Allows GET, POST, OPTIONS, etc.
    allow_headers=["*"],          # Allows all custom/standard headers
)

# 3. Mount the Dedicated API Endpoint Routers
app.include_router(router)

# 4. Health Check Endpoint (To verify if the server is alive)
@app.get("/health", tags=["System Verification"])
async def health_check():
    return {
        "status": "healthy",
        "environment": CONFIG.get("app", {}).get("environment", "development"),
        "api_version": "1.0.0"
    }

   

if __name__ == "__main__":
    # Uvicorn serves the app at http://127.0.0.1:8000
    uvicorn.run("src.backend.main:app", host="127.0.0.1", port=8000, reload=True)