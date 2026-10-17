def test_authentication_is_required_and_role_is_checked(client, report_payload):
    client.post("/api/v1/reports", json=report_payload)
    assert client.get("/api/v1/responder/reports").status_code == 401
    assert client.get(
        "/api/v1/responder/reports",
        headers={"Authorization": "Bearer incorrect"},
    ).status_code == 401
    assert client.get(
        "/api/v1/admin/audit",
        headers={"Authorization": "Bearer test-responder-token"},
    ).status_code == 403
    assert client.get(
        "/api/v1/admin/audit",
        headers={"Authorization": "Bearer test-admin-token"},
    ).status_code == 200


def test_responder_can_review_and_audit_status_change(client, report_payload, responder_headers):
    client.post("/api/v1/reports", json=report_payload)

    response = client.patch(
        "/api/v1/responder/reports/CL-TEST-001",
        headers=responder_headers,
        json={"review_status": "in_review", "assigned_to": "Responder A"},
    )

    assert response.status_code == 200
    assert response.json()["review_status"] == "in_review"
    assert response.json()["contact_primary"] == report_payload["contact_primary"]
    public_response = client.get("/api/v1/reports/CL-TEST-001")
    assert "contact_primary" not in public_response.json()
    audit = client.get("/api/v1/responder/audit", headers=responder_headers)
    assert audit.status_code == 200
    assert audit.json()[0]["action"] == "review_updated"


def test_responder_can_add_internal_note(client, report_payload, responder_headers):
    client.post("/api/v1/reports", json=report_payload)
    response = client.post(
        "/api/v1/responder/reports/CL-TEST-001/notes",
        headers=responder_headers,
        json={"text": "Confirm location details with the reporting contact."},
    )
    assert response.status_code == 201
    assert response.json()["author"] == "local-responder"
