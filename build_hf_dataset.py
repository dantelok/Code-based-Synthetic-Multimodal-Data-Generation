"""Build a multi-domain synthetic chart-QA dataset with verifiable labels.

For each source table we repeatedly: pick a chart type + columns, aggregate an
exact data slice, render it deterministically (matplotlib), and generate
ground-truth QA over that *same* slice with pandas. Because chart and QA come
from one frame, every answer is answerable from the image and correct by
construction — the property a chart-QA benchmark needs. The whole build is
offline, seed-controlled, and free (no API calls).

Sources (all CC BY 4.0 — download into --source-dir first; see the dataset card):
  * climate   -> owid-co2-data.csv   (Our World in Data, CO2 & GHG emissions)
  * ecommerce -> online_retail.csv   (UCI Online Retail)
  * housing   -> listings.csv        (Inside Airbnb, a city's listings)

Usage:
    python build_hf_dataset.py --source-dir data/sources --out generated/hf \\
        --charts-per-domain 600 --qa-per-chart 7 --seed 0
    # then, to assemble a Hugging Face dataset on disk (needs `datasets`):
    python build_hf_dataset.py ... --hf-out generated/hf_dataset
    # and to publish (needs huggingface-cli login):
    python build_hf_dataset.py ... --hf-out generated/hf_dataset --push <user>/<name>
"""

import argparse
import json
import logging
import os
import random
from typing import Dict, List, Optional

import pandas as pd

from src.qa_templates import generate_grounded_qa
from src.render import render_bar, render_line, render_pie, render_scatter

logger = logging.getLogger("build_hf_dataset")

# Per-source configuration. Column lists are filtered to those actually present,
# so a slightly different export still works.
SOURCES = [
    {
        "domain": "climate",
        "file": "owid-co2-data.csv",
        "source": "Our World in Data — CO2 and Greenhouse Gas Emissions (CC BY 4.0)",
        "categorical": ["country"],
        "numeric": ["co2", "co2_per_capita", "coal_co2", "oil_co2", "gas_co2",
                    "cement_co2", "population", "gdp", "primary_energy_consumption"],
        "line_x": "year",
    },
    {
        "domain": "ecommerce",
        "file": "online_retail.csv",
        "source": "UCI Machine Learning Repository — Online Retail (CC BY 4.0)",
        "categorical": ["Country", "Description"],
        "numeric": ["Quantity", "UnitPrice"],
        "line_x": None,
    },
    {
        "domain": "housing",
        "file": "listings.csv",
        "source": "Inside Airbnb — listings (CC BY 4.0)",
        "categorical": ["neighbourhood", "room_type"],
        "numeric": ["price", "minimum_nights", "number_of_reviews",
                    "availability_365", "calculated_host_listings_count"],
        "line_x": None,
    },
]


def _present(cols: List[str], df: pd.DataFrame) -> List[str]:
    return [c for c in cols if c in df.columns]


def _numeric_frame(df: pd.DataFrame, cols: List[str]) -> pd.DataFrame:
    out = df.copy()
    for c in cols:
        out[c] = pd.to_numeric(out[c], errors="coerce")
    return out


def build_one_chart(df: pd.DataFrame, cfg: Dict, rng: random.Random, idx: int,
                    images_dir: str, qa_per_chart: int) -> List[Dict]:
    """Render one chart and return its QA records (possibly empty if infeasible)."""
    cats = _present(cfg["categorical"], df)
    nums = _present(cfg["numeric"], df)
    line_x = cfg["line_x"] if cfg["line_x"] in df.columns else None

    feasible = []
    if cats and nums:
        feasible += ["bar", "pie"]
    if line_x and nums:
        feasible.append("line")
    if len(nums) >= 2:
        feasible.append("scatter")
    if not feasible:
        return []

    chart_type = rng.choice(feasible)
    domain = cfg["domain"]
    file_name = f"images/{domain}_{idx}.png"
    path = os.path.join(images_dir, f"{domain}_{idx}.png")
    seed = rng.randint(0, 2**31 - 1)
    frame: Optional[pd.DataFrame] = None
    cols = None

    if chart_type in ("bar", "pie"):
        cat, num = rng.choice(cats), rng.choice(nums)
        clean = _numeric_frame(df.dropna(subset=[cat]), [num]).dropna(subset=[num])
        agg = clean.groupby(cat)[num].sum().sort_values(ascending=False)
        agg = agg[agg > 0].head(rng.randint(5, 8))
        if agg.shape[0] < 3:
            return []
        title = f"Total {num} by {cat}"
        if chart_type == "bar":
            render_bar(agg.index, agg.values, cat, num, title, path)
        else:
            render_pie(agg.index, agg.values, title, path)
        frame = agg.reset_index()
        cols = [cat, num]

    elif chart_type == "line":
        num = rng.choice(nums)
        clean = _numeric_frame(df.dropna(subset=[line_x]), [num]).dropna(subset=[num])
        agg = clean.groupby(line_x)[num].mean().sort_index()
        if agg.shape[0] < 4:
            return []
        agg = agg.tail(rng.randint(6, 12))  # a readable recent window
        render_line(agg.index, agg.values, line_x, num, f"{num} over {line_x}", path)
        # x as string keeps QA about "which x has highest y", not "total year"
        frame = pd.DataFrame({line_x: agg.index.astype(str), num: agg.values})
        cols = [line_x, num]

    else:  # scatter
        nx, ny = rng.sample(nums, 2)
        clean = _numeric_frame(df, [nx, ny]).dropna(subset=[nx, ny])
        if clean.shape[0] < 8:
            return []
        clean = clean.sample(n=min(len(clean), rng.randint(15, 30)), random_state=seed)
        render_scatter(clean[nx], clean[ny], nx, ny, f"{ny} vs {nx}", path)
        frame = clean[[nx, ny]].reset_index(drop=True)
        cols = [nx, ny]

    qa = generate_grounded_qa(frame, max_pairs=qa_per_chart, columns=cols,
                              exclude_ops={"mode"}, seed=seed)
    return [
        {
            "file_name": file_name,
            "question": q["question"],
            "answer": q["answer"],
            "chart_type": chart_type,
            "domain": domain,
            "source": cfg["source"],
            "op": q["meta"]["op"],
            "columns": q["meta"]["columns"],
        }
        for q in qa
    ]


def build_source(cfg: Dict, source_dir: str, images_dir: str, charts: int,
                 qa_per_chart: int, seed: int) -> List[Dict]:
    path = os.path.join(source_dir, cfg["file"])
    if not os.path.exists(path):
        logger.warning("SKIP %s: %s not found (download it into %s).", cfg["domain"], cfg["file"], source_dir)
        return []
    df = pd.read_csv(path, low_memory=False)
    rng = random.Random(f"{seed}-{cfg['domain']}")
    records: List[Dict] = []
    built = 0
    attempts = 0
    while built < charts and attempts < charts * 4:
        attempts += 1
        recs = build_one_chart(df, cfg, rng, built, images_dir, qa_per_chart)
        if recs:
            records.extend(recs)
            built += 1
    logger.info("%s: %d charts, %d QA pairs", cfg["domain"], built, len(records))
    return records


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--source-dir", default="data/sources", help="Directory holding the source CSVs.")
    p.add_argument("--out", default="generated/hf", help="Output dir for images + records.jsonl.")
    p.add_argument("--charts-per-domain", type=int, default=600)
    p.add_argument("--qa-per-chart", type=int, default=7)
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--hf-out", default=None, help="If set, assemble a Hugging Face dataset here (needs `datasets`).")
    p.add_argument("--push", default=None, help="If set, push_to_hub to this repo id (needs auth).")
    args = p.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s", datefmt="%H:%M:%S")

    images_dir = os.path.join(args.out, "images")
    os.makedirs(images_dir, exist_ok=True)

    all_records: List[Dict] = []
    for cfg in SOURCES:
        all_records.extend(build_source(cfg, args.source_dir, images_dir,
                                         args.charts_per_domain, args.qa_per_chart, args.seed))

    if not all_records:
        logger.error("No records built. Did you download the source CSVs into %s?", args.source_dir)
        return 1

    records_path = os.path.join(args.out, "records.jsonl")
    with open(records_path, "w") as fh:
        for r in all_records:
            fh.write(json.dumps(r) + "\n")
    n_images = len({r["file_name"] for r in all_records})
    logger.info("Wrote %d QA pairs over %d images -> %s", len(all_records), n_images, records_path)

    if args.hf_out or args.push:
        _assemble_hf(all_records, args.out, args.hf_out, args.push, args.seed)

    return 0


def _assemble_hf(records: List[Dict], out_dir: str, hf_out: Optional[str],
                 push: Optional[str], seed: int) -> None:
    """Build a Hugging Face dataset (one row per QA, with an embedded image)."""
    from datasets import Dataset, Image  # lazy: heavy, only needed to publish

    rows = [{**r, "image": os.path.join(out_dir, r["file_name"])} for r in records]
    ds = Dataset.from_list(rows).cast_column("image", Image())
    ds = ds.train_test_split(test_size=0.1, seed=seed)
    if hf_out:
        ds.save_to_disk(hf_out)
        logger.info("Saved Hugging Face dataset -> %s", hf_out)
    if push:
        ds.push_to_hub(push)
        logger.info("Pushed dataset -> https://huggingface.co/datasets/%s", push)


if __name__ == "__main__":
    raise SystemExit(main())
