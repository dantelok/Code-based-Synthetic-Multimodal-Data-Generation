# Code-based Synthetic Multimodal Data Generation

[![CI](https://github.com/dantelok/Code-based-Synthetic-Multimodal-Data-Generation/actions/workflows/ci.yml/badge.svg)](https://github.com/dantelok/Code-based-Synthetic-Multimodal-Data-Generation/actions/workflows/ci.yml)

Generate **synthetic chart-and-QA datasets** to train and evaluate Vision-Language Models (VLMs) — using an LLM to write real plotting code, execute it, and then judge the results with a VLM.

> Built for the **Cohere Aya Expedition 2025**. Runs entirely on your own machine with your own Cohere API key — nothing is hosted, nothing leaves your laptop except the API calls you make.

![Data pipeline](images/Data-Pipeline.png)

---

## Why this exists

High-quality multimodal datasets rarely contain structured **chart/plot** data, which limits how well VLMs understand visualizations. Instead of scraping or hand-labeling, this project **generates** the data:

1. An LLM writes Python (matplotlib/seaborn) code to plot a real CSV.
2. The code is executed to render an actual chart image.
3. An LLM generates question–answer pairs grounded in the same data.
4. A **VLM-as-judge** (Aya Vision) checks whether the QA pairs are answerable and correct from the chart.

The result is a scalable, low-cost, diverse dataset — plus an automated quality filter.

---

## Two ways to run

This repo contains **two independent parts**. Most people want the first one.

| | What it is | Needs |
|---|---|---|
| **1. The web app** | Interactive chat UI: upload a CSV or image, pick chart types, generate charts in your browser | **Node.js only** (Python runs in-browser via Pyodide) |
| **2. The research pipeline** | Batch scripts that generate + evaluate a full dataset from the command line | **Python** + a Cohere API key |

You need a free Cohere API key for either: <https://dashboard.cohere.com/api-keys>

---

## 1. Run the web app

**Prerequisites:** Node.js 18.17+ and npm.

```bash
git clone <repository-url>
cd Code-based-Synthetic-Multimodal-Data-Generation

npm install
npm run dev
```

Open <http://localhost:3000>. You should see a greeting and a prompt box.

**Try it in 30 seconds:**
1. Paste your Cohere API key into the key field (it stays in your browser — it is never committed or sent anywhere except Cohere).
2. Upload a CSV — a sample lives at `data/covid-19-dataset/country_wise_latest.csv`.
3. Select rows/columns and chart types, then generate. Charts render in-browser.

Image mode: upload an image instead to get VLM analysis and auto-generated Q&A pairs.

---

## 2. Run the research pipeline

**Prerequisites:** Python 3.10+.

```bash
# from the repo root
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# provide your key (either export it, or use a .env file)
cp .env.example .env             # then edit .env and paste your key
```

The pipeline is a command-line tool (`main.py`) with four subcommands:

```bash
# Full pipeline: generate charts -> generate QA pairs -> evaluate
python main.py run --csv data/covid-19-dataset/usa_county_wise.csv

# Or run stages individually:
python main.py charts --chart-types "Bar Chart" "Line Chart" --output-size 4
python main.py qa --output-size 8           # ground-truth QA, computed from data (no API key)
python main.py evaluate            # scores artifacts from a previous run

python main.py --help              # all commands
python main.py run --help          # all flags for a command
```

### Ground-truth QA labels

By default (`--qa-method grounded`) the answers are **computed from the data**
with pandas and filled into question templates, so every label is correct by
construction — for a column `cases = [100, 250, 400]`, "total" is 750 and "max"
is 400, never a plausible-but-wrong LLM guess. This is how chart-QA datasets
like DVQA / FigureQA / PlotQA are built, and it's what makes the dataset worth
publishing. Grounded QA needs no API key. Pass `--qa-method llm` to instead have
the model write answers (convenient, but *not* guaranteed correct).

Common flags: `--csv`, `--output-dir`, `--batch-size`, `--output-size`, `--model`,
`--vlm-model`, `--max-retries`, `--seed`, `-v/--verbose`. Defaults produce the sample
COVID-19 dataset run, so `python main.py run` works out of the box once your key is set.

Under the hood:

- `src/generation.py` — LLM calls: `generate_code_block(...)` (chart code) and `generate_qa_pairs(...)`
- `src/qa_templates.py` — `generate_grounded_qa(...)`: computes ground-truth QA answers from the data
- `src/render.py` — deterministic matplotlib chart rendering (for the dataset build)
- `src/evaluation.py` — chart/QA scoring and `vlm_evaluation(...)` (VLM-as-judge)
- `src/metrics.py` — the scoring itself: AST analysis of the chart code (does it call
  the right plot for the chart type, render it, label axes, sample rows?) and numeric
  grounding of QA answers against the data (with tolerance), rather than substring checks
- `src/pipeline.py` — orchestration: retries, logging, and on-disk output layout
- `src/utils.py` — helpers (markdown-fence stripping, robust JSON extraction)

The VLM judge returns structured per-QA verdicts (`answer_correct` / `question_relevant`),
which the pipeline aggregates into a `vlm_summary` (mean answer accuracy and relevance).

Outputs are written under `--output-dir` (default `generated/`):

```
generated/
├── cohere_chart_datasets/   # rendered chart images (.png)
├── chart_code/              # the LLM-generated code for each chart type
└── qa_pairs.json            # generated QA pairs (a sample is committed)
```

> ⚠️ **Security:** the pipeline executes LLM-generated Python. That code runs in an
> isolated subprocess with a wall-clock timeout (and a CPU-time limit on POSIX), so a
> hang or crash is bounded. This is not a full security sandbox — the code still has
> normal filesystem/network access — so only run it on data and prompts you trust.
> (The web app runs generated code in the browser via Pyodide, which is sandboxed.)

### Building the publishable dataset

`build_hf_dataset.py` assembles a **multi-domain chart-QA dataset with verifiable
labels**. For each source it renders charts deterministically and generates
ground-truth QA over the *same* slice, so every answer is answerable from the
image and correct by construction — entirely offline, no API key.

```bash
pip install -r requirements-dataset.txt

# download the CC BY 4.0 sources into data/sources/ first (see DATASET_CARD.md):
#   owid-co2-data.csv · online_retail.csv · listings.csv
python build_hf_dataset.py --source-dir data/sources --out generated/hf \
    --charts-per-domain 600 --qa-per-chart 7 --seed 0

# assemble a Hugging Face dataset (train/test) and optionally publish:
python build_hf_dataset.py --source-dir data/sources --hf-out generated/hf_dataset \
    --push <user>/<dataset-name>
```

Sources (all **CC BY 4.0**): Our World in Data (climate), UCI Online Retail
(e-commerce), Inside Airbnb (housing). See [`DATASET_CARD.md`](DATASET_CARD.md)
for the full card, schema, attribution, and limitations.

---

## Project structure

```
app/            Next.js web app (chat UI, in-browser Pyodide chart execution)
src/            Python research pipeline (generation, evaluation, metrics, pipeline, utils)
data/           Sample source datasets (COVID-19)
generated/      Pipeline outputs (chart images are git-ignored; qa_pairs.json kept as a sample)
images/         README assets (pipeline diagram, demo GIFs)
main.py         Pipeline CLI entrypoint (charts / qa / evaluate / run)
```

## Tech stack

- **App:** Next.js 15, React 19, TypeScript, Tailwind CSS, Pyodide (in-browser Python)
- **Pipeline:** Python, pandas, matplotlib, seaborn
- **Models:** Cohere `command-a-03-2025` (code + QA), `command-a-vision-07-2025` (VLM judge)
  - *Historical note:* this project was built for the Aya Expedition using Aya Vision
    (`c4ai-aya-vision-8b/32b`). Those models have since been sunset by Cohere, so the
    default judge is the maintained successor. Override with `--vlm-model`.

## Development

```bash
pip install -r requirements-dev.txt   # runtime deps + pytest + ruff

pytest                                 # run the test suite (no API key needed)
ruff check .                           # lint the Python code
```

CI (GitHub Actions) runs the Python lint + tests and the web app's lint + build
on every push and pull request — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Roadmap

This project is being hardened from a hackathon prototype toward a polished open-source tool. Planned work:

- [x] Remove hardcoded API keys; load from environment / `.env`
- [x] Stop committing generated images; pin Python dependencies
- [x] Turn the pipeline into a configurable CLI (no more editing globals)
- [x] Isolate generated code in a subprocess with a timeout (`exec()` hardening)
- [x] Tests (pytest) and CI (lint + tests for Python, lint + build for the web app)
- [x] Refactor the large `AiMessage` component into focused hooks/components
- [x] Replace substring-based evaluation heuristics with AST analysis, numeric
      grounding, and a structured VLM judge
- [x] Generate ground-truth QA labels programmatically (computed from data, not
      LLM-guessed) so the dataset's answers are verifiable
- [x] Multi-domain dataset builder (`build_hf_dataset.py`) + dataset card, with
      deterministic rendering so QA is answerable from the image
- [ ] Publish the built dataset to Hugging Face (run the builder on the CC-BY sources)
- [ ] Research track: external benchmark + a VLM fine-tune showing gains from
      the synthetic data (the experiment that would make this a paper)

## Team

- **Dante Lok** — Project Lead — [LinkedIn](https://www.linkedin.com/in/dante-lok-2a09a5146/)
- **Avneet Kaur** — [LinkedIn](https://www.linkedin.com/in/avneetkaur97/)
- **Reuben Chagas Fernandes** — [LinkedIn](https://www.linkedin.com/in/reuben-chagas-fernandes/)

## License

Released under the [MIT License](LICENSE) — free to use, modify, and distribute.

Note: the sample data under `data/` (Johns Hopkins COVID-19 dataset) is provided by
its original authors under their own terms; the MIT license covers this project's code.
