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
    cluster_id: int | None = None


class ConceptDiscovery:
    """Core pipeline: concept text -> model activations -> SAE features."""

    def __init__(self, model_manager: ModelManager, sae_manager: SAEManager) -> None:
        self.model = model_manager
        self.saes = sae_manager

    def _cluster_features(self, features: list[DiscoveredFeature], threshold: float = 0.3) -> None:
        """Cluster features in-place by setting their cluster_id using cosine similarity of their SAE decoder vectors."""
        if not features:
            return
            
        vectors = []
        for f in features:
            vectors.append(self.saes.get_decoder_vector(f.layer, f.feature_index).unsqueeze(0))
            
        V = torch.cat(vectors, dim=0)
        V_norm = torch.nn.functional.normalize(V, p=2, dim=1)
        sim_matrix = torch.matmul(V_norm, V_norm.T)
        
        assigned = set()
        next_cluster_id = 0
        
        for i in range(len(features)):
            if i in assigned:
                continue
            cluster_id = next_cluster_id
            next_cluster_id += 1
            features[i].cluster_id = cluster_id
            assigned.add(i)
            
            for j in range(i + 1, len(features)):
                if j not in assigned and sim_matrix[i, j].item() >= threshold:
                    features[j].cluster_id = cluster_id
                    assigned.add(j)

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
        top_features = all_features[:top_k]
        self._cluster_features(top_features)
        return top_features

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
        top_features = all_features[:top_k]
        self._cluster_features(top_features)
        return top_features

    def _find_nearby_features_sync(self, layer: int, feature_index: int, top_k: int) -> list[DiscoveredFeature]:
        query_vec = self.saes.get_decoder_vector(layer, feature_index)
        query_norm = torch.nn.functional.normalize(query_vec, p=2, dim=0)
        
        all_features: list[DiscoveredFeature] = []
        for l in self.saes.saes.keys():
            W_dec = self.saes.get_all_decoder_vectors(l)  # shape (n_features, d_model)
            W_norm = torch.nn.functional.normalize(W_dec, p=2, dim=1)
            sims = torch.matmul(W_norm, query_norm)
            values, indices = torch.topk(sims, k=min(top_k + 1, sims.shape[0]))
            
            for sim, idx in zip(values.tolist(), indices.tolist()):
                if l == layer and idx == feature_index:
                    continue  # Skip self
                all_features.append(
                    DiscoveredFeature(
                        layer=l,
                        feature_index=idx,
                        activation_strength=sim,  # Use similarity as strength
                        concept_text=f"Nearby L{layer}/{feature_index}",
                    )
                )
                
        all_features.sort(key=lambda f: f.activation_strength, reverse=True)
        top_features = all_features[:top_k]
        self._cluster_features(top_features)
        return top_features

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

    async def find_nearby_features(self, layer: int, feature_index: int, top_k: int = 50) -> list[DiscoveredFeature]:
        """Find features with similar decoder vectors to the specified feature."""
        return await asyncio.to_thread(self._find_nearby_features_sync, layer, feature_index, top_k)
