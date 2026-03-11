/**
 * Database Setup Script
 *
 * Initializes the database with schema and default data.
 *
 * Usage:
 *   tsx scripts/setup-db.ts
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { sql } from '../lib/db';

async function setupDatabase() {
  try {
    console.log('Setting up database...');

    // Read schema file
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = await readFile(schemaPath, 'utf-8');

    // Execute schema (note: this won't work with multiple statements)
    // You need to run this manually in Neon SQL Editor
    console.log('⚠️  Please run the schema.sql file manually in Neon SQL Editor');
    console.log('📄 File location: scripts/schema.sql');

    // Check if tables exist
    const tablesCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'bible_chunks', 'conversations', 'messages', 'system_prompts')
    `;

    console.log(`\n✅ Found ${tablesCheck.length} tables in database:`);
    tablesCheck.forEach(row => console.log(`   - ${row.table_name}`));

    if (tablesCheck.length === 5) {
      console.log('\n✅ Database setup complete!');
    } else {
      console.log('\n⚠️  Some tables are missing. Please run schema.sql in Neon SQL Editor.');
    }

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { setupDatabase };
