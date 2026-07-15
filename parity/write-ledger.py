#!/usr/bin/env python3
"""Build the Babylon parity ledger from one sweep's policy decisions and reports."""

import argparse
import json
import re
from pathlib import Path


def derive_metadata(root, program, previous):
    if program in previous:
        return previous[program].get("effect"), previous[program].get("mode", "default")
    dsl = root / "parity" / "programs" / f"{program}.dsl"
    effect_name = None
    if dsl.exists():
        calls = [name for name in re.findall(r"\.([A-Za-z][A-Za-z0-9_]*)\(", dsl.read_text()) if name not in {"write", "render"}]
        if calls:
            effect_name = calls[-1]
    mode = program[len(effect_name) + 1 :] if effect_name and program.startswith(effect_name + "_") else "default"
    return (f"filter/{effect_name}" if effect_name else None), mode


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--results", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    output = args.output if args.output.is_absolute() else args.root / args.output
    previous = {}
    if output.exists():
        try:
            previous = {row["program"]: row for row in json.loads(output.read_text())}
        except (json.JSONDecodeError, KeyError, TypeError):
            previous = {}

    rows = []
    for line in args.results.read_text().splitlines():
        if not line:
            continue
        program, status, tolerance, ssim_min, reason = line.split("\t", 4)
        policy_tolerance = float(tolerance)
        policy_ssim_min = float(ssim_min)
        report_path = args.root / "parity" / "out" / f"{program}.report.json"
        try:
            report = json.loads(report_path.read_text()) if report_path.exists() else {}
        except json.JSONDecodeError:
            report = {}
        if status in {"PASS", "SKIP"}:
            try:
                report_valid = (
                    report.get("name") == program
                    and bool(report.get("passed"))
                    and float(report.get("tolerance")) == policy_tolerance
                    and float(report.get("ssim_min")) == policy_ssim_min
                    and float(report.get("max_abs_diff")) <= policy_tolerance
                    and float(report.get("ssim")) >= policy_ssim_min
                )
            except (TypeError, ValueError):
                report_valid = False
            if not report_valid:
                status = "FAIL"
                reason = "shell status was not backed by a complete passing comparison report"
        effect, mode = derive_metadata(args.root, program, previous)
        rows.append({
            "program": program,
            "effect": effect,
            "mode": mode,
            "golden": f"parity/out/{program}.golden.png",
            "candidate": f"parity/out/{program}.candidate.png",
            "status": status,
            "max_abs_diff": report.get("max_abs_diff"),
            "mean_abs_diff": report.get("mean_abs_diff"),
            "ssim": report.get("ssim"),
            "passed": status in {"PASS", "SKIP"},
            "skipped": status == "SKIP",
            "policy": {
                "tolerance": policy_tolerance,
                "ssim_min": policy_ssim_min,
                "reason": reason,
            },
        })

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(sorted(rows, key=lambda row: row["program"]), indent=2) + "\n")
    if any(row["status"] == "FAIL" for row in rows):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
