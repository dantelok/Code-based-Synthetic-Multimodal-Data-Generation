import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import json

from matplotlib.colors import LinearSegmentedColormap

from src.evaluation import evaluate_charts, evaluate_qa_pairs, vlm_evaluation
from src.generation import generate_code_block, generate_qa_pairs
from src.utils import clean_code_block

chart_type = ["Radar Chart", "Bar Chart", "Pie Chart", "Line Chart"]  # Change this value dynamically
file_path = './data/covid-19-dataset/usa_county_wise.csv'
batch_size = 32
output_size = 8
clean_code = None
# qa_pairs = None
MAX_RETRIES = 10

# Load the CSV file
file_path = f'{file_path}'
df = pd.read_csv(file_path)

# for attempt in range(1, MAX_RETRIES + 1):
#     try:
#         print(f"🟡 Attempt {attempt}")
#
#         # Generate new code from Cohere
#         raw_code = generate_code_block(file_path, chart_type, batch_size, output_size)
#
#         # Clean markdown formatting (```python ... ```)
#         clean_code = clean_code_block(raw_code)
#
#         print(f"Clean code: {clean_code}")
#
#         # Execute the code (safely)
#         local_scope = {"batch_size": batch_size}
#         exec(clean_code, globals(), local_scope)
#
#         print("✅ Code ran successfully.")
#         break
#
#     except Exception as e:
#         print(f"❌ Error on attempt {attempt}: {e}")
#
#         if attempt == MAX_RETRIES:
#             print("❗ Max retries reached. Aborting.")
#         else:
#             print("🔁 Retrying with a new generation...")


# # Dynamically inspect column types
# numeric_cols = df.select_dtypes(include=['int64', 'float64']).columns.tolist()
# categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
# datetime_cols = df.select_dtypes(include=['datetime64']).columns.tolist()
#
#
# print("Generating QA pairs...")
# for attempt in range(1, MAX_RETRIES + 1):
#     try:
#         print(f"🟡 Attempt {attempt}")
#
#         # Generate new code from Cohere
#         output_str = generate_qa_pairs(df, batch_size, output_size)
#
#         # Remove triple backticks or markdown formatting if present
#         output_str = output_str.strip().strip("```json").strip("```").strip()
#
#         # print(f"Output JSON: {output_str}")
#
#         # Convert to Python object
#         qa_pairs = json.loads(output_str)
#
#         # Print output
#         for qa in qa_pairs:
#             print("Q:", qa["question"])
#             print("A:", qa["answer"])
#
#         # Save qa_pairs to json
#         json.dump(qa_pairs, open("./generated/qa_pairs.json", "w"), indent=4)
#
#         print("✅ QA data generated successfully.")
#         break  # Success! Exit retry loop
#
#     except Exception as e:
#         print(f"❌ Error on attempt {attempt}: {e}")
#
#         if attempt == MAX_RETRIES:
#             print("❗ Max retries reached. Aborting.")
#         else:
#             print("🔁 Retrying with a new generation...")


print("Running Evaluation...")
# Chart evaluation
# # chart_code = generate_code_block(file_path, "bar", 10, 3)
# chart_eval = evaluate_charts(file_path, "bar", 8, 3, clean_code)
# print(json.dumps(chart_eval, indent=2))
#
# # QA pair evaluation
# # qa_pairs = generate_qa_pairs(df, 10, 3)
# qa_eval = evaluate_qa_pairs(file_path, 8, 8, qa_pairs)
# print(json.dumps(qa_eval, indent=2))

# VLM as a judge
with open('./generated/qa_pairs.json', "rb") as f:
    qa_pairs = json.load(f)

vlm_evaluation(file_path, 8, './generated/cohere_chart_datasets/', qa_pairs)
