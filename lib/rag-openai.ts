import OpenAI from 'openai';
import { createEmbedding } from './embeddings-openai';
import { searchBibleChunks, getActiveSystemPrompt } from './db';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'gpt-4o-mini';

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
    const queryEmbedding = await createEmbedding(userQuery);
    const relevantChunks = await searchBibleChunks(queryEmbedding, 5);
    const context = relevantChunks
      .map((chunk, idx) => {
        return `[${idx + 1}] ${chunk.book} ${chunk.chapter}:${chunk.verse}\n${chunk.content}`;
      })
      .join('\n\n');

    const systemPrompt = await getActiveSystemPrompt();
    const fullSystemPrompt = `${systemPrompt}

KONTEXT Z BIBLE 21:
${context}

DŮLEŽITÉ:
- Odpovídej POUZE na základě výše uvedeného kontextu
- Vždy cituj konkrétní knihu, kapitolu a verš
- Pokud odpověď není v kontextu, řekni to upřímně`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: fullSystemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      } as OpenAI.Chat.ChatCompletionMessageParam)),
      { role: 'user', content: userQuery }
    ];

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const answer = response.choices[0].message.content || '';

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

// Streaming version
export async function* generateRAGResponseStream(
  userQuery: string,
  conversationHistory: ChatMessage[] = []
): AsyncGenerator<string, void, unknown> {
  try {
    const queryEmbedding = await createEmbedding(userQuery);
    const relevantChunks = await searchBibleChunks(queryEmbedding, 5);
    const context = relevantChunks
      .map((chunk, idx) => {
        return `[${idx + 1}] ${chunk.book} ${chunk.chapter}:${chunk.verse}\n${chunk.content}`;
      })
      .join('\n\n');

    const systemPrompt = await getActiveSystemPrompt();
    const fullSystemPrompt = `${systemPrompt}

KONTEXT Z BIBLE 21:
${context}

DŮLEŽITÉ:
- Odpovídej POUZE na základě výše uvedeného kontextu
- Vždy cituj konkrétní knihu, kapitolu a verš
- Pokud odpověď není v kontextu, řekni to upřímně`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: fullSystemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      } as OpenAI.Chat.ChatCompletionMessageParam)),
      { role: 'user', content: userQuery }
    ];

    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    console.error('RAG streaming error:', error);
    throw new Error('Failed to generate streaming response');
  }
}
