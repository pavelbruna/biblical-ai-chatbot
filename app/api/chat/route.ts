import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateRAGResponseStream } from '@/lib/rag-openai';

export const runtime = 'nodejs';

interface ChatRequest {
  message: string;
  conversationId?: number;
  conversationHistory?: Array<{ role: string; content: string }>;
}

// Streaming response
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ChatRequest = await req.json();
    const { message, conversationHistory = [] } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // TEMPORARY FIX: No database persistence due to Neon FREE tier size limit (512 MB)
    // Conversation history is now managed client-side
    // TODO: Upgrade Neon plan or migrate to larger database

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';

          for await (const chunk of generateRAGResponseStream(
            message,
            conversationHistory
          )) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          // No database persistence - responses are not saved
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get conversation history
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationId = req.nextUrl.searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const messages = await getConversationMessages(parseInt(conversationId));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
