from dataclasses import dataclass
from typing import Protocol

from backend.app.schemas import Category, TriageSuggestion, Urgency


class TriageProvider(Protocol):
    def suggest(self, description: str, categories: list[Category]) -> TriageSuggestion: ...


@dataclass(frozen=True)
class RuleBasedTriage:
    critical_terms: tuple[str, ...] = (
        "cardiac", "heart attack", "bleeding", "drowning", "pregnant",
        "infant", "baby", "trapped", "electrical", "electric shock",
    )
    urgent_terms: tuple[str, ...] = (
        "elderly", "child", "water rising", "medicine", "oxygen",
        "flood", "stranded", "missing",
    )

    def suggest(self, description: str, categories: list[Category]) -> TriageSuggestion:
        text = description.casefold()
        reasons = [term for term in self.critical_terms if term in text]
        if reasons:
            return TriageSuggestion(
                suggested_priority=Urgency.CRITICAL,
                reasons=[f"Description mentions: {reason}" for reason in reasons[:4]],
                uncertainty="high",
            )
        reasons = [term for term in self.urgent_terms if term in text]
        if Category.MEDICAL in categories and "medical need" not in reasons:
            reasons.append("medical need")
        if reasons:
            return TriageSuggestion(
                suggested_priority=Urgency.URGENT,
                reasons=[f"Description mentions: {reason}" for reason in reasons[:4]],
                uncertainty="high",
            )
        return TriageSuggestion(
            suggested_priority=Urgency.MODERATE,
            reasons=["No configured high-risk keywords were identified"],
            uncertainty="very_high",
        )


triage_provider: TriageProvider = RuleBasedTriage()
