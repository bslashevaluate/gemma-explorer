import threading

import torch

from backend.engine.model_manager import ModelManager
from backend.engine.sae_manager import SAEManager


class SteeringEngine:
    """Steered generation by injecting SAE decoder vectors into the model's forward pass."""

    def __init__(self, model_manager: ModelManager, sae_manager: SAEManager) -> None:
        self.model = model_manager
        self.saes = sae_manager
        # TransformerLens hooks are global on the model object, so concurrent
        # generation (e.g. steered + baseline from two panels) would contaminate
        # each other.  Serialize all model access behind a lock.
        self._lock = threading.Lock()

    def _build_hooks(
        self, active_features: list[dict]
    ) -> list[tuple[str, callable]]:
        """Build TransformerLens forward hooks for the active steering features.

        Each hook adds alpha * decoder_vector to the residual stream at the target layer.
        """
        hooks = []
        for feat in active_features:
            layer = feat["layer"]
            feature_index = feat["feature_index"]
            alpha = feat.get("alpha", 10.0)
            vec = self.saes.get_decoder_vector(layer, feature_index).detach()

            def make_hook(vector: torch.Tensor, strength: float):
                def hook_fn(activation, hook):
                    activation[:, :, :] += strength * vector
                    return activation
                return hook_fn

            hook_name = f"blocks.{layer}.hook_resid_post"
            hooks.append((hook_name, make_hook(vec, alpha)))

        return hooks

    def _tokenize(self, prompt: str) -> torch.Tensor:
        """Pre-tokenize prompt to a tensor for generate().

        TransformerLens generate() can accept strings, but this is more
        reliable when combined with hooks.

        prepend_bos=True so the base model gets a proper BOS token at the start
        of our plain-text continuation prompt.
        """
        return self.model.model.to_tokens(prompt, prepend_bos=True)

    def _decode_new_tokens(self, output: torch.Tensor, input_len: int) -> str:
        """Decode only the newly generated tokens, excluding the prompt."""
        return self.model.model.to_string(output[0, input_len:])

    @staticmethod
    def _clean_reply(text: str) -> str:
        """Truncate output at '\nUser:' to prevent the model from generating both sides."""
        marker = "\nUser:"
        idx = text.find(marker)
        if idx != -1:
            text = text[:idx]
        return text.strip()

    def _sampling_kwargs(
        self, temperature: float, top_k: int | None, top_p: float | None, freq_penalty: float,
    ) -> dict:
        """Build common sampling kwargs for generate()."""
        kwargs: dict = {
            "temperature": temperature,
            "stop_at_eos": True,
        }
        if top_k is not None:
            kwargs["top_k"] = top_k
        if top_p is not None:
            kwargs["top_p"] = top_p
        if freq_penalty:
            kwargs["freq_penalty"] = freq_penalty
        return kwargs

    def generate_steered(
        self,
        prompt: str,
        active_features: list[dict],
        max_new_tokens: int = 256,
        temperature: float = 0.7,
        top_k: int | None = 64,
        top_p: float | None = 0.95,
        freq_penalty: float = 0.0,
    ) -> str:
        """Generate text with steering vectors injected."""
        hooks = self._build_hooks(active_features)
        tokens = self._tokenize(prompt)
        input_len = tokens.shape[1]

        with self._lock:
            with torch.no_grad():
                with self.model.model.hooks(fwd_hooks=hooks):
                    output = self.model.model.generate(
                        tokens,
                        max_new_tokens=max_new_tokens,
                        **self._sampling_kwargs(temperature, top_k, top_p, freq_penalty),
                    )
        return self._clean_reply(self._decode_new_tokens(output, input_len))

    def generate_baseline(
        self,
        prompt: str,
        max_new_tokens: int = 256,
        temperature: float = 0.7,
        top_k: int | None = 64,
        top_p: float | None = 0.95,
        freq_penalty: float = 0.0,
    ) -> str:
        """Generate text without any steering (control condition)."""
        tokens = self._tokenize(prompt)
        input_len = tokens.shape[1]

        with self._lock:
            with torch.no_grad():
                output = self.model.model.generate(
                    tokens,
                    max_new_tokens=max_new_tokens,
                    **self._sampling_kwargs(temperature, top_k, top_p, freq_penalty),
                )
        return self._clean_reply(self._decode_new_tokens(output, input_len))

    def generate_both(
        self,
        prompt: str,
        active_features: list[dict],
        max_new_tokens: int = 256,
        temperature: float = 0.7,
        top_k: int | None = 64,
        top_p: float | None = 0.95,
        freq_penalty: float = 0.0,
    ) -> tuple[str, str]:
        """Generate both steered and baseline responses for side-by-side comparison.

        Returns:
            (steered_response, baseline_response)
        """
        steered = self.generate_steered(
            prompt, active_features, max_new_tokens, temperature, top_k, top_p, freq_penalty,
        )
        baseline = self.generate_baseline(
            prompt, max_new_tokens, temperature, top_k, top_p, freq_penalty,
        )
        return steered, baseline
