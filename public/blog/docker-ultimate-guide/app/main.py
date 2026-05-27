from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np

app = FastAPI(title="ML Prediction API")
model = joblib.load("models/model.pkl")


class PredictionRequest(BaseModel):
    features: list[float]


class PredictionResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    prediction: float
    model_version: str = "1.0.0"


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    X = np.array(request.features).reshape(1, -1)
    prediction = model.predict(X)[0]
    return PredictionResponse(prediction=float(prediction))
