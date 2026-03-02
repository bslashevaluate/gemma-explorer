import os

import torch
import transformer_lens

from backend.config import DEVICE, DTYPE, HF_TOKEN, MODEL_NAME


def _resolve_dtype(dtype_str: str) -> torch.dtype:
    return {"float32": torch.float32, "bfloat16": torch.bfloat16, "float16": torch.float16}[dtype_str]


class ModelManager:
    """Singleton that loads and manages the Gemma 2 2B model via TransformerLens."""

    _instance: "ModelManager | None" = None

    def __new__(cls) -> "ModelManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if hasattr(self, "_initialized"):
            return
        self._initialized = True

        self.device = DEVICE
        self.dtype = _resolve_dtype(DTYPE)

        # Set HF_TOKEN as env var rather than passing token= kwarg directly,
        # because TransformerLens already passes token= internally and would
        # raise "got multiple values for keyword argument 'token'" otherwise.
        if HF_TOKEN:
            os.environ["HF_TOKEN"] = HF_TOKEN

        print(f"Loading {MODEL_NAME} on {self.device} with {DTYPE}...")
        self.model = transformer_lens.HookedTransformer.from_pretrained(
            MODEL_NAME,
            device=self.device,
            dtype=self.dtype,
        )
        self.model.eval()

        print("Model loaded.")

    def run_with_cache(
        self,
        text: str,
        layers: list[int] | None = None,
    ) -> tuple[torch.Tensor, dict]:
        """Run text through the model, return (logits, cache) with activations at specified layers."""
        if layers:
            names_filter = [f"blocks.{l}.hook_resid_post" for l in layers]
        else:
            names_filter = None

        with torch.no_grad():
            logits, cache = self.model.run_with_cache(text, names_filter=names_filter)
        return logits, cache

    def format_chat(self, messages: list[dict]) -> str:
        """Format messages as plain continuation-style text for the base model.

        Produces a simple format like:
            User: Hello
            Assistant:
        No special tokens — just text the base model has seen in pretraining data.
        """
        parts: list[str] = []
        for msg in messages:
            role = "User" if msg["role"] == "user" else "Assistant"
            parts.append(f"{role}: {msg['content']}")
        parts.append("Assistant:")
        return "\n".join(parts)

    def tokenize(self, text: str) -> list[str]:
        """Tokenize text and return string tokens (useful for debugging)."""
        return self.model.to_str_tokens(text)
