import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { correctMessage } from '@/lib/db';

export const runtime = 'edge';

interface CorrectRequest {
  messageId: number;
  correctedContent: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only expert and admin can correct messages
    if (session.user.role !== 'expert' && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - only experts and admins can correct messages' },
        { status: 403 }
      );
    }

    const body: CorrectRequest = await req.json();
    const { messageId, correctedContent } = body;

    if (!messageId || !correctedContent || correctedContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'messageId and correctedContent are required' },
        { status: 400 }
      );
    }

    const userId = parseInt(session.user.id);

    await correctMessage(messageId, correctedContent, userId);

    return NextResponse.json({
      success: true,
      message: 'Message corrected successfully',
    });
  } catch (error) {
    console.error('Correct API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
