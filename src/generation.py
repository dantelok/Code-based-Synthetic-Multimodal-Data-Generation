import cohere

def generate_code_block(csv_path, chart_type, batch_size, output_size):
    prompt = f"""
    You are a Python code assistant. Write Python code to generate a {chart_type} using the matplotlib, seaborn library from a CSV dataset.

    Instructions:
    1. Load the CSV files '{csv_path}' using pandas.
    2. Use the variable `batch_size` (already defined) to generate {output_size} charts in {chart_type} from the dataset with random {batch_size} rows.
    3. Dynamically inspect the column types:
        - Use `df.select_dtypes(...)` to identify:
            - Numeric columns (for value-based plots)
            - Categorical columns (for count/distribution plots)
            - Datetime columns (for time series plots)
        - Do not use any identifier column(s) to generate charts.
    4. Based on the chart type:
        - For bar, pie, treemap, or donut charts: use value counts of a categorical column.
        - For scatter, line, radar, or heatmaps: use combinations of numeric columns.
        - For box or violin plots: plot numeric values grouped by a categorical column.
        - For Sankey, node, or flow charts: use 'source', 'target', and 'value' columns if available.
        - For time series: use a datetime column as x-axis and a numeric column as y-axis.
    5. Do not assume column names. Use generic column selection like `numeric_cols[0]`, `categorical_cols[0]`, etc.
    6. Add axis labels, titles, and legends where relevant.
    7. Include necessary imports, inline comments, and a final command to display or render the chart:
        - `plt.show()` for matplotlib/seaborn
    8. Use the data as random as possible, e.g. generate each chart with different rows and columns
    9. Save the chart to the path `./generated/cohere_chart_datasets/` + image_file name

    Assume:
    - The `batch_size` variable is predefined.
    - The file exists at the path {csv_path}.

    Only output clean, complete Python code.
    """

    co = cohere.ClientV2(api_key="kZxhlDFN7ExcUdVi7yurvNRH6Vc5fmeKzprefQ4W")

    response = co.chat(
        model="command-a-03-2025",
        messages=[{"role": "user", "content": prompt}],
    )

    return response.message.content[0].text


def generate_qa_pairs(df, batch_size, output_size):
    df_sample = df.head(batch_size)
    table_text = df_sample.to_markdown(index=False)

    prompt = f"""
    You are a helpful assistant that reads tabular data and generates diverse question-answer pairs from it.

    Here is a dataset sample:

    {table_text}

    Instructions:
    - Generate {output_size} natural-sounding question-answer pairs based on the data above.
    - Make the questions diverse: factual, inferential, boolean, comparative, descriptive.
    - Vary question styles and column combinations.
    - Each question should clearly relate to a specific row or pattern in the data.
    - Return the result as a JSON array with objects like:
    [
        {{"question": "...", "answer": "..."}},
        ...
    ]
    Only output the JSON data.
    """

    co = cohere.ClientV2(api_key="kZxhlDFN7ExcUdVi7yurvNRH6Vc5fmeKzprefQ4W")

    response = co.chat(
        model="command-a-03-2025",
        messages=[{"role": "user", "content": prompt}],
    )

    return response.message.content[0].text
