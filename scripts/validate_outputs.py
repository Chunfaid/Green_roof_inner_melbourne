#!/usr/bin/env python3
"""Offline structural/arithmetic checks for published 15 green roof scenario GeoJSONs.

No GIS libraries required. Run from the repository root:
    python3 scripts/validate_outputs.py [--data-dir data]

This does NOT reproduce spatial processing or validate physical cooling performance.
"""
import argparse
import json
import math
from pathlib import Path

SCENARIOS = {
    "Balanced": ["Scenario_1_priority.geojson", "Scenario_2_targeted.geojson", "Scenario_3_Board.geojson"],
    "Heat": ["Heat_S1_cooling.geojson", "Heat_S2_roofs_cooling.geojson", "Heat_S3_roofs_cooling.geojson"],
    "Equity": ["Equity_S1_roofs_cooling.geojson", "Equity_S2_roofs_cooling.geojson", "Equity_S3_roofs_cooling.geojson"],
    "Vegetation": ["Green_S1_roofs_cooling.geojson", "Green_S2_roofs_cooling.geojson", "Green_S3_roofs_cooling.geojson"],
    "Population": ["Population_S1_roofs_cooling.geojson", "Population_S2_roofs_cooling.geojson", "Population_S3_roofs_cooling.geojson"],
}
AREA = 62500.0
def number(value):
    if isinstance(value, bool) or value is None or value == "":
        return None
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None

def test_file(path, errors, warnings):
    try:
        with path.open(encoding="utf-8") as f:
            collection = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"{path.name}: cannot load JSON ({exc})")
        return None
    features = collection.get("features") if isinstance(collection, dict) else None
    if not isinstance(collection, dict) or collection.get("type") != "FeatureCollection" or not isinstance(features, list):
        errors.append(f"{path.name}: must be a GeoJSON FeatureCollection")
        return None
    if not features:
        errors.append(f"{path.name}: empty feature list")
        return None
    counts = 0
    grid_ids = set()
    has_ids = True
    coverage_samples = 0
    covered_cells = set()
    for n, feature in enumerate(features, 1):
        p = feature.get("properties") or {}
        if not isinstance(p, dict):
            errors.append(f"{path.name}: feature {n} has invalid properties")
            continue
        gid = p.get("id")
        if gid is None:
            has_ids = False
        else:
            if gid in grid_ids:
                errors.append(f"{path.name}: duplicate grid id {gid}")
            grid_ids.add(gid)
        cooling = number(p.get("cooling_C"))
        before = number(p.get("LST_mean"))
        after = number(p.get("scenario_LST"))
        coverage = number(p.get("gr_percentage"))
        area = number(p.get("gr_area_sum"))
        if area is None:
            area = number(p.get("roof_area_m2"))
        if coverage is not None:
            coverage_samples += 1
            if not (-0.001 <= coverage <= 100.001):
                errors.append(f"{path.name}: row {n} coverage outside 0–100% ({coverage:.3f})")
            if area is not None and abs(coverage - area / AREA * 100) > 0.02:
                errors.append(f"{path.name}: row {n} coverage and roof area disagree")
            if cooling is not None and cooling > 0:
                if coverage < 30 - 1e-7:
                    errors.append(f"{path.name}: row {n} cooling below 30%")
                expected = min(3.8, 1 + (coverage - 30) * (2.8 / 60))
                if abs(cooling - expected) > 0.025:
                    errors.append(f"{path.name}: row {n} cooling differs from model")
        if cooling is not None and cooling > 0:
            if cooling > 3.8 + 0.025:
                errors.append(f"{path.name}: row {n} cooling exceeds model cap")
            counts += 1
            if gid is not None:
                covered_cells.add(gid)
        elif before is not None and after is not None and before > after + 1e-6:
            counts += 1
            if gid is not None:
                covered_cells.add(gid)
        if before is not None and after is not None and cooling is not None:
            if cooling > 0 and abs((before-after)-cooling) > 0.03:
                errors.append(f"{path.name}: row {n} baseline – scenario LST mismatch")
    if not has_ids:
        warnings.append(f"{path.name}: some grid ids missing; cannot confirm cell uniqueness for every row")
    if not coverage_samples:
        warnings.append(f"{path.name}: no gr_percentage values; threshold/area checks skipped")
    print(f"{path.name}: {len(features)} features, {counts} affected cells")
    return len(features), counts, covered_cells

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="data", type=Path)
    args = parser.parse_args()
    errors, warnings = [], []
    for focus, paths in SCENARIOS.items():
        results = []
        for filename in paths:
            results.append(test_file(args.data_dir / filename, errors, warnings))
        if any(r is None for r in results):
            continue
        totals = [r[0] for r in results]
        counts = [r[1] for r in results]
        if len(set(totals)) != 1:
            errors.append(f"{focus}: different total grid-cell counts: {totals}")
        if counts != sorted(counts):
            errors.append(f"{focus}: affected cell counts decline across cumulative scenarios: {counts}")
        # Broader roof selections should not lose already affected cell identifiers.
        for i in range(2):
            missing = results[i][2] - results[i+1][2]
            if missing:
                errors.append(f"{focus}: {len(missing)} affected cells in S{i+1} disappear from S{i+2}")
    for msg in warnings:
        print("WARNING:", msg)
    for msg in errors[:40]:
        print("ERROR:", msg)
    if len(errors) > 40:
        print(f"... and {len(errors)-40} more errors")
    print(f"QA completed: {len(errors)} errors, {len(warnings)} warnings.")
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
