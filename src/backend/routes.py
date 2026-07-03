from fastapi import APIRouter, Query, HTTPException
from src.common.logger import logger
from src.main import ResearchPlatformOrchestrator

# 1. Initialize API Router instance with clear prefix and grouping tags
router = APIRouter(prefix="/api", tags=["Research Operations"])

# 2. Instantiate the ML Pipeline Orchestrator outside routes to prevent memory re-load leaks
try:
    logger.info("Initializing ML Orchestrator inside Web API Routes...")
    orchestrator = ResearchPlatformOrchestrator()
except Exception as e:
    logger.critical(f"Failed to load core ML components onto API layer: {e}")
    raise RuntimeError(f"Core ML engine failure: {e}")


# 3. Dedicated GET endpoint for Semantic Search & AI Summary
@router.get("/search")
async def semantic_paper_search(
    query: str = Query(..., description="The research topic or paragraph description entered by the user")
):
    """
    Core Search API:
    - Automatically checks ChromaDB for a semantic match (Cache Hit).
    - If below threshold, fires arXiv client ingestion & Gemini summaries (Cache Miss).
    - Returns structured JSON array safely to the frontend UI dashboard.
    """
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query string cannot be blank or whitespace.")
        
    try:
        logger.info(f"API Server received search request for query: '{query}'")
        
        # FIX SYNC: Passing query text into your exact signature parameter 'user_query'
        # Your run_pipeline returns data internally, but prints output. 
        # For API response uniformity, we capture it cleanly.
        results = orchestrator.run_pipeline(user_query=query)
        
        # Safety fallback logic: If your pipeline returns None, return empty structure instead of crash
        if results is None:
            results = []
            
        return {
            "query": query,
            "papers": results
        }
        
    except Exception as e:
        logger.error(f"Internal breakdown during API search execution for '{query}': {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"An error occurred while processing the research papers: {str(e)}"
        )