import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel, Field

LIBRARY_DIR = Path(__file__).resolve().parent.parent / "data" / "prompt_library"


class SavedPrompt(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    text: str
    label: str
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class PromptLibrary:
    """Persists saved prompts as JSON files."""

    def __init__(self, directory: Path = LIBRARY_DIR) -> None:
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)

    def _path(self, prompt_id: str) -> Path:
        return self.directory / f"{prompt_id}.json"

    def list_prompts(self) -> list[SavedPrompt]:
        prompts = []
        for path in sorted(self.directory.glob("*.json")):
            try:
                data = json.loads(path.read_text())
                prompts.append(SavedPrompt(**data))
            except Exception:
                continue
        return prompts

    def get_prompt(self, prompt_id: str) -> SavedPrompt | None:
        path = self._path(prompt_id)
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        return SavedPrompt(**data)

    def save_prompt(self, prompt: SavedPrompt) -> SavedPrompt:
        path = self._path(prompt.id)
        path.write_text(prompt.model_dump_json(indent=2))
        return prompt

    def update_prompt(self, prompt_id: str, text: str | None = None, label: str | None = None) -> SavedPrompt | None:
        prompt = self.get_prompt(prompt_id)
        if prompt is None:
            return None
        if text is not None:
            prompt.text = text
        if label is not None:
            prompt.label = label
        return self.save_prompt(prompt)

    def delete_prompt(self, prompt_id: str) -> bool:
        path = self._path(prompt_id)
        if path.exists():
            path.unlink()
            return True
        return False
