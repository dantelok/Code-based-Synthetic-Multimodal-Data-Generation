"""Baseline: how well does an off-the-shelf VLM answer our chart questions?

Because the dataset's labels are ground truth, we can measure a real accuracy:
run a vision model on the test split, then score its answers against the
computed answers. This turns the dataset from "some generated data" into a
benchmark with a number.

    python evaluate_baseline.py --hf-dir generated/hf_dataset --limit 150 --seed 0

Requires COHERE_API_KEY (the default solver is Cohere's vision model). Prints an
overall accuracy plus a breakdown by chart type and operation.
"""

import argparse
import base64
import io
import json
import re
import time
from collections import defaultdict

from datasets import load_from_disk

from src.evaluation import DEFAULT_VLM_MODEL
from src.generation import ensure_api_key
from src.metrics import extract_numbers, numbers_match


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s).strip().lower())


def is_correct(pred: str, gold: str) -> bool:
    """Lenient, ground-truth-aware match: numeric tolerance for numeric answers,
    word/substring match for categorical (and yes/no) answers."""
    gold_nums = extract_numbers(gold)
    if gold_nums:
        return numbers_match(extract_numbers(pred), gold_nums, rel_tol=0.02)
    g, p = _norm(gold), _norm(pred)
    if g in {"yes", "no"}:
        return bool(re.search(rf"\b{g}\b", p))
    return g in p or p in g


def _image_data_url(image) -> str:
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hf-dir", default="generated/hf_dataset")
    ap.add_argument("--limit", type=int, default=150, help="Number of test examples to score.")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--model", default=DEFAULT_VLM_MODEL)
    ap.add_argument("--delay", type=float, default=1.5, help="Seconds between requests (rate-limit throttle).")
    ap.add_argument("--dump", default=None, help="Write per-example predictions to this JSONL file.")
    args = ap.parse_args(argv)

    import cohere
    co = cohere.ClientV2(api_key=ensure_api_key())

    test = load_from_disk(args.hf_dir)["test"].shuffle(seed=args.seed).select(range(args.limit))

    total = correct = errors = 0
    by_chart = defaultdict(lambda: [0, 0])
    by_op = defaultdict(lambda: [0, 0])
    dump = open(args.dump, "w") if args.dump else None
    for ex in test:
        prompt = ("You are answering a question about the chart shown. "
                  "Reply with only the direct answer (a value or a name), no explanation.\n"
                  f"Question: {ex['question']}")
        content = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": _image_data_url(ex["image"])}},
        ]
        pred = None
        for attempt in range(6):  # retry with backoff, mainly for 429 rate limits
            try:
                resp = co.chat(model=args.model, messages=[{"role": "user", "content": content}])
                pred = resp.message.content[0].text
                break
            except Exception as exc:  # noqa: BLE001
                if "429" in str(exc) and attempt < 5:
                    time.sleep(2 ** attempt)  # 1, 2, 4, 8, 16s
                    continue
                pred = f"<error: {exc}>"
                break
        time.sleep(args.delay)  # throttle to stay under the rate limit

        if pred.startswith("<error:"):
            errors += 1
        ok = is_correct(pred, ex["answer"])
        total += 1
        correct += int(ok)
        by_chart[ex["chart_type"]][0] += int(ok)
        by_chart[ex["chart_type"]][1] += 1
        by_op[ex["op"]][0] += int(ok)
        by_op[ex["op"]][1] += 1
        if dump:
            dump.write(json.dumps({"op": ex["op"], "chart_type": ex["chart_type"],
                                   "question": ex["question"], "gold": ex["answer"],
                                   "pred": pred, "ok": ok}) + "\n")
    if dump:
        dump.close()

    print(f"\n## Baseline: {args.model} (zero-shot), {total} test examples\n")
    print(f"**Overall accuracy: {correct/total:.1%}** ({correct}/{total})  |  API errors: {errors}\n")
    print("| Chart type | Accuracy |")
    print("|---|---|")
    for k, (c, n) in sorted(by_chart.items()):
        print(f"| {k} | {c/n:.0%} ({c}/{n}) |")
    print("\n| Operation | Accuracy |")
    print("|---|---|")
    for k, (c, n) in sorted(by_op.items(), key=lambda kv: -kv[1][1]):
        print(f"| {k} | {c/n:.0%} ({c}/{n}) |")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
