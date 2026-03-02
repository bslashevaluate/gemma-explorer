# Concept Steering Explorer — Claude Code Build Instructions

## What We're Building

A local web application for mechanistic interpretability research on Gemma 2 2B. The app lets users type in natural-language concepts (e.g., "the smell of resin from trees on a hot day"), automatically discovers which SAE features in the model correspond to that concept, and provides a split-pane chat interface where users can talk to the model with those features enhanced/suppressed and compare against a baseline.

The app uses a **hybrid architecture**: local model inference and activation analysis via SAE Lens + TransformerLens + Gemma Scope pre-trained SAEs, with Neuronpedia integration for feature metadata, labels, and optional cloud-side steering comparison.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Concept   │  │  Feature     │  │ Split Chat    │  │
│  │ Input +   │  │  Explorer    │  │ (steered vs   │  │
│  │ Discovery │  │  + Library   │  │  baseline)    │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────┐
│                 FastAPI Backend                       │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ Local Engine     │  │ Neuronpedia Bridge       │  │
│  │ - TransformerLens│  │ - Feature search/labels  │  │
│  │ - SAE Lens       │  │ - Explanation lookup     │  │
│  │ - Gemma Scope    │  │ - Vector upload/share    │  │
│  │   SAE weights    │  │ - Cloud steering compare │  │
│  └─────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend
- **Python 3.11+**
- **FastAPI** with uvicorn
- **TransformerLens** — hooked transformer for Gemma 2 2B, gives access to all internal activations
- **SAE Lens** (v6+) — load pre-trained Gemma Scope SAEs, encode/decode activations
- **PyTorch** — underlying tensor ops, CUDA if available
- **httpx** — async HTTP client for Neuronpedia API calls

### Frontend
- **React 18** with TypeScript
- **Vite** for dev server and bundling
- **Tailwind CSS** for styling
- **Zustand** for state management (lightweight, no boilerplate)
- **React Query** (TanStack Query) for API state

### Model & SAE Weights
- **google/gemma-2-2b-it** — instruct-tuned model from HuggingFace (for chat)
- **google/gemma-2-2b** — base model (TransformerLens loads this under the hood)
- **google/gemma-scope-2b-pt-res** — pre-trained residual stream SAEs, all 26 layers, multiple widths (16K features is the sweet spot)

---

## Project Structure

```
concept-steering-explorer/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── requirements.txt
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── model_manager.py     # Load/manage TransformerLens model (singleton)
│   │   ├── sae_manager.py       # Load/manage Gemma Scope SAEs via SAE Lens
│   │   ├── concept_discovery.py # Core: concept text → activated features
│   │   ├── steering.py          # Core: inject feature vectors during generation
│   │   └── feature_library.py   # Save/load/manage discovered feature sets
│   ├── neuronpedia/
│   │   ├── __init__.py
│   │   ├── client.py            # Neuronpedia API wrapper
│   │   └── models.py            # Pydantic models for NP API responses
│   ├── api/
│   │   ├── __init__.py
│   │   ├── discovery.py         # /api/discover endpoints
│   │   ├── steering.py          # /api/steer + /api/chat endpoints
│   │   ├── features.py          # /api/features CRUD + NP lookup
│   │   └── neuronpedia.py       # /api/neuronpedia proxy endpoints
│   └── data/
│       └── feature_library/     # Saved feature sets (JSON + vectors)
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   └── client.ts        # Typed API client for backend
│       ├── stores/
│       │   ├── conceptStore.ts  # Active concept + discovered features
│       │   ├── chatStore.ts     # Chat history (steered + baseline)
│       │   └── settingsStore.ts # Model settings, layer selection, alpha
│       ├── components/
│       │   ├── ConceptInput.tsx      # Main concept text input
│       │   ├── DiscoveryPanel.tsx    # Shows discovery progress + results
│       │   ├── FeatureList.tsx       # Ranked features with toggles
│       │   ├── FeatureCard.tsx       # Single feature: name, layer, strength, NP link
│       │   ├── FeatureLibrary.tsx    # Saved feature sets
│       │   ├── ChatPanel.tsx         # Split chat: steered vs baseline
│       │   ├── ChatMessage.tsx       # Individual message bubble
│       │   ├── SteeringControls.tsx  # Alpha slider, layer picker, feature toggles
│       │   └── NeuronpediaEmbed.tsx  # Iframe embed of NP feature dashboards
│       └── pages/
│           ├── DiscoverPage.tsx
│           ├── LibraryPage.tsx
│           └── ChatPage.tsx
├── .env.example
├── .gitignore
└── README.md
```

---

## Phase 1: Backend Foundation

### Step 1: Environment Setup

**Important: Always use a dedicated conda environment — never install into your base/system Python.**

```bash
conda create -n gemma-explorer python=3.11 -y
conda activate gemma-explorer
```

Then install dependencies:
```bash
pip install -r backend/requirements.txt
```

Create `backend/requirements.txt`:
```
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
torch>=2.1.0
transformer-lens>=2.0.0
sae-lens>=6.27.0
transformers>=4.38.0
safetensors>=0.4.2
httpx>=0.25.0
pydantic>=2.0
python-dotenv>=1.0.0
accelerate>=0.25.0
```

Create `.env.example`:
```
# Required
HF_TOKEN=your_huggingface_token

# Optional — enables Neuronpedia integration
NEURONPEDIA_API_KEY=your_neuronpedia_api_key

# Model config
MODEL_NAME=gemma-2-2b-it
DEVICE=cuda  # or cpu, or mps
DTYPE=float32  # or bfloat16 if GPU supports it

# SAE config
SAE_RELEASE=gemma-scope-2b-pt-res
SAE_WIDTH=16k
SAE_LAYERS=10,12,14,16,18,20  # layers to load SAEs for (comma-separated)

# Server
BACKEND_PORT=8000
FRONTEND_PORT=5173
```

### Step 2: Model Manager (`backend/engine/model_manager.py`)

This is a singleton that loads the Gemma 2 2B model via TransformerLens once at startup.

Key implementation notes:
- Use `HookedTransformer.from_pretrained("gemma-2-2b", dtype=torch.float32)` for the base model
- For chat/instruct generation, you'll need the HuggingFace tokenizer from `google/gemma-2-2b-it` separately, because TransformerLens uses the base model but we want the instruct tokenizer's chat template
- The model should be loaded once and reused across all requests
- Expose methods: `run_with_cache(text) -> (logits, cache)` and `generate(prompt, hooks) -> text`

```python
# Sketch — model_manager.py
import torch
import transformer_lens
from transformers import AutoTokenizer

class ModelManager:
    _instance = None

    def __init__(self):
        self.model = transformer_lens.HookedTransformer.from_pretrained(
            "gemma-2-2b",
            device=DEVICE,
            dtype=DTYPE,
        )
        # Separate instruct tokenizer for chat template formatting
        self.chat_tokenizer = AutoTokenizer.from_pretrained("google/gemma-2-2b-it")

    def run_with_cache(self, text: str, layers: list[int] | None = None):
        """Run text through model, return activations at specified layers."""
        if layers:
            names_filter = [f"blocks.{l}.hook_resid_post" for l in layers]
        else:
            names_filter = None
        logits, cache = self.model.run_with_cache(text, names_filter=names_filter)
        return logits, cache

    def format_chat(self, messages: list[dict]) -> str:
        """Format messages using instruct chat template."""
        return self.chat_tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
```

### Step 3: SAE Manager (`backend/engine/sae_manager.py`)

Loads Gemma Scope SAEs for the configured layers.

Key implementation notes:
- SAE Lens can load directly from HuggingFace: `SAE.from_pretrained(release, sae_id)`
- The sae_id format for Gemma Scope residual stream SAEs is: `layer_{N}/width_16k/canonical`
- Load SAEs for a configurable subset of layers (not all 26 — that's too much RAM). Start with layers 10, 12, 14, 16, 18, 20 as these are the most interpretable mid-to-late layers.
- Each SAE has 16,384 features for the 16k width variant
- Expose: `encode(layer, activation_tensor) -> feature_activations` and `decode(layer, feature_activations) -> reconstructed_activation`

```python
# Sketch — sae_manager.py
from sae_lens import SAE

class SAEManager:
    def __init__(self, layers: list[int]):
        self.saes: dict[int, SAE] = {}
        for layer in layers:
            sae_id = f"layer_{layer}/width_16k/average_l0_71"
            self.saes[layer] = SAE.from_pretrained(
                release="gemma-scope-2b-pt-res",
                sae_id=sae_id,
                device=DEVICE,
            )

    def encode(self, layer: int, activation: torch.Tensor) -> torch.Tensor:
        """Encode activation into SAE feature space. Returns feature activations."""
        return self.saes[layer].encode(activation)

    def get_top_features(self, layer: int, activation: torch.Tensor, k: int = 20):
        """Get top-k activated features for a given activation."""
        feature_acts = self.encode(layer, activation)
        values, indices = torch.topk(feature_acts.squeeze(), k)
        return list(zip(indices.tolist(), values.tolist()))
```

### Step 4: Concept Discovery (`backend/engine/concept_discovery.py`)

This is the core pipeline. When a user types a concept:

1. Take the concept text and run it through the model with `run_with_cache`
2. For each configured layer, pass the residual stream activation (at the last token position) through the SAE encoder
3. Collect which features activate and how strongly
4. Optionally, also generate a few contrastive "neutral" prompts and compute difference-in-means for more robust feature identification
5. Return a ranked list of (layer, feature_index, activation_strength) tuples

```python
# Sketch — concept_discovery.py

class ConceptDiscovery:
    def __init__(self, model_manager: ModelManager, sae_manager: SAEManager):
        self.model = model_manager
        self.saes = sae_manager

    async def discover(self, concept_text: str, top_k: int = 50) -> list[DiscoveredFeature]:
        """
        Run concept text through the model, find which SAE features activate.
        Returns ranked list of features across all loaded layers.
        """
        logits, cache = self.model.run_with_cache(concept_text, layers=list(self.saes.saes.keys()))

        all_features = []
        for layer in self.saes.saes:
            hook_name = f"blocks.{layer}.hook_resid_post"
            activation = cache[hook_name][:, -1, :]  # last token position
            top = self.saes.get_top_features(layer, activation, k=top_k)
            for feat_idx, strength in top:
                all_features.append(DiscoveredFeature(
                    layer=layer,
                    feature_index=feat_idx,
                    activation_strength=strength,
                    concept_text=concept_text,
                ))

        # Sort by activation strength across all layers
        all_features.sort(key=lambda f: f.activation_strength, reverse=True)
        return all_features[:top_k]

    async def discover_contrastive(
        self,
        concept_text: str,
        neutral_texts: list[str],
        top_k: int = 50
    ) -> list[DiscoveredFeature]:
        """
        More robust discovery using contrastive pairs.
        Finds features that activate MORE for the concept than for neutral text.
        """
        # Get concept activations
        _, concept_cache = self.model.run_with_cache(concept_text, layers=...)

        # Get neutral activations (average across multiple neutral texts)
        neutral_caches = []
        for text in neutral_texts:
            _, cache = self.model.run_with_cache(text, layers=...)
            neutral_caches.append(cache)

        all_features = []
        for layer in self.saes.saes:
            hook = f"blocks.{layer}.hook_resid_post"
            concept_acts = self.saes.encode(layer, concept_cache[hook][:, -1, :])
            neutral_acts = torch.stack([
                self.saes.encode(layer, c[hook][:, -1, :]) for c in neutral_caches
            ]).mean(dim=0)

            # Difference-in-means: which features are MORE active for the concept
            diff = concept_acts - neutral_acts
            values, indices = torch.topk(diff.squeeze(), top_k)
            for idx, val in zip(indices.tolist(), values.tolist()):
                if val > 0:  # only features that are more active for concept
                    all_features.append(DiscoveredFeature(
                        layer=layer,
                        feature_index=idx,
                        activation_strength=val,
                        concept_text=concept_text,
                    ))

        all_features.sort(key=lambda f: f.activation_strength, reverse=True)
        return all_features[:top_k]
```

### Step 5: Steering Engine (`backend/engine/steering.py`)

Implements steered generation by hooking into the model's forward pass.

Key implementation notes:
- For each active feature the user has selected, retrieve the SAE decoder vector for that feature: `sae.W_dec[feature_index]`
- During generation, register a forward hook at the target layer that adds `alpha * decoder_vector` to the residual stream
- `alpha` is user-controllable (typically 1.0–100.0 range depending on feature)
- Support multiple simultaneous steered features across different layers

```python
# Sketch — steering.py

class SteeringEngine:
    def __init__(self, model_manager: ModelManager, sae_manager: SAEManager):
        self.model = model_manager
        self.saes = sae_manager

    def get_steering_vector(self, layer: int, feature_index: int) -> torch.Tensor:
        """Extract the decoder direction for a specific SAE feature."""
        sae = self.saes.saes[layer]
        return sae.W_dec[feature_index]

    def generate_steered(
        self,
        prompt: str,
        active_features: list[dict],  # [{layer, feature_index, alpha}]
        max_new_tokens: int = 256,
        temperature: float = 0.7,
    ) -> str:
        """Generate text with steering vectors injected."""
        hooks = []
        for feat in active_features:
            vec = self.get_steering_vector(feat["layer"], feat["feature_index"])
            alpha = feat.get("alpha", 10.0)

            def make_hook(vector, strength):
                def hook_fn(activation, hook):
                    activation[:, :, :] += strength * vector
                    return activation
                return hook_fn

            hook_name = f"blocks.{feat['layer']}.hook_resid_post"
            hooks.append((hook_name, make_hook(vec, alpha)))

        # Use TransformerLens hooks_with context for generation
        with self.model.model.hooks(fwd_hooks=hooks):
            output = self.model.model.generate(
                prompt,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
            )
        return self.model.model.to_string(output[0])

    def generate_baseline(
        self,
        prompt: str,
        max_new_tokens: int = 256,
        temperature: float = 0.7,
    ) -> str:
        """Generate text without any steering (control condition)."""
        output = self.model.model.generate(
            prompt,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
        )
        return self.model.model.to_string(output[0])
```

### Step 6: Neuronpedia Client (`backend/neuronpedia/client.py`)

Wraps the Neuronpedia public API for feature metadata and labels.

Key endpoints to integrate:
- **Feature lookup**: `GET https://www.neuronpedia.org/api/feature/{model}/{source}/{index}` — returns dashboard data, explanation, top activations
- **Search by explanation**: `POST https://www.neuronpedia.org/api/explanation/search` — semantic search across all feature explanations
- **Steer (cloud)**: Available via the neuronpedia Python package for comparison with your local steering

```python
# Sketch — neuronpedia/client.py
import httpx

NP_BASE = "https://www.neuronpedia.org"

class NeuronpediaClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key
        self.client = httpx.AsyncClient(base_url=NP_BASE, timeout=30.0)

    async def get_feature(self, model: str, source: str, index: int) -> dict:
        """Get feature dashboard data including explanation."""
        r = await self.client.get(f"/api/feature/{model}/{source}/{index}")
        r.raise_for_status()
        return r.json()

    async def search_features(self, query: str, model: str = "gemma-2-2b",
                               layers: list[str] | None = None) -> list[dict]:
        """Search features by explanation text (semantic search)."""
        payload = {
            "modelId": model,
            "query": query,
        }
        if layers:
            payload["layers"] = layers
        r = await self.client.post("/api/explanation/search", json=payload)
        r.raise_for_status()
        return r.json().get("results", [])

    def get_feature_url(self, model: str, source: str, index: int) -> str:
        """Get the Neuronpedia URL for a feature (for linking/embedding)."""
        return f"{NP_BASE}/{model}/{source}/{index}"

    def get_embed_url(self, model: str, source: str, index: int) -> str:
        """Get embeddable iframe URL for a feature dashboard."""
        return f"{NP_BASE}/{model}/{source}/{index}?embed=true"
```

The **source** format for Gemma Scope residual SAEs on Neuronpedia is: `{layer}-gemmascope-res-16k`
So layer 20 would be: `20-gemmascope-res-16k`

### Step 7: API Routes

Create FastAPI routers for each domain:

**`/api/discover`**
- `POST /api/discover` — body: `{concept: string, top_k?: int, contrastive?: bool}` → returns discovered features
- `POST /api/discover/contrastive` — body: `{concept: string, neutral_texts: string[]}` → contrastive discovery

**`/api/features`**
- `GET /api/features/{layer}/{index}` — get feature info (local SAE data + NP explanation)
- `GET /api/features/{layer}/{index}/neuronpedia` — get full NP dashboard data
- `POST /api/features/search` — search NP by explanation text

**`/api/chat`**
- `POST /api/chat` — body: `{messages: [...], features: [{layer, index, alpha}], temperature?: float}` → returns `{steered_response: string, baseline_response: string}`
- Both steered and baseline are generated for each message so the UI can show them side-by-side

**`/api/library`**
- `GET /api/library` — list saved feature sets
- `POST /api/library` — save a feature set: `{name, concept, features: [...]}`
- `GET /api/library/{id}` — load a feature set
- `DELETE /api/library/{id}`

**`/api/neuronpedia`**
- `GET /api/neuronpedia/feature/{layer}/{index}` — proxy to NP API (avoids CORS in frontend)
- `GET /api/neuronpedia/embed-url/{layer}/{index}` — returns NP iframe embed URL

### Step 8: FastAPI Main (`backend/main.py`)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load model and SAEs (this takes time, ~2-5 min)
    print("Loading model...")
    app.state.model_manager = ModelManager()
    print("Loading SAEs...")
    app.state.sae_manager = SAEManager(layers=CONFIGURED_LAYERS)
    print("Initializing engines...")
    app.state.concept_discovery = ConceptDiscovery(app.state.model_manager, app.state.sae_manager)
    app.state.steering = SteeringEngine(app.state.model_manager, app.state.sae_manager)
    app.state.neuronpedia = NeuronpediaClient(api_key=NP_API_KEY)
    print("Ready!")
    yield
    # Shutdown: cleanup

app = FastAPI(title="Concept Steering Explorer", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], ...)

# Include routers
app.include_router(discovery_router, prefix="/api")
app.include_router(features_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(library_router, prefix="/api")
app.include_router(neuronpedia_router, prefix="/api")
```

---

## Phase 2: Frontend

### Step 9: React App Setup

Use Vite with React + TypeScript + Tailwind:
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install zustand @tanstack/react-query axios lucide-react
```

### Step 10: Core Pages

**Discover Page** — the main landing experience:
- Large text input: "Describe a concept to explore..."
- Optional toggle for contrastive mode (generates neutral comparisons automatically)
- "Discover" button → shows progress bar while backend runs inference
- Results: a ranked list of feature cards, each showing:
  - Layer number and feature index
  - Activation strength (visual bar)
  - Neuronpedia explanation (fetched async, shown when available)
  - Link to Neuronpedia dashboard (opens in new tab or inline iframe)
  - Toggle: include this feature in steering set
  - Slider: per-feature alpha (strength)
- "Save to Library" button → saves selected features as a named set
- "Open in Chat" button → navigates to Chat page with these features active

**Library Page**:
- Grid of saved feature sets
- Each card: name, concept text, feature count, created date
- Click to load → sets features active and goes to Chat page
- Delete, rename, export as JSON

**Chat Page** — the split-pane comparison:
- Top bar: active feature set name + concept, global alpha multiplier, temperature slider
- Two-column layout:
  - Left: **Steered** — chat with features active
  - Right: **Baseline** — same messages, no steering
- Shared input at bottom — when user sends a message, both columns get a response
- Per-feature toggles in a collapsible sidebar (can enable/disable individual features mid-conversation)
- Each steered feature shown as a pill/chip with its NP explanation and a strength slider
- Optional: embed Neuronpedia feature dashboard as expandable iframe below each feature pill

### Step 11: Key Frontend Components

**FeatureCard.tsx** — the main reusable unit:
```tsx
// Should display:
// - Layer badge (e.g., "L20")
// - Feature index
// - Activation strength bar (visual, 0-1 normalized)
// - NP explanation text (loaded async)
// - Link icon → opens Neuronpedia page
// - Toggle switch → include/exclude from steering
// - Alpha slider (0-100 range)
```

**ChatPanel.tsx** — handles the split-pane chat:
```tsx
// - Maintains separate message histories for steered and baseline
// - Sends single POST /api/chat with the user message + active features
// - Receives both responses and appends to respective histories
// - Streaming would be ideal (SSE) but start with simple request/response
```

**NeuronpediaEmbed.tsx** — embeds NP feature dashboards:
```tsx
// Simple iframe wrapper
// URL format: https://www.neuronpedia.org/gemma-2-2b/{layer}-gemmascope-res-16k/{index}?embed=true
// Wrap in a collapsible/expandable container
```

---

## Phase 3: Neuronpedia Integration Details

### Enriching Local Features with NP Data

After concept discovery returns a list of (layer, feature_index) pairs from local SAE analysis, enrich each feature by calling the Neuronpedia API:

1. **Get explanation**: `GET /api/feature/gemma-2-2b/{layer}-gemmascope-res-16k/{index}` — the response includes an `explanations` array where each entry has a `description` field (auto-generated by GPT-4 describing what the feature responds to).

2. **Search by concept**: Separately, use `POST /api/explanation/search` with the concept text to find features that NP has already identified as semantically related. Cross-reference these with your locally discovered features — features that appear in BOTH lists are high-confidence matches.

3. **Deep links**: Every feature should link back to its NP page at `https://www.neuronpedia.org/gemma-2-2b/{layer}-gemmascope-res-16k/{index}` where users can see the full dashboard with top activations, logits, and more.

### Cloud Steering Comparison (Optional/Advanced)

The Neuronpedia Python package supports remote steering:
```python
from neuronpedia.np_vector import NPVector

vector = NPVector.new(
    label="resin-smell",
    model_id="gemma-2-2b-it",
    layer_num=20,
    hook_type="hook_resid_pre",
    vector=steering_vector_tensor.tolist(),
    default_steer_strength=44,
)
response = vector.steer_chat(
    steered_chat_messages=[{"role": "user", "content": "Tell me about a forest"}]
)
```

This could be exposed as a "Compare with Neuronpedia" button that runs the same steering remotely and shows the result alongside the local output — useful for validating that local steering behaves the same way.

---

## Implementation Order for Claude Code

Build in this order so you always have something testable:

### Sprint 1: Backend Core (get inference working)
1. Create conda env (`conda create -n gemma-explorer python=3.11`) and install deps with `pip install -r backend/requirements.txt`
2. Implement `ModelManager` — load Gemma 2 2B via TransformerLens, verify it generates text
3. Implement `SAEManager` — load Gemma Scope SAEs for 3 layers initially (12, 16, 20), verify encode/decode roundtrip
4. Implement basic `ConceptDiscovery.discover()` — single-text mode (not contrastive yet)
5. Create minimal FastAPI app with `POST /api/discover` endpoint
6. **Test**: `conda activate gemma-explorer && python -m backend.main`, then curl a concept and get back a list of features with activation strengths

### Sprint 2: Steering (the core feature)
7. Implement `SteeringEngine` — steering hook injection + generation
8. Add `POST /api/chat` endpoint that returns steered + baseline
9. **Test**: send a chat message with features active, verify steered output differs from baseline

### Sprint 3: Neuronpedia Bridge
10. Implement `NeuronpediaClient` — feature lookup and search
11. Add NP proxy endpoints to avoid CORS
12. Enrich discovered features with NP explanations
13. **Test**: discover features for a concept, see NP explanations alongside local data

### Sprint 4: Frontend MVP
14. Scaffold React app with Vite + Tailwind
15. Build Discover page with concept input and feature list
16. Build Chat page with split-pane layout
17. Wire up API calls
18. **Test**: end-to-end flow from concept input to steered chat

### Sprint 5: Library + Polish
19. Implement feature library (save/load feature sets)
20. Add Library page
21. Add NP iframe embeds for feature deep-dives
22. Add contrastive discovery mode
23. Improve UI: loading states, error handling, responsive layout

---

## Hardware Requirements

- **Minimum (CPU only, slow)**: 16GB RAM. Inference will take 10-30 seconds per generation. SAE encoding is fast. Workable for development.
- **Recommended (GPU)**: NVIDIA GPU with 8GB+ VRAM (RTX 3070/4070 or better). Use bfloat16 dtype. Inference drops to 1-3 seconds.
- **Ideal**: 16GB+ VRAM GPU (RTX 4090, A100). Can load more SAE layers simultaneously and run bfloat16 comfortably.

Gemma 2 2B in float32 needs ~8GB RAM/VRAM. In bfloat16, ~4GB. Each 16K-width SAE adds ~250MB. Loading 6 layers of SAEs adds ~1.5GB.

---

## Key Gotchas to Watch For

1. **TransformerLens model name**: Use `"gemma-2-2b"` (not `"google/gemma-2-2b"`) — TransformerLens has its own model registry.

2. **SAE hook points**: Gemma Scope residual SAEs are trained on `blocks.{N}.hook_resid_post`. Make sure you're reading from the same hook point when encoding activations.

3. **Token position for concept discovery**: Use the LAST token position `[:, -1, :]` when extracting concept activations — this is where the model's representation of the full input is most concentrated.

4. **Steering vector magnitude**: The raw SAE decoder vectors may need scaling. Start with alpha values of 5-50 and let users adjust. Too high causes degenerate output (repetition, gibberish). Too low has no visible effect.

5. **Chat template**: Gemma 2 IT expects a specific chat format. Use the HuggingFace tokenizer's `apply_chat_template()` to format messages correctly before passing to TransformerLens for generation.

6. **Neuronpedia rate limits**: The NP API has rate limits (100 steers/hour, general API limits). Cache NP responses aggressively on the backend. Feature explanations don't change — cache them indefinitely.

7. **SAE Lens version**: Use v6+ — the API changed significantly. The `from_pretrained` method and `SAE` class are the current interface.

8. **First startup is slow**: Downloading model weights (~5GB) and SAE weights (~1.5GB) happens on first run. Subsequent starts use cached weights from `~/.cache/huggingface/`.

---

## Environment Variables Reference

```bash
# .env file
HF_TOKEN=hf_xxxxx                          # HuggingFace token (required for gated model access)
NEURONPEDIA_API_KEY=np_xxxxx               # Optional, enables NP features
DEVICE=cuda                                 # cuda | cpu | mps
DTYPE=bfloat16                             # float32 | bfloat16
SAE_LAYERS=10,12,14,16,18,20              # Which layers to load SAEs for
BACKEND_PORT=8000
FRONTEND_URL=http://localhost:5173         # For CORS
```
