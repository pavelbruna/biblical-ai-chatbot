/**
 * Bible21 PDF Ingestion Script
 *
 * Reads Bible21.pdf, extracts text, splits into verses,
 * creates Voyage AI embeddings, and stores in Neon database.
 *
 * Usage:
 *   tsx scripts/ingest.ts path/to/Bible21.pdf
 */

import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse';
import { createBatchEmbeddings } from '../lib/embeddings';
import { saveBibleChunk } from '../lib/db';

interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

// Bible book names in Czech (Bible21)
const BIBLE_BOOKS = [
  // Old Testament
  'Genesis', '1. Mojžíšova', '2. Mojžíšova', '3. Mojžíšova', '4. Mojžíšova', '5. Mojžíšova',
  'Jozue', 'Soudců', 'Rút', '1. Samuelova', '2. Samuelova', '1. Královská', '2. Královská',
  '1. Letopisů', '2. Letopisů', 'Ezdráš', 'Nehemiáš', 'Ester', 'Jób', 'Žalmy',
  'Přísloví', 'Kazatel', 'Píseň', 'Izaiáš', 'Jeremiáš', 'Pláč', 'Ezechiel', 'Daniel',
  'Ozeáš', 'Joel', 'Amos', 'Abdiáš', 'Jonáš', 'Micheáš', 'Nahum', 'Habakuk',
  'Sofoniáš', 'Ageus', 'Zachariáš', 'Malachiáš',
  // New Testament
  'Matouš', 'Marek', 'Lukáš', 'Jan', 'Skutky',
  'Římanům', '1. Korintským', '2. Korintským', 'Galatským', 'Efezským',
  'Filipským', 'Koloským', '1. Tesalonickým', '2. Tesalonickým',
  '1. Timoteovi', '2. Timoteovi', 'Titovi', 'Filemonovi',
  'Židům', 'Jakub', '1. Petr', '2. Petr', '1. Jan', '2. Jan', '3. Jan', 'Juda', 'Zjevení'
];

/**
 * Extract verses from PDF text
 * This is a simplified parser - adjust based on Bible21 PDF format
 */
function extractVerses(pdfText: string): BibleVerse[] {
  const verses: BibleVerse[] = [];
  const lines = pdfText.split('\n');

  let currentBook = '';
  let currentChapter = 0;

  // Regex patterns for Bible21 format
  const bookPattern = new RegExp(`^(${BIBLE_BOOKS.join('|')})\\s*$`, 'i');
  const chapterPattern = /^(\d+)$/;
  const versePattern = /^(\d+)\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;

    // Check if it's a book name
    const bookMatch = line.match(bookPattern);
    if (bookMatch) {
      currentBook = bookMatch[1];
      continue;
    }

    // Check if it's a chapter number
    const chapterMatch = line.match(chapterPattern);
    if (chapterMatch && line.length < 4) {
      currentChapter = parseInt(chapterMatch[1]);
      continue;
    }

    // Check if it's a verse
    const verseMatch = line.match(versePattern);
    if (verseMatch && currentBook && currentChapter > 0) {
      const verseNumber = parseInt(verseMatch[1]);
      const verseText = verseMatch[2];

      verses.push({
        book: currentBook,
        chapter: currentChapter,
        verse: verseNumber,
        text: verseText,
      });
    }
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
    const texts = batch.map(v => `${v.book} ${v.chapter}:${v.verse} ${v.text}`);

    console.log(`Creating embeddings for batch ${Math.floor(i / batchSize) + 1}...`);
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

    console.log(`Batch ${Math.floor(i / batchSize) + 1} completed (${i + batch.length}/${verses.length})`);
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

    const verses = extractVerses(pdfData.text);
    console.log(`Extracted ${verses.length} verses`);

    if (verses.length === 0) {
      throw new Error('No verses extracted from PDF. Check PDF format.');
    }

    await processBatch(verses);

    console.log('✅ Ingestion complete!');
  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.error('Usage: tsx scripts/ingest.ts <path-to-bible21.pdf>');
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
