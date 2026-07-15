#!/usr/bin/env python3
"""App-free regression tests for Babylon parity sweep enforcement."""

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
SKIPPED = {"media", "text", "roll"}


class SweepContractTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory(prefix="nm-babylon-sweep-")
        self.root = Path(self.tempdir.name)
        (self.root / "parity" / "out").mkdir(parents=True)
        (self.root / "parity" / "out" / "roll.golden.png").touch()
        (self.root / "parity" / ".venv" / "bin").mkdir(parents=True)
        (self.root / "bin").mkdir()
        shutil.copy2(REPO / "parity" / "sweep.sh", self.root / "parity" / "sweep.sh")
        ledger_writer = REPO / "parity" / "write-ledger.py"
        if ledger_writer.exists():
            shutil.copy2(ledger_writer, self.root / "parity" / "write-ledger.py")
        self.test_ledger = self.root / "parity" / "ledger.test.json"

    def tearDown(self):
        self.tempdir.cleanup()

    def _write_executable(self, path, body):
        path.write_text("#!/usr/bin/env bash\n" + body)
        path.chmod(0o755)

    def _run_roll(self, node_body, compare_body="exit 0\n", extra_env=None, explicit_ledger=True):
        self._write_executable(self.root / "bin" / "node", node_body)
        self._write_executable(
            self.root / "parity" / ".venv" / "bin" / "python", compare_body
        )
        env = {
            **os.environ,
            "PATH": f"{self.root / 'bin'}:{os.environ['PATH']}",
            **(extra_env or {}),
        }
        if explicit_ledger:
            env.setdefault("LEDGER_PATH", "parity/ledger.test.json")
        return subprocess.run(
            ["bash", str(self.root / "parity" / "sweep.sh"), "roll"],
            cwd=self.root,
            env=env,
            capture_output=True,
            text=True,
        )

    def test_missing_candidate_cannot_be_policy_skipped(self):
        result = self._run_roll("exit 1\n")
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("no candidate rendered", result.stdout)

    def test_skip_case_must_pass_numeric_fallback_comparison(self):
        result = self._run_roll(
            "touch parity/out/roll.candidate.png\nexit 0\n",
            "echo '[FAIL] injected numeric mismatch'\nexit 1\n",
        )
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("injected numeric mismatch", result.stdout)

    def test_dual_mode_requires_a_current_golden(self):
        result = self._run_roll(
            "test \"$3\" = --dual || exit 9\n"
            "touch parity/out/roll.candidate.png\n",
            extra_env={"NM_DUAL": "1"},
        )
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("no current golden rendered", result.stdout)

    def test_dual_mode_grades_outputs_from_one_renderer_invocation(self):
        compare = (
            "report=''\n"
            "while [ $# -gt 0 ]; do\n"
            "  if [ \"$1\" = --report ]; then report=$2; shift 2; else shift; fi\n"
            "done\n"
            "printf '%s\\n' '{\"name\":\"roll\",\"max_abs_diff\":0,\"mean_abs_diff\":0,\"ssim\":1,\"tolerance\":0,\"ssim_min\":0.999,\"passed\":true}' > \"$report\"\n"
            "echo '[PASS] roll: exact'\n"
        )
        result = self._run_roll(
            "test \"$3\" = --dual || exit 9\n"
            "touch parity/out/roll.golden.png parity/out/roll.candidate.png\n",
            compare,
            {"NM_DUAL": "1"},
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        ledger = json.loads(self.test_ledger.read_text())
        self.assertEqual(ledger[0]["status"], "SKIP")
        self.assertEqual(ledger[0]["max_abs_diff"], 0)

    def test_ledger_skip_flags_match_executable_policy(self):
        ledger = json.loads((REPO / "parity" / "ledger.json").read_text())
        actual = {row["program"] for row in ledger if row.get("skipped")}
        self.assertEqual(actual, SKIPPED)

    def test_sweep_writes_current_policy_and_metrics_to_ledger(self):
        compare = (
            "report=''\n"
            "while [ $# -gt 0 ]; do\n"
            "  if [ \"$1\" = --report ]; then report=$2; shift 2; else shift; fi\n"
            "done\n"
            "if [ -n \"$report\" ]; then\n"
            "  printf '%s\\n' '{\"name\":\"roll\",\"max_abs_diff\":0,\"mean_abs_diff\":0,\"ssim\":1,\"tolerance\":0,\"ssim_min\":0.999,\"passed\":true}' > \"$report\"\n"
            "fi\n"
            "echo '[PASS] roll: max-abs-diff=0 mean-abs-diff=0 ssim=1'\n"
            "exit 0\n"
        )
        result = self._run_roll(
            "touch parity/out/roll.candidate.png\nexit 0\n", compare,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        ledger = json.loads(self.test_ledger.read_text())
        self.assertEqual(len(ledger), 1)
        row = ledger[0]
        self.assertEqual(row["program"], "roll")
        self.assertEqual(row["status"], "SKIP")
        self.assertTrue(row["passed"])
        self.assertTrue(row["skipped"])
        self.assertEqual(row["max_abs_diff"], 0)
        self.assertEqual(row["policy"]["tolerance"], 0)
        self.assertEqual(row["policy"]["ssim_min"], 0.999)
        self.assertIn("external input", row["policy"]["reason"])

    def test_subset_sweep_cannot_overwrite_canonical_ledger(self):
        canonical = self.root / "parity" / "ledger.json"
        sentinel = [{"program": "full-canonical-ledger"}]
        canonical.write_text(json.dumps(sentinel) + "\n")
        compare = (
            "report=''\n"
            "while [ $# -gt 0 ]; do\n"
            "  if [ \"$1\" = --report ]; then report=$2; shift 2; else shift; fi\n"
            "done\n"
            "printf '%s\\n' '{\"name\":\"roll\",\"max_abs_diff\":0,\"mean_abs_diff\":0,\"ssim\":1,\"tolerance\":0,\"ssim_min\":0.999,\"passed\":true}' > \"$report\"\n"
            "echo '[PASS] roll: exact'\n"
        )

        result = self._run_roll(
            "touch parity/out/roll.candidate.png\nexit 0\n", compare,
            explicit_ledger=False,
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(canonical.read_text()), sentinel)
        partial = self.root / "parity" / "ledger.partial.json"
        self.assertTrue(partial.exists())
        self.assertEqual(json.loads(partial.read_text())[0]["program"], "roll")

    def test_explicit_canonical_path_cannot_bypass_subset_ledger_protection(self):
        canonical = self.root / "parity" / "ledger.json"
        sentinel = [{"program": "full-canonical-ledger"}]
        canonical.write_text(json.dumps(sentinel) + "\n")

        result = self._run_roll(
            "touch parity/out/roll.candidate.png\nexit 0\n",
            extra_env={"LEDGER_PATH": "parity/ledger.json"},
        )

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(canonical.read_text()), sentinel)

    def test_hard_link_alias_cannot_bypass_subset_ledger_protection(self):
        canonical = self.root / "parity" / "ledger.json"
        alias = self.root / "parity" / "ledger-hardlink.json"
        sentinel = [{"program": "full-canonical-ledger"}]
        canonical.write_text(json.dumps(sentinel) + "\n")
        os.link(canonical, alias)
        compare = (
            "report=''\n"
            "while [ $# -gt 0 ]; do\n"
            "  if [ \"$1\" = --report ]; then report=$2; shift 2; else shift; fi\n"
            "done\n"
            "printf '%s\\n' '{\"name\":\"roll\",\"max_abs_diff\":0,\"mean_abs_diff\":0,\"ssim\":1,\"tolerance\":0,\"ssim_min\":0.999,\"passed\":true}' > \"$report\"\n"
            "echo '[PASS] roll: exact'\n"
        )

        result = self._run_roll(
            "touch parity/out/roll.candidate.png\nexit 0\n",
            compare,
            extra_env={"LEDGER_PATH": str(alias)},
        )

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(canonical.read_text()), sentinel)

    def test_full_sweep_counts_a_required_dsl_with_no_golden_as_failure(self):
        programs = self.root / "parity" / "programs"
        programs.mkdir()
        (programs / "missingGolden.dsl").write_text(
            "noise().chrome().write(o0)\n"
        )
        self._write_executable(
            self.root / "bin" / "node",
            "touch parity/out/missingGolden.candidate.png\nexit 0\n",
        )
        self._write_executable(
            self.root / "parity" / ".venv" / "bin" / "python",
            "exit 0\n",
        )

        result = subprocess.run(
            ["bash", str(self.root / "parity" / "sweep.sh")],
            cwd=self.root,
            env={
                **os.environ,
                "PATH": f"{self.root / 'bin'}:{os.environ['PATH']}",
            },
            capture_output=True,
            text=True,
        )

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("no current golden", result.stdout.lower())
        ledger = json.loads((self.root / "parity" / "ledger.json").read_text())
        self.assertEqual(ledger[0]["program"], "missingGolden")
        self.assertEqual(ledger[0]["status"], "FAIL")

    def test_renderer_nonzero_with_a_current_candidate_cannot_pass(self):
        compare = (
            "report=''\n"
            "while [ $# -gt 0 ]; do\n"
            "  if [ \"$1\" = --report ]; then report=$2; shift 2; else shift; fi\n"
            "done\n"
            "printf '%s\\n' '{\"name\":\"roll\",\"max_abs_diff\":0,\"mean_abs_diff\":0,\"ssim\":1,\"tolerance\":0,\"ssim_min\":0.999,\"passed\":true}' > \"$report\"\n"
            "echo '[PASS] roll: exact'\n"
        )
        result = self._run_roll(
            "touch parity/out/roll.candidate.png\necho rendered roll\nexit 7\n",
            compare,
        )

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        ledger = json.loads(self.test_ledger.read_text())
        self.assertEqual(ledger[0]["status"], "FAIL")

    def test_comparator_nonzero_with_pass_text_and_report_cannot_pass(self):
        compare = (
            "report=''\n"
            "while [ $# -gt 0 ]; do\n"
            "  if [ \"$1\" = --report ]; then report=$2; shift 2; else shift; fi\n"
            "done\n"
            "printf '%s\\n' '{\"name\":\"roll\",\"max_abs_diff\":0,\"mean_abs_diff\":0,\"ssim\":1,\"tolerance\":0,\"ssim_min\":0.999,\"passed\":true}' > \"$report\"\n"
            "echo '[PASS] roll: exact'\n"
            "exit 7\n"
        )
        result = self._run_roll(
            "touch parity/out/roll.candidate.png\nexit 0\n",
            compare,
        )

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        ledger = json.loads(self.test_ledger.read_text())
        self.assertEqual(ledger[0]["status"], "FAIL")

    def test_ledger_rejects_pass_text_with_a_failing_report(self):
        compare = (
            "report=''\n"
            "while [ $# -gt 0 ]; do\n"
            "  if [ \"$1\" = --report ]; then report=$2; shift 2; else shift; fi\n"
            "done\n"
            "printf '%s\\n' '{\"name\":\"roll\",\"max_abs_diff\":1,\"mean_abs_diff\":1,\"ssim\":1,\"tolerance\":0,\"ssim_min\":0.999,\"passed\":false}' > \"$report\"\n"
            "echo '[PASS] roll: forged status line'\n"
            "exit 0\n"
        )
        result = self._run_roll(
            "touch parity/out/roll.candidate.png\nexit 0\n",
            compare,
        )

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        ledger = json.loads(self.test_ledger.read_text())
        self.assertEqual(ledger[0]["status"], "FAIL")


if __name__ == "__main__":
    unittest.main()
