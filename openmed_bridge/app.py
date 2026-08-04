"""OpenMed REST application extended with MediBrief advisory endpoints.

Run with:

    uvicorn openmed_bridge.app:app --host 127.0.0.1 --port 8080

The imported OpenMed application continues to provide `/health` and `/analyze`.
This module adds assertion-context and page-aware document extraction endpoints
on the same origin so the browser needs one local service and one CORS policy.
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
from .document_service import (
    DEFAULT_OCR_RESOLUTION,
    DocumentBridgeInputError,
    DocumentBridgeRuntimeError,
    document_bridge_health,
    extract_document,
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


class DocumentExtractRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(min_length=1, max_length=500)
    file_name: str = Field(min_length=1, max_length=500)
    mime_type: str = Field(min_length=1, max_length=200)
    document_base64: str = Field(min_length=1)
    ocr_mode: Literal["auto", "always", "never"] = "auto"
    ocr_engine: Literal[
        "auto",
        "doctr",
        "tesseract",
        "easyocr",
        "paddleocr",
    ] = "auto"
    languages: list[str] = Field(default_factory=lambda: ["en"], max_length=8)
    resolution: int = Field(default=DEFAULT_OCR_RESOLUTION, ge=72, le=400)


def _dump(model: BaseModel) -> dict[str, object]:
    model_dump = getattr(model, "model_dump", None)
    if callable(model_dump):
        return model_dump()
    return model.dict()  # type: ignore[attr-defined,no-any-return]


@app.get("/medibrief/context/health")
def medibrief_context_health() -> dict[str, object]:
    """Report context-bridge availability without claiming clinical validity."""

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


@app.get("/medibrief/documents/health")
def medibrief_document_health() -> dict[str, object]:
    """Report embedded-text and OCR capability for the local bridge."""

    return document_bridge_health()


@app.post("/medibrief/documents/extract")
def medibrief_document_extract(payload: DocumentExtractRequest) -> dict[str, object]:
    """Extract page-aware text from one PDF or image without retaining it."""

    try:
        return extract_document(
            document_id=payload.document_id,
            file_name=payload.file_name,
            mime_type=payload.mime_type,
            document_base64=payload.document_base64,
            ocr_mode=payload.ocr_mode,
            ocr_engine=payload.ocr_engine,
            languages=payload.languages,
            resolution=payload.resolution,
        )
    except DocumentBridgeInputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except DocumentBridgeRuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


__all__ = ["app"]
