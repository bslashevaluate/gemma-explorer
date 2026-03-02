from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from backend.neuronpedia.models import NeuronpediaFeature, NeuronpediaSearchResult

router = APIRouter(prefix="/features", tags=["features"])


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    layers: list[int] | None = None


@router.get("/{layer}/{index}", response_model=NeuronpediaFeature)
async def get_feature(layer: int, index: int, request: Request) -> NeuronpediaFeature:
    """Get feature info including Neuronpedia explanation."""
    np_client = request.app.state.neuronpedia
    return await np_client.get_feature(layer, index)


@router.post("/search", response_model=list[NeuronpediaSearchResult])
async def search_features(
    body: SearchRequest, request: Request
) -> list[NeuronpediaSearchResult]:
    """Search Neuronpedia features by explanation text."""
    np_client = request.app.state.neuronpedia
    return await np_client.search_features(query=body.query, layers=body.layers)
