import { NextResponse } from 'next/server';
import { CohereClientV2 } from 'cohere-ai';

export async function POST(request: Request) {
  try {
    const { data, prompt } = await request.json();

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
          content: `Generate Python code to create a chart using the following data and requirements:
          Data: ${JSON.stringify(data)}
          Requirements: ${prompt}
          Please write a matplotlib python code.`
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