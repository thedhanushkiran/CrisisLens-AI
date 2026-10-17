def test_claim_cannot_be_marked_verified_without_evidence(client, responder_headers):
    claim = {
        "id": "CLAIM-TEST-001",
        "claim": "A bridge in the demonstration area has reportedly collapsed.",
    }
    assert client.post("/api/v1/misinformation/claims", json=claim).status_code == 201

    response = client.patch(
        "/api/v1/misinformation/claims/CLAIM-TEST-001",
        headers=responder_headers,
        json={"status": "corroborated"},
    )
    assert response.status_code == 422


def test_claim_review_requires_auth_and_evidence(client):
    claim = {
        "id": "CLAIM-TEST-002",
        "claim": "A bridge in the demonstration area has reportedly collapsed.",
    }
    client.post("/api/v1/misinformation/claims", json=claim)
    response = client.patch(
        "/api/v1/misinformation/claims/CLAIM-TEST-002",
        json={
            "status": "corroborated",
            "evidence": "Link to a verified municipal incident bulletin.",
            "reviewer_decision": "The supplied municipal bulletin confirms the closure.",
        },
    )
    assert response.status_code == 401


def test_verified_claim_requires_review_and_records_audit(client, responder_headers):
    client.post("/api/v1/misinformation/claims", json={
        "id": "CLAIM-TEST-003",
        "claim": "A road closure is reported in the demonstration area.",
    })
    response = client.patch(
        "/api/v1/misinformation/claims/CLAIM-TEST-003",
        headers=responder_headers,
        json={
            "status": "disputed",
            "evidence": "Municipal notice states the road remains open.",
            "reviewer_decision": "The cited source does not support the reported closure.",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "disputed"
    assert response.json()["reviewer_decision"]
    audit = client.get("/api/v1/misinformation/audit", headers=responder_headers)
    assert audit.status_code == 200
    assert audit.json()[0]["action"] == "claim_reviewed"
