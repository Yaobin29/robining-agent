"""Command line entry point for the public kernel."""

from __future__ import annotations

import argparse
import json

from .routing import classify_intent, route_artifact


def main() -> int:
    parser = argparse.ArgumentParser(prog="robining-agent")
    sub = parser.add_subparsers(dest="command", required=True)
    route = sub.add_parser("route")
    for name in ("role", "lifecycle", "reuse-scope", "privacy"):
        route.add_argument(f"--{name}", required=True)
    classify = sub.add_parser("classify")
    classify.add_argument("--text", required=True)
    args = parser.parse_args()
    if args.command == "classify":
        print(json.dumps({"type": classify_intent(args.text)}, ensure_ascii=False))
        return 0
    decision = route_artifact(role=args.role, lifecycle=args.lifecycle, reuse_scope=args.reuse_scope, privacy=args.privacy)
    print(json.dumps(decision.to_dict(), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
