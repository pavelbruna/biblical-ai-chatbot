/**
 * Specialized parser for Bible21 PDF format
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import pdf from 'pdf-parse';

config({ path: '.env.local' });

interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
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

function parseBible21(text: string): BibleVerse[] {
  const verses: BibleVerse[] = [];
  const lines = text.split('\n');

  let currentBook = '';
  let currentChapter = 1;
  let currentVerse = 0;
  let verseBuffer: string[] = [];
  let inBook = false;
  let bookStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Skip page numbers and metadata
    if (line.match(/^\d+$/) && parseInt(line) > 200) continue;
    if (line.includes('ISBN') || line.includes('©')) continue;

    // Check if it's a book name - exact match only at start of section
    if (BIBLE_BOOKS.includes(line) && !inBook) {
      // Save previous verse if exists
      if (currentBook && currentVerse > 0 && verseBuffer.length > 0) {
        verses.push({
          book: currentBook,
          chapter: currentChapter,
          verse: currentVerse,
          text: verseBuffer.join(' ').trim(),
        });
      }

      currentBook = line;
      currentChapter = 1;
      currentVerse = 0;
      verseBuffer = [];
      inBook = true;
      bookStartIndex = i;
      console.log(`📖 Found book: ${currentBook}`);
      continue;
    }

    // Skip if not in a book yet
    if (!inBook) continue;

    // Skip subtitles (capitalized phrases after book name)
    if (i - bookStartIndex < 5 && line.match(/^[A-ZČŘŠŽÝÁÍÉ]/)) {
      continue;
    }

    // Check if line is a verse number (1-3 digits on its own line)
    if (line.match(/^(\d{1,3})$/)) {
      const num = parseInt(line);

      // Save previous verse
      if (currentVerse > 0 && verseBuffer.length > 0) {
        verses.push({
          book: currentBook,
          chapter: currentChapter,
          verse: currentVerse,
          text: verseBuffer.join(' ').trim(),
        });
      }

      // Detect new chapter (verse resets to 1-3)
      if (num <= 3 && currentVerse > 10) {
        currentChapter++;
        console.log(`  Chapter ${currentChapter}`);
      }

      currentVerse = num;
      verseBuffer = [];
      continue;
    }

    // Accumulate verse text
    if (currentVerse > 0) {
      verseBuffer.push(line);
    }
  }

  // Save last verse
  if (currentBook && currentVerse > 0 && verseBuffer.length > 0) {
    verses.push({
      book: currentBook,
      chapter: currentChapter,
      verse: currentVerse,
      text: verseBuffer.join(' ').trim(),
    });
  }

  return verses;
}

async function testParse(pdfPath: string) {
  console.log(`Reading PDF: ${pdfPath}\n`);

  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdf(dataBuffer);

  console.log(`PDF loaded: ${pdfData.numpages} pages\n`);
  console.log('Parsing verses...\n');

  const verses = parseBible21(pdfData.text);

  console.log(`\n✅ Extracted ${verses.length} verses\n`);

  // Show samples
  console.log('Sample verses:');
  verses.slice(0, 10).forEach(v => {
    console.log(`${v.book} ${v.chapter}:${v.verse} - ${v.text.substring(0, 60)}...`);
  });

  console.log('\n...\n');

  verses.slice(Math.floor(verses.length / 2), Math.floor(verses.length / 2) + 5).forEach(v => {
    console.log(`${v.book} ${v.chapter}:${v.verse} - ${v.text.substring(0, 60)}...`);
  });

  // Stats by book
  console.log('\nVerses per book:');
  const bookCounts = new Map<string, number>();
  verses.forEach(v => {
    bookCounts.set(v.book, (bookCounts.get(v.book) || 0) + 1);
  });
  bookCounts.forEach((count, book) => {
    console.log(`  ${book}: ${count}`);
  });

  return verses;
}

// CLI
if (require.main === module) {
  const pdfPath = process.argv[2] || 'C:/Users/pavel/Downloads/bible_21.pdf';

  testParse(pdfPath)
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export { parseBible21 };
export type { BibleVerse };
