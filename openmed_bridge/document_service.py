"""Local PDF text extraction and OCR adapter for MediBrief.

The adapter composes OpenMed's public multimodal APIs and returns one derived
text string with page-aware source spans. The original uploaded file remains the
authoritative source; this module never creates or confirms clinical facts.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import importlib
import os
import tempfile
from collections.abc import Callable, Mapping, Sequence
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DOCUMENT_BRIDGE_VERSION = "1"
DOCUMENT_ENGINE = "OpenMed multimodal document extraction"
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
MAX_DOCUMENT_PAGES = 200
DEFAULT_OCR_RESOLUTION = 200
MIN_EMBEDDED_PAGE_CHARACTERS = 12

_SUPPORTED_IMAGE_SUFFIXES = {
    ".bmp",
    ".gif",
    ".jpeg",
    ".jpg",
    ".png",
    ".tif",
    ".tiff",
    ".webp",
}
_IMAGE_MIME_PREFIX = "image/"


class DocumentBridgeInputError(ValueError):
    """Raised when a document request is malformed or inconsistent."""


class DocumentBridgeUnsupportedError(ValueError):
    """Raised when the supplied document family is not supported."""


class DocumentBridgeRuntimeError(RuntimeError):
    """Raised when an optional local extraction dependency cannot run."""


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _sha256(data: bytes | str) -> str:
    payload = data.encode("utf-8") if isinstance(data, str) else data
    return hashlib.sha256(payload).hexdigest()


def _required_text(value: object, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise DocumentBridgeInputError(f"{field} must be a non-empty string")
    return value.strip()


def _decode_base64(value: str) -> bytes:
    try:
        decoded = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise DocumentBridgeInputError(
            "document_base64 must contain valid base64 data"
        ) from exc
    if not decoded:
        raise DocumentBridgeInputError("the supplied document is empty")
    if len(decoded) > MAX_DOCUMENT_BYTES:
        raise DocumentBridgeInputError(
            f"the supplied document exceeds {MAX_DOCUMENT_BYTES} bytes"
        )
    return decoded


def _normalized_languages(languages: Sequence[str] | None) -> list[str]:
    normalized = [
        str(language).strip().lower()
        for language in (languages or ["en"])
        if str(language).strip()
    ]
    return normalized or ["en"]


def _safe_suffix(file_name: str, mime_type: str) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix == ".pdf" or mime_type == "application/pdf":
        return ".pdf"
    if suffix in _SUPPORTED_IMAGE_SUFFIXES:
        return suffix
    if mime_type.startswith(_IMAGE_MIME_PREFIX):
        subtype = mime_type.split("/", 1)[1].split("+", 1)[0].lower()
        if subtype == "jpeg":
            return ".jpg"
        candidate = f".{subtype}"
        if candidate in _SUPPORTED_IMAGE_SUFFIXES:
            return candidate
    return suffix or ".bin"


def _document_kind(file_name: str, mime_type: str) -> str:
    suffix = _safe_suffix(file_name, mime_type)
    if suffix == ".pdf" or mime_type == "application/pdf":
        return "pdf"
    if suffix in _SUPPORTED_IMAGE_SUFFIXES or mime_type.startswith(
        _IMAGE_MIME_PREFIX
    ):
        return "image"
    return "unsupported"


def _load_multimodal_api() -> tuple[Callable[..., Any], Callable[..., Any], Callable[[], tuple[str, ...]]]:
    try:
        multimodal = importlib.import_module("openmed.multimodal")
        ocr_module = importlib.import_module("openmed.multimodal.ocr")
    except Exception as exc:  # pragma: no cover - depends on install profile
        raise DocumentBridgeRuntimeError(
            'OpenMed multimodal support is unavailable. Install "openmed[multimodal]".'
        ) from exc
    return (
        getattr(multimodal, "extract_pdf"),
        getattr(ocr_module, "ocr"),
        getattr(multimodal, "available_ocr_engines"),
    )


def document_bridge_health() -> dict[str, Any]:
    """Report extraction capability without claiming document suitability."""

    try:
        _extract_pdf, _ocr, available_ocr_engines = _load_multimodal_api()
        engines = list(available_ocr_engines())
        return {
            "status": "ready",
            "service": "medibrief-openmed-document-bridge",
            "engine": DOCUMENT_ENGINE,
            "bridge_version": DOCUMENT_BRIDGE_VERSION,
            "features": [
                "embedded-pdf-text",
                "page-provenance",
                "image-ocr",
                "scanned-pdf-ocr",
            ],
            "available_ocr_engines": engines,
            "ocr_available": bool(engines),
            "advisory": True,
        }
    except DocumentBridgeRuntimeError as exc:
        return {
            "status": "unavailable",
            "service": "medibrief-openmed-document-bridge",
            "engine": DOCUMENT_ENGINE,
            "bridge_version": DOCUMENT_BRIDGE_VERSION,
            "features": [],
            "available_ocr_engines": [],
            "ocr_available": False,
            "message": str(exc),
            "advisory": True,
        }


def _value(item: object, key: str, default: Any = None) -> Any:
    if isinstance(item, Mapping):
        return item.get(key, default)
    return getattr(item, key, default)


def _bbox(value: object) -> list[float] | None:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        return None
    if len(value) != 4:
        return None
    try:
        result = [float(part) for part in value]
    except (TypeError, ValueError):
        return None
    return result


def _embedded_pdf_words(document: object) -> tuple[int, dict[int, list[dict[str, Any]]]]:
    text = str(_value(document, "text", ""))
    metadata = _value(document, "metadata", {})
    if not isinstance(metadata, Mapping):
        metadata = {}
    try:
        page_count = max(0, int(metadata.get("page_count", 0)))
    except (TypeError, ValueError):
        page_count = 0

    by_page: dict[int, list[dict[str, Any]]] = {}
    for source in tuple(_value(document, "spans", ()) or ()):
        try:
            start = int(_value(source, "start"))
            end = int(_value(source, "end"))
            page = int(_value(source, "page", 0))
        except (TypeError, ValueError):
            continue
        if start < 0 or end <= start or end > len(text) or page < 0:
            continue
        word = text[start:end].strip()
        if not word:
            continue
        by_page.setdefault(page, []).append(
            {
                "text": word,
                "bbox": _bbox(_value(source, "bbox")),
                "confidence": None,
                "method": "embedded-pdf",
                "engine": "pdfplumber",
            }
        )
        page_count = max(page_count, page + 1)

    for words in by_page.values():
        words.sort(key=lambda item: str(item["text"])) if False else None
    return page_count, by_page


def _ocr_words(result: object, *, page_override: int | None = None) -> tuple[str, dict[int, list[dict[str, Any]]]]:
    metadata = _value(result, "metadata", {})
    if not isinstance(metadata, Mapping):
        metadata = {}
    engine = str(metadata.get("engine") or "openmed-ocr")
    by_page: dict[int, list[dict[str, Any]]] = {}
    for word in tuple(_value(result, "words", ()) or ()):
        text = str(_value(word, "text", "")).strip()
        if not text:
            continue
        try:
            page = page_override if page_override is not None else int(
                _value(word, "page", 0)
            )
            confidence = float(_value(word, "confidence", 0.0))
        except (TypeError, ValueError):
            continue
        if page < 0:
            continue
        by_page.setdefault(page, []).append(
            {
                "text": text,
                "bbox": _bbox(_value(word, "bbox")),
                "confidence": max(0.0, min(1.0, confidence)),
                "method": "ocr",
                "engine": engine,
            }
        )
    return engine, by_page


def _default_pdf_renderer(
    path: str | Path,
    page_indexes: Sequence[int],
    resolution: int,
) -> dict[int, object]:
    try:
        pdfplumber = importlib.import_module("pdfplumber")
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise DocumentBridgeRuntimeError(
            'PDF rasterization requires "openmed[multimodal]".'
        ) from exc

    rendered: dict[int, object] = {}
    with pdfplumber.open(path) as pdf:
        for page_index in page_indexes:
            if page_index < 0 or page_index >= len(pdf.pages):
                continue
            try:
                rendered[page_index] = pdf.pages[page_index].to_image(
                    resolution=resolution
                ).original
            except Exception as exc:
                raise DocumentBridgeRuntimeError(
                    f"PDF page {page_index + 1} could not be rasterized for OCR."
                ) from exc
    return rendered


def _non_whitespace_characters(words: Sequence[Mapping[str, Any]]) -> int:
    return sum(len(str(word.get("text", "")).strip()) for word in words)


def _assemble_pages(
    *,
    page_count: int,
    page_words: Mapping[int, Sequence[Mapping[str, Any]]],
    page_methods: Mapping[int, str],
    page_engines: Mapping[int, str | None],
    warnings: Sequence[str],
    failed_pages: Sequence[int],
) -> dict[str, Any]:
    parts: list[str] = []
    spans: list[dict[str, Any]] = []
    pages: list[dict[str, Any]] = []
    cursor = 0

    for page_index in range(page_count):
        if page_index > 0:
            parts.append("\n\n")
            cursor += 2
        page_start = cursor
        confidences: list[float] = []
        words = tuple(page_words.get(page_index, ()))
        for word_index, word in enumerate(words):
            text = str(word.get("text", "")).strip()
            if not text:
                continue
            if cursor > page_start:
                parts.append(" ")
                cursor += 1
            start = cursor
            parts.append(text)
            cursor += len(text)
            confidence = word.get("confidence")
            if isinstance(confidence, (int, float)):
                confidences.append(float(confidence))
            span: dict[str, Any] = {
                "start": start,
                "end": cursor,
                "page_number": page_index + 1,
                "method": str(word.get("method") or page_methods.get(page_index) or "unknown"),
            }
            box = word.get("bbox")
            if isinstance(box, list) and len(box) == 4:
                span["bbox"] = box
            if isinstance(confidence, (int, float)):
                span["confidence"] = round(float(confidence), 6)
            spans.append(span)

        page_end = cursor
        page_payload: dict[str, Any] = {
            "page_number": page_index + 1,
            "start": page_start,
            "end": page_end,
            "method": page_methods.get(page_index, "none"),
            "word_count": len(words),
            "character_count": max(0, page_end - page_start),
        }
        engine = page_engines.get(page_index)
        if engine:
            page_payload["engine"] = engine
        if confidences:
            page_payload["average_confidence"] = round(
                sum(confidences) / len(confidences), 6
            )
            page_payload["minimum_confidence"] = round(min(confidences), 6)
        pages.append(page_payload)

    text = "".join(parts)
    methods = {
        page_methods.get(index, "none")
        for index in range(page_count)
        if page_methods.get(index, "none") != "none"
    }
    if methods == {"embedded-pdf"}:
        method = "embedded-pdf"
    elif methods == {"ocr"}:
        method = "ocr"
    elif methods:
        method = "hybrid"
    else:
        method = "none"

    if not text.strip():
        status = "empty"
    elif failed_pages or warnings:
        status = "partial"
    else:
        status = "completed"

    return {
        "status": status,
        "method": method,
        "text": text,
        "text_sha256": _sha256(text),
        "page_count": page_count,
        "pages": pages,
        "source_spans": spans,
        "warnings": list(warnings),
        "failed_pages": [page + 1 for page in failed_pages],
    }


def _extract_pdf_document(
    *,
    path: str | Path,
    ocr_mode: str,
    ocr_engine: str,
    languages: Sequence[str],
    resolution: int,
    pdf_extractor: Callable[..., Any],
    ocr_runner: Callable[..., Any],
    pdf_renderer: Callable[[str | Path, Sequence[int], int], Mapping[int, object]],
) -> dict[str, Any]:
    try:
        document = pdf_extractor(path)
    except Exception as exc:
        raise DocumentBridgeRuntimeError(
            "Embedded PDF text extraction failed."
        ) from exc

    page_count, embedded = _embedded_pdf_words(document)
    if page_count <= 0:
        return _assemble_pages(
            page_count=0,
            page_words={},
            page_methods={},
            page_engines={},
            warnings=["The PDF did not expose any pages."],
            failed_pages=[],
        )
    if page_count > MAX_DOCUMENT_PAGES:
        raise DocumentBridgeInputError(
            f"the PDF exceeds the {MAX_DOCUMENT_PAGES}-page local extraction limit"
        )

    page_words: dict[int, Sequence[Mapping[str, Any]]] = {}
    page_methods: dict[int, str] = {}
    page_engines: dict[int, str | None] = {}
    warnings: list[str] = []
    failed_pages: list[int] = []

    ocr_indexes: list[int] = []
    for page_index in range(page_count):
        words = embedded.get(page_index, [])
        has_embedded_text = (
            _non_whitespace_characters(words) >= MIN_EMBEDDED_PAGE_CHARACTERS
        )
        if ocr_mode == "always" or (
            ocr_mode == "auto" and not has_embedded_text
        ):
            ocr_indexes.append(page_index)
        elif words:
            page_words[page_index] = words
            page_methods[page_index] = "embedded-pdf"
            page_engines[page_index] = "pdfplumber"
        else:
            page_words[page_index] = ()
            page_methods[page_index] = "none"
            page_engines[page_index] = None
            if ocr_mode == "never":
                warnings.append(
                    f"Page {page_index + 1} had no usable embedded text and OCR was disabled."
                )

    rendered: Mapping[int, object] = {}
    if ocr_indexes:
        try:
            rendered = pdf_renderer(path, ocr_indexes, resolution)
        except Exception as exc:
            warnings.append(str(exc))
            failed_pages.extend(ocr_indexes)

    for page_index in ocr_indexes:
        embedded_words = embedded.get(page_index, [])
        image = rendered.get(page_index)
        if image is None:
            if embedded_words:
                page_words[page_index] = embedded_words
                page_methods[page_index] = "embedded-pdf"
                page_engines[page_index] = "pdfplumber"
                warnings.append(
                    f"Page {page_index + 1} used embedded text because OCR rendering was unavailable."
                )
            else:
                page_words[page_index] = ()
                page_methods[page_index] = "none"
                page_engines[page_index] = None
            continue
        try:
            result = ocr_runner(
                image,
                engine=None if ocr_engine == "auto" else ocr_engine,
                languages=list(languages),
            )
            engine, by_page = _ocr_words(result, page_override=page_index)
            words = by_page.get(page_index, [])
            if words:
                page_words[page_index] = words
                page_methods[page_index] = "ocr"
                page_engines[page_index] = engine
            elif embedded_words:
                page_words[page_index] = embedded_words
                page_methods[page_index] = "embedded-pdf"
                page_engines[page_index] = "pdfplumber"
                warnings.append(
                    f"OCR returned no text for page {page_index + 1}; embedded text was retained."
                )
            else:
                page_words[page_index] = ()
                page_methods[page_index] = "none"
                page_engines[page_index] = engine
                warnings.append(
                    f"OCR returned no text for page {page_index + 1}."
                )
        except Exception as exc:
            failed_pages.append(page_index)
            if embedded_words:
                page_words[page_index] = embedded_words
                page_methods[page_index] = "embedded-pdf"
                page_engines[page_index] = "pdfplumber"
            else:
                page_words[page_index] = ()
                page_methods[page_index] = "none"
                page_engines[page_index] = None
            warnings.append(
                f"OCR failed for page {page_index + 1}: {exc}"
            )

    return _assemble_pages(
        page_count=page_count,
        page_words=page_words,
        page_methods=page_methods,
        page_engines=page_engines,
        warnings=warnings,
        failed_pages=sorted(set(failed_pages)),
    )


def _extract_image_document(
    *,
    path: str | Path,
    ocr_mode: str,
    ocr_engine: str,
    languages: Sequence[str],
    ocr_runner: Callable[..., Any],
) -> dict[str, Any]:
    if ocr_mode == "never":
        return {
            "status": "unsupported",
            "method": "none",
            "text": "",
            "text_sha256": _sha256(""),
            "page_count": 1,
            "pages": [{
                "page_number": 1,
                "start": 0,
                "end": 0,
                "method": "none",
                "word_count": 0,
                "character_count": 0,
            }],
            "source_spans": [],
            "warnings": ["Image OCR is disabled by the current extraction settings."],
            "failed_pages": [],
        }
    try:
        result = ocr_runner(
            path,
            engine=None if ocr_engine == "auto" else ocr_engine,
            languages=list(languages),
        )
    except Exception as exc:
        raise DocumentBridgeRuntimeError("Image OCR failed.") from exc

    engine, by_page = _ocr_words(result)
    page_count = max(by_page, default=0) + 1
    page_words = {page: words for page, words in by_page.items()}
    return _assemble_pages(
        page_count=max(1, page_count),
        page_words=page_words,
        page_methods={page: "ocr" for page in page_words},
        page_engines={page: engine for page in page_words},
        warnings=[] if page_words else ["OCR returned no text for the image."],
        failed_pages=[],
    )


def extract_document(
    *,
    document_id: str,
    file_name: str,
    mime_type: str,
    document_base64: str,
    ocr_mode: str = "auto",
    ocr_engine: str = "auto",
    languages: Sequence[str] | None = None,
    resolution: int = DEFAULT_OCR_RESOLUTION,
    extracted_at: str | None = None,
    pdf_extractor: Callable[..., Any] | None = None,
    ocr_runner: Callable[..., Any] | None = None,
    pdf_renderer: Callable[[str | Path, Sequence[int], int], Mapping[int, object]] | None = None,
) -> dict[str, Any]:
    """Extract page-aware local text from a PDF or image upload."""

    clean_document_id = _required_text(document_id, "document_id")
    clean_file_name = _required_text(file_name, "file_name")
    clean_mime_type = _required_text(mime_type, "mime_type").lower()
    if ocr_mode not in {"auto", "always", "never"}:
        raise DocumentBridgeInputError(
            "ocr_mode must be auto, always, or never"
        )
    if ocr_engine not in {
        "auto",
        "doctr",
        "tesseract",
        "easyocr",
        "paddleocr",
    }:
        raise DocumentBridgeInputError("unsupported OCR engine")
    if isinstance(resolution, bool) or not isinstance(resolution, int):
        raise DocumentBridgeInputError("resolution must be an integer")
    if resolution < 72 or resolution > 400:
        raise DocumentBridgeInputError("resolution must be between 72 and 400 DPI")

    content = _decode_base64(document_base64)
    kind = _document_kind(clean_file_name, clean_mime_type)
    active_languages = _normalized_languages(languages)
    extracted_timestamp = extracted_at or _iso_now()

    if kind == "unsupported":
        return {
            "status": "unsupported",
            "document_id": clean_document_id,
            "file_name": clean_file_name,
            "mime_type": clean_mime_type,
            "source_sha256": _sha256(content),
            "text": "",
            "text_sha256": _sha256(""),
            "method": "none",
            "page_count": 0,
            "pages": [],
            "source_spans": [],
            "warnings": ["Only PDF and image extraction is supported by this endpoint."],
            "failed_pages": [],
            "engine": DOCUMENT_ENGINE,
            "bridge_version": DOCUMENT_BRIDGE_VERSION,
            "extracted_at": extracted_timestamp,
            "ocr_engine": ocr_engine,
            "languages": active_languages,
        }

    if pdf_extractor is None or ocr_runner is None:
        default_pdf_extractor, default_ocr_runner, _available = _load_multimodal_api()
        pdf_extractor = pdf_extractor or default_pdf_extractor
        ocr_runner = ocr_runner or default_ocr_runner
    pdf_renderer = pdf_renderer or _default_pdf_renderer

    suffix = _safe_suffix(clean_file_name, clean_mime_type)
    temporary_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix,
            prefix="medibrief-openmed-",
            delete=False,
        ) as handle:
            handle.write(content)
            temporary_path = handle.name

        if kind == "pdf":
            result = _extract_pdf_document(
                path=temporary_path,
                ocr_mode=ocr_mode,
                ocr_engine=ocr_engine,
                languages=active_languages,
                resolution=resolution,
                pdf_extractor=pdf_extractor,
                ocr_runner=ocr_runner,
                pdf_renderer=pdf_renderer,
            )
        else:
            result = _extract_image_document(
                path=temporary_path,
                ocr_mode=ocr_mode,
                ocr_engine=ocr_engine,
                languages=active_languages,
                ocr_runner=ocr_runner,
            )
    finally:
        if temporary_path:
            try:
                os.unlink(temporary_path)
            except FileNotFoundError:
                pass

    return {
        **result,
        "document_id": clean_document_id,
        "file_name": clean_file_name,
        "mime_type": clean_mime_type,
        "source_sha256": _sha256(content),
        "engine": DOCUMENT_ENGINE,
        "bridge_version": DOCUMENT_BRIDGE_VERSION,
        "extracted_at": extracted_timestamp,
        "ocr_engine": ocr_engine,
        "languages": active_languages,
    }


__all__ = [
    "DEFAULT_OCR_RESOLUTION",
    "DOCUMENT_BRIDGE_VERSION",
    "DOCUMENT_ENGINE",
    "DocumentBridgeInputError",
    "DocumentBridgeRuntimeError",
    "DocumentBridgeUnsupportedError",
    "document_bridge_health",
    "extract_document",
]
