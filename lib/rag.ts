import { GoogleGenerativeAI } from '@google/generative-ai';
import { createEmbedding } from './embeddings-openai';
import { searchBibleChunks, getActiveSystemPrompt } from './db';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is not set');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = 'gemini-pro'; // Stable model that works

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RAGResponse {
  answer: string;
  sources: Array<{
    book: string;
    chapter: number;
    verse: number;
    content: string;
  }>;
}

export async function generateRAGResponse(
  userQuery: string,
  conversationHistory: ChatMessage[] = []
): Promise<RAGResponse> {
  try {
    // 1. Create embedding for user query
    const queryEmbedding = await createEmbedding(userQuery);

    // 2. Search for relevant Bible chunks using pgvector
    const relevantChunks = await searchBibleChunks(queryEmbedding, 5);

    // 3. Build context from relevant chunks
    const context = relevantChunks
      .map((chunk, idx) => {
        return `[${idx + 1}] ${chunk.book} ${chunk.chapter}:${chunk.verse}\n${chunk.content}`;
      })
      .join('\n\n');

    // 4. Get active system prompt
    const systemPrompt = await getActiveSystemPrompt();

    // 5. Build full prompt with context
    const fullPrompt = `${systemPrompt}

KONTEXT Z BIBLE 21:
${context}

DŮLEŽITÉ:
- Odpovídej POUZE na základě výše uvedeného kontextu
- Vždy cituj konkrétní knihu, kapitolu a verš
- Pokud odpověď není v kontextu, řekni to upřímně

HISTORIE KONVERZACE:
${conversationHistory.map(msg => `${msg.role === 'user' ? 'Uživatel' : 'Asistent'}: ${msg.content}`).join('\n')}

DOTAZ UŽIVATELE:
${userQuery}

ODPOVĚĎ:`;

    // 6. Call Gemini API
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(fullPrompt);
    const answer = result.response.text();

    // 7. Return response with sources
    return {
      answer,
      sources: relevantChunks.map(chunk => ({
        book: chunk.book,
        chapter: chunk.chapter,
        verse: chunk.verse,
        content: chunk.content,
      })),
    };
  } catch (error) {
    console.error('RAG pipeline error:', error);
    throw new Error('Failed to generate response');
  }
}

// Streaming version for real-time responses
export async function* generateRAGResponseStream(
  userQuery: string,
  conversationHistory: ChatMessage[] = []
): AsyncGenerator<string, void, unknown> {
  try {
    // 1-3. Same as above
    const queryEmbedding = await createEmbedding(userQuery);
    const relevantChunks = await searchBibleChunks(queryEmbedding, 5);
    const context = relevantChunks
      .map((chunk, idx) => {
        return `[${idx + 1}] ${chunk.book} ${chunk.chapter}:${chunk.verse}\n${chunk.content}`;
      })
      .join('\n\n');

    const systemPrompt = await getActiveSystemPrompt();
    const fullPrompt = `${systemPrompt}

KONTEXT Z BIBLE 21:
${context}

DŮLEŽITÉ:
- Odpovídej POUZE na základě výše uvedeného kontextu
- Vždy cituj konkrétní knihu, kapitolu a verš
- Pokud odpověď není v kontextu, řekni to upřímně

HISTORIE KONVERZACE:
${conversationHistory.map(msg => `${msg.role === 'user' ? 'Uživatel' : 'Asistent'}: ${msg.content}`).join('\n')}

DOTAZ UŽIVATELE:
${userQuery}

ODPOVĚĎ:`;

    // 4. Stream response from Gemini
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContentStream(fullPrompt);

    // 5. Yield chunks as they arrive
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      yield chunkText;
    }
  } catch (error) {
    console.error('RAG streaming error:', error);
    throw new Error('Failed to generate streaming response');
  }
}
