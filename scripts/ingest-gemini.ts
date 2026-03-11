/**
 * Bible21 Ingestion with Google Gemini Embeddings (FREE)
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import pdf from 'pdf-parse';
import { createBatchEmbeddings } from '../lib/embeddings-gemini';
import { saveBibleChunk } from '../lib/db';

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
      console.log(`\n📖 ${currentBook}`);
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

          if (sequence % 100 === 0) {
            process.stdout.write('.');
          }
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

async function processBatches(chunks: BibleChunk[], batchSize: number = 10) {
  console.log(`\n\nProcessing ${chunks.length} chunks in batches of ${batchSize}...`);
  console.log('⏱️  Rate limit: 15 requests/minute (Gemini FREE tier)\n');

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map(c => `${c.book}: ${c.text}`);

    try {
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / batchSize);

      console.log(`[${batchNum}/${totalBatches}] Creating embeddings...`);
      const embeddings = await createBatchEmbeddings(texts);

      console.log(`[${batchNum}/${totalBatches}] Saving to database...`);
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddings[j];

        await saveBibleChunk(
          chunk.text,
          embedding,
          chunk.book,
          1,
          chunk.sequence,
        );
      }

      const progress = ((i + batch.length) / chunks.length * 100).toFixed(1);
      console.log(`✓ Completed ${i + batch.length}/${chunks.length} (${progress}%)\n`);

      // Rate limiting: 15 RPM = 1 request per 4 seconds
      if (i + batchSize < chunks.length) {
        process.stdout.write('⏳ Waiting 5 seconds (rate limit)...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`\n❌ Error in batch ${Math.floor(i / batchSize) + 1}:`, error);
      throw error;
    }
  }
}

async function ingest(pdfPath: string) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log('BIBLE21 PDF INGESTION (Gemini Embeddings)');
    console.log('='.repeat(60));

    console.log(`\nReading PDF: ${pdfPath}...`);
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(dataBuffer);

    console.log(`✓ Loaded ${pdfData.numpages} pages`);
    console.log('\nParsing verses...');

    const chunks = parseBible21ToChunks(pdfData.text);

    console.log(`\n\n✓ Extracted ${chunks.length} text chunks`);

    console.log('\nSample chunks:');
    chunks.slice(0, 5).forEach(c => {
      console.log(`  ${c.book} [${c.sequence}]: ${c.text.substring(0, 60)}...`);
    });

    const bookCounts = new Map<string, number>();
    chunks.forEach(c => {
      bookCounts.set(c.book, (bookCounts.get(c.book) || 0) + 1);
    });

    console.log(`\nTotal books: ${bookCounts.size}`);

    const estimatedTime = Math.ceil(chunks.length / 10 * 5 / 60);
    console.log(`\n⏱️  Estimated time: ~${estimatedTime} minutes`);
    console.log('(FREE Gemini tier: 15 requests/minute)\n');

    await processBatches(chunks, 10);

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ INGESTION COMPLETE!');
    console.log('='.repeat(60));
    console.log(`Total chunks processed: ${chunks.length}`);
    console.log(`Total books: ${bookCounts.size}`);
    console.log('\n🎉 Database is ready for RAG queries!');

  } catch (error) {
    console.error('\n❌ Ingestion failed:', error);
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
