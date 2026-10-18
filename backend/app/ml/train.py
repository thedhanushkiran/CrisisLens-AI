"""
CrisisLens AI - Incident Severity Classification Model Training Pipeline.

Trains and evaluates incident severity classifiers comparing Logistic Regression,
Random Forest, and Gradient Boosting. Computes Macro-F1, Precision, Recall,
and Confusion Matrix, and saves the serialized production model artifact.
"""

import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from backend.app.ml.dataset import generate_augmented_dataset

ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

MODEL_PATH = os.path.join(ARTIFACTS_DIR, "incident_severity_model.joblib")
METRICS_PATH = os.path.join(ARTIFACTS_DIR, "model_metrics.json")


def build_pipeline(classifier):
    """Constructs a composite text and tabular pipeline."""
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "text",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    max_features=400,
                    sublinear_tf=True,
                    stop_words="english",
                ),
                "description",
            ),
            (
                "num",
                StandardScaler(),
                [
                    "water_depth_m",
                    "trapped_count",
                    "vulnerable_count",
                    "has_elderly",
                    "has_child",
                    "has_medical",
                    "has_hazard",
                ],
            ),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore"),
                ["categories"],
            ),
        ]
    )

    return Pipeline([
        ("preprocessor", preprocessor),
        ("clf", classifier),
    ])


def train_and_evaluate(random_state: int = 42) -> dict:
    print("Generating disaster triage benchmark dataset...")
    df = generate_augmented_dataset(target_size=630, random_state=random_state)

    X = df[[
        "description",
        "categories",
        "water_depth_m",
        "trapped_count",
        "vulnerable_count",
        "has_elderly",
        "has_child",
        "has_medical",
        "has_hazard",
    ]]
    y = df["severity"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=random_state, stratify=y
    )

    candidate_models = {
        "LogisticRegression_Baseline": LogisticRegression(max_iter=1000, random_state=random_state),
        "RandomForestClassifier": RandomForestClassifier(n_estimators=120, max_depth=12, random_state=random_state),
        "GradientBoostingClassifier": GradientBoostingClassifier(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=random_state),
    }

    results = {}
    best_name = None
    best_macro_f1 = -1.0
    best_pipeline = None

    classes = ["Critical", "Urgent", "Moderate"]
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=random_state)

    print("\n--- Model Comparison on Stratified 5-Fold Cross Validation ---")
    for name, clf in candidate_models.items():
        pipeline = build_pipeline(clf)
        cv_scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring="f1_macro")
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)
        macro_f1 = float(f1_score(y_test, y_pred, average="macro"))

        print(f"Model: {name}")
        print(f"  CV Macro-F1: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")
        print(f"  Hold-out Macro-F1: {macro_f1:.4f}")

        results[name] = {
            "cv_macro_f1_mean": float(np.round(cv_scores.mean(), 4)),
            "cv_macro_f1_std": float(np.round(cv_scores.std(), 4)),
            "test_macro_f1": float(np.round(macro_f1, 4)),
        }

        if macro_f1 > best_macro_f1:
            best_macro_f1 = macro_f1
            best_name = name
            best_pipeline = pipeline

    print(f"\nSelected Best Model: {best_name} (Macro-F1: {best_macro_f1:.4f})")

    # Detailed evaluation on best model
    y_pred_best = best_pipeline.predict(X_test)
    report_dict = classification_report(y_test, y_pred_best, labels=classes, output_dict=True)
    cm = confusion_matrix(y_test, y_pred_best, labels=classes).tolist()

    evaluation_report = {
        "best_model": best_name,
        "classes": classes,
        "sample_count": len(df),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "model_comparison": results,
        "holdout_metrics": {
            "accuracy": float(np.round(report_dict["accuracy"], 4)),
            "macro_f1": float(np.round(report_dict["macro avg"]["f1-score"], 4)),
            "weighted_f1": float(np.round(report_dict["weighted avg"]["f1-score"], 4)),
            "class_metrics": {
                c: {
                    "precision": float(np.round(report_dict[c]["precision"], 4)),
                    "recall": float(np.round(report_dict[c]["recall"], 4)),
                    "f1_score": float(np.round(report_dict[c]["f1-score"], 4)),
                    "support": int(report_dict[c]["support"]),
                }
                for c in classes
            },
            "confusion_matrix": {
                "labels": classes,
                "matrix": cm,
            },
        },
        "limitations": [
            "Trained on structured synthetic emergency benchmark with domain heuristics.",
            "Must NOT be used as autonomous dispatch authorization without human responder verification.",
            "Language support is primarily English text; multilingual dialect performance requires expanded corpora.",
            "High uncertainty samples are flagged for mandatory human escalation."
        ],
    }

    # Save artifacts
    print(f"Saving serialized pipeline to: {MODEL_PATH}")
    joblib.dump(best_pipeline, MODEL_PATH)

    print(f"Saving metrics report to: {METRICS_PATH}")
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(evaluation_report, f, indent=2)

    print("Model training & artifact generation completed successfully.")
    return evaluation_report


if __name__ == "__main__":
    train_and_evaluate()
