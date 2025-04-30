import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import json

from matplotlib.colors import LinearSegmentedColormap

from src.evaluation import evaluate_charts, evaluate_qa_pairs
from src.generation import generate_code_block, generate_qa_pairs
from src.utils import clean_code_block

chart_type = ["Radar Chart", "Bar Chart", "Pie Chart", "Line Chart"]  # Change this value dynamically
file_path = './data/covid-19-dataset/usa_county_wise.csv'
batch_size = 32
output_size = 8
clean_code = None
qa_pairs = None
MAX_RETRIES = 10

for attempt in range(1, MAX_RETRIES + 1):
    try:
        print(f"🟡 Attempt {attempt}")

        # Generate new code from Cohere
        raw_code = generate_code_block(file_path, chart_type, batch_size, output_size)

        # Clean markdown formatting (```python ... ```)
        clean_code = clean_code_block(raw_code)

        print(f"Clean code: {clean_code}")

        # Execute the code (safely)
        local_scope = {"batch_size": batch_size}
        exec(clean_code, globals(), local_scope)

        print("✅ Code ran successfully.")
        break  # Success! Exit retry loop

    except Exception as e:
        print(f"❌ Error on attempt {attempt}: {e}")

        if attempt == MAX_RETRIES:
            print("❗ Max retries reached. Aborting.")
        else:
            print("🔁 Retrying with a new generation...")


# Load the CSV file
file_path = f'{file_path}'
df = pd.read_csv(file_path)

# Dynamically inspect column types
numeric_cols = df.select_dtypes(include=['int64', 'float64']).columns.tolist()
categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
datetime_cols = df.select_dtypes(include=['datetime64']).columns.tolist()

# # Function to generate random charts based on chart type
# def generate_chart(df, chart_type, batch_size):
#     if chart_type in ['bar', 'pie', 'treemap', 'donut']:
#         if categorical_cols:
#             cat_col = categorical_cols[0]
#             value_counts = df[cat_col].value_counts()
#             plt.figure(figsize=(10, 6))
#             if chart_type == 'bar':
#                 sns.barplot(x=value_counts.index, y=value_counts.values)
#                 plt.title(f'Bar Chart of {cat_col}')
#             elif chart_type == 'pie':
#                 plt.pie(value_counts.values, labels=value_counts.index, autopct='%1.1f%%')
#                 plt.title(f'Pie Chart of {cat_col}')
#             plt.xlabel(cat_col)
#             plt.ylabel('Count')
#             plt.show()
#         else:
#             print("No categorical columns available for this chart type.")
#
#     elif chart_type in ['scatter', 'line', 'radar', 'heatmap']:
#         if len(numeric_cols) >= 2:
#             num_col1 = numeric_cols[0]
#             num_col2 = numeric_cols[1]
#             plt.figure(figsize=(10, 6))
#             if chart_type == 'scatter':
#                 sns.scatterplot(x=df[num_col1], y=df[num_col2])
#                 plt.title(f'Scatter Plot of {num_col1} vs {num_col2}')
#             elif chart_type == 'line':
#                 sns.lineplot(x=df.index, y=df[num_col1], label=num_col1)
#                 sns.lineplot(x=df.index, y=df[num_col2], label=num_col2)
#                 plt.title(f'Line Plot of {num_col1} and {num_col2}')
#             elif chart_type == 'heatmap':
#                 corr_matrix = df[[num_col1, num_col2]].corr()
#                 sns.heatmap(corr_matrix, annot=True, cmap='coolwarm')
#                 plt.title(f'Heatmap of Correlation between {num_col1} and {num_col2}')
#             plt.xlabel(num_col1)
#             plt.ylabel(num_col2)
#             plt.legend()
#             plt.show()
#         else:
#             print("Insufficient numeric columns available for this chart type.")
#
#     elif chart_type in ['box', 'violin']:
#         if len(numeric_cols) > 0 and len(categorical_cols) > 0:
#             num_col = numeric_cols[0]
#             cat_col = categorical_cols[0]
#             plt.figure(figsize=(10, 6))
#             if chart_type == 'box':
#                 sns.boxplot(x=cat_col, y=num_col, data=df)
#                 plt.title(f'Box Plot of {num_col} by {cat_col}')
#             elif chart_type == 'violin':
#                 sns.violinplot(x=cat_col, y=num_col, data=df)
#                 plt.title(f'Violin Plot of {num_col} by {cat_col}')
#             plt.xlabel(cat_col)
#             plt.ylabel(num_col)
#             plt.show()
#         else:
#             print("Insufficient columns available for this chart type.")
#
#     elif chart_type == 'time_series':
#         if datetime_cols and numeric_cols:
#             dt_col = datetime_cols[0]
#             num_col = numeric_cols[0]
#             plt.figure(figsize=(10, 6))
#             sns.lineplot(x=df[dt_col], y=df[num_col])
#             plt.title(f'Time Series Plot of {num_col} over {dt_col}')
#             plt.xlabel(dt_col)
#             plt.ylabel(num_col)
#             plt.show()
#         else:
#             print("Insufficient columns available for time series plot.")
#
#     else:
#         print("Unsupported chart type.")

# Generate {output_size} charts with random batch_size rows
# output_size = 3
# chart_type = f'{chart_type}'

# for _ in range(output_size):
#     random_rows = np.random.choice(df.index, size=batch_size, replace=False)
#     random_df = df.loc[random_rows]
#     generate_chart(random_df, chart_type, batch_size)


print("Generating QA pairs...")
for attempt in range(1, MAX_RETRIES + 1):
    try:
        print(f"🟡 Attempt {attempt}")

        # Generate new code from Cohere
        output_str = generate_qa_pairs(df, batch_size, output_size)

        # Remove triple backticks or markdown formatting if present
        output_str = output_str.strip().strip("```json").strip("```").strip()

        # print(f"Output JSON: {output_str}")

        # Convert to Python object
        qa_pairs = json.loads(output_str)

        # Print output
        for qa in qa_pairs:
            print("Q:", qa["question"])
            print("A:", qa["answer"])

        # Save qa_pairs to json
        json.dump(qa_pairs, open("./generated/qa_pairs.json", "w"), indent=4)

        print("✅ QA data generated successfully.")
        break  # Success! Exit retry loop

    except Exception as e:
        print(f"❌ Error on attempt {attempt}: {e}")

        if attempt == MAX_RETRIES:
            print("❗ Max retries reached. Aborting.")
        else:
            print("🔁 Retrying with a new generation...")


print("Running Evaluation...")
# Chart evaluation
# chart_code = generate_code_block(file_path, "bar", 10, 3)
chart_eval = evaluate_charts(file_path, "bar", 8, 3, clean_code)
print(json.dumps(chart_eval, indent=2))

# QA pair evaluation
# qa_pairs = generate_qa_pairs(df, 10, 3)
qa_eval = evaluate_qa_pairs(file_path, 10, 8, qa_pairs)
print(json.dumps(qa_eval, indent=2))
