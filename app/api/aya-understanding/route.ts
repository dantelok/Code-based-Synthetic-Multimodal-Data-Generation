import { NextResponse } from 'next/server';
import { CohereClientV2 } from 'cohere-ai';

export async function POST(request: Request) {
  try {
    const { prompt, imageBase64 } = await request.json();

    const COHERE_API_KEY = process.env.COHERE_API_KEY;
    
    if (!COHERE_API_KEY) {
      throw new Error('Cohere API key not found');
    }

    const cohere = new CohereClientV2({
      token: COHERE_API_KEY,
    });

    // Format the image as a data URI
    const imageDataUri = `data:image/jpeg;base64,${imageBase64}`;

    const response = await cohere.chat({
      model: 'c4ai-aya-vision-8b',
      messages: [
        {
          role: 'user',
          content: [
            {
              "type": "text",
              "text": `${prompt} `
            },
            {
              "type": "image_url",
              "imageUrl": {
                "url": imageDataUri
              }
            }
          ],
        },
      ],
    });

    const response_text = response.message?.content?.[0]?.text || '';

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