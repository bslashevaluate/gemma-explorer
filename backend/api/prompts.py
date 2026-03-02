from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from backend.engine.prompt_library import SavedPrompt

router = APIRouter(prefix="/prompts", tags=["prompts"])


class CreatePromptRequest(BaseModel):
    text: str
    label: str = ""


class UpdatePromptRequest(BaseModel):
    text: str | None = None
    label: str | None = None


@router.get("", response_model=list[SavedPrompt])
async def list_prompts(request: Request):
    library = request.app.state.prompt_library
    return library.list_prompts()


@router.post("", response_model=SavedPrompt, status_code=201)
async def create_prompt(body: CreatePromptRequest, request: Request):
    library = request.app.state.prompt_library
    label = body.label or body.text[:60].rstrip()
    prompt = SavedPrompt(text=body.text, label=label)
    return library.save_prompt(prompt)


@router.put("/{prompt_id}", response_model=SavedPrompt)
async def update_prompt(prompt_id: str, body: UpdatePromptRequest, request: Request):
    library = request.app.state.prompt_library
    updated = library.update_prompt(prompt_id, text=body.text, label=body.label)
    if updated is None:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return updated


@router.delete("/{prompt_id}", status_code=204)
async def delete_prompt(prompt_id: str, request: Request):
    library = request.app.state.prompt_library
    if not library.delete_prompt(prompt_id):
        raise HTTPException(status_code=404, detail="Prompt not found")
