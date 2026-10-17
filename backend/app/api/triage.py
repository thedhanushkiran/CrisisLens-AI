from fastapi import APIRouter

from backend.app.schemas import TriageRequest, TriageSuggestion
from backend.app.services.triage import triage_provider

router = APIRouter(prefix="/api/v1/triage", tags=["triage"])


@router.post("/suggest", response_model=TriageSuggestion)
def suggest_triage(payload: TriageRequest):
    return triage_provider.suggest(payload.description, payload.categories)
