/**
 * Bible21 PDF Ingestion Script (Enhanced)
 *
 * Reads Bible21.pdf, extracts text, splits into verses,
 * creates Voyage AI embeddings, and stores in Neon database.
 *
 * Usage:
 *   tsx scripts/ingest-bible21.ts <path-to-bible21.pdf>
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import pdf from 'pdf-parse';
import { createBatchEmbeddings } from '../lib/embeddings';
import { saveBibleChunk } from '../lib/db';

// Load .env.local
config({ path: '.env.local' });

interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

// Bible book names in Czech (Bible21)
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

/**
 * Enhanced verse extraction for Bible21 format
 */
function extractVersesFromBible21(pdfText: string): BibleVerse[] {
  const verses: BibleVerse[] = [];
  const lines = pdfText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentBook = '';
  let currentChapter = 1;
  let currentVerse = 0;
  let verseBuffer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip header/footer content
    if (line.match(/^\d+$/) && parseInt(line) > 1000) continue;
    if (line.includes('ISBN') || line.includes('©') || line.includes('BIBLION')) continue;

    // Check if it's a book name
    const bookMatch = BIBLE_BOOKS.find(book => line === book || line.startsWith(book));
    if (bookMatch) {
      currentBook = bookMatch;
      currentChapter = 1;
      currentVerse = 0;
      verseBuffer = '';
      console.log(`Found book: ${currentBook}`);
      continue;
    }

    // Skip if no book yet
    if (!currentBook) continue;

    // Check if line is a verse number (single digit or double digit on its own line)
    const verseNumMatch = line.match(/^(\d{1,3})$/);
    if (verseNumMatch) {
      const num = parseInt(verseNumMatch[1]);

      // Save previous verse if exists
      if (verseBuffer.trim() && currentVerse > 0) {
        verses.push({
          book: currentBook,
          chapter: currentChapter,
          verse: currentVerse,
          text: verseBuffer.trim(),
        });
      }

      // Check if new chapter (verse number resets to 1-3)
      if (num <= 3 && currentVerse > 10) {
        currentChapter++;
      }

      currentVerse = num;
      verseBuffer = '';
      continue;
    }

    // Check if line starts with verse number
    const inlineVerseMatch = line.match(/^(\d{1,3})\s+(.+)$/);
    if (inlineVerseMatch && currentBook) {
      const num = parseInt(inlineVerseMatch[1]);
      const text = inlineVerseMatch[2];

      // Save previous verse
      if (verseBuffer.trim() && currentVerse > 0) {
        verses.push({
          book: currentBook,
          chapter: currentChapter,
          verse: currentVerse,
          text: verseBuffer.trim(),
        });
      }

      // Check for new chapter
      if (num <= 3 && currentVerse > 10) {
        currentChapter++;
      }

      currentVerse = num;
      verseBuffer = text;
      continue;
    }

    // Otherwise, append to current verse buffer
    if (currentVerse > 0) {
      verseBuffer += ' ' + line;
    }
  }

  // Save last verse
  if (verseBuffer.trim() && currentVerse > 0 && currentBook) {
    verses.push({
      book: currentBook,
      chapter: currentChapter,
      verse: currentVerse,
      text: verseBuffer.trim(),
    });
  }

  return verses;
}

/**
 * Process verses in batches
 */
async function processBatch(verses: BibleVerse[], batchSize: number = 100): Promise<void> {
  console.log(`Processing ${verses.length} verses in batches of ${batchSize}...`);

  for (let i = 0; i < verses.length; i += batchSize) {
    const batch = verses.slice(i, i + batchSize);
    const texts = batch.map(v => `${v.book} ${v.chapter}:${v.verse} - ${v.text}`);

    console.log(`Creating embeddings for batch ${Math.floor(i / batchSize) + 1}...`);

    try {
      const embeddings = await createBatchEmbeddings(texts);

      console.log(`Saving batch to database...`);
      for (let j = 0; j < batch.length; j++) {
        const verse = batch[j];
        const embedding = embeddings[j];

        await saveBibleChunk(
          verse.text,
          embedding,
          verse.book,
          verse.chapter,
          verse.verse
        );
      }

      console.log(`✓ Batch ${Math.floor(i / batchSize) + 1} completed (${i + batch.length}/${verses.length})`);

      // Rate limiting - wait 1 second between batches
      if (i + batchSize < verses.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, error);
      throw error;
    }
  }
}

/**
 * Main ingestion function
 */
async function ingest(pdfPath: string): Promise<void> {
  try {
    console.log(`Reading PDF from ${pdfPath}...`);

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(dataBuffer);

    console.log(`PDF loaded: ${pdfData.numpages} pages`);
    console.log(`Extracting verses...`);

    const verses = extractVersesFromBible21(pdfData.text);
    console.log(`✓ Extracted ${verses.length} verses`);

    if (verses.length === 0) {
      throw new Error('No verses extracted from PDF. Check PDF format.');
    }

    // Show sample
    console.log('\nSample verses:');
    verses.slice(0, 5).forEach(v => {
      console.log(`  ${v.book} ${v.chapter}:${v.verse} - ${v.text.substring(0, 50)}...`);
    });

    console.log('\nStarting batch processing...\n');
    await processBatch(verses, 50); // Smaller batches for rate limiting

    console.log('\n✅ Ingestion complete!');
    console.log(`Total verses processed: ${verses.length}`);
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.error('Usage: tsx scripts/ingest-bible21.ts <path-to-bible21.pdf>');
    process.exit(1);
  }

  ingest(pdfPath)
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { ingest };
