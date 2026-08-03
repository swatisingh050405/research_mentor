import os
from fastapi import APIRouter, Query, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from backend.src.core.logger import logger
from backend.src.core.limiter import limiter
from backend.src.core.jwt_handler import get_current_user

# 1. Initialize API Router
router = APIRouter(prefix="/api", tags=["Research Operations"])


# Module-level Cached Clients (Prevents Repeated Environment Lookups & Re-creations)

_orchestrator = None
_chat_orchestrator = None
_supabase_client = None

def get_supabase_client():
    global _supabase_client
    if _supabase_client is None:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_key:
            logger.critical("Supabase environment variables missing.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication service is misconfigured."
            )
        
        from supabase import create_client
        _supabase_client = create_client(supabase_url, supabase_key)
        logger.info("⚡ Supabase Client initialized once and cached.")
        
    return _supabase_client


def get_orchestrator():
    global _orchestrator
    if _orchestrator is None:
        logger.info("⚡ Lazy initializing ResearchPlatformOrchestrator...")
        from backend.src.orchestrator.search_orchestrator import ResearchPlatformOrchestrator
        _orchestrator = ResearchPlatformOrchestrator()
    return _orchestrator


def get_chat_orchestrator():
    global _chat_orchestrator
    if _chat_orchestrator is None:
        logger.info("⚡ Lazy initializing ChatOrchestrator...")
        from backend.src.orchestrator.chat_orchestrator import ChatOrchestrator
        _chat_orchestrator = ChatOrchestrator()
    return _chat_orchestrator



@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends()
):
    """Authenticates user using cached Supabase Client instance."""
    try:
        supabase = get_supabase_client()

        auth_response = supabase.auth.sign_in_with_password(
            {
                "email": form_data.username,
                "password": form_data.password,
            }
        )

        if not auth_response.user or not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        logger.info(f"User '{auth_response.user.email}' logged in successfully.")

        return {
            "access_token": auth_response.session.access_token,
            "token_type": "bearer",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Login failed for '{form_data.username}': {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Request Schemas

class SearchRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=300)
    description: str = Field(default="", max_length=1000)

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)

# Search Routes

@router.post("/search")
@limiter.limit("10/minute")
async def start_search(
    request: Request,
    payload: SearchRequest, 
    current_user: str = Depends(get_current_user)
):
    topic = payload.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be blank or whitespace.")

    try:
        logger.info(f"User '{current_user}' issued search request. Topic: '{topic}'")
        engine = get_orchestrator()
        result = engine.start_search(topic=topic, description=payload.description)

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
            detail=f"An error occurred while processing research papers: {str(e)}",
        )


@router.get("/search/more")
async def load_more_results(
    search_id: str = Query(..., description="search_id returned by POST /api/search"),
    current_count: int = Query(..., ge=0, description="How many results already shown"),
    current_user: str = Depends(get_current_user)
):
    try:
        engine = get_orchestrator()
        result = engine.load_more(search_id=search_id, current_count=current_count)

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


@router.get("/paper/{paper_id}")
async def get_paper_detail(
    paper_id: str, 
    current_user: str = Depends(get_current_user)
):
    try:
        engine = get_orchestrator()
        result = engine.get_paper_details(paper_id)

        if result is None:
            raise HTTPException(status_code=404, detail="Paper not found")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Paper detail API failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve paper details.")

# Chat Routes
@router.post("/paper/{paper_id}/chat/prepare")
async def prepare_paper_chat(
    paper_id: str, 
    current_user: str = Depends(get_current_user)
):
    try:
        chat_engine = get_chat_orchestrator()
        result = chat_engine.prepare_chat(paper_id)

        if not result["paper_found"]:
            raise HTTPException(status_code=404, detail="Paper not found")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Chat preparation failed for paper_id: '{paper_id}'")
        raise HTTPException(status_code=500, detail="Failed to prepare this paper for chat.")


@router.post("/paper/{paper_id}/chat")
@limiter.limit("15/minute")
async def ask_paper_question(
    request: Request,
    paper_id: str, 
    payload: ChatRequest, 
    current_user: str = Depends(get_current_user)
):
    try:
        chat_engine = get_chat_orchestrator()
        result = chat_engine.ask(paper_id=paper_id, question=payload.question)

        if not result["paper_found"]:
            raise HTTPException(status_code=404, detail="Paper not found")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Chat answer failed for paper_id: '{paper_id}'")
        raise HTTPException(status_code=500, detail="Failed to answer the question.")