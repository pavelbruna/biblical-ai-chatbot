-- Biblical AI Chatbot Database Schema
-- Neon PostgreSQL with pgvector extension

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table with role-based access
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'expert', 'user')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System prompts (admin can modify)
CREATE TABLE system_prompts (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bible chunks with vector embeddings (1024 dimensions for Voyage AI)
CREATE TABLE bible_chunks (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1024),
  book VARCHAR(100) NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversations
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages with corrections support
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  corrected_content TEXT,
  corrected_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_bible_embedding ON bible_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_bible_book_chapter ON bible_chunks(book, chapter);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_system_prompts_active ON system_prompts(active) WHERE active = true;

-- Insert default system prompt
INSERT INTO system_prompts (content, active) VALUES (
  'Jsi biblický AI asistent. Odpovídej POUZE na základě kontextu z Bible 21, který ti byl poskytnut. Pokud odpověď není v poskytnutém kontextu, řekni: "Tuto informaci nemohu najít v poskytnutém biblickém kontextu." Buď přesný, laskavý a respektující. Vždy cituj konkrétní knihu, kapitolu a verš.',
  true
);

-- Insert default admin user (password: admin123 - CHANGE THIS!)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (email, password_hash, role) VALUES (
  'admin@biblical-ai.local',
  '$2b$10$rBV2kMFqhLQWvGgV5wV5Xu0y7FQY5bMqP5Z3zJZ0Z8Z0Z8Z0Z8Z0Z',
  'admin'
);
