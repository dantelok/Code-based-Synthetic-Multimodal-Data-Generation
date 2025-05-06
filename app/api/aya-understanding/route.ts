import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    const COHERE_API_KEY = process.env.COHERE_API_KEY;
    
    if (!COHERE_API_KEY) {
      throw new Error('Cohere API key not found');
    }

    const response = await fetch('https://api.cohere.ai/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'command',
        messages: [
          {
            role: 'user',
            content: prompt || 'Hello'
          }
        ]
      })
    });

    const data = await response.json();
    const response_text = data.message?.content?.[0]?.text || '';

    return NextResponse.json({
      response: response_text
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 