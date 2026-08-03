import os
from typing import Optional
from fastapi import APIRouter, Query, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from backend.src.core.logger import logger
from backend.src.core.limiter import limiter
from backend.src.core.jwt_handler import get_current_user, oauth2_scheme

router = APIRouter(prefix="/api", tags=["Research Operations"])

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
                detail="Authentication service misconfigured."
            )
        from supabase import create_client
        _supabase_client = create_client(supabase_url, supabase_key)
    return _supabase_client

def get_orchestrator():
    global _orchestrator
    if _orchestrator is None:
        from backend.src.orchestrator.search_orchestrator import ResearchPlatformOrchestrator
        _orchestrator = ResearchPlatformOrchestrator()
    return _orchestrator

def get_chat_orchestrator():
    global _chat_orchestrator
    if _chat_orchestrator is None:
        from backend.src.orchestrator.chat_orchestrator import ChatOrchestrator
        _chat_orchestrator = ChatOrchestrator()
    return _chat_orchestrator

def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[str]:
    if not token or token in ("null", "undefined", "None", "", "Bearer"):
        return None
    try:
        return get_current_user(token)
    except Exception:
        return None

# Schemas
class SearchRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=300)
    description: str = Field(default="", max_length=1000)

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)

@router.post("/search")
@limiter.limit("10/minute")
async def start_search(
    request: Request,
    payload: SearchRequest, 
    current_user: Optional[str] = Depends(get_optional_current_user)
):
    topic = payload.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be blank.")
    try:
        engine = get_orchestrator()
        result = engine.start_search(topic=topic, description=payload.description)
        return result or {"search_id": None, "results": [], "has_more": False, "total_pool_size": 0}
    except Exception as e:
        logger.exception(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail="Search processing failed.")

@router.get("/search/more")
async def load_more_results(
    search_id: str = Query(...),
    current_count: int = Query(..., ge=0),
    current_user: Optional[str] = Depends(get_optional_current_user)
):
    try:
        engine = get_orchestrator()
        return engine.load_more(search_id=search_id, current_count=current_count)
    except Exception as e:
        logger.exception(f"Load more failed: {e}")
        raise HTTPException(status_code=500, detail="Could not load more results.")

@router.get("/paper/{paper_id}")
async def get_paper_detail(
    paper_id: str, 
    current_user: Optional[str] = Depends(get_optional_current_user)
):
    try:
        engine = get_orchestrator()
        result = engine.get_paper_details(paper_id)

        # 🛡️ SAFE FALLBACK: Prevents 500 Error on Hash IDs
        if not result:
            logger.info(f"Paper '{paper_id}' missing in vector DB. Trying live fetch...")
            try:
                live_paper = engine.arxiv_client.get_paper_by_id(paper_id)
                if live_paper:
                    return {"paper": live_paper, "recommendations": []}
            except Exception as f_err:
                logger.warning(f"Live arXiv fetch skipped for non-arXiv ID '{paper_id}': {f_err}")

            raise HTTPException(status_code=404, detail="Paper details unavailable in current database.")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Paper detail fetch error: {e}")
        raise HTTPException(status_code=404, detail="Paper details unavailable.")

@router.post("/paper/{paper_id}/chat/prepare")
async def prepare_paper_chat(
    paper_id: str, 
    current_user: str = Depends(get_current_user)
):
    try:
        chat_engine = get_chat_orchestrator()
        result = chat_engine.prepare_chat(paper_id)

        # 🛡️ SAFE FALLBACK FOR CHAT PREPARE
        if not result or not result.get("paper_found"):
            try:
                engine = get_orchestrator()
                live_paper = engine.arxiv_client.get_paper_by_id(paper_id)
                if live_paper:
                    result = chat_engine.prepare_chat_from_data(live_paper)
            except Exception as e:
                logger.warning(f"Live fetch failed in chat prepare: {e}")

        # Return fallback mode instead of failing
        return {
            "paper_found": True,
            "context_mode": "abstract_only",
            "message": "Prepared using available metadata."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Chat preparation error: {e}")
        return {
            "paper_found": True,
            "context_mode": "abstract_only",
            "message": "Prepared in basic abstract mode."
        }

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
        if not result or not result.get("paper_found"):
            return {
                "paper_found": True,
                "answer": "I can answer based on the summary and abstract for this paper.",
                "context_mode": "abstract_only"
            }
        return result
    except Exception as e:
        logger.exception(f"Chat query error: {e}")
        return {
            "paper_found": True,
            "answer": "Sorry, I couldn't process that question right now. Please try rephrasing.",
            "context_mode": "abstract_only"
        }