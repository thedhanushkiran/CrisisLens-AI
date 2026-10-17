def test_sync_is_idempotent_and_acknowledges_each_item(client, report_payload):
    response = client.post("/api/v1/reports/sync", json=[report_payload, report_payload])

    assert response.status_code == 200
    acknowledgements = response.json()["acknowledgements"]
    assert [item["status"] for item in acknowledgements] == ["accepted", "duplicate"]
    assert acknowledgements[0]["server_status"] == "received"
    assert "not an emergency-services delivery receipt" in acknowledgements[0]["message"]
    assert len(client.get("/api/v1/reports").json()) == 1


def test_sync_returns_invalid_per_item_and_keeps_valid_items(client, report_payload):
    invalid = {**report_payload, "id": "INVALID-1", "categories": ["not-a-category"]}
    response = client.post("/api/v1/reports/sync", json=[invalid, report_payload])

    assert response.status_code == 200
    assert [item["status"] for item in response.json()["acknowledgements"]] == ["invalid", "accepted"]
    assert len(client.get("/api/v1/reports").json()) == 1


def test_sync_id_conflict_with_different_payload_is_invalid(client, report_payload):
    client.post("/api/v1/reports/sync", json=[report_payload])
    changed = {**report_payload, "description": "A different narrative for the same client ID."}

    response = client.post("/api/v1/reports/sync", json=[changed])

    assert response.json()["acknowledgements"][0]["status"] == "invalid"
    assert len(client.get("/api/v1/reports").json()) == 1


def test_sync_rejects_oversized_batch(client, report_payload):
    response = client.post("/api/v1/reports/sync", json=[report_payload] * 101)

    assert response.status_code == 422


def test_sync_invalid_non_object_is_acknowledged_per_item(client, report_payload):
    response = client.post("/api/v1/reports/sync", json=["not-a-report", report_payload])
    assert response.status_code == 200
    assert [item["status"] for item in response.json()["acknowledgements"]] == ["invalid", "accepted"]
