import { config } from 'dotenv';
import { sql } from '../lib/db';

// Load .env.local
config({ path: '.env.local' });

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = await sql`SELECT version()`;
    console.log('✅ Database connection successful!');
    console.log('PostgreSQL version:', result[0].version);

    // Check if pgvector extension exists
    const extResult = await sql`
      SELECT * FROM pg_extension WHERE extname = 'vector'
    `;

    if (extResult.length > 0) {
      console.log('✅ pgvector extension is installed');
    } else {
      console.log('⚠️  pgvector extension not found - installing...');
      await sql`CREATE EXTENSION IF NOT EXISTS vector`;
      console.log('✅ pgvector extension installed');
    }

    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

testConnection()
  .then((success) => {
    if (success) {
      console.log('\nDatabase is ready!');
      process.exit(0);
    } else {
      process.exit(1);
    }
  });
