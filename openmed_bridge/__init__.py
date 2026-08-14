"""MediBrief extensions for the local OpenMed service.

The package root deliberately avoids importing the OpenMed runtime eagerly.
Lightweight evaluators and corpus tools must remain usable without installing
model, OCR, CUDA, or service dependencies. The clinical-context helper loads
its runtime implementation only when it is actually called.
"""

from typing import Any


def analyze_clinical_context(*args: Any, **kwargs: Any) -> Any:
    """Load and call the OpenMed-backed context service on demand."""
    from .context_service import analyze_clinical_context as implementation

    return implementation(*args, **kwargs)


__all__ = ["analyze_clinical_context"]
