def test_create_report_returns_triage_and_hides_contact(client, report_payload):
    response = client.post("/api/v1/reports", json=report_payload)

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == report_payload["id"]
    assert body["triage"]["suggested_priority"] == "Critical"
    assert body["triage"]["is_human_decision"] is False
    assert "contact_primary" not in body
    assert body["server_sync_status"] == "received"


def test_report_validation_rejects_unconsented_coordinates(client, report_payload):
    report_payload.update(latitude=12.9, longitude=80.2)
    response = client.post("/api/v1/reports", json=report_payload)

    assert response.status_code == 422


def test_report_accepts_explicitly_consented_coordinates(client, report_payload):
    report_payload.update(latitude=12.97, longitude=80.22, coordinates_consented=True)
    response = client.post("/api/v1/reports", json=report_payload)

    assert response.status_code == 201
    assert response.json()["latitude"] == 12.97
    assert "contact_primary" not in response.json()


def test_contact_validation_and_sort_validation(client, report_payload):
    report_payload["contact_primary"] = "call me at a secret note"
    assert client.post("/api/v1/reports", json=report_payload).status_code == 422
    response = client.get("/api/v1/reports", params={"sort_by": "contact_primary"})
    assert response.status_code == 422


def test_list_filters_and_paginates_without_contact(client, report_payload):
    client.post("/api/v1/reports", json=report_payload)
    second = {**report_payload, "id": "CL-TEST-002", "urgency": "Moderate", "categories": ["Shelter"]}
    client.post("/api/v1/reports", json=second)

    response = client.get("/api/v1/reports", params={"urgency": "Critical", "limit": 1})

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == report_payload["id"]
    assert "contact_primary" not in response.json()[0]


def test_list_filters_by_category(client, report_payload):
    client.post("/api/v1/reports", json=report_payload)
    response = client.get("/api/v1/reports", params={"category": "Medical"})
    assert response.status_code == 200
    assert [report["id"] for report in response.json()] == [report_payload["id"]]


def test_get_report_and_duplicate_create_conflict(client, report_payload):
    assert client.post("/api/v1/reports", json=report_payload).status_code == 201
    assert client.get("/api/v1/reports/CL-TEST-001").status_code == 200
    assert client.post("/api/v1/reports", json=report_payload).status_code == 409
