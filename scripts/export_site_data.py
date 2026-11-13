#!/usr/bin/env python3
# Exports the capstone's recorded results into compact JSON for the site.
#
# The capstone repository is only read, never written. Every number the site
# shows comes from this script; nothing is typed into the site by hand.
#
# Usage:
#   python3 scripts/export_site_data.py
#   python3 scripts/export_site_data.py --capstone_path /path/to/capstone
#   python3 scripts/export_site_data.py --public_only
#
# --public_only exports only what the committed CSVs and config provide. Use it
# on a machine without the capstone's local data/ folder; the per-tick episode
# traces and other raw-derived files already in public/data are left as they are.

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import math
import re
import shutil
import statistics
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

import yaml

exporter_version = 1
default_capstone_path = Path("/home/jarinnit/cloud-healing-capstone")
default_out_dir = Path(__file__).resolve().parent.parent / "public" / "data"

# The incident the replay opens on. Chosen because it shows the full story
# (fault, a single repair, recovery) and its baselines never recover; the
# visitor can switch to any of the other 49 entries.
featured_entry = 38

eval_blocks = ("main", "edge", "seed1")
training_runs = ("sac_per_s0", "sac_per_s1", "sac_per_cold_s0")
fault_types = ("F1", "F2", "F3", "F4")

# Layout of the 36-value observation, in the order built by
# env/telemetry.py (build_observation) and fixed by CLAUDE.md section 5.3.
global_feature_names = ["latency", "fail_ratio", "request_rate", "latency_change", "fail_ratio_change"]
service_feature_names = ["cpu", "throttle", "memory", "available_replicas", "spec_replicas", "restarts", "rollout_recency"]
controller_feature_names = ["action_in_flight", "ticks_since_action", "stale_telemetry"]

phase_codes = {"lead_in": 0, "fault": 1, "post": 2}


class ExportError(RuntimeError):
    pass


# Small helpers.

def parse_cell(text: str) -> Any:
    if text == "":
        return None
    if text == "True":
        return True
    if text == "False":
        return False
    try:
        return int(text)
    except ValueError:
        pass
    try:
        return float(text)
    except ValueError:
        return text


def read_csv_rows(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise ExportError(f"missing source file: {path}")
    with path.open(newline="", encoding="utf-8") as handle:
        return [{key: parse_cell(value) for key, value in row.items()} for row in csv.DictReader(handle)]


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise ExportError(f"missing source file: {path}")
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def round_to(value: float | None, digits: int) -> float | None:
    if value is None:
        return None
    if not math.isfinite(value):
        raise ExportError(f"non-finite value in source data: {value}")
    rounded = round(float(value), digits)
    return int(rounded) if rounded == int(rounded) and abs(rounded) < 1e12 else rounded


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 16), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    path.write_text(text + "\n", encoding="utf-8")


def median_or_none(values: list[float]) -> float | None:
    return statistics.median(values) if values else None


# Source tracking.

class SourceLog:
    def __init__(self, capstone_path: Path) -> None:
        self.capstone_path = capstone_path
        self.file_hashes: dict[str, str] = {}
        self.folder_hashes: dict[str, dict[str, Any]] = {}

    def file(self, relative_path: str) -> Path:
        path = self.capstone_path / relative_path
        if not path.is_file():
            raise ExportError(f"missing source file: {path}")
        self.file_hashes[relative_path] = file_sha256(path)
        return path

    def folder(self, relative_path: str, pattern: str) -> Path:
        folder_path = self.capstone_path / relative_path
        if not folder_path.is_dir():
            raise ExportError(f"missing source folder: {folder_path}")
        digest = hashlib.sha256()
        file_count = 0
        for path in sorted(folder_path.glob(pattern)):
            digest.update(path.name.encode())
            digest.update(file_sha256(path).encode())
            file_count += 1
        self.folder_hashes[relative_path] = {"files": file_count, "sha256": digest.hexdigest()}
        return folder_path


# Configuration.

def parse_action_catalog(source_text: str) -> list[dict[str, Any]]:
    # Reads the CATALOG tuple in env/k8s_actions.py, so action ids and names
    # always match the code that executed them.
    pattern = re.compile(r"Action\((\d+),\s*(NOOP|RESTART|SCALE|RESTORE),\s*(None|\"([a-z]+)\")(?:,\s*([+-]?\d+))?\)")
    catalog = []
    for match in pattern.finditer(source_text):
        action_id = int(match.group(1))
        kind = match.group(2)
        target = match.group(4)
        delta = int(match.group(5)) if match.group(5) else 0
        if kind == "SCALE":
            name = f"SCALE_{'UP' if delta > 0 else 'DOWN'} {target}"
        else:
            name = kind if target is None else f"{kind} {target}"
        catalog.append({"id": action_id, "kind": kind, "target": target, "delta": delta, "name": name})
    if [entry["id"] for entry in catalog] != list(range(12)):
        raise ExportError("could not read the 12-action catalog from env/k8s_actions.py")
    return catalog


def build_config(sources: SourceLog) -> dict[str, Any]:
    contract = yaml.safe_load(sources.file("config/contract.yaml").read_text(encoding="utf-8"))
    calibration = json.loads(sources.file("config/calibration.json").read_text(encoding="utf-8"))
    catalog = parse_action_catalog(sources.file("env/k8s_actions.py").read_text(encoding="utf-8"))

    managed = list(contract["cluster"]["managed"])
    observation_names = list(global_feature_names)
    for service in managed:
        observation_names += [f"{service}.{feature}" for feature in service_feature_names]
    observation_names += controller_feature_names
    if len(observation_names) != 36:
        raise ExportError(f"observation layout has {len(observation_names)} entries, expected 36")

    tick_s = contract["clock"]["tick_s"]
    episode = contract["episode"]
    return {
        "tick_s": tick_s,
        "collect_deadline_s": contract["clock"]["collect_deadline_s"],
        "managed_services": managed,
        "sla": {
            "latency_ms": calibration["l_sla_ms"],
            "latency_quantile": contract["sla"]["latency_quantile"],
            "error_ratio": contract["sla"]["e_sla"],
            "error_ratio_max": contract["sla"]["e_max"],
            "recovery_ticks": contract["sla"]["recovery_ticks"],
        },
        "calibration": {
            "users": calibration["u_base"],
            "requests_per_s": calibration["rps_base"],
        },
        "episode": {
            "lead_in_ticks": episode["lead_in_ticks"],
            "fault_max_ticks": episode["fault_max_ticks"],
            "censor_s": episode["fault_max_ticks"] * tick_s,
            "null_extra_ticks": episode["null_extra_ticks"],
            "fault_probs": episode["fault_probs"],
            "f1_latency": episode["f1_latency"],
            "f2_targets": episode["f2_targets"],
            "f2_workers": episode["f2_workers"],
            "f3_targets": episode["f3_targets"],
            "f4_multiplier": episode["f4_multiplier"],
        },
        "replicas": contract["replicas"],
        "reward": contract["reward"],
        "rl": contract["rl"],
        "per": contract["per"],
        "runbook": contract["runbook"],
        "locust": {"wait_s": contract["locust"]["wait_s"], "request_timeout_s": contract["locust"]["request_timeout_s"]},
        "actions": catalog,
        "observation_names": observation_names,
    }


# Evaluation results.

def pooled_by_policy(episode_rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in episode_rows:
        grouped[row["policy"]].append(row)

    pooled = {}
    for policy, rows in grouped.items():
        fault_rows = [row for row in rows if row["fault"] in fault_types]
        null_rows = [row for row in rows if row["fault"] == "NULL"]
        recovered_rows = [row for row in fault_rows if row["recovered"]]
        pooled[policy] = {
            "fault_episodes": len(fault_rows),
            "recovered": len(recovered_rows),
            "mttr_median_censored_s": round_to(median_or_none([row["mttr_censored_s"] for row in fault_rows]), 2),
            "mttr_median_recovered_s": round_to(median_or_none([row["mttr_censored_s"] for row in recovered_rows]), 2),
            "sla_penalty_mean": round_to(statistics.fmean(row["sla_penalty"] for row in fault_rows), 3) if fault_rows else None,
            "actions_mean": round_to(statistics.fmean(row["actions"] for row in fault_rows), 3) if fault_rows else None,
            "null_episodes": len(null_rows),
            "null_with_action": sum(1 for row in null_rows if row["actions"] > 0),
        }
    return pooled


def build_results_block(sources: SourceLog, block: str) -> dict[str, Any]:
    figure_dir = "paper_a/figure_data"
    summary_rows = read_csv_rows(sources.file(f"{figure_dir}/summary_{block}.csv"))
    episode_rows = read_csv_rows(sources.file(f"{figure_dir}/episodes_{block}.csv"))
    action_rows = read_csv_rows(sources.file(f"{figure_dir}/actions_{block}.csv"))
    policies = list(dict.fromkeys(row["policy"] for row in episode_rows))
    return {
        "block": block,
        "policies": policies,
        "entries": len({row["index"] for row in episode_rows}),
        "summary": summary_rows,
        "pooled": pooled_by_policy(episode_rows),
        "episodes": [
            {
                "index": row["index"],
                "policy": row["policy"],
                "fault": row["fault"],
                "target": row["target"],
                "severity": row["severity"],
                "recovered": row["recovered"],
                "mttr_censored_s": row["mttr_censored_s"],
                "sla_penalty": row["sla_penalty"],
                "actions": row["actions"],
            }
            for row in episode_rows
        ],
        "actions": action_rows,
    }


def build_tests(sources: SourceLog) -> list[dict[str, Any]]:
    return read_csv_rows(sources.file("paper_a/figure_data/tests.csv"))


def build_km_curves(sources: SourceLog) -> dict[str, list[dict[str, Any]]]:
    curves: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in read_csv_rows(sources.file("paper_a/figure_data/km_curves.csv")):
        curves[row["policy"]].append({"t_s": row["t_s"], "p_not_recovered": row["p_not_recovered"], "n": row["n"]})
    return dict(curves)


def build_context(sources: SourceLog) -> dict[str, dict[str, Any]]:
    return {row["block"]: row for row in read_csv_rows(sources.file("paper_a/figure_data/context.csv"))}


def build_training(sources: SourceLog) -> dict[str, dict[str, list[Any]]]:
    columns = ("episode", "fault", "target", "severity", "return", "recovered", "mttr_s", "actions", "stale_ticks")
    runs: dict[str, dict[str, list[Any]]] = {}
    for row in read_csv_rows(sources.file("paper_a/figure_data/training.csv")):
        run = runs.setdefault(row["run"], {column: [] for column in columns})
        for column in columns:
            run[column].append(row[column])
    for run_name in training_runs:
        if run_name not in runs:
            raise ExportError(f"training.csv has no rows for {run_name}")
    return runs


def build_measurement(sources: SourceLog) -> dict[str, list[dict[str, Any]]]:
    folder = sources.capstone_path / "paper_b" / "figure_data"
    tables = {}
    for path in sorted(folder.glob("*.csv")):
        relative_path = str(path.relative_to(sources.capstone_path))
        tables[path.stem] = read_csv_rows(sources.file(relative_path))
    if not tables:
        raise ExportError("no Paper B tables found")
    return tables


# Raw data (local data/ folder).

def load_valid_episodes(sources: SourceLog, block: str) -> list[dict[str, Any]]:
    records = read_jsonl(sources.file(f"data/eval/eval_v1_{block}/episodes.jsonl"))
    valid = [record for record in records if record["valid"]]
    seen = set()
    for record in valid:
        key = (record["index"], record["policy"])
        if key in seen:
            raise ExportError(f"{block}: two valid episodes for entry {key[0]} and policy {key[1]}")
        seen.add(key)
    return valid


def verify_against_summary(block: str, raw_episodes: list[dict[str, Any]], summary_rows: list[dict[str, Any]]) -> None:
    # The committed summary CSV and the raw episode log must agree before
    # anything is exported; a mismatch means the inputs are out of sync.
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for record in raw_episodes:
        grouped[(record["policy"], record["fault"])].append(record)
    for record in raw_episodes:
        if record["fault"] in fault_types:
            grouped[(record["policy"], "F1-F4")].append(record)
    for row in summary_rows:
        records = grouped.get((row["policy"], row["fault"]), [])
        if len(records) != row["n"]:
            raise ExportError(f"{block} {row['policy']} {row['fault']}: {len(records)} raw episodes, summary says {row['n']}")
        if row["fault"] == "NULL":
            # Fault-free rows have no recovery; they are checked on false alarms.
            with_action = sum(1 for record in records if record["actions"] > 0)
            if with_action != row["null_with_action"]:
                raise ExportError(f"{block} {row['policy']} NULL: {with_action} with an action, summary says {row['null_with_action']}")
            continue
        recovered = sum(1 for record in records if record["recovered"])
        if recovered != row["recovered"]:
            raise ExportError(f"{block} {row['policy']} {row['fault']}: {recovered} recovered, summary says {row['recovered']}")
        raw_median = statistics.median(record["mttr_censored_s"] for record in records)
        # The CSV keeps 4 significant figures, so compare at that precision.
        if not math.isclose(raw_median, row["mttr_median_censored_s"], rel_tol=5e-4, abs_tol=0.01):
            raise ExportError(
                f"{block} {row['policy']} {row['fault']}: median MTTR {raw_median:.3f}, summary says {row['mttr_median_censored_s']}"
            )


def build_lane(records: list[dict[str, Any]], episode: dict[str, Any], tick_s: float) -> dict[str, Any]:
    managed = list(records[0]["raw"]["features"]["services"].keys())
    injection_tick = next((record["tick"] for record in records if record["phase"] != "lead_in"), None)

    recovery_tick = None
    if episode["recovered"] and injection_tick is not None and episode["mttr_s"] is not None:
        recovery_tick = injection_tick + round(episode["mttr_s"] / tick_s)
        recovery_record = next((record for record in records if record["tick"] == recovery_tick), None)
        if recovery_record is None:
            raise ExportError(f"episode {episode['episode']}: recovery tick {recovery_tick} not in the trace")

    ticks: dict[str, list[Any]] = {
        "tick": [], "phase": [], "latency_ms": [], "client_p99_ms": [], "fail_ratio": [], "requests_per_s": [],
        "action": [], "chosen_action": [], "mask": [], "reward": [], "decision_latency_s": [],
        "stale": [], "imputed": [], "observation": [],
    }
    services: dict[str, dict[str, list[Any]]] = {
        name: {"cpu_cores": [], "throttle": [], "spec_replicas": [], "available_replicas": [], "restarts": []}
        for name in managed
    }
    for record in records:
        features = record["raw"]["features"]
        ticks["tick"].append(record["tick"])
        ticks["phase"].append(phase_codes[record["phase"]])
        ticks["latency_ms"].append(round_to(features["latency_ms"], 1))
        ticks["client_p99_ms"].append(round_to(features["client_p99_ms"], 1))
        ticks["fail_ratio"].append(round_to(features["fail_ratio"], 4))
        ticks["requests_per_s"].append(round_to(features["rps"], 2))
        ticks["action"].append(record["a_exec"])
        ticks["chosen_action"].append(record["a_chosen"])
        ticks["mask"].append("".join(str(int(bit)) for bit in record["mask"]))
        ticks["reward"].append(round_to(record["reward"], 4))
        ticks["decision_latency_s"].append(round_to(record["decision_latency_s"], 3))
        ticks["stale"].append(bool(record["stale"]))
        ticks["imputed"].append(bool(features["imputed"]))
        ticks["observation"].append([round_to(value, 3) for value in record["obs"]])
        for name in managed:
            service = features["services"][name]
            services[name]["cpu_cores"].append(round_to(service["cpu_cores"], 4))
            services[name]["throttle"].append(round_to(service["throttle"], 4))
            services[name]["spec_replicas"].append(round_to(service["spec_replicas"], 0))
            services[name]["available_replicas"].append(round_to(service["available_replicas"], 0))
            services[name]["restarts"].append(round_to(service["restarts_delta"], 0))

    return {
        "policy": episode["policy"],
        "episode": episode["episode"],
        "recovered": episode["recovered"],
        "mttr_s": round_to(episode["mttr_s"], 2),
        "mttr_censored_s": round_to(episode["mttr_censored_s"], 2),
        "sla_penalty": round_to(episode["sla_penalty"], 3),
        "actions": episode["actions"],
        "injection_tick": injection_tick,
        "recovery_tick": recovery_tick,
        "ticks": ticks,
        "services": services,
    }


def build_traces(sources: SourceLog, raw_episodes: list[dict[str, Any]], tick_s: float, out_dir: Path) -> dict[str, Any]:
    transitions_dir = sources.folder("data/transitions/eval_v1_main", "episode_*.jsonl")
    by_entry: dict[int, dict[str, dict[str, Any]]] = defaultdict(dict)
    for episode in raw_episodes:
        by_entry[episode["index"]][episode["policy"]] = episode

    episode_dir = out_dir / "episodes"
    if episode_dir.exists():
        shutil.rmtree(episode_dir)

    index_entries = []
    for entry_index in sorted(by_entry):
        lanes = {}
        for policy, episode in by_entry[entry_index].items():
            records = read_jsonl(transitions_dir / f"episode_{episode['episode']}.jsonl")
            if len(records) != episode["ticks"]:
                raise ExportError(f"episode {episode['episode']}: {len(records)} ticks on disk, log says {episode['ticks']}")
            if any(not record["valid"] for record in records):
                raise ExportError(f"episode {episode['episode']} is marked valid but has invalid ticks")
            lanes[policy] = build_lane(records, episode, tick_s)

        first = next(iter(by_entry[entry_index].values()))
        write_json(
            episode_dir / f"entry_{entry_index:02d}.json",
            {"index": entry_index, "fault": first["fault"], "target": first["target"], "severity": first["severity"], "lanes": lanes},
        )
        index_entries.append(
            {
                "index": entry_index,
                "fault": first["fault"],
                "target": first["target"],
                "severity": first["severity"],
                "outcomes": {
                    policy: {
                        "recovered": lane["recovered"],
                        "mttr_censored_s": lane["mttr_censored_s"],
                        "actions": lane["actions"],
                    }
                    for policy, lane in lanes.items()
                },
            }
        )

    if featured_entry not in by_entry:
        raise ExportError(f"featured entry {featured_entry} is not in the main block")
    index_payload = {"block": "main", "featured_entry": featured_entry, "entries": index_entries}
    write_json(episode_dir / "index.json", index_payload)
    return index_payload


def build_safety(raw_by_block: dict[str, list[dict[str, Any]]]) -> dict[str, dict[str, dict[str, int]]]:
    safety: dict[str, dict[str, dict[str, int]]] = {}
    for block, episodes in raw_by_block.items():
        per_policy: dict[str, dict[str, int]] = defaultdict(lambda: {"episodes": 0, "mask_violations": 0, "exec_errors": 0, "ticks": 0})
        for episode in episodes:
            totals = per_policy[episode["policy"]]
            totals["episodes"] += 1
            totals["mask_violations"] += episode["mask_violations"]
            totals["exec_errors"] += episode["exec_errors"]
            totals["ticks"] += episode["ticks"]
        safety[block] = dict(per_policy)
    return safety


def build_training_internals(sources: SourceLog, training: dict[str, dict[str, list[Any]]]) -> dict[str, dict[str, list[Any]]]:
    # Per-episode learner diagnostics. Each run's log can hold an episode more
    # than once after a resume, so rows are matched to training.csv by return
    # (the CSV keeps 4 significant figures).
    columns = ("critic_loss", "actor_loss", "entropy", "q_mean", "alpha", "beta", "buffer")
    internals = {}
    for run_name in training_runs:
        log_rows = [row for row in read_jsonl(sources.file(f"data/m4/{run_name}/episodes.jsonl")) if not row.get("probe")]
        by_episode: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for row in log_rows:
            by_episode[row["episode"]].append(row)

        run_series: dict[str, list[Any]] = {"episode": [], **{column: [] for column in columns}}
        for episode_number, csv_return in zip(training[run_name]["episode"], training[run_name]["return"]):
            candidates = [row for row in by_episode.get(episode_number, []) if math.isclose(row["return"], csv_return, rel_tol=5e-4, abs_tol=1e-3)]
            if not candidates:
                raise ExportError(f"{run_name} episode {episode_number}: no log row matches training.csv")
            row = candidates[-1]
            run_series["episode"].append(episode_number)
            for column in columns:
                value = row.get(column)
                run_series[column].append(round_to(value, 4) if isinstance(value, (int, float)) else None)
        internals[run_name] = run_series
    return internals


# Provenance.

def git_value(capstone_path: Path, *arguments: str) -> str | None:
    try:
        result = subprocess.run(["git", "-C", str(capstone_path), *arguments], capture_output=True, text=True, check=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    return result.stdout.strip()


def build_provenance(sources: SourceLog, public_only: bool) -> dict[str, Any]:
    status = git_value(sources.capstone_path, "status", "--porcelain", "--untracked-files=no")
    return {
        "exporter_version": exporter_version,
        "exported_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "capstone_commit": git_value(sources.capstone_path, "rev-parse", "HEAD"),
        "capstone_commit_date": git_value(sources.capstone_path, "log", "-1", "--format=%cI"),
        "capstone_tracked_changes": bool(status) if status is not None else None,
        "raw_data_included": not public_only,
        "rounding_note": "Traces are rounded for size only: latency 0.1 ms, ratios 4 decimals, observations 3 decimals.",
        "source_files": dict(sorted(sources.file_hashes.items())),
        "source_folders": dict(sorted(sources.folder_hashes.items())),
    }


# Main.

def run_export(capstone_path: Path, out_dir: Path, public_only: bool) -> None:
    if not capstone_path.is_dir():
        raise ExportError(f"capstone repository not found at {capstone_path}")
    data_dir = capstone_path / "data"
    if not public_only and not data_dir.is_dir():
        raise ExportError(f"{data_dir} not found; run with --public_only to export the committed results only")

    sources = SourceLog(capstone_path)
    config = build_config(sources)
    results = {block: build_results_block(sources, block) for block in eval_blocks}
    training = build_training(sources)

    if not public_only:
        raw_by_block = {block: load_valid_episodes(sources, block) for block in eval_blocks}
        for block in eval_blocks:
            verify_against_summary(block, raw_by_block[block], results[block]["summary"])
        index_payload = build_traces(sources, raw_by_block["main"], config["tick_s"], out_dir)
        write_json(out_dir / "safety.json", build_safety(raw_by_block))
        write_json(out_dir / "training_internals.json", build_training_internals(sources, training))
        print(f"traces: {len(index_payload['entries'])} entries, featured entry {index_payload['featured_entry']}")

    write_json(out_dir / "config.json", config)
    write_json(out_dir / "results.json", {"blocks": results, "km_curves": build_km_curves(sources), "context": build_context(sources)})
    write_json(out_dir / "tests.json", build_tests(sources))
    write_json(out_dir / "training.json", training)
    write_json(out_dir / "measurement.json", build_measurement(sources))
    write_json(out_dir / "provenance.json", build_provenance(sources, public_only))

    total_bytes = sum(path.stat().st_size for path in out_dir.rglob("*.json"))
    print(f"wrote {out_dir} ({total_bytes / 1024:.0f} KiB)")


def main() -> int:
    parser = argparse.ArgumentParser(description="Export capstone results to JSON for the site.")
    parser.add_argument("--capstone_path", type=Path, default=default_capstone_path)
    parser.add_argument("--out_dir", type=Path, default=default_out_dir)
    parser.add_argument("--public_only", action="store_true", help="skip the local data/ folder")
    arguments = parser.parse_args()
    try:
        run_export(arguments.capstone_path.resolve(), arguments.out_dir.resolve(), arguments.public_only)
    except ExportError as error:
        print(f"export failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
