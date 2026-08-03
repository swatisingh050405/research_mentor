import os
import jwt

from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from backend.src.core.logger import logger

# OAuth2 scheme used by protected endpoints
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

SUPABASE_URL = os.getenv("SUPABASE_URL")

if not SUPABASE_URL:
    logger.critical("SUPABASE_URL environment variable is not configured.")
    raise RuntimeError("SUPABASE_URL environment variable is required.")

# Supabase JWKS endpoint
JWKS_URL = f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"

try:
    jwks_client = PyJWKClient(JWKS_URL)
    logger.info("Supabase JWKS client initialized successfully.")
except Exception as e:
    logger.critical(f"Failed to initialize Supabase JWKS client: {e}")
    raise


def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """
    Validate a Supabase JWT using the project's public signing keys (JWKS).

    Returns:
        str: Authenticated user's ID.

    Raises:
        HTTPException(401): If the token is invalid or expired.
    """

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token or token in ("null", "undefined"):
        logger.warning("Authentication attempted without an access token.")
        raise credentials_exception

    try:
        # Fetch the correct public signing key
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Verify JWT signature and expiration
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            options={"verify_aud": False},
        )

        user_id = payload.get("sub")

        if not user_id:
            logger.warning("JWT is missing the 'sub' claim.")
            raise credentials_exception

        logger.info(f"Authenticated user: {user_id}")

        return user_id

    except jwt.ExpiredSignatureError:
        logger.warning("Expired JWT received.")
        raise credentials_exception

    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT: {e}")
        raise credentials_exception

    except Exception as e:
        logger.exception(f"Unexpected authentication error: {e}")
        raise credentials_exception