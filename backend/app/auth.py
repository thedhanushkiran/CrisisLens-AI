import hmac
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.config import get_settings


bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Actor:
    name: str
    role: str


def current_actor(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> Actor:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    settings = get_settings()
    token = credentials.credentials
    if settings.admin_api_token and hmac.compare_digest(token, settings.admin_api_token):
        return Actor(name="local-admin", role="admin")
    if settings.responder_api_token and hmac.compare_digest(token, settings.responder_api_token):
        return Actor(name="local-responder", role="responder")
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token")


def require_roles(*allowed_roles: str):
    def dependency(actor: Annotated[Actor, Depends(current_actor)]) -> Actor:
        if actor.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return actor

    return dependency


ResponderOrAdmin = Annotated[Actor, Depends(require_roles("responder", "admin"))]
AdminOnly = Annotated[Actor, Depends(require_roles("admin"))]
