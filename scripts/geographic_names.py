#!/usr/bin/env python3
"""Apply reviewed Natural Earth names without changing any geometry.

Imported by data-build.py; may also repair the current generated region and
gazetteer names without rebuilding unrelated geographic layers.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEW = json.loads(Path(__file__).with_name("geographic-name-corrections.json").read_text())
CORRECTIONS = {entry["featureId"]: entry for entry in REVIEW["corrections"]}


def correct_region_name(properties, original_name=None):
    """Use only an explicitly reviewed feature ID and matching original name."""
    correction = CORRECTIONS.get(properties.get("id"))
    if correction is None:
        return properties
    original = original_name or properties.get("sourceName")
    if original is None and correction["originalName"] in properties.get("aliases", []):
        original = correction["originalName"]
    if original != correction["originalName"]:
        raise ValueError(f"Unexpected original name for {properties['id']}: {original!r}")
    out = dict(properties)
    out.update(name=correction["name"], nameEn=correction["nameEn"],
               aliases=correction["aliases"], sourceName=original,
               nameCorrectionNote=correction["reason"])
    if correction.get("dropWikidataId") and out.get("wikidataId"):
        out["sourceWikidataId"] = out.pop("wikidataId")
    return out


def update_outputs():
    regions_path = ROOT / "public/data/regions.geojson"
    regions = json.loads(regions_path.read_text())
    seen = set()
    for feature in regions["features"]:
        properties = feature["properties"]
        if properties["id"] in CORRECTIONS:
            feature["properties"] = correct_region_name(properties)
            seen.add(properties["id"])
    if seen != set(CORRECTIONS):
        raise ValueError(f"Missing reviewed features: {set(CORRECTIONS) - seen}")
    regions_path.write_text(json.dumps(regions, ensure_ascii=False, separators=(",", ":")) + "\n")
    gazetteer_path = ROOT / "public/data/gazetteer.json"
    gazetteer = json.loads(gazetteer_path.read_text())
    for properties in gazetteer:
        if properties["id"] in CORRECTIONS:
            corrected = correct_region_name(properties)
            for key in ["name", "nameEn", "aliases"]:
                properties[key] = corrected[key]
    gazetteer_path.write_text(json.dumps(gazetteer, ensure_ascii=False, separators=(",", ":")) + "\n")
    for path in [ROOT / "data/research/geographic-name-review.json", ROOT / "public/data/geographic-name-review.json"]:
        path.write_text(json.dumps(REVIEW, ensure_ascii=False, indent=2) + "\n")
    print(f"Updated {len(seen)} reviewed Natural Earth feature names and gazetteer entries")


if __name__ == "__main__":
    update_outputs()
