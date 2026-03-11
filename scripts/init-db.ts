import { config } from 'dotenv';
import { sql } from '../lib/db';

// Load .env.local
config({ path: '.env.local' });

async function initDatabase() {
  try {
    console.log('Initializing database schema...\n');

    // 1. Create users table
    console.log('Creating users table...');
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'expert', 'user')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Users table created');

    // 2. Create system_prompts table
    console.log('Creating system_prompts table...');
    await sql`
      CREATE TABLE IF NOT EXISTS system_prompts (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ System prompts table created');

    // 3. Create bible_chunks table
    console.log('Creating bible_chunks table...');
    await sql`
      CREATE TABLE IF NOT EXISTS bible_chunks (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding vector(1024),
        book VARCHAR(100) NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Bible chunks table created');

    // 4. Create conversations table
    console.log('Creating conversations table...');
    await sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Conversations table created');

    // 5. Create messages table
    console.log('Creating messages table...');
    await sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        corrected_content TEXT,
        corrected_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Messages table created');

    // 6. Create indexes
    console.log('\nCreating indexes...');

    // Check if index exists before creating
    const indexExists = await sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'bible_chunks' AND indexname = 'idx_bible_embedding'
    `;

    if (indexExists.length === 0) {
      await sql`
        CREATE INDEX idx_bible_embedding ON bible_chunks
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
      `;
      console.log('✅ Bible embedding index created');
    } else {
      console.log('✅ Bible embedding index already exists');
    }

    await sql`CREATE INDEX IF NOT EXISTS idx_bible_book_chapter ON bible_chunks(book, chapter)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_system_prompts_active ON system_prompts(active) WHERE active = true`;
    console.log('✅ Additional indexes created');

    // 7. Insert default system prompt
    console.log('\nInserting default system prompt...');
    const existingPrompt = await sql`SELECT * FROM system_prompts WHERE active = true LIMIT 1`;

    if (existingPrompt.length === 0) {
      await sql`
        INSERT INTO system_prompts (content, active) VALUES (
          'Jsi biblický AI asistent. Odpovídej POUZE na základě kontextu z Bible 21, který ti byl poskytnut. Pokud odpověď není v poskytnutém kontextu, řekni: "Tuto informaci nemohu najít v poskytnutém biblickém kontextu." Buď přesný, laskavý a respektující. Vždy cituj konkrétní knihu, kapitolu a verš.',
          true
        )
      `;
      console.log('✅ Default system prompt inserted');
    } else {
      console.log('✅ System prompt already exists');
    }

    // 8. Insert default admin user
    console.log('\nInserting default admin user...');
    const existingAdmin = await sql`SELECT * FROM users WHERE email = 'admin@biblical-ai.local' LIMIT 1`;

    if (existingAdmin.length === 0) {
      // Password: admin123 (bcrypt hash)
      await sql`
        INSERT INTO users (email, password_hash, role) VALUES (
          'admin@biblical-ai.local',
          '$2b$10$rBV2kMFqhLQWvGgV5wV5Xu0y7FQY5bMqP5Z3zJZ0Z8Z0Z8Z0Z8Z0Z',
          'admin'
        )
      `;
      console.log('✅ Default admin user created');
      console.log('   Email: admin@biblical-ai.local');
      console.log('   Password: admin123');
      console.log('   ⚠️  CHANGE THIS PASSWORD AFTER FIRST LOGIN!');
    } else {
      console.log('✅ Admin user already exists');
    }

    console.log('\n✅ Database initialization complete!');
    return true;
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error);
    return false;
  }
}

initDatabase()
  .then((success) => {
    if (success) {
      console.log('\nDatabase is ready for use!');
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
