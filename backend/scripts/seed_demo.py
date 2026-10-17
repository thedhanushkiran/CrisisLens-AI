from sqlalchemy import select

from backend.app.database import SessionLocal
from backend.app.models import Report
from backend.app.schemas import Category, ReportCreate, Urgency
from backend.app.api.reports import new_report

DEMO_REPORTS = [
    ReportCreate(
        id="DEMO-RESCUE-001",
        categories=[Category.RESCUE, Category.MEDICAL],
        description="DEMO ONLY: An adult with a medical need reports floodwater at the building entrance.",
        location_text="Demonstration location, Chennai",
        urgency=Urgency.URGENT,
    ),
    ReportCreate(
        id="DEMO-SUPPLY-001",
        categories=[Category.FOOD_WATER],
        description="DEMO ONLY: A relief shelter requests drinking water resupply.",
        location_text="Demonstration shelter, Chennai",
        urgency=Urgency.MODERATE,
    ),
]


def main() -> None:
    with SessionLocal() as db:
        for payload in DEMO_REPORTS:
            if db.scalar(select(Report.id).where(Report.id == payload.id)) is None:
                db.add(new_report(payload))
        db.commit()
    print("Demo reports are seeded (DEMO ONLY; no responder dispatch is implied).")


if __name__ == "__main__":
    main()
