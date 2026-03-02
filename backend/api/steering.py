import asyncio
import json
import logging
import traceback

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ActiveFeature(BaseModel):
    layer: int
    feature_index: int
    alpha: float = Field(10.0, ge=0.0, le=200.0)


class ChatRequest(BaseModel):
    # Either send structured messages (legacy) or a raw prompt string.
    # When prompt is provided it is sent to the model as-is (no wrapping).
    messages: list[ChatMessage] = Field(default_factory=list)
    prompt: str | None = None
    features: list[ActiveFeature] = Field(default_factory=list)
    max_new_tokens: int = Field(256, ge=1, le=1024)
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    top_k: int | None = Field(64, ge=1, le=500)
    top_p: float | None = Field(0.95, ge=0.0, le=1.0)
    freq_penalty: float = Field(0.0, ge=0.0, le=2.0)
    side: str = Field("both", pattern="^(steered|baseline|both)$")


class ChatResponse(BaseModel):
    steered_response: str
    baseline_response: str


def _resolve_prompt(body: ChatRequest, model_manager) -> str:
    """Return the raw prompt string to feed to the model.

    If the client sent a raw `prompt`, use it as-is.
    Otherwise fall back to formatting the structured messages.
    """
    if body.prompt is not None:
        return body.prompt
    messages_dicts = [{"role": m.role, "content": m.content} for m in body.messages]
    return model_manager.format_chat(messages_dicts)


def _extract_reply(reply: str) -> str:
    """Clean up a decoded reply (trimming whitespace)."""
    return reply.strip()


def _generate(steering, prompt, active_features, max_new_tokens, temperature, top_k, top_p, freq_penalty):
    """Synchronous generation — runs in a thread to avoid blocking the event loop."""
    if active_features:
        steered, baseline = steering.generate_both(
            prompt=prompt,
            active_features=active_features,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_k=top_k,
            top_p=top_p,
            freq_penalty=freq_penalty,
        )
    else:
        baseline = steering.generate_baseline(
            prompt=prompt,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            top_k=top_k,
            top_p=top_p,
            freq_penalty=freq_penalty,
        )
        steered = baseline
    return steered, baseline


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest, request: Request) -> ChatResponse:
    """Send a chat message and get both steered and baseline responses."""
    model_manager = request.app.state.model_manager
    steering = request.app.state.steering

    prompt = _resolve_prompt(body, model_manager)
    active_features = [f.model_dump() for f in body.features]

    try:
        steered, baseline = await asyncio.to_thread(
            _generate, steering, prompt, active_features,
            body.max_new_tokens, body.temperature, body.top_k, body.top_p, body.freq_penalty,
        )
    except Exception as e:
        logger.error("Generation failed:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

    return ChatResponse(
        steered_response=_extract_reply(steered),
        baseline_response=_extract_reply(baseline),
    )


@router.post("/stream")
async def chat_stream(body: ChatRequest, request: Request) -> StreamingResponse:
    """Stream steered then baseline responses as SSE events, each as soon as it's ready."""
    model_manager = request.app.state.model_manager
    steering = request.app.state.steering

    prompt = _resolve_prompt(body, model_manager)
    active_features = [f.model_dump() for f in body.features]

    side = body.side  # 'steered' | 'baseline' | 'both'

    async def event_stream():
        try:
            if active_features:
                if side in ("steered", "both"):
                    steered_raw = await asyncio.to_thread(
                        steering.generate_steered,
                        prompt, active_features, body.max_new_tokens, body.temperature,
                        body.top_k, body.top_p, body.freq_penalty,
                    )
                    yield f"data: {json.dumps({'type': 'steered', 'content': _extract_reply(steered_raw)})}\n\n"

                if side in ("baseline", "both"):
                    baseline_raw = await asyncio.to_thread(
                        steering.generate_baseline,
                        prompt, body.max_new_tokens, body.temperature,
                        body.top_k, body.top_p, body.freq_penalty,
                    )
                    yield f"data: {json.dumps({'type': 'baseline', 'content': _extract_reply(baseline_raw)})}\n\n"
            else:
                # No steering: single generation serves both panels
                baseline_raw = await asyncio.to_thread(
                    steering.generate_baseline,
                    prompt, body.max_new_tokens, body.temperature,
                    body.top_k, body.top_p, body.freq_penalty,
                )
                reply = _extract_reply(baseline_raw)
                if side in ("steered", "both"):
                    yield f"data: {json.dumps({'type': 'steered', 'content': reply})}\n\n"
                if side in ("baseline", "both"):
                    yield f"data: {json.dumps({'type': 'baseline', 'content': reply})}\n\n"

        except Exception as e:
            logger.error("Stream generation failed:\n%s", traceback.format_exc())
            yield f"data: {json.dumps({'type': 'error', 'detail': str(e)})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
