"""Deterministic, privacy-first routing for the six public buckets."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import re

BUCKETS = ("core", "capabilities", "template", "projects", "outputs", "local-runtime")


@dataclass(frozen=True)
class RouteDecision:
    bucket: str
    reason: str
    public: bool

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def route_artifact(*, role: str, lifecycle: str, reuse_scope: str, privacy: str) -> RouteDecision:
    """Return a stable bucket decision from explicit metadata."""
    role = role.strip().lower()
    lifecycle = lifecycle.strip().lower()
    reuse_scope = reuse_scope.strip().lower()
    privacy = privacy.strip().lower()
    if privacy not in {"public", "private", "sensitive"}:
        raise ValueError("privacy must be public, private, or sensitive")
    if privacy != "public":
        return RouteDecision("local-runtime", "private or sensitive state is local-only", False)
    if role in {"authority", "governance", "identity-neutral-rule"}:
        return RouteDecision("core", "portable authority and routing rule", True)
    if role in {"reusable-capability", "skill", "adapter", "tool-bridge"}:
        return RouteDecision("capabilities", "reusable execution logic", True)
    if role in {"example", "fixture", "test", "scaffold"}:
        return RouteDecision("template", "reusable example or validation scaffold", True)
    if role in {"deliverable", "report", "export"} or lifecycle in {"produced", "final"}:
        return RouteDecision("outputs", "produced artifact intended to leave the workflow", True)
    if role in {"project-source", "active-source"} or reuse_scope == "project-specific":
        return RouteDecision("projects", "active source of work", True)
    if role in {"runtime", "cache", "log", "credential"}:
        return RouteDecision("local-runtime", "mutable runtime state", False)
    raise ValueError("insufficient metadata to route artifact")


def classify_intent(text: str) -> str:
    """Classify a request as WHY, HOW, or MIX using transparent cues."""
    value = text.strip().lower()
    why = bool(re.search(r"\b(why|cause|reason|mechanism|failure|explain)\b", value))
    how = bool(re.search(r"\b(how|implement|build|fix|optimi[sz]e|steps?)\b", value))
    if why and how:
        return "MIX"
    if why:
        return "WHY"
    return "HOW"
