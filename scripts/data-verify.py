#!/usr/bin/env python3
"""Verify deployed map geometry against its source data and climate raster."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from rasterio.features import rasterize
from shapely.geometry import Polygon, shape
from shapely import set_precision
from opencc import OpenCC

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/data"
report = {"verifiedAt": datetime.now(timezone.utc).isoformat(), "checks": [], "layers": {}}
ids = set()
feature_by_id = {}
for path in sorted(OUT.glob("*.geojson")):
    layer = json.loads(path.read_text())
    assert layer["type"] == "FeatureCollection", path
    for f in layer["features"]:
        p = f["properties"]
        assert f["id"] == p["id"] and p["id"] not in ids, (path, p["id"])
        ids.add(p["id"])
        feature_by_id[p["id"]] = f
        g = shape(f["geometry"])
        assert not g.is_empty and g.is_valid, (path, p["id"])
        w, s, e, n = g.bounds
        assert -180.0001 <= w <= e <= 180.0001 and -90.0001 <= s <= n <= 90.0001, (path, p["id"])
    report["layers"][path.stem] = {"features": len(layer["features"]), "bytes": path.stat().st_size,
                                  "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
report["checks"].append("All deployed GeoJSON geometries are valid, non-empty WGS84 features with globally unique IDs.")

gazetteer = json.loads((OUT / "gazetteer.json").read_text())
assert all(p["id"] in feature_by_id for p in gazetteer)
assert len({p["id"] for p in gazetteer}) == len(gazetteer)
report["namedSearchObjects"] = len(gazetteer)
report["checks"].append("Every gazetteer entry resolves to a real deployed feature; no duplicate search IDs.")

country_names = {}
cc = OpenCC("t2s")
for f in json.loads((ROOT / "data/raw/ne_50m_admin_0_countries.geojson").read_text())["features"]:
    p = {key.lower(): value for key, value in f["properties"].items()}
    key = f"country-{p['adm0_a3'].lower()}"
    country_names[key] = cc.convert(p.get("name_zh") or p.get("name") or p.get("name_en") or "")
    assert feature_by_id[key]["properties"]["name"] == country_names[key], key
for p in gazetteer:
    if p["id"] in country_names:
        assert p["name"] == country_names[p["id"]], p["id"]
for filename, field in [("learning-human.json", "religion"), ("learning-country-languages.json", None), ("learning-country-indicators.json", None)]:
    table = json.loads((OUT / filename).read_text())
    for row in (table[field] if field else table)["countries"]:
        assert row["name"] == country_names[row["countryId"]], (filename, row["countryId"])
report["checks"].append("Country labels retain the original simplified Chinese names; the gazetteer and derived country learning tables use the same names.")

grid = json.loads((OUT / "climate-grid.json").read_text())
legend = json.loads((OUT / "climate-legend.json").read_text())
assert len(legend) == 30 and [item["value"] for item in legend] == list(range(1, 31))
assert len(grid["data"]) == grid["width"] * grid["height"]
assert grid["period"] == "1991–2020" and grid["resolutionDegrees"] == 0.5
deployed = np.array(grid["data"], dtype=np.uint8).reshape(grid["height"], grid["width"])
with rasterio.open(ROOT / "data/raw/climate/1991_2020/koppen_geiger_0p5.tif") as src:
    original = src.read(1)
    assert np.array_equal(deployed, original)
    climates = json.loads((OUT / "climate.geojson").read_text())["features"]
    reconstructed = rasterize([(f["geometry"], f["properties"]["value"]) for f in climates],
                              out_shape=original.shape, transform=src.transform, fill=0, dtype="uint8")
    assert np.array_equal(reconstructed, original)
report["checks"].append("The deployed climate lookup grid is byte-for-byte equal to the official 1991–2020 0.5° GeoTIFF values.")
report["checks"].append("Rasterizing every deployed climate polygon reconstructs every original climate grid cell exactly.")
report["climate"] = {"system": "Köppen–Geiger", "period": "1991–2020", "resolutionDegrees": 0.5,
                      "legendClasses": 30, "representedClasses": len(climates),
                      "absentAtResolution": [item["code"] for item in legend if not item["presentAtResolution"]]}

# Protect against transliteration collisions that would connect unrelated rivers.
for key in ["river-yangtze", "river-yellow-river", "river-xi", "river-han-270", "river-min-367"]:
    w, s, e, n = shape(feature_by_id[key]["geometry"]).bounds
    assert 90 < w < 130 and 20 < s < 45 and e < 130 and n < 50, key
pearl = feature_by_id["river-pearl"]["properties"]
assert "珠江" not in pearl["aliases"] and shape(feature_by_id["river-pearl"]["geometry"]).bounds[2] < -80
assert "珠江" in feature_by_id["river-xi"]["properties"]["aliases"]
assert feature_by_id["river-min-367"]["properties"]["name"] == "岷江"
assert feature_by_id["river-min-473"]["properties"]["name"] == "闽江"
report["checks"].append("Pearl in the USA, Xi/Pearl River in China, Han rivers in China/Korea, and Min rivers in Sichuan/Fujian remain separate objects.")

# The Caspian Sea must use its actual source shoreline, not an approximate oval.
raw_land = json.loads((ROOT / "data/raw/ne_50m_land.geojson").read_text())["features"]
raw_caspian = Polygon(shape(raw_land[1380]["geometry"]).interiors[0])
expected_caspian = set_precision(raw_caspian.simplify(0.025, preserve_topology=True), 0.0001, mode="valid_output")
assert shape(feature_by_id["lake-caspian-sea"]["geometry"]).equals(expected_caspian)
assert feature_by_id["lake-caspian-sea"]["properties"]["sourceId"] == "natural-earth-50m-land"
report["checks"].append("The Caspian Sea lake polygon is exactly the topology-preserving simplified real shoreline from the original Natural Earth 50m land interior ring.")

source = json.loads((OUT / "sources.json").read_text())
for item in source["artifacts"]:
    path = OUT / Path(item["path"]).name
    assert item["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest(), item["path"]
for item in source["sources"]:
    assert item["license"] and item["licenseUrl"] and item["retrievedAt"] and item["sha256"]
report["checks"].append("Every listed deployed artifact matches its recorded SHA-256; every input has URL, retrieval time, SHA-256, and a license.")
report["status"] = "passed"
(OUT / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(report, ensure_ascii=False, indent=2))
