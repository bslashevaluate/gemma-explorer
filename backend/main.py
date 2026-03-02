import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

logging.basicConfig(level=logging.INFO)
from fastapi.middleware.cors import CORSMiddleware

from backend.config import BACKEND_PORT, FRONTEND_URL, NEURONPEDIA_API_KEY, SAE_LAYERS
from backend.engine.model_manager import ModelManager
from backend.engine.sae_manager import SAEManager
from backend.engine.concept_discovery import ConceptDiscovery
from backend.engine.steering import SteeringEngine
from backend.engine.feature_library import FeatureLibrary
from backend.engine.prompt_library import PromptLibrary
from backend.api.discovery import router as discovery_router
from backend.api.steering import router as chat_router
from backend.api.features import router as features_router
from backend.api.neuronpedia import router as neuronpedia_router
from backend.api.library import router as library_router
from backend.api.prompts import router as prompts_router
from backend.neuronpedia.client import NeuronpediaClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load model and SAEs
    print("Loading model...")
    app.state.model_manager = ModelManager()

    print("Loading SAEs...")
    app.state.sae_manager = SAEManager(layers=SAE_LAYERS)

    print("Initializing engines...")
    app.state.concept_discovery = ConceptDiscovery(
        app.state.model_manager, app.state.sae_manager
    )
    app.state.steering = SteeringEngine(
        app.state.model_manager, app.state.sae_manager
    )
    app.state.neuronpedia = NeuronpediaClient(
        api_key=NEURONPEDIA_API_KEY or None
    )
    app.state.feature_library = FeatureLibrary()
    app.state.prompt_library = PromptLibrary()

    print("Ready!")
    yield
    # Shutdown
    await app.state.neuronpedia.close()


app = FastAPI(
    title="Concept Steering Explorer",
    description="Mechanistic interpretability research tool for Gemma 2 2B",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(discovery_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(features_router, prefix="/api")
app.include_router(neuronpedia_router, prefix="/api")
app.include_router(library_router, prefix="/api")
app.include_router(prompts_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=BACKEND_PORT, reload=False)
