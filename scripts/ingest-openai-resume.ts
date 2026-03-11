/**
 * Bible21 Ingestion with OpenAI Embeddings (RESUME VERSION)
 * - Checks existing chunks and continues from last position
 * - Retry logic for database timeouts
 * - Slower batching for stability
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import pdf from 'pdf-parse';
import { createBatchEmbeddings } from '../lib/embeddings-openai';
import { sql } from '../lib/db';

config({ path: '.env.local' });

interface BibleChunk {
  book: string;
  text: string;
  sequence: number;
}

const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numeri', 'Deuteronomium',
  'Jozue', 'Soudců', 'Rút', '1. Samuelova', '2. Samuelova',
  '1. Královská', '2. Královská', '1. Letopisů', '2. Letopisů',
  'Ezdráš', 'Nehemiáš', 'Ester', 'Job', 'Žalmy', 'Přísloví',
  'Kazatel', 'Píseň písní', 'Izaiáš', 'Jeremiáš', 'Pláč',
  'Ezechiel', 'Daniel', 'Ozeáš', 'Joel', 'Amos', 'Abdiáš',
  'Jonáš', 'Micheáš', 'Nahum', 'Abakuk', 'Sofoniáš', 'Ageus',
  'Zachariáš', 'Malachiáš',
  'Matouš', 'Marek', 'Lukáš', 'Jan', 'Skutky apoštolů',
  'Římanům', '1. Korintským', '2. Korintským', 'Galatským',
  'Efeským', 'Filipským', 'Koloským', '1. Tesalonickým',
  '2. Tesalonickým', '1. Timoteovi', '2. Timoteovi', 'Titovi',
  'Filemonovi', 'Židům', 'Jakub', '1. Petr', '2. Petr',
  '1. Jan', '2. Jan', '3. Jan', 'Juda', 'Zjevení'
];

function parseBible21ToChunks(text: string): BibleChunk[] {
  const chunks: BibleChunk[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentBook = '';
  let verseBuffer: string[] = [];
  let sequence = 0;
  let inBook = false;
  let skipLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('ISBN') || line.includes('©') || line.includes('BIBLION')) continue;
    if (line.match(/^\d{4,}$/)) continue;

    if (BIBLE_BOOKS.includes(line)) {
      if (currentBook && verseBuffer.length > 0) {
        chunks.push({
          book: currentBook,
          text: verseBuffer.join(' ').trim(),
          sequence: sequence++,
        });
      }

      currentBook = line;
      verseBuffer = [];
      inBook = true;
      skipLines = 3;
      continue;
    }

    if (!inBook) continue;

    if (skipLines > 0) {
      skipLines--;
      continue;
    }

    if (line.match(/^(\d{1,3})$/)) {
      if (verseBuffer.length > 0) {
        const text = verseBuffer.join(' ').trim();
        if (text.length > 10) {
          chunks.push({
            book: currentBook,
            text,
            sequence: sequence++,
          });
        }
      }
      verseBuffer = [];
      continue;
    }

    verseBuffer.push(line);
  }

  if (currentBook && verseBuffer.length > 0) {
    chunks.push({
      book: currentBook,
      text: verseBuffer.join(' ').trim(),
      sequence: sequence++,
    });
  }

  return chunks;
}

async function saveBibleChunkWithRetry(
  content: string,
  embedding: number[],
  book: string,
  chapter: number,
  verse: number,
  maxRetries: number = 3
): Promise<void> {
  const embeddingString = `[${embedding.join(',')}]`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sql`
        INSERT INTO bible_chunks (text, embedding, book, chapter, chunk_index)
        VALUES (${content}, ${embeddingString}::vector, ${book}, ${chapter.toString()}, ${verse})
      `;
      return; // Success
    } catch (error: any) {
      if (attempt === maxRetries) {
        throw error;
      }

      console.log(`\n⚠️  Retry ${attempt}/${maxRetries} after error...`);
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

async function getExistingProgress(): Promise<number> {
  const result = await sql`SELECT MAX(chunk_index) as max_index FROM bible_chunks`;
  return result[0].max_index || 0;
}

async function processBatches(chunks: BibleChunk[], batchSize: number = 50, startFrom: number = 0) {
  console.log(`\n\nProcessing ${chunks.length} chunks in batches of ${batchSize}...`);
  if (startFrom > 0) {
    console.log(`📍 Resuming from chunk ${startFrom}`);
  }
  console.log('💰 Cost: ~$0.02 per 1M tokens (~$0.60 total)\n');

  let totalProcessed = startFrom;
  const startTime = Date.now();

  for (let i = startFrom; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map(c => `${c.book}: ${c.text}`);

    try {
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / batchSize);

      process.stdout.write(`[${batchNum}/${totalBatches}] Creating embeddings... `);
      const embeddings = await createBatchEmbeddings(texts);

      process.stdout.write(`Saving... `);
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j];

        await saveBibleChunkWithRetry(
          chunk.text,
          embedding,
          chunk.book,
          1,
          chunk.sequence,
        );
      }

      totalProcessed += batch.length;
      const progress = (totalProcessed / chunks.length * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = ((totalProcessed - startFrom) / (Date.now() - startTime) * 1000).toFixed(1);

      console.log(`✓ ${totalProcessed}/${chunks.length} (${progress}%) [${elapsed}s, ${rate} chunks/s]`);

      // Longer delay for database stability
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`\n❌ Error in batch ${Math.floor(i / batchSize) + 1}:`, error);
      console.log(`Progress saved up to chunk ${totalProcessed}`);
      throw error;
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n⏱️  Total time: ${totalTime} minutes`);
}

async function ingest(pdfPath: string) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log('BIBLE21 PDF INGESTION (OpenAI - RESUME)');
    console.log('='.repeat(60));

    // Check existing progress
    console.log('\n📊 Checking existing progress...');
    const existingCount = await getExistingProgress();
    console.log(`✓ Found ${existingCount} chunks already in database`);

    console.log(`\nReading PDF: ${pdfPath}...`);
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(dataBuffer);

    console.log(`✓ Loaded ${pdfData.numpages} pages`);
    console.log('\nParsing verses...');

    const chunks = parseBible21ToChunks(pdfData.text);

    console.log(`\n\n✓ Extracted ${chunks.length} text chunks`);

    if (existingCount > 0) {
      console.log(`⏩ Skipping first ${existingCount} chunks (already processed)`);
    }

    const bookCounts = new Map<string, number>();
    chunks.forEach(c => {
      bookCounts.set(c.book, (bookCounts.get(c.book) || 0) + 1);
    });

    console.log(`\nTotal books: ${bookCounts.size}`);
    console.log(`Remaining: ${chunks.length - existingCount} chunks`);

    await processBatches(chunks, 50, existingCount);

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ INGESTION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total chunks processed: ${chunks.length}`);
    console.log(`Total books: ${bookCounts.size}`);
    console.log('\n🎉 Database is ready for RAG queries!');

  } catch (error) {
    console.error('\n❌ Ingestion failed:', error);
    console.log('\n💡 You can run this script again to resume from where it stopped.');
    throw error;
  }
}

if (require.main === module) {
  const pdfPath = process.argv[2] || 'C:/Users/pavel/Downloads/bible_21.pdf';

  ingest(pdfPath)
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { ingest };
