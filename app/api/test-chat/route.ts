import { NextRequest, NextResponse } from 'next/server';
import { generateRAGResponseStream } from '@/lib/rag-openai';

export const runtime = 'nodejs';

// Test endpoint WITHOUT authentication
export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get('q') || 'Kdo stvořil svět?';

    console.log('🧪 Test endpoint called with query:', query);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';

          console.log('🔄 Starting RAG stream...');

          for await (const chunk of generateRAGResponseStream(query, [])) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          console.log('✅ RAG stream completed. Length:', fullResponse.length);

          controller.close();
        } catch (error) {
          console.error('❌ Streaming error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(encoder.encode(`\n\n[ERROR: ${errorMessage}]`));
          controller.close();
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
    console.error('❌ Test API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Test failed', details: errorMessage },
      { status: 500 }
    );
  }
}
