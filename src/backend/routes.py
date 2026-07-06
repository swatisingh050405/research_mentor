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
    query: str = Query(
    ...,
    min_length=2,
    max_length=300
),
   offset: int = Query(
    default=0,
    ge=0,
    description="Pagination offset"
)
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
        
        # 4. Pipeline Execution
        results = orchestrator.run_pipeline(user_query=query, offset=offset)
        logger.info(f"Received Query : {query}")
        
        # 5. Response Formatting
        if results is None:

            logger.warning(
                "Pipeline returned None. Sending empty response."
            )

            results = []
            
        return {
            "query": query,
            "offset": offset,
            "count": len(results),
            "papers": results
        }
    except Exception as e:
        logger.exception(
        f"Pipeline execution failed for query: {query}"
    )
        raise HTTPException(
            status_code=500, 
            detail=f"An error occurred while processing the research papers: {str(e)}"
        )

@router.get("/paper/{paper_id}")
async def get_paper_detail(paper_id: str):
    """
    Returns complete paper information along with similar paper recommendations.
    """

    try:
        result = orchestrator.get_paper_details(paper_id)

        if result is None:
            raise HTTPException(
                status_code=404,
                detail="Paper not found"
            )

        return result

    except Exception as e:
        logger.error(f"Paper detail API failed: {e}")

        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve paper details."
        )