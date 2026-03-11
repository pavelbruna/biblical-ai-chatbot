import { neon } from '@neondatabase/serverless';

// Load environment variables
if (typeof window === 'undefined') {
  // Server-side only
  try {
    require('dotenv').config({ path: '.env.local' });
  } catch (e) {
    // dotenv not available or already loaded
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = neon(process.env.DATABASE_URL);

// Type definitions
export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: 'admin' | 'expert' | 'user';
  created_at: Date;
}

export interface BibleChunk {
  id: number;
  content: string;
  embedding: number[];
  book: string;
  chapter: number;
  verse: number;
  created_at: Date;
}

export interface Conversation {
  id: number;
  user_id: number;
  created_at: Date;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  corrected_content: string | null;
  corrected_by: number | null;
  created_at: Date;
}

export interface SystemPrompt {
  id: number;
  content: string;
  active: boolean;
  created_at: Date;
}

// Database helpers
export async function getActiveSystemPrompt(): Promise<string> {
  const result = await sql`
    SELECT content FROM system_prompts
    WHERE active = true
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (result.length === 0) {
    return 'Jsi biblický AI asistent. Odpovídej POUZE na základě poskytnutého kontextu z Bible 21.';
  }

  return result[0].content;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await sql`
    SELECT * FROM users WHERE email = ${email} LIMIT 1
  `;

  return result.length > 0 ? result[0] as User : null;
}

export async function createConversation(userId: number): Promise<number> {
  const result = await sql`
    INSERT INTO conversations (user_id)
    VALUES (${userId})
    RETURNING id
  `;

  return result[0].id;
}

export async function saveMessage(
  conversationId: number,
  role: 'user' | 'assistant',
  content: string
): Promise<number> {
  const result = await sql`
    INSERT INTO messages (conversation_id, role, content)
    VALUES (${conversationId}, ${role}, ${content})
    RETURNING id
  `;

  return result[0].id;
}

export async function correctMessage(
  messageId: number,
  correctedContent: string,
  correctedBy: number
): Promise<void> {
  await sql`
    UPDATE messages
    SET corrected_content = ${correctedContent},
        corrected_by = ${correctedBy}
    WHERE id = ${messageId}
  `;
}

export async function getConversationMessages(conversationId: number): Promise<Message[]> {
  const result = await sql`
    SELECT * FROM messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
  `;

  return result as Message[];
}

export async function searchBibleChunks(
  embedding: number[],
  limit: number = 5
): Promise<Array<BibleChunk & { similarity: number }>> {
  const embeddingString = `[${embedding.join(',')}]`;

  const result = await sql`
    SELECT
      id, text as content, book, chapter, chunk_index as verse,
      1 - (embedding <=> ${embeddingString}::vector) as similarity
    FROM bible_chunks
    ORDER BY embedding <=> ${embeddingString}::vector
    LIMIT ${limit}
  `;

  return result as Array<BibleChunk & { similarity: number }>;
}

export async function saveBibleChunk(
  content: string,
  embedding: number[],
  book: string,
  chapter: number,
  verse: number
): Promise<void> {
  const embeddingString = `[${embedding.join(',')}]`;

  // Use existing table structure: text, chunk_index, chapter (as text)
  await sql`
    INSERT INTO bible_chunks (text, embedding, book, chapter, chunk_index)
    VALUES (${content}, ${embeddingString}::vector, ${book}, ${chapter.toString()}, ${verse})
  `;
}
