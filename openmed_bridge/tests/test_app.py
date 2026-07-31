from __future__ import annotations

from openmed_bridge.app import app


def test_bridge_extends_the_openmed_rest_application():
    paths = {route.path for route in app.routes}

    assert "/health" in paths
    assert "/analyze" in paths
    assert "/medibrief/context/health" in paths
    assert "/medibrief/context" in paths
