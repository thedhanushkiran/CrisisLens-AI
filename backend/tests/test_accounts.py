def register_user(client):
    return client.post(
        "/api/v1/accounts/register",
        json={
            "display_name": "Asha Kumar",
            "email": "asha@example.org",
            "phone": "+1 555 0101",
            "password": "correct-horse-battery",
        },
    )


def test_register_login_and_logout_account(client):
    registered = register_user(client)

    assert registered.status_code == 201
    body = registered.json()
    token = body["access_token"]
    assert body["user"]["email"] == "asha@example.org"
    assert "password" not in body["user"]
    assert client.get("/api/v1/accounts/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    assert client.get("/api/v1/responder/reports", headers={"Authorization": f"Bearer {token}"}).status_code == 401

    login = client.post(
        "/api/v1/accounts/login",
        json={"email": "ASHA@example.org", "password": "correct-horse-battery"},
    )
    assert login.status_code == 200
    login_token = login.json()["access_token"]

    assert client.post(
        "/api/v1/accounts/logout",
        headers={"Authorization": f"Bearer {login_token}"},
    ).status_code == 204
    assert client.get(
        "/api/v1/accounts/me",
        headers={"Authorization": f"Bearer {login_token}"},
    ).status_code == 401


def test_duplicate_email_password_validation_and_generic_login_error(client):
    assert register_user(client).status_code == 201
    duplicate = client.post(
        "/api/v1/accounts/register",
        json={
            "display_name": "Duplicate",
            "email": "ASHA@example.org",
            "password": "correct-horse-battery",
        },
    )
    assert duplicate.status_code == 409

    short_password = client.post(
        "/api/v1/accounts/register",
        json={"display_name": "Short", "email": "short@example.org", "password": "short"},
    )
    assert short_password.status_code == 422

    failed_login = client.post(
        "/api/v1/accounts/login",
        json={"email": "missing@example.org", "password": "incorrect-password"},
    )
    assert failed_login.status_code == 401
    assert failed_login.json()["detail"] == "Invalid email or password"


def test_account_report_message_is_private_and_report_is_linked(client, report_payload, responder_headers):
    token = register_user(client).json()["access_token"]
    report_payload["request_message"] = "Please bring clean drinking water."
    response = client.post(
        "/api/v1/reports",
        json=report_payload,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    assert "request_message" not in response.json()
    assert response.json()["id"] == report_payload["id"]

    own_reports = client.get(
        "/api/v1/accounts/me/reports",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert [report["id"] for report in own_reports.json()] == [report_payload["id"]]

    responder_reports = client.get("/api/v1/responder/reports", headers=responder_headers)
    responder_report = responder_reports.json()[0]
    assert responder_report["request_message"] == report_payload["request_message"]


def test_account_linked_offline_sync_preserves_request_message(client, report_payload, responder_headers):
    token = register_user(client).json()["access_token"]
    report_payload["request_message"] = "Need medicine and a safe evacuation route."
    sync = client.post(
        "/api/v1/reports/sync",
        json=[report_payload],
        headers={"Authorization": f"Bearer {token}"},
    )
    assert sync.status_code == 200
    assert sync.json()["acknowledgements"][0]["status"] == "accepted"

    replay = client.post(
        "/api/v1/reports/sync",
        json=[report_payload],
        headers={"Authorization": f"Bearer {token}"},
    )
    assert replay.json()["acknowledgements"][0]["status"] == "duplicate"

    reports = client.get("/api/v1/responder/reports", headers=responder_headers).json()
    assert reports[0]["request_message"] == report_payload["request_message"]
