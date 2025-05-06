import matplotlib.pyplot as plt
import numpy as np
import json
import sys
import os
from io import BytesIO
import base64

def generate_chart(data, chart_type='bar'):
    # Convert data to numpy arrays
    labels = [item['Dish Name'] for item in data]
    values = [float(item['Calories (kcal)']) for item in data]
    
    # Create figure and axis
    plt.figure(figsize=(10, 6))
    
    if chart_type == 'bar':
        plt.bar(labels, values, color='skyblue')
    elif chart_type == 'line':
        plt.plot(labels, values, marker='o', color='skyblue')
    elif chart_type == 'pie':
        plt.pie(values, labels=labels, autopct='%1.1f%%')
    
    # Customize the chart
    plt.title('Calories in Different Dishes')
    plt.xlabel('Dish Name')
    plt.ylabel('Calories (kcal)')
    plt.xticks(rotation=45)
    plt.tight_layout()
    
    # Save the chart to a BytesIO object
    buffer = BytesIO()
    plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight')
    buffer.seek(0)
    
    # Convert to base64
    image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    plt.close()
    
    return image_base64

if __name__ == "__main__":
    # Read data from stdin
    data = json.loads(sys.stdin.read())
    
    # Generate chart
    chart_image = generate_chart(data)
    
    # Output the base64 image
    print(json.dumps({"image": chart_image})) 