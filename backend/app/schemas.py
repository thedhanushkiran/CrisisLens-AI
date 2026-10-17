from datetime import datetime
from enum import StrEnum
import re
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Category(StrEnum):
    RESCUE = "Rescue"
    MEDICAL = "Medical"
    FOOD_WATER = "FoodWater"
    SHELTER = "Shelter"
    MISSING = "Missing"
    HAZARD = "Hazard"


class Urgency(StrEnum):
    CRITICAL = "Critical"
    URGENT = "Urgent"
    MODERATE = "Moderate"


class ClientSyncStatus(StrEnum):
    SAVED_DEVICE = "saved_device"
    QUEUED = "queued"


class ReviewStatus(StrEnum):
    UNREVIEWED = "unreviewed"
    IN_REVIEW = "in_review"
    VERIFIED = "verified"
    REJECTED = "rejected"
    RESOLVED = "resolved"


class TriageSuggestion(BaseModel):
    suggested_priority: Urgency
    reasons: list[str]
    uncertainty: str
    is_human_decision: bool = False


class ReportCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._:-]+$")]
    categories: Annotated[list[Category], Field(min_length=1, max_length=6)]
    description: Annotated[str, Field(min_length=5, max_length=5000)]
    request_message: Annotated[str | None, Field(max_length=2000)] = None
    location_text: Annotated[str, Field(min_length=2, max_length=500)]
    landmark: Annotated[str | None, Field(max_length=500)] = None
    latitude: Annotated[float | None, Field(ge=-90, le=90)] = None
    longitude: Annotated[float | None, Field(ge=-180, le=180)] = None
    coordinates_consented: bool = False
    urgency: Urgency
    contact_primary: Annotated[str | None, Field(max_length=40, pattern=r"^[0-9+().\-\s]*$")] = None
    contact_alternate: Annotated[str | None, Field(max_length=40, pattern=r"^[0-9+().\-\s]*$")] = None
    client_sync_status: ClientSyncStatus = ClientSyncStatus.QUEUED

    @field_validator("contact_primary", "contact_alternate")
    @classmethod
    def validate_contact_number(cls, value: str | None):
        if value and len(re.sub(r"\D", "", value)) < 3:
            raise ValueError("contact information must contain at least 3 digits")
        return value

    @model_validator(mode="after")
    def validate_location_consent(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be provided together")
        if self.latitude is not None and not self.coordinates_consented:
            raise ValueError("coordinates require explicit consent")
        return self


class ReportUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    urgency: Urgency | None = None
    review_status: ReviewStatus | None = None
    assigned_to: Annotated[str | None, Field(max_length=120)] = None


class NoteCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    text: Annotated[str, Field(min_length=1, max_length=2000)]


class ReportNoteResponse(BaseModel):
    id: int
    author: str
    text: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReportPublic(BaseModel):
    id: str
    categories: list[str]
    description: str
    location_text: str
    landmark: str | None
    latitude: float | None
    longitude: float | None
    coordinates_consented: bool
    urgency: str
    triage: TriageSuggestion
    client_sync_status: str
    server_sync_status: str
    review_status: str
    assigned_to: str | None
    created_at: datetime
    updated_at: datetime


class ReportResponder(ReportPublic):
    contact_primary: str | None
    contact_alternate: str | None
    request_message: str | None
    notes: list[ReportNoteResponse]


class AccountRegister(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    display_name: Annotated[str, Field(min_length=1, max_length=120)]
    email: Annotated[str, Field(min_length=5, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    phone: Annotated[str | None, Field(max_length=40, pattern=r"^[0-9+().\-\s]*$")] = None
    password: Annotated[str, Field(min_length=10, max_length=128)]

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.casefold()

    @field_validator("phone")
    @classmethod
    def validate_account_phone(cls, value: str | None):
        if value and len(re.sub(r"\D", "", value)) < 3:
            raise ValueError("phone must contain at least 3 digits")
        return value


class AccountLogin(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: Annotated[str, Field(min_length=5, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    password: Annotated[str, Field(min_length=1, max_length=128)]

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.casefold()


class AccountProfile(BaseModel):
    id: str
    display_name: str
    email: str
    phone: str | None
    created_at: datetime


class AccountAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AccountProfile


class SyncItemResult(BaseModel):
    client_id: str | None
    status: str
    server_status: str | None = None
    message: str | None = None


class SyncBatchResponse(BaseModel):
    acknowledgements: list[SyncItemResult]


class TriageRequest(BaseModel):
    description: Annotated[str, Field(min_length=5, max_length=5000)]
    categories: list[Category] = Field(default_factory=list)


class ClaimCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._:-]+$")]
    claim: Annotated[str, Field(min_length=5, max_length=5000)]
    location: Annotated[str | None, Field(max_length=500)] = None
    reporter_contact: Annotated[str | None, Field(max_length=120)] = None


class ClaimReview(BaseModel):
    status: str
    evidence: Annotated[str | None, Field(min_length=10, max_length=5000)] = None
    reviewer_decision: Annotated[str | None, Field(min_length=5, max_length=2000)] = None

    @model_validator(mode="after")
    def require_review_evidence(self):
        if self.status in {"corroborated", "disputed"} and (not self.evidence or not self.reviewer_decision):
            raise ValueError("evidence and reviewer_decision are required for verification decisions")
        return self


class ClaimPublic(BaseModel):
    id: str
    claim: str
    location: str | None
    status: str
    evidence: str | None
    reviewer_decision: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClaimResponder(ClaimPublic):
    evidence: str | None
    reviewer_decision: str | None
