import { NextResponse } from 'next/server';
import { CohereClientV2 } from 'cohere-ai';

export async function POST(request: Request) {
  try {
    const { data, prompt, chartType, chartSize } = await request.json();

    const COHERE_API_KEY = process.env.COHERE_API_KEY;
    
    if (!COHERE_API_KEY) {
      throw new Error('Cohere API key not found');
    }

    const cohere = new CohereClientV2({
      token: COHERE_API_KEY,
    });

    // Call Cohere API to generate Python code for chart
    const response = await cohere.chat({
      model: 'command-a-03-2025',
      messages: [
        {
          role: 'user',
          content: `Generate Python code to create a matplotlib chart using the following data and requirements:

Data: ${JSON.stringify(data)}
Requirements: ${prompt}
Chart Type: ${chartType}
Chart Size: ${chartSize} (scale from 0-10, where 0 is smallest and 10 is largest)

Your generated code must:

1. Use the headless Agg backend by including the following at the top:
   "import matplotlib
   matplotlib.use('Agg')"
2. Create a ${chartType} chart using the provided data.
3. Set the figure size based on the chart size (0-10) using plt.figure(figsize=(width, height)) where:
   - For size 0-3: use small dimensions (e.g., 4x3)
   - For size 4-6: use medium dimensions (e.g., 8x6)
   - For size 7-10: use large dimensions (e.g., 12x8)
4. Do not use plt.show() or print() anywhere in the script.
5. Instead of displaying the plot, save it to an in-memory buffer using BytesIO(), then call:
"plt.savefig(buffer, format='png', bbox_inches='tight')
plt.close()"
6. Encode the buffer content using Base64 and assign it to a variable:
result = f"data:image/png;base64,{...}"
7. The last line of your script must be a bare result expression (not inside a print statement), so it can be returned directly.
Output only the complete Python script.`
        }
      ],
    });

    const generatedCode = response.message?.content?.[0]?.text || '';

    // TODO: Execute the generated Python code to create the chart
    // This would typically be done in a secure environment
    // For now, we'll return a placeholder image URL
    const chartImage = 'https://placeholder.com/chart.png';

    return NextResponse.json({
      code: generatedCode,
      image: chartImage
    });
  } catch (error) {
    console.error('Error generating chart:', error);
    return NextResponse.json(
      { error: 'Failed to generate chart' },
      { status: 500 }
    );
  }
} 