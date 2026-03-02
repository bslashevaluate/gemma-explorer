import logging
import traceback

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.engine.concept_discovery import DiscoveredFeature

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/discover", tags=["discovery"])


class DiscoverRequest(BaseModel):
    concept: str = Field(..., min_length=1, description="Concept text to discover features for")
    top_k: int = Field(50, ge=1, le=200, description="Number of top features to return")
    contrastive: bool = Field(False, description="Use contrastive discovery mode")
    neutral_texts: list[str] | None = Field(
        None, description="Custom neutral texts for contrastive mode (auto-generated if omitted)"
    )


class DiscoverResponse(BaseModel):
    concept: str
    features: list[DiscoveredFeature]
    mode: str  # "simple" or "contrastive"


DEFAULT_NEUTRAL_TEXTS = [
    "The weather is nice today.",
    "I went to the store yesterday.",
    "The book was on the table.",
    "She walked down the street.",
    "They had a meeting at noon.",
]


@router.post("", response_model=DiscoverResponse)
async def discover_features(body: DiscoverRequest, request: Request) -> DiscoverResponse:
    """Discover SAE features that correspond to a natural-language concept."""
    discovery = request.app.state.concept_discovery

    try:
        if body.contrastive:
            neutral = body.neutral_texts or DEFAULT_NEUTRAL_TEXTS
            features = await discovery.discover_contrastive(
                concept_text=body.concept,
                neutral_texts=neutral,
                top_k=body.top_k,
            )
            mode = "contrastive"
        else:
            features = await discovery.discover(
                concept_text=body.concept,
                top_k=body.top_k,
            )
            mode = "simple"
    except Exception as e:
        logger.error("Discovery failed:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

    return DiscoverResponse(concept=body.concept, features=features, mode=mode)
