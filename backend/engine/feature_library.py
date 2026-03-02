import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel, Field

LIBRARY_DIR = Path(__file__).resolve().parent.parent / "data" / "feature_library"


class SavedFeature(BaseModel):
    layer: int
    feature_index: int
    activation_strength: float
    alpha: float = 10.0
    explanation: str = ""


class FeatureSet(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    name: str
    concept: str
    features: list[SavedFeature]
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class FeatureLibrary:
    """Persists discovered feature sets as JSON files."""

    def __init__(self, directory: Path = LIBRARY_DIR) -> None:
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)

    def _path(self, set_id: str) -> Path:
        return self.directory / f"{set_id}.json"

    def list_sets(self) -> list[FeatureSet]:
        sets = []
        for path in sorted(self.directory.glob("*.json")):
            try:
                data = json.loads(path.read_text())
                sets.append(FeatureSet(**data))
            except Exception:
                continue
        return sets

    def get_set(self, set_id: str) -> FeatureSet | None:
        path = self._path(set_id)
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        return FeatureSet(**data)

    def save_set(self, feature_set: FeatureSet) -> FeatureSet:
        path = self._path(feature_set.id)
        path.write_text(feature_set.model_dump_json(indent=2))
        return feature_set

    def delete_set(self, set_id: str) -> bool:
        path = self._path(set_id)
        if path.exists():
            path.unlink()
            return True
        return False
