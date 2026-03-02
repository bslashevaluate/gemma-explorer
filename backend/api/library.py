from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.engine.feature_library import FeatureSet, SavedFeature

router = APIRouter(prefix="/library", tags=["library"])


class CreateFeatureSetRequest(BaseModel):
    name: str = Field(..., min_length=1)
    concept: str
    features: list[SavedFeature]


@router.get("", response_model=list[FeatureSet])
async def list_feature_sets(request: Request) -> list[FeatureSet]:
    """List all saved feature sets."""
    return request.app.state.feature_library.list_sets()


@router.post("", response_model=FeatureSet)
async def create_feature_set(
    body: CreateFeatureSetRequest, request: Request
) -> FeatureSet:
    """Save a new feature set."""
    feature_set = FeatureSet(
        name=body.name, concept=body.concept, features=body.features
    )
    return request.app.state.feature_library.save_set(feature_set)


@router.get("/{set_id}", response_model=FeatureSet)
async def get_feature_set(set_id: str, request: Request) -> FeatureSet:
    """Load a saved feature set."""
    fs = request.app.state.feature_library.get_set(set_id)
    if fs is None:
        raise HTTPException(status_code=404, detail="Feature set not found")
    return fs


@router.delete("/{set_id}")
async def delete_feature_set(set_id: str, request: Request) -> dict:
    """Delete a saved feature set."""
    if not request.app.state.feature_library.delete_set(set_id):
        raise HTTPException(status_code=404, detail="Feature set not found")
    return {"status": "deleted"}
