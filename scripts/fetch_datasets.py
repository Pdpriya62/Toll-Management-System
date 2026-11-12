"""Download and unpack the demo/test datasets into datasets/ (gitignored).

Usage:  pip install huggingface_hub pandas pyarrow
        python scripts/fetch_datasets.py

Output:
  datasets/plates/images/*.jpg + labels.csv  (Indian plates: file, plate_text, xmin, ymin, xmax, ymax)
  datasets/scenes/*.jpg + _annotations.coco.json  (vehicle photos with plate boxes, CC BY 4.0)
"""
import csv
import zipfile
from pathlib import Path

import pandas as pd
from huggingface_hub import hf_hub_download

ROOT = Path(__file__).resolve().parent.parent / "datasets"
RAW = ROOT / "raw"


def fetch(repo, filename, sub):
    return Path(hf_hub_download(repo, filename, repo_type="dataset", local_dir=RAW / sub))


def build_plates():
    parquet = fetch("zenitsu09/indian-number-plate", "data/train-00000-of-00001.parquet", "indian-plates")
    out = ROOT / "plates" / "images"
    out.mkdir(parents=True, exist_ok=True)
    df = pd.read_parquet(parquet)
    with open(ROOT / "plates" / "labels.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "plate_text", "xmin", "ymin", "xmax", "ymax"])
        for i, row in df.iterrows():
            name = f"plate_{i:05d}.jpg"
            (out / name).write_bytes(row["image"]["bytes"])
            w.writerow([name, row["plate_text"], row["xmin"], row["ymin"], row["xmax"], row["ymax"]])
    print(f"plates: {len(df)} images -> {out}")


def build_scenes():
    z = fetch("keremberke/license-plate-object-detection", "data/test.zip", "vehicle-scenes")
    out = ROOT / "scenes"
    out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(z) as zf:
        zf.extractall(out)  # zipfile strips absolute paths and '..' entries
    print(f"scenes: {len(list(out.glob('*.jpg')))} images -> {out}")


if __name__ == "__main__":
    build_plates()
    build_scenes()
