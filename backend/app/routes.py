from fastapi import APIRouter, Query, HTTPException, Depends, status , Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from backend.src.core.logger import logger
from backend.src.core.limiter import limiter
from backend.src.orchestrator.search_orchestrator import ResearchPlatformOrchestrator
from backend.src.orchestrator.chat_orchestrator import ChatOrchestrator
from backend.src.core.jwt_handler import create_access_token, get_current_user

# 1. Initialize API Router instance with clear prefix and grouping tags
router = APIRouter(prefix="/api", tags=["Research Operations"])

# 2. Instantiate the ML Pipeline Orchestrators outside routes to prevent memory re-load leaks
try:
    logger.info("Initializing ML Orchestrator inside Web API Routes...")
    orchestrator = ResearchPlatformOrchestrator()

    logger.info("Initializing Chat Orchestrator inside Web API Routes...")
    chat_orchestrator = ChatOrchestrator()

except Exception as e:
    logger.critical(f"Failed to load core ML components onto API layer: {e}")
    raise RuntimeError(f"Core ML engine failure: {e}")


# ----------------------------------------------------------------------
# Login Endpoint (Public Endpoint)
# ----------------------------------------------------------------------
@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request, form_data: 
                OAuth2PasswordRequestForm = Depends()):
    """Authenticates the user and returns an 8-hour JWT access token."""
    # Replace with your database validation or credential check logic
    if form_data.username != "admin" or form_data.password != "password123":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 8 hours lifetime ke sath access token banega
    access_token = create_access_token(data={"sub": form_data.username})
    return {"access_token": access_token, "token_type": "bearer"}


# ----------------------------------------------------------------------
# Request schema for starting a search
# ----------------------------------------------------------------------
class SearchRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=300)
    description: str = Field(default="", max_length=1000)


# ----------------------------------------------------------------------
# 3. Start a new search — builds the ranked pool once, returns first page
# ----------------------------------------------------------------------
@router.post("/search")
@limiter.limit("10/minute")
async def start_search(
    request: Request,
    payload: SearchRequest, 
    current_user: str = Depends(get_current_user)
):
    """
    Starts a new search:
    - Runs Gemini query enhancement on (topic, description).
    - Builds a ranked candidate pool (cache-hit papers first, external
      papers filling any remaining slots).
    - Generates summaries only for the first page of results.
    - Returns a search_id used by /search/more for pagination.
    """
    topic = payload.topic.strip()

    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be blank or whitespace.")

    try:
        logger.info(f"User '{current_user}' issued search request. Topic: '{topic}'")

        result = orchestrator.start_search(topic=topic, description=payload.description)

        if result["search_id"] is None:
            return {
                "search_id": None,
                "results": [],
                "has_more": False,
                "total_pool_size": 0,
            }

        return result

    except Exception as e:
        logger.exception(f"Search pipeline execution failed for topic: '{topic}'")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing the research papers: {str(e)}",
        )


# ----------------------------------------------------------------------
# 4. Load the next page of an existing search
# ----------------------------------------------------------------------
@router.get("/search/more")
async def load_more_results(
    search_id: str = Query(..., description="search_id returned by POST /api/search"),
    current_count: int = Query(..., ge=0, description="How many results already shown"),
    current_user: str = Depends(get_current_user)
):
    """
    Returns the next page (up to PAGE_SIZE) of an existing search pool.
    """
    try:
        result = orchestrator.load_more(search_id=search_id, current_count=current_count)

        if result.get("expired"):
            raise HTTPException(
                status_code=410,
                detail="This search session has expired. Please search again.",
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Load more failed for search_id: '{search_id}'")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while fetching more results: {str(e)}",
        )


# ----------------------------------------------------------------------
# 5. Paper detail + recommendations
# ----------------------------------------------------------------------
@router.get("/paper/{paper_id}")
async def get_paper_detail(
    paper_id: str, 
    current_user: str = Depends(get_current_user)
):
    """Returns complete paper information along with similar paper recommendations."""
    try:
        result = orchestrator.get_paper_details(paper_id)

        if result is None:
            raise HTTPException(status_code=404, detail="Paper not found")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Paper detail API failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve paper details.")


# ----------------------------------------------------------------------
# Request schema for asking a chat question
# ----------------------------------------------------------------------
class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


# ----------------------------------------------------------------------
# 6. Prepare a paper for chat (lazy PDF fetch + chunk + embed)
# ----------------------------------------------------------------------
@router.post("/paper/{paper_id}/chat/prepare")
async def prepare_paper_chat(
    paper_id: str, 
    current_user: str = Depends(get_current_user)
):
    """
    Triggers the PDF fetch + chunk + embed pipeline for this paper.
    """
    try:
        result = chat_orchestrator.prepare_chat(paper_id)

        if not result["paper_found"]:
            raise HTTPException(status_code=404, detail="Paper not found")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Chat preparation failed for paper_id: '{paper_id}'")
        raise HTTPException(status_code=500, detail="Failed to prepare this paper for chat.")


# ----------------------------------------------------------------------
# 7. Ask a question about a specific paper (RAG chat)
# ----------------------------------------------------------------------
@router.post("/paper/{paper_id}/chat")
@limiter.limit("15/minute")
async def ask_paper_question(
    request: Request,
    paper_id: str, 
    payload: ChatRequest, 
    current_user: str = Depends(get_current_user)
):
    """
    Answers a user's question about a specific paper.
    """
    try:
        result = chat_orchestrator.ask(paper_id=paper_id, question=payload.question)

        if not result["paper_found"]:
            raise HTTPException(status_code=404, detail="Paper not found")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Chat answer failed for paper_id: '{paper_id}'")
        raise HTTPException(status_code=500, detail="Failed to answer the question.")