import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.config import DEVICE
from backend.engine.model_manager import ModelManager
from backend.engine.sae_manager import SAEManager
from backend.engine.concept_discovery import ConceptDiscovery
from backend.api.discovery import router

app = FastAPI()

# For a test, we will monkeypatch the backend engine so we don't have to load actual huge weights
class DummySaeManager:
    def __init__(self, layers):
        self.saes = {l: None for l in layers}
        import torch
        # create random decoder matrices
        self.W_dec_dummy = {l: torch.randn(100, 10) for l in layers}
        
    def get_decoder_vector(self, layer, feat_idx):
        return self.W_dec_dummy[layer][feat_idx]

    def get_all_decoder_vectors(self, layer):
        return self.W_dec_dummy[layer]
        
    def get_top_features(self, layer, activation, k):
        return [(i, float(i)*0.1) for i in range(k)]

class DummyModel:
    def run_with_cache(self, text, layers):
        import torch
        # Return mock cache
        cache = {f"blocks.{l}.hook_resid_post": torch.randn(1, 1, 10) for l in layers}
        return None, cache

dummy_sae = DummySaeManager([12, 16])
dummy_model = DummyModel()
concept_discovery = ConceptDiscovery(dummy_model, dummy_sae)

app.state.concept_discovery = concept_discovery
app.state.model_manager = dummy_model
app.state.sae_manager = dummy_sae
app.include_router(router, prefix="/api")

async def run_tests():
    client = TestClient(app)
    
    print("Testing /api/discover endpoint (should include cluster_id)...")
    res = client.post("/api/discover", json={"concept": "test", "top_k": 20})
    data = res.json()
    assert res.status_code == 200
    features = data["features"]
    print(f"Found {len(features)} features")
    for f in features:
        # Check that cluster_id is present and is an integer
        assert "cluster_id" in f
        assert isinstance(f["cluster_id"], int)
    
    print("Testing /api/discover/nearby endpoint...")
    res2 = client.post("/api/discover/nearby", json={"layer": 16, "feature_index": 5, "top_k": 10})
    data2 = res2.json()
    assert res2.status_code == 200
    nearby = data2["features"]
    print(f"Found {len(nearby)} nearby features")
    for f in nearby:
        assert "cluster_id" in f
        # Should not include the target instance itself.
        assert not (f["layer"] == 16 and f["feature_index"] == 5)

if __name__ == "__main__":
    asyncio.run(run_tests())
    print("All tests passed!")
