"""
Train a simple regression model and save it as model.pkl.

Usage:
    python train_model.py

Generates:
    models/model.pkl — a trained scikit-learn model ready for the FastAPI example.
"""
import os
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
import joblib

np.random.seed(42)
n_samples = 1000
n_features = 4

X = np.random.randn(n_samples, n_features)
y = 3.0 * X[:, 0] - 1.5 * X[:, 1] + 0.5 * X[:, 2] ** 2 + np.random.randn(n_samples) * 0.3

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=42)
model.fit(X_train, y_train)

score = model.score(X_test, y_test)
print(f"Model R² score: {score:.4f}")

os.makedirs("models", exist_ok=True)
joblib.dump(model, "models/model.pkl")
print("Saved to models/model.pkl")
