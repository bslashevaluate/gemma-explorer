from functools import lru_cache

import httpx

from backend.neuronpedia.models import (
    FeatureExplanation,
    NeuronpediaFeature,
    NeuronpediaSearchResult,
)

NP_BASE = "https://www.neuronpedia.org"
NP_MODEL_ID = "gemma-2-2b"


def _source_for_layer(layer: int) -> str:
    """Neuronpedia source ID for a Gemma Scope residual SAE layer."""
    return f"{layer}-gemmascope-res-16k"


def _feature_url(model: str, source: str, index: int) -> str:
    return f"{NP_BASE}/{model}/{source}/{index}"


def _embed_url(model: str, source: str, index: int) -> str:
    return f"{NP_BASE}/{model}/{source}/{index}?embed=true"


class NeuronpediaClient:
    """Async client for the Neuronpedia API with in-memory caching."""

    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key
        headers = {}
        if api_key:
            headers["X-Api-Key"] = api_key
        self.client = httpx.AsyncClient(
            base_url=NP_BASE, timeout=30.0, headers=headers
        )
        # Simple in-memory cache for feature data (explanations don't change)
        self._feature_cache: dict[tuple[int, int], NeuronpediaFeature] = {}

    async def close(self) -> None:
        await self.client.aclose()

    async def get_feature(
        self, layer: int, feature_index: int, model: str = NP_MODEL_ID
    ) -> NeuronpediaFeature:
        """Get feature dashboard data including explanation from Neuronpedia."""
        cache_key = (layer, feature_index)
        if cache_key in self._feature_cache:
            return self._feature_cache[cache_key]

        source = _source_for_layer(layer)
        r = await self.client.get(f"/api/feature/{model}/{source}/{feature_index}")
        r.raise_for_status()
        data = r.json()

        explanations = []
        for exp in data.get("explanations", []):
            explanations.append(
                FeatureExplanation(
                    description=exp.get("description", ""),
                    score=exp.get("score"),
                )
            )

        feature = NeuronpediaFeature(
            model_id=model,
            layer=layer,
            feature_index=feature_index,
            source=source,
            explanations=explanations,
            neuronpedia_url=_feature_url(model, source, feature_index),
            embed_url=_embed_url(model, source, feature_index),
        )
        self._feature_cache[cache_key] = feature
        return feature

    async def search_features(
        self,
        query: str,
        model: str = NP_MODEL_ID,
        layers: list[int] | None = None,
    ) -> list[NeuronpediaSearchResult]:
        """Search features by explanation text (semantic search)."""
        payload: dict = {"modelId": model, "query": query}
        if layers:
            payload["sourceIds"] = [_source_for_layer(l) for l in layers]

        r = await self.client.post("/api/explanation/search", json=payload)
        r.raise_for_status()
        data = r.json()

        results = []
        for item in data.get("results", []):
            layer_num = item.get("layer", 0)
            idx = item.get("index", 0)
            source = _source_for_layer(layer_num)
            results.append(
                NeuronpediaSearchResult(
                    model_id=model,
                    layer=layer_num,
                    feature_index=idx,
                    description=item.get("description", ""),
                    score=item.get("score"),
                    neuronpedia_url=_feature_url(model, source, idx),
                )
            )
        return results

    def get_feature_url(self, layer: int, feature_index: int, model: str = NP_MODEL_ID) -> str:
        source = _source_for_layer(layer)
        return _feature_url(model, source, feature_index)

    def get_embed_url(self, layer: int, feature_index: int, model: str = NP_MODEL_ID) -> str:
        source = _source_for_layer(layer)
        return _embed_url(model, source, feature_index)
