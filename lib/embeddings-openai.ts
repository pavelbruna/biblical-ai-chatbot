// OpenAI Embeddings Client
// Using text-embedding-3-small model with 1536 dimensions

// Load environment variables (server-side only)
if (typeof window === 'undefined') {
  try {
    require('dotenv').config({ path: '.env.local' });
  } catch (e) {
    // dotenv not available or already loaded
  }
}

import OpenAI from 'openai';

const OPENAI_MODEL = 'text-embedding-3-small';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: OPENAI_MODEL,
      input: text,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding returned from OpenAI');
    }

    return response.data[0].embedding;
  } catch (error) {
    console.error('Failed to create embedding:', error);
    throw error;
  }
}

export async function createBatchEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    // OpenAI supports up to 2048 inputs per request
    const response = await openai.embeddings.create({
      model: OPENAI_MODEL,
      input: texts,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embeddings returned from OpenAI');
    }

    // Sort by index to maintain order
    return response.data
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
