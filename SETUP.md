# Setup Guide - Biblický AI Chatbot

Kompletní návod pro nastavení projektu od nuly.

## Předpoklady

- Node.js 18+ ([https://nodejs.org](https://nodejs.org))
- npm nebo yarn
- Neon účet ([https://neon.tech](https://neon.tech))
- Voyage AI API key ([https://www.voyageai.com](https://www.voyageai.com))
- Anthropic API key ([https://console.anthropic.com](https://console.anthropic.com))
- Bible21.pdf soubor

---

## Krok 1: Instalace projektu

```bash
cd biblical-ai-chatbot
npm install
```

Nainstaluje všechny dependencies:
- Next.js 14
- TypeScript
- Tailwind CSS
- NextAuth.js
- Neon serverless driver
- Anthropic SDK
- bcryptjs

---

## Krok 2: Nastavení Neon Database

### 2.1 Vytvoření Neon projektu

1. Jdi na [https://neon.tech](https://neon.tech) a zaregistruj se
2. Vytvoř nový projekt (např. "biblical-ai-chatbot")
3. Vyber region (nejlépe blízko tvojí lokace)

### 2.2 Aktivace pgvector extension

V Neon dashboardu:
1. Jdi do **SQL Editor**
2. Spusť:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2.3 Spuštění database schema

V SQL Editoru zkopíruj celý obsah souboru `scripts/schema.sql` a spusť.

To vytvoří:
- `users` tabulku (admin, expert, user)
- `bible_chunks` tabulku (verše s embeddingy)
- `conversations` a `messages` tabulky
- `system_prompts` tabulku
- Indexy pro výkon
- Defaultního admin uživatele

### 2.4 Získání connection stringu

V Neon dashboardu:
1. Jdi do **Dashboard** → **Connection Details**
2. Zkopíruj **Connection string** (začíná `postgresql://...`)

---

## Krok 3: API Keys

### 3.1 Voyage AI API Key

1. Jdi na [https://www.voyageai.com](https://www.voyageai.com)
2. Zaregistruj se / přihlas
3. Jdi do **Dashboard** → **API Keys**
4. Vytvoř nový API key
5. Zkopíruj (začíná `pa-...`)

**Model:** `voyage-3-lite` (1024 dimensions)
**Free tier:** 10M tokens/měsíc

### 3.2 Anthropic API Key

1. Jdi na [https://console.anthropic.com](https://console.anthropic.com)
2. Zaregistruj se / přihlas
3. Jdi do **API Keys**
4. Vytvoř nový API key
5. Zkopíruj (začíná `sk-ant-...`)

**Model:** `claude-sonnet-4-20250514`
**Pricing:** ~$3 per 1M input tokens

---

## Krok 4: Environment Variables

Zkopíruj `.env.example` do `.env.local`:

```bash
cp .env.example .env.local
```

Vyplň hodnoty:

```env
# Neon PostgreSQL Connection
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/biblical_ai?sslmode=require

# Voyage AI API Key
VOYAGE_API_KEY=pa-xxx

# Anthropic Claude API Key
ANTHROPIC_API_KEY=sk-ant-xxx

# NextAuth Configuration
NEXTAUTH_SECRET=your-secret-key-min-32-chars-random-string
NEXTAUTH_URL=http://localhost:3000
```

**Generování NEXTAUTH_SECRET:**

```bash
# Linux/Mac
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Krok 5: Kontrola databáze

Zkontroluj, že databáze je správně nastavená:

```bash
npm run setup-db
```

Měl bys vidět:

```
✅ Found 5 tables in database:
   - users
   - bible_chunks
   - conversations
   - messages
   - system_prompts
```

---

## Krok 6: Spuštění dev serveru

```bash
npm run dev
```

Otevři [http://localhost:3000](http://localhost:3000)

---

## Krok 7: První přihlášení

Defaultní admin účet (vytvořený v `schema.sql`):

```
Email: admin@biblical-ai.local
Heslo: admin123
```

⚠️ **DŮLEŽITÉ:** Změň heslo nebo vytvoř nového admina!

### Změna admin hesla

Vytvoř nového admina:

```bash
npm run create-user admin@tvuj-email.com bezpecne-heslo admin
```

Pak smaž defaultního admina v databázi (Neon SQL Editor):

```sql
DELETE FROM users WHERE email = 'admin@biblical-ai.local';
```

---

## Krok 8: Nahrání Bible21 PDF

### 8.1 Připravení PDF

Ujisti se, že máš `Bible21.pdf` ve formátu:

```
Genesis
1
1 Na počátku stvořil Bůh nebe a zemi.
2 Země byla pustá a prázdná...

...
```

### 8.2 Upload přes admin panel (doporučeno)

1. Přihlas se jako admin
2. Klikni na **Admin** v headeru
3. Vyber záložku **Nahrát PDF**
4. Vyber `Bible21.pdf`
5. Klikni **Nahrát a zpracovat**
6. Počkej 5-10 minut

### 8.3 Nebo upload přes CLI

```bash
npm run ingest /cesta/k/Bible21.pdf
```

**Co se děje:**
1. Parsuje PDF po verších
2. Pro každý verš vytvoří embedding (1024 dims) přes Voyage AI
3. Uloží do `bible_chunks` s pgvector indexem
4. Může trvat 5-10 min (záleží na počtu veršů a API rate limits)

**Očekávaný výstup:**

```
Reading PDF from /cesta/k/Bible21.pdf...
PDF loaded: 1432 pages
Extracting verses...
Extracted 31102 verses
Processing 31102 verses in batches of 100...
Creating embeddings for batch 1...
Saving batch to database...
Batch 1 completed (100/31102)
...
✅ Ingestion complete!
```

---

## Krok 9: Testování

### 9.1 Chat test

1. Přihlas se jako admin
2. V chatu napiš: "Kdo byl Jan Křtitel?"
3. Měl bys dostat odpověď z Bible 21 s citacemi

### 9.2 Expert korekce test

1. Vytvoř expert uživatele:

```bash
npm run create-user expert@test.com password123 expert
```

2. Přihlas se jako expert
3. Pošli dotaz
4. Klikni **Opravit odpověď** pod bot odpovědí
5. Uprav text a uložit

### 9.3 Admin panel test

1. Přihlas se jako admin
2. Klikni **Admin**
3. Vyber **Systémový Prompt**
4. Změň prompt a uložit
5. Vyzkoušej chat - měl by používat nový prompt

---

## Krok 10: Vytvoření více uživatelů

### Admin

```bash
npm run create-user admin@example.com strong-password admin
```

### Expert

```bash
npm run create-user expert@example.com password123 expert
```

### User

```bash
npm run create-user user@example.com password123 user
```

---

## Troubleshooting

### ❌ "DATABASE_URL environment variable is not set"

- Zkontroluj, že máš `.env.local` (ne `.env.example`)
- Zkontroluj, že `DATABASE_URL` je vyplněn

### ❌ "Failed to create embedding"

- Zkontroluj `VOYAGE_API_KEY`
- Zkontroluj rate limits na Voyage AI dashboardu

### ❌ "Unauthorized" při chatu

- Přihlas se znovu
- Zkontroluj, že `NEXTAUTH_SECRET` je nastaven
- Vymaž cookies a zkus znovu

### ❌ PDF ingestion fails

- Zkontroluj formát PDF (musí mít čísla veršů)
- Zkus menší batch size ve `scripts/ingest.ts`
- Zkontroluj Voyage AI rate limits

### ❌ pgvector error

- Ujisti se, že `CREATE EXTENSION vector;` proběhlo v Neon
- Zkontroluj Neon logs

---

## Production Deployment

### Vercel

```bash
npm install -g vercel
vercel login
vercel
```

Environment proměnné nastav v **Vercel Dashboard** → **Settings** → **Environment Variables**:
- `DATABASE_URL`
- `VOYAGE_API_KEY`
- `ANTHROPIC_API_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (změň na production URL, např. `https://biblical-ai.vercel.app`)

### Cloudflare Pages (alternativa)

```bash
npm run build
npx wrangler pages deploy out
```

---

## Co dál?

✅ Aplikace běží!

**Next steps:**
1. Změň admin heslo
2. Vytvoř expert a user účty
3. Testuj RAG odpovědi
4. Přizpůsob systémový prompt
5. Nasaď do production

**Roadmap:**
- Přehled korekcí v admin panelu
- Export konverzací
- Citace s odkazy na verše
- WhatsApp/Telegram bot

---

Máš otázky? Koukni do `README.md` nebo kontaktuj autora.

**Built with 💜 by JANE**
