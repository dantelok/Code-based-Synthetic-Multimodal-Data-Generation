import { NextResponse } from 'next/server';
import { CohereClientV2 } from 'cohere-ai';

const MAX_RETRIES = 3;

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

    // If no prompt is provided, generate Q&A pairs
    const defaultPrompt = 
      `Generate around 3-5 different question-answer pairs about this image. Return the response strictly in the following JSON format:
      {
        "qa_pairs": [
          {
            "question": "What is shown in this image?",
            "answer": "The image shows..."
          },
          ...
        ]
      }
      Make sure the response is valid JSON and each question is unique and insightful.`;

    let response_text = '';
    let attempts = 0;

    while (attempts < MAX_RETRIES) {
      try {
        const response = await cohere.chat({
          model: 'c4ai-aya-vision-32b',
          messages: [
            {
              role: 'user',
              content: [
                {
                  "type": "text",
                  "text": defaultPrompt
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

        response_text = response.message?.content?.[0]?.text || '';
        console.log(response_text);
        // If it's a Q&A response, try to parse it as JSON
        if (!prompt) {
          // Clean up the response text
          const cleanedText = response_text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
          
          // Try to parse as JSON
          const parsed = JSON.parse(cleanedText);
          
          // If we get here, the JSON is valid
          response_text = JSON.stringify(parsed);
          break; // Success! Exit retry loop
        } else {
          break; // For regular prompts, no need to retry
        }
      } catch {
        attempts++;
        if (attempts === MAX_RETRIES) {
          throw new Error('Failed to generate valid Q&A pairs after multiple attempts');
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

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