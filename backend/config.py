import os
from dotenv import load_dotenv

load_dotenv()

# Model
HF_TOKEN = os.getenv("HF_TOKEN", "")
MODEL_NAME = os.getenv("MODEL_NAME", "gemma-2-2b")
DEVICE = os.getenv("DEVICE", "cuda")
DTYPE = os.getenv("DTYPE", "bfloat16")

# SAE
SAE_RELEASE = os.getenv("SAE_RELEASE", "gemma-scope-2b-pt-res")
SAE_WIDTH = os.getenv("SAE_WIDTH", "16k")
SAE_LAYERS = [int(x) for x in os.getenv("SAE_LAYERS", "10,12,14,16,18,20").split(",")]

# Neuronpedia
NEURONPEDIA_API_KEY = os.getenv("NEURONPEDIA_API_KEY", "")

# Server
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
