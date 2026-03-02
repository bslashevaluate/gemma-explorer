from pydantic import BaseModel


class FeatureExplanation(BaseModel):
    description: str
    score: float | None = None


class NeuronpediaFeature(BaseModel):
    model_id: str
    layer: int
    feature_index: int
    source: str
    explanations: list[FeatureExplanation] = []
    neuronpedia_url: str
    embed_url: str


class NeuronpediaSearchResult(BaseModel):
    model_id: str
    layer: int
    feature_index: int
    description: str
    score: float | None = None
    neuronpedia_url: str
