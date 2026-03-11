# Biblický AI Chatbot

RAG-powered AI chatbot pro Bible 21 s vektorovým vyhledáváním, embeddingy přes Voyage AI a Claude Sonnet 4.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database:** Neon PostgreSQL s pgvector extension
- **Embeddings:** Voyage AI (voyage-3-lite, 1024 dimensions)
- **LLM:** Anthropic Claude (claude-sonnet-4-20250514)
- **Auth:** NextAuth.js (credentials provider)

## Role Uživatelů

1. **ADMIN** - Plný přístup, nahrává PDF, mění systémový prompt, spravuje uživatele
2. **EXPERT** - Může chatovat + inline editovat odpovědi bota
3. **USER** - Pouze chatuje

## Setup

### 1. Klonování a instalace

\`\`\`bash
git clone <repo-url>
cd biblical-ai-chatbot
npm install
\`\`\`

### 2. Nastavení databáze (Neon)

1. Vytvoř účet na [Neon.tech](https://neon.tech)
2. Vytvoř nový projekt
3. V projektu běž do **SQL Editor** a spusť:

\`\`\`sql
-- Zkopíruj celý obsah scripts/schema.sql a spusť
\`\`\`

4. Zkopíruj connection string (najdeš v Dashboard → Connection Details)

### 3. Environment proměnné

Zkopíruj \`.env.example\` do \`.env.local\`:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Vyplň:

\`\`\`env
DATABASE_URL=<tvůj Neon connection string>
VOYAGE_API_KEY=<Voyage AI API key z https://www.voyageai.com>
ANTHROPIC_API_KEY=<Claude API key z https://console.anthropic.com>
NEXTAUTH_SECRET=<náhodný string min 32 znaků>
NEXTAUTH_URL=http://localhost:3000
\`\`\`

### 4. Spuštění dev serveru

\`\`\`bash
npm run dev
\`\`\`

Otevři [http://localhost:3000](http://localhost:3000)

### 5. První přihlášení

Defaultní admin účet (vytvořený v schema.sql):
- Email: \`admin@biblical-ai.local\`
- Heslo: \`admin123\`

⚠️ **ZMĚŇ HESLO IHNED!** (nebo vytvoř nového admina v databázi s bcrypt hashem)

### 6. Nahrání Bible21 PDF

1. Přihlas se jako admin
2. Klikni na **Admin** v headeru
3. Na záložce **Nahrát PDF** vyber \`Bible21.pdf\`
4. Klikni **Nahrát a zpracovat**
5. Počkej 5-10 minut (záleží na velikosti PDF)

Proces:
- Parsuje PDF po verších
- Vytvoří 1024-dimenzionální embeddingy přes Voyage AI
- Uloží do Neon s pgvector indexem

## Použití

### Chat

1. Přihlas se jako libovolný uživatel
2. Napiš dotaz v inputu (např. "Kdo byl Jan Křtitel?")
3. Bot odpoví pouze z kontextu Bible 21
4. Konverzace se ukládá do databáze

### Opravy (Expert/Admin)

1. Pod každou odpovědí bota vidíš tlačítko **Opravit odpověď**
2. Klikni, uprav text, uložit
3. Opravená verze se zobrazí místo původní
4. Označeno štítkem "✓ Opraveno expertem"

### Admin Panel

**Záložky:**

1. **Nahrát PDF** - Upload a zpracování Bible21.pdf
2. **Systémový Prompt** - Změna instrukcí pro Claude AI
3. **Korekce** - Přehled všech oprav (TBD)

## Struktura Projektu

\`\`\`
biblical-ai-chatbot/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # NextAuth endpoint
│   │   ├── chat/route.ts                  # Chat API (streaming)
│   │   ├── correct/route.ts               # Opravy (expert/admin)
│   │   └── admin/
│   │       ├── upload/route.ts            # PDF upload
│   │       └── prompt/route.ts            # Systémový prompt
│   ├── admin/page.tsx                     # Admin panel UI
│   ├── login/page.tsx                     # Login stránka
│   ├── page.tsx                           # Chat UI
│   ├── layout.tsx                         # Root layout
│   ├── providers.tsx                      # SessionProvider
│   └── globals.css                        # Tailwind styles
├── lib/
│   ├── db.ts                              # Neon klient + helpers
│   ├── embeddings.ts                      # Voyage AI embeddings
│   ├── rag.ts                             # RAG pipeline (Claude + pgvector)
│   └── auth.ts                            # NextAuth config
├── scripts/
│   ├── schema.sql                         # DB schema
│   └── ingest.ts                          # PDF ingestion script
├── types/
│   └── next-auth.d.ts                     # NextAuth TypeScript types
├── middleware.ts                          # Role-based access control
├── .env.example                           # Environment proměnné template
└── package.json
\`\`\`

## Jak funguje RAG Pipeline

1. **User dotaz** → "Kdo byl Jan Křtitel?"
2. **Embedding** → Voyage AI vytvoří 1024-dim vektor
3. **Vector Search** → pgvector najde 5 nejpodobnějších veršů v DB (cosine similarity)
4. **Context** → Verše se vloží do systémového promptu
5. **Claude API** → Generuje odpověď POUZE z kontextu
6. **Streaming** → Odpověď se streamuje chunk po chunku
7. **Save** → Uložení do \`messages\` tabulky

## Příklady Queries

\`\`\`
Kdo byl Jan Křtitel?
Co říká Bible o lásce?
Vysvětli притчу o milosrdném Samaritánovi
Jaké jsou přikázání v Bibli?
Co se stalo na hoře Sinaj?
\`\`\`

## API Endpoints

| Endpoint | Metoda | Auth | Role | Popis |
|----------|--------|------|------|-------|
| \`/api/auth/[...nextauth]\` | GET/POST | - | - | NextAuth login/logout |
| \`/api/chat\` | POST | ✅ | všichni | Chat (streaming) |
| \`/api/chat?conversationId=X\` | GET | ✅ | všichni | Historie konverzace |
| \`/api/correct\` | POST | ✅ | expert/admin | Oprava odpovědi |
| \`/api/admin/upload\` | POST | ✅ | admin | Upload PDF |
| \`/api/admin/prompt\` | POST/GET | ✅ | admin | Systémový prompt |

## Troubleshooting

### Chyba při uploadu PDF

- Zkontroluj, že PDF má správný formát (Bible21 s čísly veršů)
- Zvětši \`bodySizeLimit\` v \`next.config.mjs\`

### Embeddingy nefungují

- Ověř \`VOYAGE_API_KEY\` v \`.env.local\`
- Zkontroluj rate limits na Voyage AI dashboardu

### Claude neodpovídá

- Ověř \`ANTHROPIC_API_KEY\`
- Zkontroluj API usage na Anthropic console

### Databáze spadla

- Ověř \`DATABASE_URL\` a connection string
- Zkontroluj, že pgvector extension je aktivní

## Production Deployment

### Neon DB
1. Produkční databáze už je na Neon (stejný setup jako dev)
2. Pouze změň \`DATABASE_URL\` na production connection string

### Vercel
\`\`\`bash
npm install -g vercel
vercel login
vercel
\`\`\`

Environment proměnné přidej v Vercel Dashboard → Settings → Environment Variables

## Roadmap

- [ ] Přehled korekcí v admin panelu
- [ ] Export konverzací do CSV
- [ ] Multi-user conversations
- [ ] Citace veršů s odkazy
- [ ] Dark/light mode toggle
- [ ] WhatsApp/Telegram integration

## License

Private - Pavel Bruna

---

**Built with 💜 by JANE**
