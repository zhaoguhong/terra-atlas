#!/usr/bin/env python3
"""Build local, attributable WGS84 map layers for Terra Atlas.

Run with Python + numpy, rasterio, shapely, opencc-python-reimplemented.
Raw inputs are deliberately kept separate from the deployable artifacts.
"""
from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import rasterio
from rasterio.features import shapes
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import unary_union
from shapely import set_precision
from opencc import OpenCC

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw"
OUT = ROOT / "public/data"
OUT.mkdir(parents=True, exist_ok=True)
CC = OpenCC("t2s")

# These aliases translate natural geographic names only; geometry comes from
# the downloaded Natural Earth layer, never an invented sketch.
NATURAL_NAME_OVERRIDES = {
    "Himalayas": "喜马拉雅山脉", "Alps": "阿尔卑斯山脉", "Andes": "安第斯山脉",
    "Rocky Mountains": "落基山脉", "Tian Shan": "天山", "Altai Mountains": "阿尔泰山脉",
    "Greater Khingan": "大兴安岭", "Kunlun Mountains": "昆仑山脉", "Qinling": "秦岭",
    "Taihang Mountains": "太行山脉", "Wuyi Mountains": "武夷山脉", "Yin Mountains": "阴山",
    "Nanling Mountains": "南岭", "Qilian Mountains": "祁连山脉", "Pamir mountains": "帕米尔高原",
    "Tibetan Plateau": "青藏高原", "Mongolian Plateau": "蒙古高原", "Loess Plateau": "黄土高原",
    "Manchurian Plain": "东北平原", "North China Plain": "华北平原",
    "Central Siberian Plateau": "中西伯利亚高原", "Indo-Gangetic Plain": "印度河—恒河平原",
    "North European Plain": "欧洲北部平原", "Amazon basin": "亚马孙盆地", "Congo basin": "刚果盆地",
    "Gobi Desert": "戈壁", "Atacama Desert": "阿塔卡马沙漠", "Kalahari Desert": "卡拉哈里沙漠",
    "Yangtze": "长江", "Chang Jiang": "长江", "Huang": "黄河", "Yellow": "黄河",
    "Yellow River": "黄河", "Amazonas": "亚马孙河", "Amazon": "亚马孙河",
    "Nile": "尼罗河", "Victoria Nile": "维多利亚尼罗河", "Albert Nile": "艾伯特尼罗河",
    "White Nile": "白尼罗河", "Blue Nile": "青尼罗河", "Mississippi": "密西西比河",
    "Missouri": "密苏里河", "Amur": "黑龙江", "Heilong Jiang": "黑龙江",
    "Mekong": "澜沧江—湄公河", "Salween": "怒江—萨尔温江",
    "Brahmaputra": "雅鲁藏布江—布拉马普特拉河", "Yarlung": "雅鲁藏布江—布拉马普特拉河",
    "Indus": "印度河", "Ganges": "恒河", "Tarim": "塔里木河", "Sungari": "松花江",
    "Songhua": "松花江", "Di’er Songhua": "第二松花江", "Pearl": "珍珠河（美国）", "Huai": "淮河",
    "Han": "汉江", "Xiang": "湘江", "Gan": "赣江", "Min": "岷江", "Yalong": "雅砻江",
    "Liao": "辽河", "Hai": "海河", "Fen": "汾河", "Wei": "渭河", "Ussuri": "乌苏里江",
    "Irrawaddy": "伊洛瓦底江", "Irrawaddy Delta": "伊洛瓦底江三角洲", "Lena": "勒拿河",
    "Yenisey": "叶尼塞河", "Yenisei": "叶尼塞河", "Ob": "鄂毕河", "Irtysh": "额尔齐斯河",
    "Angara": "安加拉河", "Volga": "伏尔加河", "Ural": "乌拉尔河", "Don": "顿河",
    "Dnieper": "第聂伯河", "Dniester": "德涅斯特河", "Danube": "多瑙河", "Rhine": "莱茵河",
    "Elbe": "易北河", "Seine": "塞纳河", "Thames": "泰晤士河", "Tigris": "底格里斯河",
    "Euphrates": "幼发拉底河", "Jordan": "约旦河", "Congo": "刚果河", "Niger": "尼日尔河",
    "Zambezi": "赞比西河", "Orange": "奥兰治河", "Limpopo": "林波波河", "Senegal": "塞内加尔河",
    "Murray": "墨累河", "Darling": "达令河", "Mackenzie": "麦肯齐河", "Yukon": "育空河",
    "Saint Lawrence": "圣劳伦斯河", "St. Lawrence": "圣劳伦斯河", "Colorado": "科罗拉多河",
    "Columbia": "哥伦比亚河", "Ohio": "俄亥俄河", "Paraná": "巴拉那河", "Parana": "巴拉那河",
    "Orinoco": "奥里诺科河", "São Francisco": "圣弗朗西斯科河", "Tocantins": "托坎廷斯河",
    "Madeira": "马代拉河", "Tapajós": "塔帕若斯河", "Rio Grande": "格兰德河",
    "Qinghai Hu": "青海湖", "Qinghai Lake": "青海湖", "Poyang Hu": "鄱阳湖",
    "Dongting Hu": "洞庭湖", "Tai Hu": "太湖", "Baikal": "贝加尔湖", "Lake Baikal": "贝加尔湖",
    "Caspian Sea": "里海", "Aral Sea": "咸海", "Lake Superior": "苏必利尔湖",
    "Lake Victoria": "维多利亚湖", "Lake Tanganyika": "坦噶尼喀湖", "Lake Malawi": "马拉维湖",
    "Lake Chad": "乍得湖", "Great Salt Lake": "大盐湖", "Lake Titicaca": "的的喀喀湖",
    "Borohoro Mts.": "博罗科努山", "Atherton Tableland": "阿瑟顿高原",
    "Xi": "西江（珠江水系）", "Nanpan": "南盘江", "Hongshui": "红水河", "Quan": "黔江",
    "Xun": "浔江", "Dong": "东江", "Bei": "北江", "You": "右江", "Yong": "邕江",
    "Yu": "郁江", "Zuo": "左江", "Liu": "柳江", "Rong": "融江",
    "Tuotuo": "沱沱河", "Tongtian": "通天河", "Qumar": "楚玛尔河", "Dam": "当曲",
    "North Island Volcanic Plateau": "北岛火山高原", "Ethiopian Highlands": "埃塞俄比亚高原",
    "Kilimanjaro": "乞力马扎罗山", "Mount Kilimanjaro": "乞力马扎罗山", "Denali": "德纳利山",
    "Mount Everest": "珠穆朗玛峰", "Everest": "珠穆朗玛峰", "Mount Elbrus": "厄尔布鲁士山",
}
RIVER_CANONICAL = {
    "Chang Jiang": "Yangtze", "Huang": "Yellow River", "Yellow": "Yellow River",
    "Amazonas": "Amazon", "Heilong Jiang": "Amur", "Songhua": "Sungari", "Yarlung": "Brahmaputra",
    "Tuotuo": "Yangtze", "Tongtian": "Yangtze",
}
KINDS = {"Range/mtn": "mountain", "Foothills": "mountain", "Plateau": "plateau", "Basin": "basin",
         "Plain": "plain", "Lowland": "plain", "Desert": "desert", "Valley": "valley",
         "Gorge": "valley", "Depression": "basin", "Delta": "delta", "Continent": "continent",
         "Island": "island", "Island group": "island", "Pen/cape": "peninsula", "Peninsula": "peninsula"}


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def round_coordinates(value):
    if isinstance(value, (tuple, list)):
        return [round_coordinates(v) for v in value]
    return round(value, 4) if isinstance(value, float) else value


def props(feature):
    return {key.lower(): value for key, value in feature["properties"].items()}


def read(name):
    return json.loads((RAW / f"{name}.geojson").read_text())["features"]


def zh_name(p, name_en, kind):
    # Country/river homonyms (Jordan, Niger, Senegal, Congo) must remain distinct.
    if kind != "country":
        for name in [name_en, p.get("name"), p.get("name_en")]:
            if name in NATURAL_NAME_OVERRIDES:
                return NATURAL_NAME_OVERRIDES[name]
    return CC.convert(p.get("name_zh") or p.get("name") or name_en or "")


def normalized_props(p, kind, key, geom, source_id):
    name_en = p.get("name_en") or p.get("name") or ""
    name = zh_name(p, name_en, kind)
    aliases = list(dict.fromkeys(str(v) for v in [name, name_en, p.get("name"), p.get("name_alt"), p.get("namealt"), p.get("name_zh")] if v))
    center = geom.representative_point()
    out = {"id": key, "name": name, "nameEn": name_en, "aliases": aliases,
           "kind": kind, "subkind": p.get("featurecla") or kind,
           "rank": p.get("scalerank", 5), "minZoom": p.get("min_zoom") or p.get("min_label") or 0,
           "sourceId": source_id, "center": [round(center.x, 4), round(center.y, 4)],
           "bbox": [round(v, 4) for v in geom.bounds]}
    for old, new in [("ne_id", "neId"), ("wikidataid", "wikidataId"), ("elevation", "elevation")]:
        if p.get(old) is not None:
            out[new] = p[old]
    return out


def feature(geom, p):
    # Quantize with GEOS topology repair rather than rounding independently:
    # very short Natural Earth segments can otherwise collapse to invalid rings.
    geom = set_precision(geom, 0.0001, mode="valid_output")
    if geom.is_empty:
        return None
    return {"type": "Feature", "id": p["id"], "properties": p,
            "geometry": {"type": geom.geom_type, "coordinates": round_coordinates(mapping(geom)["coordinates"])}}


def write_layer(name, features):
    features = [f for f in features if f is not None]
    features.sort(key=lambda f: str(f["properties"]["id"]))
    payload = {"type": "FeatureCollection", "features": features}
    path = OUT / f"{name}.geojson"
    path.write_text(compact(payload) + "\n")
    print(name, len(features), path.stat().st_size, flush=True)
    return path


layers = []
land = []
for i, f in enumerate(read("ne_50m_land")):
    geom = shape(f["geometry"]).simplify(0.025, preserve_topology=True)
    land.append(feature(geom, {"id": f"land-{i}", "kind": "land", "sourceId": "natural-earth-50m-land"}))
layers.append(write_layer("land", land))

countries = []
for f in read("ne_50m_admin_0_countries"):
    p = props(f)
    geom = shape(f["geometry"]).simplify(0.025, preserve_topology=True)
    out = normalized_props(p, "country", f"country-{p['adm0_a3'].lower()}", geom, "natural-earth-50m-countries")
    if p.get("label_x") is not None:
        out["center"] = [p["label_x"], p["label_y"]]
    out["continent"] = p.get("continent")
    countries.append(feature(geom, out))
layers.append(write_layer("countries", countries))

regions = []
groups = defaultdict(list)
for i, f in enumerate(read("ne_10m_geography_regions_polys")):
    p = props(f)
    if p.get("featurecla") == "Dragons-be-here":
        continue
    groups[p.get("ne_id") or i].append(f)
for key, fs in groups.items():
    p = props(fs[0])
    geom = unary_union([shape(f["geometry"]) for f in fs]).simplify(0.018, preserve_topology=True)
    out = normalized_props(p, KINDS.get(p["featurecla"], "region"), f"region-{key}", geom, "natural-earth-10m-regions")
    out["geometryNote"] = "Natural Earth自然地理标注范围（1:1000万概化），不是精确地貌边界。"
    regions.append(feature(geom, out))
layers.append(write_layer("regions", regions))

lakes = []
for i, f in enumerate(read("ne_10m_lakes")):
    p = props(f)
    geom = shape(f["geometry"]).simplify(0.004, preserve_topology=True)
    key = p.get("ne_id") or f"unnamed-{i}"
    out = normalized_props(p, "lake", f"lake-{key}", geom, "natural-earth-10m-lakes")
    lakes.append(feature(geom, out))
# Natural Earth's 10m lakes intentionally omits the Caspian Sea. The 50m
# land polygon contains its real shoreline as an interior ring. Reuse that
# measured cartographic line; do not invent a lake envelope.
caspian_land = shape(read("ne_50m_land")[1380]["geometry"])
caspian_shoreline = Polygon(caspian_land.interiors[0])
assert 46 < caspian_shoreline.bounds[0] < 47 and 54 < caspian_shoreline.bounds[2] < 55
assert 36 < caspian_shoreline.bounds[1] < 37 and 47 < caspian_shoreline.bounds[3] < 48
caspian_geom = caspian_shoreline.simplify(0.025, preserve_topology=True)
caspian_props = normalized_props({"name": "Caspian Sea", "name_en": "Caspian Sea", "name_zh": "里海",
                                  "scalerank": 1, "min_zoom": 1, "featurecla": "Lake"},
                                 "lake", "lake-caspian-sea", caspian_geom, "natural-earth-50m-land")
caspian_props["aliases"].append("Caspian")
caspian_props["scale"] = "1:50,000,000"
caspian_props["derivedFrom"] = "ne_50m_land.geojson: features[1380].geometry.coordinates[1]"
caspian_props["geometryNote"] = "里海岸线提取自Natural Earth 1:5000万陆地数据的真实内环，经过0.025°保拓扑概化；不是手绘示意范围。"
lakes.append(feature(caspian_geom, caspian_props))
layers.append(write_layer("lakes", lakes))

rivers = []
groups = defaultdict(list)
name_numbers = defaultdict(set)
merge_known_segments = {"Yangtze", "Yellow River", "Amazon", "Mississippi", "Amur", "Brahmaputra", "Sungari"}
for i, f in enumerate(read("ne_10m_rivers_lake_centerlines")):
    p = props(f)
    name = p.get("name_en") or p.get("name") or f"unnamed-{i}"
    canonical = RIVER_CANONICAL.get(name, name)
    num = p.get("rivernum", i)
    group_num = 0 if canonical in merge_known_segments else num
    groups[(canonical, group_num)].append(f)
    name_numbers[canonical].add(group_num)
for (name, group_num), fs in groups.items():
    p = props(fs[0])
    p["name_en"] = name
    geom = unary_union([shape(f["geometry"]) for f in fs]).simplify(0.006, preserve_topology=True)
    if geom.is_empty:
        continue
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")
    # A short digest prevents name collisions for distinct non-ASCII names.
    if not slug:
        slug = hashlib.sha256(name.encode()).hexdigest()[:12]
    if len(name_numbers[name]) > 1:
        slug += f"-{group_num}"
    out = normalized_props(p, "river", f"river-{slug}", geom, "natural-earth-10m-rivers")
    out["aliases"] = list(dict.fromkeys(out["aliases"] + [str(v) for f in fs for k, v in props(f).items() if k in ["name", "name_en", "name_alt"] and v]))
    out["sourceSegments"] = sorted({(props(f).get("name"), props(f).get("rivernum")) for f in fs}, key=lambda item: (str(item[0]), str(item[1])))
    if name == "Yangtze":
        out["aliases"] += ["沱沱河", "通天河", "长江干流"]
    out["rank"] = min(props(f).get("scalerank", 9) for f in fs)
    out["minZoom"] = min(props(f).get("min_zoom", 0) for f in fs)
    # Disambiguate different rivers that have the same English transliteration.
    specific_names = {270: "汉江", 626: "汉江（韩国）", 367: "岷江", 473: "闽江",
                      163: "科罗拉多河（北美）", 192: "科罗拉多河（阿根廷）",
                      244: "丘吉尔河（拉布拉多）", 629: "丘吉尔河（马尼托巴）"}
    if group_num in specific_names:
        out["name"] = specific_names[group_num]
        out["aliases"] = list(dict.fromkeys([out["name"]] + out["aliases"]))
        # A generic Chinese name from the other river is not a valid alias.
        if group_num == 473:
            out["aliases"] = [s for s in out["aliases"] if s != "岷江"]
    if name == "Xi" and group_num == 96:
        out["aliases"] += ["西江", "珠江", "珠江水系", "Pearl River", "Xi Jiang"]
    rivers.append(feature(geom, out))
layers.append(write_layer("rivers", rivers))

peaks = []
for i, f in enumerate(read("ne_10m_geography_regions_elevation_points")):
    p = props(f)
    if p.get("featurecla") != "mountain":
        continue
    geom = shape(f["geometry"])
    key = p.get("ne_id") or f"unnamed-{i}"
    out = normalized_props(p, "peak", f"peak-{key}", geom, "natural-earth-10m-peaks")
    peaks.append(feature(geom, out))
layers.append(write_layer("peaks", peaks))

# Published 0.5 degree GeoTIFF, not a hand-drawn climate teaching sketch.
archive = RAW / "koppen_geiger_tif.zip"
entry = "1991_2020/koppen_geiger_0p5.tif"
with ZipFile(archive) as z:
    tif_path = RAW / "climate" / entry
    tif_path.parent.mkdir(parents=True, exist_ok=True)
    tif_path.write_bytes(z.read(entry))
    legend_text = z.read("legend.txt").decode()
    (RAW / "climate/legend.txt").write_text(legend_text)

CN_NAMES = [
    "热带雨林气候", "热带季风气候", "热带草原气候", "热沙漠气候", "冷沙漠气候",
    "热半干旱气候", "冷半干旱气候", "温带夏干炎夏气候", "温带夏干暖夏气候", "温带夏干凉夏气候",
    "温带冬干炎夏气候", "温带冬干暖夏气候", "温带冬干凉夏气候", "温带湿润炎夏气候",
    "温带湿润暖夏气候", "温带湿润凉夏气候", "寒冷夏干炎夏气候", "寒冷夏干暖夏气候",
    "寒冷夏干凉夏气候", "寒冷夏干严冬气候", "寒冷冬干炎夏气候", "寒冷冬干暖夏气候",
    "寒冷冬干凉夏气候", "寒冷冬干严冬气候", "寒冷湿润炎夏气候", "寒冷湿润暖夏气候",
    "寒冷湿润凉夏气候", "寒冷湿润严冬气候", "苔原气候", "冰原气候",
]
FAMILY_NAMES = {"A": "热带", "B": "干旱", "C": "温带", "D": "寒冷", "E": "极地"}
legend = []
for line in legend_text.splitlines():
    match = re.match(r"\s*(\d+):\s+(\w+)\s+(.+?)\s+\[(\d+)\s+(\d+)\s+(\d+)\]", line)
    if match:
        value, code, name_en, r, g, b = match.groups()
        value = int(value)
        legend.append({"value": value, "code": code, "name": CN_NAMES[value - 1], "nameEn": name_en,
                       "family": code[0], "familyName": FAMILY_NAMES[code[0]],
                       "color": f"#{int(r):02x}{int(g):02x}{int(b):02x}"})
climate = []
with rasterio.open(tif_path) as ds:
    grid = ds.read(1)
    present = set(int(v) for v in np.unique(grid))
    for item in legend:
        item["presentAtResolution"] = item["value"] in present
    geometry_groups = defaultdict(list)
    for geometry, value in shapes(grid, mask=grid > 0, transform=ds.transform):
        geometry_groups[int(value)].append(shape(geometry))
    for value, geoms in geometry_groups.items():
        item = legend[value - 1]
        geom = unary_union(geoms)
        # Collinear grid edges are removed without changing class boundaries.
        geom = geom.simplify(0, preserve_topology=True)
        p = {**item, "id": f"climate-{item['code']}", "kind": "climate",
             "sourceId": "koppen-geiger-1991-2020", "period": "1991–2020",
             "resolutionDegrees": 0.5,
             "geometryNote": "Beck等(2023)发布的1991–2020 Köppen–Geiger气候分类；0.5°网格概化，赤道附近约55公里。"}
        climate.append(feature(geom, p))
    grid_payload = {"system": "Köppen–Geiger", "period": "1991–2020", "version": "V3",
                    "sourceId": "koppen-geiger-1991-2020", "width": ds.width, "height": ds.height,
                    "west": ds.bounds.left, "north": ds.bounds.top, "resolutionDegrees": 0.5,
                    "nodata": 0, "data": grid.flatten().tolist()}
    (OUT / "climate-grid.json").write_text(compact(grid_payload) + "\n")
layers.append(write_layer("climate", climate))
(OUT / "climate-legend.json").write_text(compact(legend) + "\n")

gazetteer = []
for path in layers:
    if path.stem in ["land", "climate"]:
        continue
    for f in json.loads(path.read_text())["features"]:
        p = f["properties"]
        if p.get("name"):
            gazetteer.append({key: p[key] for key in ["id", "name", "nameEn", "aliases", "kind", "center", "bbox", "sourceId"]})
(OUT / "gazetteer.json").write_text(compact(gazetteer) + "\n")

manifest = json.loads((RAW / "download-manifest.json").read_text())
source_ids = {
    "ne_50m_land": "natural-earth-50m-land", "ne_50m_admin_0_countries": "natural-earth-50m-countries",
    "ne_10m_geography_regions_polys": "natural-earth-10m-regions", "ne_10m_lakes": "natural-earth-10m-lakes",
    "ne_10m_rivers_lake_centerlines": "natural-earth-10m-rivers", "ne_10m_geography_regions_elevation_points": "natural-earth-10m-peaks",
}
sources = []
for row in manifest:
    if row["id"] == "ne_10m_geography_regions_points":
        continue
    if row["id"] == "koppen_geiger_tif":
        sources.append({**row, "id": "koppen-geiger-1991-2020", "title": "Beck等（2023）Köppen–Geiger全球气候分类 V3",
                        "homepage": "https://www.gloh2o.org/koppen/", "license": "CC BY 4.0",
                        "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
                        "citation": "Beck, H.E. et al. (2023). High-resolution (1 km) Köppen-Geiger maps for 1901–2099 based on constrained CMIP6 projections. Scientific Data 10, 724. DOI:10.1038/s41597-023-02549-6.",
                        "citationUrl": "https://doi.org/10.1038/s41597-023-02549-6", "period": "1991–2020", "version": "V3",
                        "processing": "采用官方归档内1991_2020/koppen_geiger_0p5.tif（原生0.5°WGS84网格，赤道约55公里）。按分类值矢量化、合并相同分类，去除共线顶点；分类网格随站点发布供本地点查。中文分类名为译文，颜色保留官方legend.txt。该分辨率存在28类，Csc/Cwc未在概化网格出现；图例保留完整30类。", "selectedFileSha256": hashlib.sha256(tif_path.read_bytes()).hexdigest()})
    else:
        sources.append({**row, "id": source_ids[row["id"]], "title": row["id"].replace("_", " "),
                        "homepage": "https://www.naturalearthdata.com/", "license": "Public domain",
                        "licenseUrl": "https://www.naturalearthdata.com/about/terms-of-use/",
                        "processing": "WGS84；去除无关属性；保拓扑简化并用GEOS安全量化至0.0001°，移除退化的极短线与极小面。中文名基于原数据Wikidata译名转简体；国家沿用原始中文名，自然要素另校正主要通用译名，避免同名国家被替换为河流名称。自然区域为标注范围与概化表达，非精确地貌边界。国家/陆地1:5000万，其他1:1000万；河流按rivernum合并同一流域河段及湖泊中心线，已核实的大河合并不同名称河段；同名跨流域河流保留独立ID。峰点仅保留原始mountain类型。"})
        if row["id"] == "ne_50m_land":
            sources[-1]["processing"] += "另从原始陆地要素1380的第一个内环提取里海湖面（lake-caspian-sea）；采用同一0.025°保拓扑简化与0.0001°量化，岸线来自原数据。"

artifact_records = []
for path in sorted(layers) + [OUT / "climate-grid.json", OUT / "climate-legend.json", OUT / "gazetteer.json"]:
    artifact_records.append({"path": "/data/" + path.name, "size": path.stat().st_size,
                             "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
source_payload = {"generatedAt": datetime.now(timezone.utc).isoformat(), "sources": sources,
                  "artifacts": artifact_records,
                  "downloadAttempts": [{"url": "https://figshare.com/ndownloader/files/61012822", "status": "web-fetch-403", "resolvedBy": "下载改用官方api.figshare.com/v2/file/download/61012822，成功。"}]}
(ROOT / "data/geodata-sources.json").write_text(json.dumps(source_payload, ensure_ascii=False, indent=2) + "\n")
(OUT / "sources.json").write_text(json.dumps(source_payload, ensure_ascii=False, indent=2) + "\n")
print("Complete", len(gazetteer), "searchable named map objects")
