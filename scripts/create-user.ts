/**
 * Create User Script
 *
 * Creates a new user in the database with hashed password.
 *
 * Usage:
 *   tsx scripts/create-user.ts <email> <password> <role>
 *
 * Example:
 *   tsx scripts/create-user.ts expert@test.com password123 expert
 */

import bcrypt from 'bcryptjs';
import { sql } from '../lib/db';

async function createUser(
  email: string,
  password: string,
  role: 'admin' | 'expert' | 'user'
) {
  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await sql`
      INSERT INTO users (email, password_hash, role)
      VALUES (${email}, ${passwordHash}, ${role})
      RETURNING id, email, role
    `;

    console.log('✅ User created successfully:');
    console.log(result[0]);
  } catch (error) {
    console.error('❌ Failed to create user:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const [email, password, role] = process.argv.slice(2);

  if (!email || !password || !role) {
    console.error('Usage: tsx scripts/create-user.ts <email> <password> <role>');
    console.error('Roles: admin | expert | user');
    process.exit(1);
  }

  if (!['admin', 'expert', 'user'].includes(role)) {
    console.error('Invalid role. Must be: admin, expert, or user');
    process.exit(1);
  }

  createUser(email, password, role as 'admin' | 'expert' | 'user')
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { createUser };
