import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { ingest } from '@/scripts/ingest';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    // Save temporarily
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempPath = join('/tmp', 'bible21.pdf');

    await writeFile(tempPath, buffer);

    // Run ingestion
    await ingest(tempPath);

    // Clean up
    await unlink(tempPath);

    return NextResponse.json({
      success: true,
      message: 'PDF uploaded and processed successfully',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload and process PDF' },
      { status: 500 }
    );
  }
}
