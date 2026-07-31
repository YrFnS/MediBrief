from __future__ import annotations

import base64
import json
from pathlib import Path
from typing import Any, Mapping

import pytest

from openmed_bridge.capture_ocr_predictions import (
    OcrCaptureError,
    capture_ocr_predictions,
)


def _write_inputs(tmp_path: Path) -> tuple[Path, Path, Path]:
    gold = tmp_path / "ocr_gold.json"
    fixture = tmp_path / "fixture.png"
    manifest = tmp_path / "fixtures.json"
    fixture.write_bytes(b"synthetic-image-bytes")
    gold.write_text(
        json.dumps(
            {
                "schema_version": "1",
                "corpus_id": "ocr-unit",
                "phi_free": True,
                "cases": [
                    {
                        "id": "ocr-1",
                        "language": "en",
                        "reference_text": "Asthma stable",
                        "pages": [
                            {
                                "page_number": 1,
                                "start": 0,
                                "end": 13,
                                "text": "Asthma stable",
                            }
                        ],
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    manifest.write_text(
        json.dumps(
            {
                "schema_version": "1",
                "corpus_id": "ocr-unit",
                "fixtures": [
                    {
                        "id": "ocr-1",
                        "path": fixture.name,
                        "mime_type": "image/png",
                        "ocr_mode": "always",
                        "ocr_engine": "tesseract",
                        "languages": ["en"],
                        "resolution": 200,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    return gold, manifest, fixture


def _response(payload: Mapping[str, Any], *, text: str = "Asthma stable") -> dict[str, Any]:
    return {
        "status": "completed" if text else "empty",
        "document_id": payload["document_id"],
        "file_name": payload["file_name"],
        "mime_type": payload["mime_type"],
        "source_sha256": "a" * 64,
        "text": text,
        "text_sha256": "b" * 64,
        "method": "ocr" if text else "none",
        "page_count": 1,
        "pages": [
            {
                "page_number": 1,
                "start": 0,
                "end": len(text),
                "method": "ocr" if text else "none",
                "word_count": len(text.split()),
                "character_count": len(text),
                "average_confidence": 0.9 if text else None,
                "minimum_confidence": 0.8 if text else None,
            }
        ],
        "source_spans": [],
        "warnings": [] if text else ["OCR returned no text."],
        "failed_pages": [],
        "engine": "OpenMed multimodal document extraction",
        "bridge_version": "1",
        "extracted_at": "2026-07-31T00:00:00Z",
        "ocr_engine": "tesseract",
        "languages": ["en"],
    }


def test_capture_ocr_predictions_preserves_live_engine_and_page_evidence(tmp_path: Path):
    gold, manifest, fixture = _write_inputs(tmp_path)
    captured_request: dict[str, Any] = {}

    def request_json(
        url: str,
        payload: Mapping[str, Any],
        timeout: float,
        headers: Mapping[str, str],
    ) -> Any:
        captured_request.update(
            url=url,
            payload=dict(payload),
            timeout=timeout,
            headers=dict(headers),
        )
        return _response(payload)

    report = capture_ocr_predictions(
        gold_path=gold,
        fixture_manifest_path=manifest,
        base_url="http://127.0.0.1:8080/",
        request_json=request_json,
    )

    assert report["prediction_source"] == "openmed-document-bridge-live"
    assert report["application_route_changed"] is False
    assert report["empty_case_ids"] == []
    assert report["cases"] == [
        {
            "id": "ocr-1",
            "text": "Asthma stable",
            "pages": [
                {
                    "page_number": 1,
                    "start": 0,
                    "end": 13,
                    "text": "Asthma stable",
                }
            ],
        }
    ]
    assert captured_request["url"].endswith("/medibrief/documents/extract")
    assert base64.b64decode(captured_request["payload"]["document_base64"]) == fixture.read_bytes()
    assert report["case_outcomes"][0]["ocr_engine"] == "tesseract"


def test_capture_ocr_predictions_scores_empty_output_by_omitting_the_case(tmp_path: Path):
    gold, manifest, _fixture = _write_inputs(tmp_path)

    report = capture_ocr_predictions(
        gold_path=gold,
        fixture_manifest_path=manifest,
        base_url="http://127.0.0.1:8080",
        request_json=lambda _url, payload, _timeout, _headers: _response(
            payload,
            text="",
        ),
    )

    assert report["cases"] == []
    assert report["empty_case_ids"] == ["ocr-1"]
    assert report["case_outcomes"][0]["status"] == "empty"


def test_capture_ocr_predictions_rejects_bridge_identity_mismatch(tmp_path: Path):
    gold, manifest, _fixture = _write_inputs(tmp_path)

    def request_json(
        _url: str,
        payload: Mapping[str, Any],
        _timeout: float,
        _headers: Mapping[str, str],
    ) -> Any:
        response = _response(payload)
        response["document_id"] = "wrong-document"
        return response

    with pytest.raises(OcrCaptureError, match="different document_id"):
        capture_ocr_predictions(
            gold_path=gold,
            fixture_manifest_path=manifest,
            base_url="http://127.0.0.1:8080",
            request_json=request_json,
        )
