// Voyage AI Embeddings Client
// Using voyage-3-lite model with 1024 dimensions

// Load environment variables (server-side only)
if (typeof window === 'undefined') {
  try {
    require('dotenv').config({ path: '.env.local' });
  } catch (e) {
    // dotenv not available or already loaded
  }
}

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3-lite';

if (!process.env.VOYAGE_API_KEY) {
  throw new Error('VOYAGE_API_KEY environment variable is not set');
}

interface VoyageEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage AI API error: ${response.status} - ${error}`);
    }

    const data: VoyageEmbeddingResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error('No embedding returned from Voyage AI');
    }

    return data.data[0].embedding;
  } catch (error) {
    console.error('Failed to create embedding:', error);
    throw error;
  }
}

export async function createBatchEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const response = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage AI API error: ${response.status} - ${error}`);
    }

    const data: VoyageEmbeddingResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error('No embeddings returned from Voyage AI');
    }

    // Sort by index to maintain order
    return data.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);
  } catch (error) {
    console.error('Failed to create batch embeddings:', error);
    throw error;
  }
}

// Utility: Calculate cosine similarity between two embeddings
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
