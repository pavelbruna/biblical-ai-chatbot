// Google Gemini Embeddings Client (FREE)
// Using text-embedding-004 model with 768 dimensions

// Load environment variables (server-side only)
if (typeof window === 'undefined') {
  try {
    require('dotenv').config({ path: '.env.local' });
  } catch (e) {
    // dotenv not available or already loaded
  }
}

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_MODEL = 'text-embedding-004';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is not set');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.embedContent(text);

    if (!result.embedding || !result.embedding.values) {
      throw new Error('No embedding returned from Gemini');
    }

    return result.embedding.values;
  } catch (error) {
    console.error('Failed to create embedding:', error);
    throw error;
  }
}

export async function createBatchEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Gemini supports batch embedding
    const result = await model.batchEmbedContents({
      requests: texts.map(text => ({ content: { parts: [{ text }] } })),
    });

    if (!result.embeddings || result.embeddings.length === 0) {
      throw new Error('No embeddings returned from Gemini');
    }

    return result.embeddings.map(emb => emb.values);
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
