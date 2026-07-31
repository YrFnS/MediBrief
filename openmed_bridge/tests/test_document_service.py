from __future__ import annotations

import base64
from dataclasses import dataclass, field
from types import SimpleNamespace

import pytest

from openmed_bridge.document_service import (
    DocumentBridgeInputError,
    extract_document,
)


@dataclass(frozen=True)
class FakeSourceSpan:
    start: int
    end: int
    page: int
    bbox: tuple[float, float, float, float] | None = None


@dataclass(frozen=True)
class FakeDocument:
    text: str
    spans: tuple[FakeSourceSpan, ...]
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class FakeOcrWord:
    text: str
    bbox: tuple[float, float, float, float]
    confidence: float
    page: int = 0


def encoded(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def unused_ocr(*_args, **_kwargs):
    raise AssertionError("OCR should not have been called")


def test_embedded_pdf_text_preserves_page_and_character_offsets():
    document = FakeDocument(
        text="Asthma albuterol\nNormal",
        spans=(
            FakeSourceSpan(0, 6, 0, (1, 1, 10, 10)),
            FakeSourceSpan(7, 16, 0, (12, 1, 30, 10)),
            FakeSourceSpan(17, 23, 1, (1, 1, 12, 10)),
        ),
        metadata={"page_count": 2},
    )

    result = extract_document(
        document_id="document-1",
        file_name="report.pdf",
        mime_type="application/pdf",
        document_base64=encoded(b"%PDF-test"),
        ocr_mode="never",
        pdf_extractor=lambda _path: document,
        ocr_runner=unused_ocr,
        extracted_at="2026-07-31T12:00:00Z",
    )

    assert result["status"] == "completed"
    assert result["method"] == "embedded-pdf"
    assert result["text"] == "Asthma albuterol\n\nNormal"
    assert result["page_count"] == 2
    assert result["pages"] == [
        {
            "page_number": 1,
            "start": 0,
            "end": 16,
            "method": "embedded-pdf",
            "word_count": 2,
            "character_count": 16,
            "engine": "pdfplumber",
        },
        {
            "page_number": 2,
            "start": 18,
            "end": 24,
            "method": "embedded-pdf",
            "word_count": 1,
            "character_count": 6,
            "engine": "pdfplumber",
        },
    ]
    assert result["source_spans"][0] == {
        "start": 0,
        "end": 6,
        "page_number": 1,
        "method": "embedded-pdf",
        "bbox": [1.0, 1.0, 10.0, 10.0],
    }
    assert result["source_spans"][-1]["page_number"] == 2
    assert result["source_sha256"]
    assert result["text_sha256"]


def test_auto_mode_uses_ocr_for_scanned_pdf_pages():
    document = FakeDocument(
        text="",
        spans=(),
        metadata={"page_count": 2},
    )
    rendered = {0: object(), 1: object()}
    calls: list[object] = []

    def fake_ocr(image, **_kwargs):
        calls.append(image)
        label = "one" if image is rendered[0] else "two"
        return SimpleNamespace(
            words=(
                FakeOcrWord("Page", (0, 0, 20, 10), 0.98),
                FakeOcrWord(label, (22, 0, 40, 10), 0.96),
            ),
            metadata={"engine": "fake-ocr"},
        )

    result = extract_document(
        document_id="document-scan",
        file_name="scan.pdf",
        mime_type="application/pdf",
        document_base64=encoded(b"%PDF-scanned"),
        ocr_mode="auto",
        ocr_engine="auto",
        languages=["en"],
        pdf_extractor=lambda _path: document,
        pdf_renderer=lambda _path, indexes, _resolution: {
            index: rendered[index] for index in indexes
        },
        ocr_runner=fake_ocr,
    )

    assert calls == [rendered[0], rendered[1]]
    assert result["status"] == "completed"
    assert result["method"] == "ocr"
    assert result["text"] == "Page one\n\nPage two"
    assert [page["engine"] for page in result["pages"]] == [
        "fake-ocr",
        "fake-ocr",
    ]
    assert result["pages"][0]["average_confidence"] == 0.97
    assert result["source_spans"][2]["page_number"] == 2


def test_auto_mode_can_combine_embedded_and_ocr_pages():
    embedded_text = "Embedded clinical text"
    document = FakeDocument(
        text=embedded_text,
        spans=(
            FakeSourceSpan(0, 8, 0, (0, 0, 20, 10)),
            FakeSourceSpan(9, 17, 0, (22, 0, 40, 10)),
            FakeSourceSpan(18, 22, 0, (42, 0, 55, 10)),
        ),
        metadata={"page_count": 2},
    )

    def fake_ocr(_image, **_kwargs):
        return SimpleNamespace(
            words=(FakeOcrWord("Scanned page", (0, 0, 50, 10), 0.9),),
            metadata={"engine": "fake-ocr"},
        )

    result = extract_document(
        document_id="document-hybrid",
        file_name="hybrid.pdf",
        mime_type="application/pdf",
        document_base64=encoded(b"%PDF-hybrid"),
        ocr_mode="auto",
        pdf_extractor=lambda _path: document,
        pdf_renderer=lambda _path, indexes, _resolution: {
            index: object() for index in indexes
        },
        ocr_runner=fake_ocr,
    )

    assert result["status"] == "completed"
    assert result["method"] == "hybrid"
    assert result["text"] == "Embedded clinical text\n\nScanned page"
    assert result["pages"][0]["method"] == "embedded-pdf"
    assert result["pages"][1]["method"] == "ocr"


def test_image_ocr_returns_page_aware_source_spans():
    def fake_ocr(_path, **kwargs):
        assert kwargs["engine"] == "tesseract"
        assert kwargs["languages"] == ["en", "ar"]
        return SimpleNamespace(
            words=(
                FakeOcrWord("Blood", (1, 2, 20, 12), 0.91),
                FakeOcrWord("pressure", (22, 2, 50, 12), 0.89),
            ),
            metadata={"engine": "tesseract"},
        )

    result = extract_document(
        document_id="document-image",
        file_name="camera.jpg",
        mime_type="image/jpeg",
        document_base64=encoded(b"fake-image"),
        ocr_engine="tesseract",
        languages=["en", "ar"],
        pdf_extractor=lambda _path: None,
        ocr_runner=fake_ocr,
    )

    assert result["status"] == "completed"
    assert result["method"] == "ocr"
    assert result["page_count"] == 1
    assert result["text"] == "Blood pressure"
    assert result["source_spans"][1] == {
        "start": 6,
        "end": 14,
        "page_number": 1,
        "method": "ocr",
        "bbox": [22.0, 2.0, 50.0, 12.0],
        "confidence": 0.89,
    }


def test_invalid_and_unsupported_payloads_fail_closed():
    with pytest.raises(DocumentBridgeInputError, match="valid base64"):
        extract_document(
            document_id="document-invalid",
            file_name="scan.pdf",
            mime_type="application/pdf",
            document_base64="not base64!",
            pdf_extractor=lambda _path: None,
            ocr_runner=unused_ocr,
        )

    result = extract_document(
        document_id="document-unsupported",
        file_name="archive.zip",
        mime_type="application/zip",
        document_base64=encoded(b"zip"),
        pdf_extractor=lambda _path: None,
        ocr_runner=unused_ocr,
    )
    assert result["status"] == "unsupported"
    assert result["text"] == ""
    assert result["source_spans"] == []
