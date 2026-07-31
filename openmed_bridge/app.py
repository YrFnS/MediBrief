"""OpenMed REST application extended with MediBrief context endpoints.

Run with:

    uvicorn openmed_bridge.app:app --host 127.0.0.1 --port 8080

The imported OpenMed application continues to provide `/health` and `/analyze`.
This module adds advisory clinical-context endpoints on the same origin so the
browser never needs a second local service or a second CORS policy.
"""

from __future__ import annotations

from typing import Literal

import openmed
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

from openmed.service.app import app

from .context_service import (
    CONTEXT_BRIDGE_VERSION,
    CONTEXT_ENGINE,
    ContextBridgeInputError,
    ContextBridgeRuntimeError,
    analyze_clinical_context,
)


class ContextSpanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    kind: Literal["condition", "medication"]
    text: str = Field(min_length=1)
    label: str | None = None
    start: int = Field(ge=0)
    end: int = Field(gt=0)


class ContextAnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1)
    spans: list[ContextSpanRequest]
    language: str = Field(default="en", min_length=2, max_length=35)


def _dump(model: BaseModel) -> dict[str, object]:
    model_dump = getattr(model, "model_dump", None)
    if callable(model_dump):
        return model_dump()
    return model.dict()  # type: ignore[attr-defined,no-any-return]


@app.get("/medibrief/context/health")
def medibrief_context_health() -> dict[str, object]:
    """Report bridge availability without claiming model or clinical validity."""

    return {
        "status": "ready",
        "service": "medibrief-openmed-context-bridge",
        "engine": CONTEXT_ENGINE,
        "openmed_version": getattr(openmed, "__version__", None),
        "bridge_version": CONTEXT_BRIDGE_VERSION,
        "features": [
            "negation",
            "certainty",
            "temporality",
            "experiencer",
            "section-context",
            "medication-sig",
        ],
        "advisory": True,
    }


@app.post("/medibrief/context")
def medibrief_context_analyze(payload: ContextAnalyzeRequest) -> dict[str, object]:
    """Resolve advisory context for already-extracted clinical spans."""

    try:
        return analyze_clinical_context(
            text=payload.text,
            spans=[_dump(span) for span in payload.spans],
            language=payload.language,
        )
    except ContextBridgeInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ContextBridgeRuntimeError as exc:
        raise HTTPException(
            status_code=500,
            detail="OpenMed clinical context evaluation failed.",
        ) from exc


__all__ = ["app"]
