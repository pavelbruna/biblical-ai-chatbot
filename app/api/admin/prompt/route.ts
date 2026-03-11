import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt } = await req.json();

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Deactivate all existing prompts
    await sql`UPDATE system_prompts SET active = false WHERE active = true`;

    // Insert new active prompt
    await sql`
      INSERT INTO system_prompts (content, active)
      VALUES (${prompt}, true)
    `;

    return NextResponse.json({
      success: true,
      message: 'System prompt updated successfully',
    });
  } catch (error) {
    console.error('Prompt update error:', error);
    return NextResponse.json(
      { error: 'Failed to update system prompt' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await sql`
      SELECT content FROM system_prompts
      WHERE active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json({ prompt: '' });
    }

    return NextResponse.json({ prompt: result[0].content });
  } catch (error) {
    console.error('Get prompt error:', error);
    return NextResponse.json(
      { error: 'Failed to get system prompt' },
      { status: 500 }
    );
  }
}
