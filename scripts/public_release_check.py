"""Fail-closed checks for the Robining Agent public staging tree."""

from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_COMPONENTS = {
    ".env", ".git", "local-secrets", "reference-from-eywa", "mother-core",
    "dialog-history", "journal", "identity-profile", "node-working-memory",
}
FORBIDDEN_TEXT = re.compile(
    r"(?:/Users/|/home/|OneDrive|Yaobin|wuyaobin|pi5-ai\.local|ghp_[A-Za-z0-9]{10,}|sk-[A-Za-z0-9]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})"
)


def check() -> list[str]:
    errors: list[str] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if ".git" in rel.parts or "__pycache__" in rel.parts or path.suffix in {".pyc", ".pyo"}:
            continue
        if any(part in FORBIDDEN_COMPONENTS for part in rel.parts):
            errors.append(f"forbidden path: {rel}")
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            errors.append(f"non-text file requires manual license review: {rel}")
            continue
        # The checker necessarily contains the patterns it is looking for.
        if path.name != "public_release_check.py" and FORBIDDEN_TEXT.search(text):
            errors.append(f"sensitive-looking text: {rel}")
    return errors


if __name__ == "__main__":
    failures = check()
    if failures:
        print("PUBLIC RELEASE CHECK FAILED")
        print("\n".join(f"- {item}" for item in failures))
        raise SystemExit(1)
    print("PUBLIC RELEASE CHECK PASSED")
