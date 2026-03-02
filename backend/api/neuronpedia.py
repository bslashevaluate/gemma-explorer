from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(prefix="/neuronpedia", tags=["neuronpedia"])


class EmbedUrlResponse(BaseModel):
    url: str
    neuronpedia_url: str


@router.get("/feature/{layer}/{index}")
async def proxy_feature(layer: int, index: int, request: Request) -> dict:
    """Proxy to Neuronpedia feature API (avoids CORS issues in the frontend)."""
    np_client = request.app.state.neuronpedia
    feature = await np_client.get_feature(layer, index)
    return feature.model_dump()


@router.get("/embed-url/{layer}/{index}", response_model=EmbedUrlResponse)
async def get_embed_url(layer: int, index: int, request: Request) -> EmbedUrlResponse:
    """Get the Neuronpedia iframe embed URL for a feature dashboard."""
    np_client = request.app.state.neuronpedia
    return EmbedUrlResponse(
        url=np_client.get_embed_url(layer, index),
        neuronpedia_url=np_client.get_feature_url(layer, index),
    )
