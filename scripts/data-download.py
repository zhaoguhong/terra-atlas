#!/usr/bin/env python3
"""Download immutable, SHA-256-locked source inputs for the data build.

Uses only the standard library. Existing valid cached inputs are reused.
"""
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / "scripts/data-sources.lock.json"
records = json.loads(LOCK.read_text())


def fetch(record):
    path = ROOT / record["path"]
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == record["sha256"]:
        print("cached", record["id"], flush=True)
        return record
    response = urlopen(Request(record["url"], headers={"User-Agent": "Terra-Atlas-geodata/1.0"}), timeout=180)
    data = response.read()
    digest = hashlib.sha256(data).hexdigest()
    if digest != record["sha256"]:
        raise RuntimeError(f"SHA-256 mismatch for {record['id']}: expected {record['sha256']}, received {digest}. Cached input was not modified.")
    temporary = path.with_suffix(path.suffix + ".download")
    temporary.write_bytes(data)
    temporary.replace(path)
    print("downloaded", record["id"], len(data), flush=True)
    return {**record, "retrievedAt": datetime.now(timezone.utc).isoformat()}


with ThreadPoolExecutor(max_workers=4) as pool:
    downloaded = list(pool.map(fetch, records))
(ROOT / "data/raw/download-manifest.json").write_text(json.dumps(downloaded, ensure_ascii=False, indent=2) + "\n")
