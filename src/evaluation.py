import base64
import json
import os
from typing import Dict, List

import cohere
import pandas as pd

from src.metrics import (
    extract_call_names,
    extract_numbers,
    numbers_match,
    score_chart_completeness,
    score_chart_correctness,
    score_chart_diversity,
)
from src.utils import extract_json

DEFAULT_VLM_MODEL = "command-a-vision-07-2025"


def evaluate_charts(csv_path: str, chart_type: str, batch_size: int, output_size: int, generated_code: str) -> Dict:
    """
    Evaluates the generated chart code for correctness, completeness, and diversity.

    Args:
        csv_path (str): Path to the CSV file.
        chart_type (str): Type of chart (e.g., 'bar', 'scatter', 'time_series').
        batch_size (int): Number of rows to sample for each chart.
        output_size (int): Number of charts to generate.
        generated_code (str): The generated Python code for chart creation.

    Returns:
        Dict: Evaluation results with scores and comments.
    """
    evaluation = {
        "correctness": 0.0,
        "completeness": 0.0,
        "diversity": 0.0,
        "comments": []
    }

    try:
        # Load the dataset
        df = pd.read_csv(csv_path)
        numeric_cols = df.select_dtypes(include=['int64', 'float64']).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        datetime_cols = df.select_dtypes(include=['datetime64']).columns.tolist()

        # Check if chart type is supported and data is sufficient
        chart_requirements = {
            'bar': len(categorical_cols) > 0,
            'pie': len(categorical_cols) > 0,
            'treemap': len(categorical_cols) > 0,
            'donut': len(categorical_cols) > 0,
            'scatter': len(numeric_cols) >= 2,
            'line': len(numeric_cols) >= 2,
            'radar': len(numeric_cols) >= 2,
            'heatmap': len(numeric_cols) >= 2,
            'box': len(numeric_cols) > 0 and len(categorical_cols) > 0,
            'violin': len(numeric_cols) > 0 and len(categorical_cols) > 0,
            'time_series': len(datetime_cols) > 0 and len(numeric_cols) > 0
        }

        if chart_type not in chart_requirements:
            evaluation["comments"].append(f"Unsupported chart type: {chart_type}")
            return evaluation

        if not chart_requirements.get(chart_type, False):
            evaluation["comments"].append(f"Insufficient columns for {chart_type} chart.")
            return evaluation

        # Statically analyse the generated code by the calls it makes (no exec:
        # the pipeline already renders the chart in a sandboxed subprocess).
        try:
            calls = extract_call_names(generated_code)
        except SyntaxError as exc:
            evaluation["comments"].append(f"Generated code does not parse: {exc}")
            return evaluation

        evaluation["correctness"] = score_chart_correctness(calls, chart_type)
        evaluation["completeness"] = score_chart_completeness(calls, generated_code)
        evaluation["diversity"] = score_chart_diversity(calls, len(numeric_cols), len(categorical_cols))
        evaluation["comments"].append("Chart code analysed successfully.")

    except Exception as e:
        evaluation["comments"].append(f"Error evaluating chart code: {str(e)}")

    return evaluation


def evaluate_qa_pairs(csv_path: str, batch_size: int, output_size: int, qa_pairs: list) -> Dict:
    """
    Evaluates the generated QA pairs for correctness, diversity, and relevance.

    Args:
        csv_path (str): Path to the CSV file.
        batch_size (int): Number of rows sampled for QA generation.
        output_size (int): Number of QA pairs generated.
        generated_qa_pairs (str): JSON string containing the QA pairs.

    Returns:
        Dict: Evaluation results with scores and comments.
    """
    evaluation = {
        "correctness": 0.0,
        "diversity": 0.0,
        "relevance": 0.0,
        "comments": []
    }

    try:
        # Load the dataset
        df = pd.read_csv(csv_path).head(batch_size)

        # Parse the generated QA pairs
        # qa_pairs = json.loads(generated_qa_pairs)
        if len(qa_pairs) != output_size:
            evaluation["comments"].append(f"Expected {output_size} QA pairs, got {len(qa_pairs)}.")
            return evaluation

        # Correctness: ground each answer against the data. Prefer numeric
        # matching (with tolerance) against the column(s) the question refers to,
        # and fall back to string containment for non-numeric answers.
        correct_count = 0
        for pair in qa_pairs:
            question = pair.get("question", "")
            answer = pair.get("answer", "")

            # Basic check: Ensure question and answer are non-empty
            if not question or not answer:
                evaluation["comments"].append("Empty question or answer detected.")
                continue

            answer_numbers = extract_numbers(answer)
            referenced_cols = [c for c in df.columns if c.lower() in question.lower()]
            cols_to_check = referenced_cols or list(df.columns)

            matched = False
            for col in cols_to_check:
                col_values = df[col].astype(str).tolist()
                col_numbers = extract_numbers(" ".join(col_values))
                if answer_numbers and numbers_match(answer_numbers, col_numbers):
                    matched = True
                    break
                if col.lower() in question.lower() and any(v in answer for v in col_values):
                    matched = True
                    break
            if matched:
                correct_count += 1

        evaluation["correctness"] = (correct_count / output_size) if output_size > 0 else 0.0

        # Diversity: Check variety in question types
        question_types = set()
        for pair in qa_pairs:
            question = pair["question"].lower()
            if any(word in question for word in ["what", "which"]):
                question_types.add("factual")
            if any(word in question for word in ["why", "how"]):
                question_types.add("inferential")
            if question.startswith(("is", "are", "does")):
                question_types.add("boolean")
            if any(word in question for word in ["compare", "difference"]):
                question_types.add("comparative")
            if any(word in question for word in ["describe", "summary"]):
                question_types.add("descriptive")

        evaluation["diversity"] = len(question_types) / 5.0  # 5 possible types

        # Relevance: Check if questions reference specific columns or rows
        relevant_count = 0
        for pair in qa_pairs:
            question = pair["question"].lower()
            if any(col.lower() in question for col in df.columns):
                relevant_count += 1
            elif any(str(val).lower() in question for val in df.values.flatten()):
                relevant_count += 1

        evaluation["relevance"] = (relevant_count / output_size) if output_size > 0 else 0.0

        evaluation["comments"].append("QA pairs evaluated successfully.")

    except Exception as e:
        evaluation["comments"].append(f"Error evaluating QA pairs: {str(e)}")

    return evaluation


def vlm_evaluation(
    csv_path: str,
    batch_size: int,
    image_folder: str,
    qa_pairs: list,
    model: str = DEFAULT_VLM_MODEL,
) -> List[Dict]:
    """
    Evaluate multiple chart images against a shared set of QA pairs using Aya Vision.

    Args:
        csv_path (str): Path to the CSV data source.
        batch_size (int): Number of rows to load (for context; optional).
        image_folder (str): Path to folder containing chart images.
        qa_pairs (list): List of {'question': str, 'answer': str} dicts.
        model (str): Cohere vision model to use as the judge.

    Returns:
        List[Dict]: One record per chart image. On a successful judge response::

            {
                "image": str,
                "verdicts": [
                    {"question": str, "answer_correct": bool,
                     "question_relevant": bool, "justification": str},
                    ...
                ],
                "chart_issues": str,
                "answer_accuracy": float,   # fraction of answers judged correct
                "relevance": float,         # fraction of questions judged relevant
            }

        If the judge response can't be parsed as JSON, the record instead
        carries ``{"image": str, "raw": str, "error": str}``.
    """
    # Initialize Cohere client from the COHERE_API_KEY environment variable
    from src.generation import ensure_api_key

    co = cohere.ClientV2(api_key=ensure_api_key())

    # A compact sample of the source data for context (a full dataframe dump
    # bloats the prompt and can make the model return no valid response).
    df = pd.read_csv(csv_path).head(batch_size)
    data_context = df.head(5).to_markdown(index=False)

    # Load all image files
    image_files = sorted([
        f for f in os.listdir(image_folder)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ])

    # Format QA pairs for prompt
    qa_block = "\n".join([
        f"Q: {pair['question']}\nA: {pair['answer']}"
        for pair in qa_pairs
    ])

    # Loop through each image
    results: List[Dict] = []
    for img_file in image_files:
        img_path = os.path.join(image_folder, img_file)
        mime = "image/png" if img_file.lower().endswith(".png") else "image/jpeg"

        with open(img_path, "rb") as f:
            base64_image_url = f"data:{mime};base64,{base64.b64encode(f.read()).decode('utf-8')}"

        # Build prompt — ask for machine-readable JSON so verdicts can be scored.
        prompt = f"""
        You are an expert in data visualization and question-answer validation.

        You are shown a chart (image), and a set of QA pairs that are claimed to be derived from that chart.
        For context, here is a sample of the source data the chart was generated from:

        {data_context}

        For each QA pair, decide from the chart:
        - is the answer correct?
        - is the question relevant to the chart?

        QA pairs:

        {qa_block}

        Respond with ONLY a JSON object of exactly this shape (no prose, no markdown):
        {{
          "verdicts": [
            {{"question": "<the question>", "answer_correct": true, "question_relevant": true, "justification": "<brief>"}}
          ],
          "chart_issues": "<any missing data or misleading visuals, or empty string>"
        }}
        """

        # Call Cohere API (one bad image should not abort the whole run).
        try:
            response = co.chat(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": base64_image_url}},
                        ],
                    }
                ],
            )
            evaluation_text = response.message.content[0].text
        except Exception as exc:  # noqa: BLE001 - keep going across images
            results.append({"image": img_file, "raw": "", "error": str(exc)})
            print(f"\n\n=== Evaluation for {img_file} ===\nERROR: {exc}")
            continue

        # Parse the structured verdicts; fall back to raw text if it isn't JSON.
        try:
            parsed = extract_json(evaluation_text)
            verdicts = parsed.get("verdicts", []) if isinstance(parsed, dict) else []
            n = len(verdicts) or 1
            record = {
                "image": img_file,
                "verdicts": verdicts,
                "chart_issues": parsed.get("chart_issues", "") if isinstance(parsed, dict) else "",
                "answer_accuracy": sum(1 for v in verdicts if v.get("answer_correct")) / n,
                "relevance": sum(1 for v in verdicts if v.get("question_relevant")) / n,
            }
        except (ValueError, AttributeError) as exc:
            record = {"image": img_file, "raw": evaluation_text, "error": f"unparseable judge response: {exc}"}

        print(f"\n\n=== Evaluation for {img_file} ===")
        print(json.dumps(record, indent=2, default=str))
        results.append(record)

    return results
