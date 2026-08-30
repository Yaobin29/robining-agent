"""Minimal contract validation without third-party dependencies."""

CONTRACT_NAMES = ("TaskBrief", "RoutePlan", "RunSummary", "EvidenceReport")

REQUIRED = {
    "TaskBrief": ("goal", "type", "constraints", "inputs", "requested_outputs"),
    "RoutePlan": ("capability", "adapter", "verification_gates"),
    "RunSummary": ("status", "artifacts", "assumptions", "limits"),
    "EvidenceReport": ("direct_evidence", "visual_evidence", "proxy_interpretation", "validation", "next_action"),
}


def validate_contract(name: str, payload: dict) -> list[str]:
    """Return validation errors; an empty list means the shape is valid."""
    if name not in CONTRACT_NAMES:
        return [f"unknown contract: {name}"]
    errors = [field for field in REQUIRED[name] if field not in payload]
    if name == "TaskBrief" and payload.get("type") not in {"WHY", "HOW", "MIX"}:
        errors.append("type must be WHY, HOW, or MIX")
    if name == "RunSummary" and payload.get("status") not in {"ok", "partial", "blocked"}:
        errors.append("status must be ok, partial, or blocked")
    return errors
