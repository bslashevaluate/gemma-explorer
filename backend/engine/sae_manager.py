import re

import torch
import yaml
from sae_lens import SAE

from backend.config import DEVICE, SAE_RELEASE

# Target L0 sparsity — we pick the available SAE closest to this value per layer.
_TARGET_L0 = 80


def _find_best_sae_id(release: str, layer: int, width: str = "16k") -> str:
    """Find the SAE ID with L0 closest to _TARGET_L0 for a given layer/width.

    SAE Lens bundles a pretrained_saes.yaml with all available IDs. The L0 values
    vary per layer so we can't hardcode a single suffix.
    """
    import sae_lens
    yaml_path = sae_lens.__file__.replace("__init__.py", "pretrained_saes.yaml")
    with open(yaml_path) as f:
        data = yaml.safe_load(f)

    saes_list = data.get(release, {}).get("saes", [])
    prefix = f"layer_{layer}/width_{width}/average_l0_"

    candidates: list[tuple[str, int]] = []
    for entry in saes_list:
        sid = entry.get("id", "")
        if sid.startswith(prefix):
            m = re.search(r"average_l0_(\d+)$", sid)
            if m:
                candidates.append((sid, int(m.group(1))))

    if not candidates:
        raise ValueError(
            f"No SAE found for layer {layer} width {width} in release {release}"
        )

    # Pick the one closest to our target L0
    best = min(candidates, key=lambda c: abs(c[1] - _TARGET_L0))
    return best[0]


class SAEManager:
    """Loads and manages Gemma Scope SAEs for configured layers."""

    def __init__(self, layers: list[int]) -> None:
        self.saes: dict[int, SAE] = {}
        self.layers = layers

        for layer in layers:
            sae_id = _find_best_sae_id(SAE_RELEASE, layer)
            print(f"Loading SAE for layer {layer} ({sae_id})...")
            sae = SAE.from_pretrained(
                release=SAE_RELEASE,
                sae_id=sae_id,
                device=DEVICE,
            )
            sae.eval()
            self.saes[layer] = sae

        print(f"Loaded SAEs for layers: {layers}")

    def encode(self, layer: int, activation: torch.Tensor) -> torch.Tensor:
        """Encode a residual-stream activation into SAE feature space.

        Args:
            layer: Which layer's SAE to use.
            activation: Tensor of shape (batch, d_model) or (d_model,).

        Returns:
            Feature activations tensor of shape (batch, n_features) or (n_features,).
        """
        # Cast to match SAE dtype (model may output bfloat16, SAE may be float32)
        sae = self.saes[layer]
        return sae.encode(activation.to(dtype=sae.dtype, device=sae.device))

    def decode(self, layer: int, feature_acts: torch.Tensor) -> torch.Tensor:
        """Decode SAE feature activations back into residual-stream space."""
        return self.saes[layer].decode(feature_acts)

    def get_top_features(
        self, layer: int, activation: torch.Tensor, k: int = 20
    ) -> list[tuple[int, float]]:
        """Get top-k activated features for a given activation.

        Returns:
            List of (feature_index, activation_strength) tuples, sorted by strength descending.
        """
        with torch.no_grad():
            feature_acts = self.encode(layer, activation)
            # Flatten to 1D if needed (squeeze batch dim)
            flat = feature_acts.squeeze()
            values, indices = torch.topk(flat, k=min(k, flat.shape[-1]))
        return list(zip(indices.tolist(), values.tolist()))

    def get_decoder_vector(self, layer: int, feature_index: int) -> torch.Tensor:
        """Get the decoder direction for a specific feature (used for steering)."""
        return self.saes[layer].W_dec[feature_index]

    def get_all_decoder_vectors(self, layer: int) -> torch.Tensor:
        """Get all decoder vectors for a specific layer."""
        return self.saes[layer].W_dec
