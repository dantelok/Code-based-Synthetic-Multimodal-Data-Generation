import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import json
from typing import List, Dict

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

        # Execute the generated code in a controlled environment
        local_vars = {'file_path': csv_path, 'chart_type': chart_type, 'batch_size': batch_size, 'output_size': output_size}
        exec(generated_code, {'pd': pd, 'np': np, 'plt': plt, 'sns': sns}, local_vars)

        # Correctness: Check if the chart type matches the implementation
        correctness_score = 0
        if chart_type in ['bar', 'pie', 'treemap', 'donut'] and 'value_counts' in generated_code:
            correctness_score += 0.5
        if chart_type in ['scatter', 'line', 'radar', 'heatmap'] and any(x in generated_code for x in ['scatterplot', 'lineplot', 'heatmap']):
            correctness_score += 0.5
        if chart_type in ['box', 'violin'] and any(x in generated_code for x in ['boxplot', 'violinplot']):
            correctness_score += 0.5
        if chart_type == 'time_series' and 'lineplot' in generated_code and 'datetime' in generated_code:
            correctness_score += 0.5
        if 'plt.show()' in generated_code:
            correctness_score += 0.5
        evaluation["correctness"] = correctness_score

        # Completeness: Check for labels, titles, and legends
        completeness_score = 0
        if 'plt.title' in generated_code:
            completeness_score += 0.3
        if 'plt.xlabel' in generated_code:
            completeness_score += 0.3
        if 'plt.ylabel' in generated_code:
            completeness_score += 0.3
        if 'plt.legend' in generated_code or 'autopct' in generated_code:
            completeness_score += 0.1
        evaluation["completeness"] = min(completeness_score, 1.0)

        # Diversity: Check if random sampling is used and different columns are plotted
        diversity_score = 0
        if 'random.choice' in generated_code or 'sample' in generated_code:
            diversity_score += 0.5
        if len(numeric_cols) > 2 or len(categorical_cols) > 2:
            diversity_score += 0.5  # Potential for diverse column usage
        evaluation["diversity"] = diversity_score

        evaluation["comments"].append("Chart generation executed successfully.")

    except Exception as e:
        evaluation["comments"].append(f"Error executing chart code: {str(e)}")

    return evaluation


def evaluate_qa_pairs(csv_path: str, batch_size: int, output_size: int, qa_pairs: dict) -> Dict:
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

        # Correctness: Verify answers align with the data
        correct_count = 0
        for pair in qa_pairs:
            question = pair.get("question", "")
            answer = pair.get("answer", "")

            # Basic check: Ensure question and answer are non-empty
            if not question or not answer:
                evaluation["comments"].append("Empty question or answer detected.")
                continue

            # Check if answer can be verified against the data
            # For simplicity, assume factual questions reference specific values
            for col in df.columns:
                if col in question.lower() and any(str(val) in answer for val in df[col].astype(str)):
                    correct_count += 1
                    break

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

    except json.JSONDecodeError:
        evaluation["comments"].append("Invalid JSON format for QA pairs.")
    except Exception as e:
        evaluation["comments"].append(f"Error evaluating QA pairs: {str(e)}")

    return evaluation
