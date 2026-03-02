import asyncio

import torch
from pydantic import BaseModel

from backend.engine.model_manager import ModelManager
from backend.engine.sae_manager import SAEManager


class DiscoveredFeature(BaseModel):
    layer: int
    feature_index: int
    activation_strength: float
    concept_text: str


class ConceptDiscovery:
    """Core pipeline: concept text -> model activations -> SAE features."""

    def __init__(self, model_manager: ModelManager, sae_manager: SAEManager) -> None:
        self.model = model_manager
        self.saes = sae_manager

    def _discover_sync(self, concept_text: str, top_k: int) -> list[DiscoveredFeature]:
        layers = list(self.saes.saes.keys())
        logits, cache = self.model.run_with_cache(concept_text, layers=layers)

        all_features: list[DiscoveredFeature] = []
        for layer in layers:
            hook_name = f"blocks.{layer}.hook_resid_post"
            activation = cache[hook_name][:, -1, :]
            top = self.saes.get_top_features(layer, activation, k=top_k)
            for feat_idx, strength in top:
                all_features.append(
                    DiscoveredFeature(
                        layer=layer,
                        feature_index=feat_idx,
                        activation_strength=strength,
                        concept_text=concept_text,
                    )
                )

        all_features.sort(key=lambda f: f.activation_strength, reverse=True)
        return all_features[:top_k]

    def _discover_contrastive_sync(
        self, concept_text: str, neutral_texts: list[str], top_k: int
    ) -> list[DiscoveredFeature]:
        layers = list(self.saes.saes.keys())

        _, concept_cache = self.model.run_with_cache(concept_text, layers=layers)

        neutral_caches = []
        for text in neutral_texts:
            _, cache = self.model.run_with_cache(text, layers=layers)
            neutral_caches.append(cache)

        all_features: list[DiscoveredFeature] = []
        for layer in layers:
            hook_name = f"blocks.{layer}.hook_resid_post"

            concept_act = concept_cache[hook_name][:, -1, :]
            concept_feats = self.saes.encode(layer, concept_act)

            neutral_feats_list = [
                self.saes.encode(layer, c[hook_name][:, -1, :]) for c in neutral_caches
            ]
            neutral_feats = torch.stack(neutral_feats_list).mean(dim=0)

            diff = concept_feats - neutral_feats
            flat = diff.squeeze()
            values, indices = torch.topk(flat, k=min(top_k, flat.shape[-1]))

            for idx, val in zip(indices.tolist(), values.tolist()):
                if val > 0:
                    all_features.append(
                        DiscoveredFeature(
                            layer=layer,
                            feature_index=idx,
                            activation_strength=val,
                            concept_text=concept_text,
                        )
                    )

        all_features.sort(key=lambda f: f.activation_strength, reverse=True)
        return all_features[:top_k]

    async def discover(
        self, concept_text: str, top_k: int = 50
    ) -> list[DiscoveredFeature]:
        """Run concept text through the model, find which SAE features activate."""
        return await asyncio.to_thread(self._discover_sync, concept_text, top_k)

    async def discover_contrastive(
        self, concept_text: str, neutral_texts: list[str], top_k: int = 50
    ) -> list[DiscoveredFeature]:
        """Contrastive discovery — find features more active for concept than neutral text."""
        return await asyncio.to_thread(
            self._discover_contrastive_sync, concept_text, neutral_texts, top_k
        )
