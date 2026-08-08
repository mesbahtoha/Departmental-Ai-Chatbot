# NoticeFlow AI — AI Chatbot for Campus Notices

The smarter way to ask, learn & get things done. An AI-powered assistant for university notices, documents, study, coding, writing, and everyday questions—with verified sources when available. Built with a TypeScript Express + MongoDB backend and a React + Vite frontend.

> Users chat in English, Bangla, or Banglish; the assistant streams answers token-by-token and cites the exact notice documents it used.

### Live deployments

- **Frontend:** https://departmental-ai-chatbot-dkpf.vercel.app
- **Backend API:** https://departmental-ai-chatbot-tzpe.vercel.app (health: `https://departmental-ai-chatbot-tzpe.vercel.app/api/v1/health`)

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Environment Variables](#environment-variables)
7. [Local Setup](#local-setup)
8. [Available Scripts](#available-scripts)
9. [Database](#database)
10. [API Reference](#api-reference)
11. [AI & Quota System](#ai--quota-system)
12. [Deployment](#deployment)
13. [Security](#security)
14. [Troubleshooting](#troubleshooting)
15. [User Manual](#user-manual)

---

## Features

### User App
- **AI chat with streaming** — answers stream token-by-token over SSE (Server-Sent Events), like ChatGPT.
- **Grounded answers with sources** — the assistant only answers from uploaded notices and shows clickable **file chips** (PDF / IMG / PPT / DOCX / XLSX) for every claim.
- **Intent-aware search** — routine, fee, admission, scholarship, exam and result questions trigger notice search; casual greetings ("hi", "hello") do not.
- **Multilingual** — replies in **Auto / English / বাংলা / Banglish** (per-chat selector, remembered per user).
- **Conversation management** — new chat, resume latest chat, rename, pin, search, delete, "clear all".
- **Sharing** — generate a public link to any conversation; viewers don't need an account.
- **Export** — download any chat as **Markdown** or **JSON**.
- **Feedback** — like / dislike any AI answer to help tune quality.
- **Markdown answers** — tables, lists, code blocks (syntax highlighted), math (KaTeX), images.
- **Accounts** — registration, login, forgot/reset password, profile & avatar, JWT refresh rotation.
- **Quota meter** — live daily token usage shown in the sidebar.
- **Dark / light theme**, responsive layout (desktop / tablet / mobile).

### Admin Panel (`/admin`)
- **Dashboard** — users, conversations, messages, notices and token usage at a glance.
- **Users** — search, activate/deactivate, promote/demote admins, delete users (cascades their chats).
- **Notices** — upload PDF/image/text notices, paste notice text, categorize (general / exam / routine / result / admission / scholarship), reindex, delete, open the original file.
- **Chat history** — browse every message across all users with search, model, tokens and feedback.
- **Analytics** — token usage over time (day / month), top models, request counts.
- **Token usage** — today / month / all-time tokens, average per request, top models.
- **Settings** — app title/tagline, registration on/off, AI model, temperature, max tokens, system prompt, daily & monthly quotas, OpenRouter API key, UI toggles.
- **Prompt templates** — manage assistant personas / system instructions (active/inactive, default, edit, delete).
- **System logs** — filtered (error/warn/info/debug/http) log viewer.
- **System info** — server uptime, CPU, memory, Node version, MongoDB status and size.

---

## Tech Stack

### Backend (`AI-Chatbot-Backend`)
| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18.17, TypeScript |
| Web framework | Express 4 |
| Database | MongoDB + Mongoose 8 |
| AI provider | OpenRouter (model-agnostic: Gemini, GPT, Claude, DeepSeek, Llama…) |
| File storage | GridFS (files + avatars) |
| PDF parsing | `pdf-parse` |
| Image OCR | Vision model via OpenRouter (extracts text from notice images) |
| Auth | JWT access + refresh (bcryptjs hashing, cookie-parser) |
| Validation | Zod |
| Security | Helmet, CORS, rate limiting, `express-mongo-sanitize` |
| Logging | Winston (console + MongoDB collection) |
| Email | Nodemailer (SMTP) — password reset |

### Frontend (`AI-Chatbot-Frontend`)
| Layer | Technology |
|---|---|
| Build | Vite 5 + TypeScript |
| UI | React 18, custom CSS design system (`index.css`), react-icons |
| State | Zustand |
| Routing | React Router v6 (protected + admin guarded routes) |
| Markdown | react-markdown + remark-gfm + remark-math + rehype-katex + highlight.js |
| Streaming | fetch + ReadableStream (SSE from backend) |
| HTTP | Axios with automatic token refresh |
| Toasts | react-hot-toast |

---

## Architecture

```
┌────────────────────┐        ┌──────────────────────────────┐
│  React Frontend    │  HTTPS │  Express Backend (:3000)     │
│  (Vite, Zustand)   │ ─────► │  /api/v1/* versioned API     │
│  /chat /admin ...  │        │  /api/* legacy compatibility │
└────────────────────┘        │  SSE streaming chat          │
                              │  GridFS file serving         │
                              └───────────┬──────────────────┘
                                          │
                          ┌───────────────┼────────────────┐
                          ▼               ▼                ▼
                    ┌──────────┐    ┌───────────┐    ┌──────────────┐
                    │ MongoDB  │    │ OpenRouter│    │ SMTP (email) │
                    │ (notices,│    │ (LLM +    │    │ password     │
                    │ chats,   │    │  vision   │    │ reset        │
                    │ usage…)  │    │  OCR)     │    │              │
                    └──────────┘    └───────────┘    └──────────────┘
```

**Chat pipeline**

1. User sends a message (`POST /api/v1/conversations/:id/messages`).
2. Backend checks the user's **daily/monthly token quota** and rate limits.
3. If the question is notice-related, `searchNotices` finds relevant chunks (keyword + vector search).
4. `buildChatMessages` composes the prompt with the retrieved context, system prompt and language instruction (English / Bangla / Banglish).
5. The answer is streamed back via **SSE** events: `start`, `chunk`, `citations`, `done`, `error`.
6. Token usage is recorded (`ai_usage` collection) and citations carry `fileUrl` links to the original documents.

---

## Project Structure

```
Ai-Chatbot/
├── AI-Chatbot-Backend/
│   ├── src/
│   │   ├── server.ts                 # Entry point (DB connect → listen → graceful shutdown)
│   │   ├── app.ts                    # Express assembly (security, CORS, rate limit, routers)
│   │   ├── app/modules/              # Feature modules (feature-first):
│   │   │   ├── auth/                 #   register, login (user+admin), refresh, password reset
│   │   │   ├── user/                 #   profile, avatar, usage
│   │   │   ├── conversation/         #   conversations, share, export
│   │   │   ├── message/              #   streaming chat (SSE), regenerate, continue, feedback
│   │   │   ├── admin/                #   dashboard, users, notices, chats, analytics, settings…
│   │   │   ├── legacy/               #   legacy-compatible endpoints (incl. /api/files/:id)
│   │   │   └── analytics/            #   usage series & summaries
│   │   ├── config/                   # env, db, gridfs, logger (+Mongo transport)
│   │   ├── constants/                # roles, notice categories, defaults, seed templates
│   │   ├── database/models/          # Mongoose models (User, Admin, Conversation, Message,
│   │   │                             #   Notice, Chunk, AIUsage, ChatLog, Log, Setting,
│   │   │                             #   PromptTemplate, RefreshToken)
│   │   ├── database/seeders.ts       # seeds admin, settings, prompt templates
│   │   ├── middleware/               # auth, role, validate (zod), rate limiters, upload, errors
│   │   ├── repositories/             # data-access layer per entity
│   │   ├── services/                 # ai, notice, search, quota, settings, mailer, openrouter
│   │   ├── routes/v1.routes.ts       # /api/v1 mounting
│   │   └── utils/                    # text utils, token utils, response utils, helpers
│   └── .env
└── AI-Chatbot-Frontend/
    └── src/
        ├── pages/                    # landing, auth (login/register/password), chat, share, admin/*
        ├── components/               # layout (AppShell, AdminLayout, PublicLayout),
        │                             # chat (ChatComposer, MessageBubble, Citations, Markdown…),
        │                             # landing (Hero, ChatPreview…), ui (Button, Modal, StatCard…)
        ├── store/                    # Zustand: auth.store, chat.store
        ├── hooks/useChatSession.ts   # SSE streaming session logic
        ├── lib/                      # api (axios + refresh), theme, format
        ├── routes/guards.tsx         # ProtectedRoute / AdminRoute / PublicOnlyRoute
        └── types/                    # shared TypeScript types
```

---

## Prerequisites

- **Node.js ≥ 18.17** (20+ recommended)
- **MongoDB** — local instance, or a cloud URI (MongoDB Atlas)
- An **OpenRouter API key** — https://openrouter.ai/keys
- (Optional) SMTP credentials for password-reset emails

---

## Environment Variables

### Backend (`AI-Chatbot-Backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API port |
| `NODE_ENV` | `development` | `production` enables prod behavior |
| `APP_BASE_URL` | `https://departmental-ai-chatbot-dkpf.vercel.app` | Public frontend URL — used for password-reset links and the OpenRouter referrer. Local dev: `http://localhost:5173` |
| `APP_TITLE` | `AI Chatbot` | App name shown in emails |
| `CORS_ORIGIN` | — | Comma-separated allowed origins: `https://departmental-ai-chatbot-dkpf.vercel.app,http://localhost:5173` (any `localhost` port is always allowed) |
| `DB_NAME` | `ChatBot_DB` | MongoDB database name |
| `MONGO_URI` | — | **Required.** MongoDB connection string |
| `VECTOR_INDEX_NAME` | `notice_vector_index` | Atlas Search vector index name |
| `OPENROUTER_API_KEY` | — | **Required for AI answers.** OpenRouter key |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter endpoint |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash-lite` | Default AI model |
| `OPENROUTER_MAX_TOKENS` | `700` | Max completion tokens |
| `JWT_ACCESS_SECRET` | dev-only | Access token secret (**change in production**) |
| `JWT_REFRESH_SECRET` | dev-only | Refresh token secret (**change in production**) |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Refresh token lifetime |
| `ADMIN_EMAIL` | `admin@gmail.com` | Seeded admin email |
| `ADMIN_PASSWORD` | `admin123` | Seeded admin password (**change in production**) |
| `ADMIN_NAME` | `Administrator` | Seeded admin name |
| `DAILY_QUOTA_PER_USER` | `40000` | Daily token quota per user (`0` = unlimited) |
| `MONTHLY_QUOTA_PER_USER` | `0` | Monthly token quota per user (`0` = unlimited) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | — | SMTP config for password reset emails |

### Frontend (`AI-Chatbot-Frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `https://departmental-ai-chatbot-tzpe.vercel.app` | Backend base URL. Local dev: `http://localhost:3000` |

> **Note:** only `VITE_API_BASE_URL` is required for the frontend; never put secrets in a `VITE_` variable. It is a **build-time** variable — after changing it in the Vercel dashboard you must redeploy.

---

## Local Setup

### 1. Backend

```bash
cd AI-Chatbot-Backend
npm install

# configure environment
copy .env.example .env    # (or create .env with the variables above)

npm run dev               # starts tsx watch on http://localhost:3000
```

On boot the server:
- connects to MongoDB and builds indexes,
- seeds the **default admin** (`admin@gmail.com` / `admin123` by default — change via env),
- seeds **default settings** and **prompt templates** if missing.

Verify: `GET http://localhost:3000/api/v1/health` → `{ "success": true, "status": "ok" }`

### 2. Frontend

```bash
cd AI-Chatbot-Frontend
npm install

# point the frontend at the backend
# create .env:  VITE_API_BASE_URL=http://localhost:3000

npm run dev               # vite dev server (default http://localhost:5173)
```

Open the printed URL, register an account (or log in as admin via **Login → "Sign in as administrator"**), and start chatting.

---

## Available Scripts

### Backend
| Command | Description |
|---|---|
| `npm run dev` | Watch mode via `tsx watch` |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Build + run production server (`node dist/server.js`) |
| `npm run start:dev` | Run without watch |
| `npm run typecheck` | `tsc --noEmit` |

### Frontend
| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Typecheck (`tsc -b`) + production build → `dist/` |
| `npm run typecheck` | TypeScript check only |
| `npm run preview` | Serve the production build locally |

---

## Database

MongoDB collections (Mongoose models in `src/database/models/`):

| Collection | Purpose |
|---|---|
| `users` | End-user accounts (role `user`/`admin`) |
| `admins` | Administrator accounts (role `superadmin`) |
| `conversations` | Chat threads per user (title, pinned, archived, share token) |
| `messages` | Messages in conversations (role, status, tokens, feedback) |
| `notices` | Uploaded notices (title, category, type, raw text, summary, fileId) |
| `chunks` | Text chunks of notices for keyword search (`normalizedChunkText`) |
| `ai_usage` | Per-request token usage (model, prompt/completion tokens, type) |
| `prompt_templates` | Assistant personas / system instructions |
| `settings` | Key-value app settings (admin-editable) |
| `logs` | Winston log entries (error/warn/info/debug/http) |
| `chat_logs` | Chat event log |
| `refresh_tokens` | Rotating refresh tokens (hashed) |
| GridFS `fs.files` / `fs.chunks` | Uploaded notice files & user avatars |

---

## API Reference

All endpoints are prefixed with `/api/v1`. Protected routes require `Authorization: Bearer <access_token>` (the frontend refreshes automatically).

Live API base: `https://departmental-ai-chatbot-tzpe.vercel.app` — local: `http://localhost:3000`.

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/health` | Liveness check |

### Auth (`/api/v1/auth`)
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create user account |
| POST | `/auth/login` | User login |
| POST | `/auth/login/admin` | Admin login |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke session |
| POST | `/auth/forgot-password` | Send reset email |
| POST | `/auth/reset-password` | Set new password with token |
| GET | `/auth/me` | Current user (protected) |
| POST | `/auth/change-password` | Change password (protected) |

### Users (`/api/v1/users` — protected)
| Method | Path | Description |
|---|---|---|
| GET | `/users/me` | Profile |
| PATCH | `/users/me` | Update name/email |
| POST | `/users/me/avatar` | Upload avatar (multipart) |
| GET | `/users/me/usage` | Daily/monthly token usage + quota |

### Conversations (`/api/v1/conversations` — protected)
| Method | Path | Description |
|---|---|---|
| GET | `/conversations?search=&limit=` | List conversations |
| POST | `/conversations` | Create conversation |
| GET | `/conversations/:id` | Conversation + messages |
| PATCH | `/conversations/:id` | Rename / pin / archive |
| DELETE | `/conversations/:id` | Delete conversation |
| DELETE | `/conversations/clear-all` | Delete all conversations |
| GET | `/conversations/share/:token` | Public shared chat (no auth) |
| GET | `/conversations/:id/export?format=markdown\|json` | Export chat |
| POST | `/conversations/:id/share` | Enable/disable sharing |

### Messages (`/api/v1/conversations/:id/messages` — protected, AI-limited)
| Method | Path | Description |
|---|---|---|
| POST | `/messages` | Send message — **SSE stream** |
| POST | `/messages/regenerate` | Regenerate last answer — SSE |
| POST | `/messages/continue` | Continue the answer — SSE |
| POST | `/messages/:messageId/feedback` | Like / dislike an answer |

SSE event types: `start` · `chunk` (partial text) · `citations` (sources) · `done` · `error`.

### Admin (`/api/v1/admin` — admin only)
| Method | Path | Description |
|---|---|---|
| GET | `/admin/dashboard` | Summary stats |
| GET | `/admin/users?search=&page=&limit=` | List users |
| PATCH | `/admin/users/:id` | Update user (name, email, role, isActive) |
| DELETE | `/admin/users/:id` | Delete user + cascades chats |
| GET | `/admin/notices?category=` | List notices |
| GET | `/admin/notices/:id` | Notice detail |
| POST | `/admin/notices` | Create notice (file upload + text) |
| PUT | `/admin/notices/:id` | Update notice (re-indexes text) |
| POST | `/admin/notices/:id/reindex` | Rebuild search chunks |
| DELETE | `/admin/notices/:id` | Delete notice + file |
| GET | `/admin/chats?search=&page=&limit=` | All messages across users |
| GET | `/admin/analytics/usage?groupBy=day\|month` | Usage analytics |
| GET | `/admin/tokens/usage` | Token overview (today/month/all-time, models) |
| GET | `/admin/settings` | All settings |
| PUT | `/admin/settings` | Update settings (`entries: [{key, value}]`) |
| GET | `/admin/settings/api-key` | Masked OpenRouter key status |
| GET/POST | `/admin/prompt-templates` | List / create templates |
| PATCH/DELETE | `/admin/prompt-templates/:id` | Update / delete template |
| GET | `/admin/logs?level=&page=&limit=` | System logs |
| GET | `/admin/system` | Server / MongoDB status |

### Files (public)
| Method | Path | Description |
|---|---|---|
| GET | `/api/files/:fileId` | Stream any uploaded file (notice PDF/image, avatar) |

---

## AI & Quota System

- **Provider:** OpenRouter — one API key gives access to many models (Gemini, GPT, Claude, DeepSeek, Llama…). The active model is configurable in **Admin → Settings**.
- **Quotas:** per-user **daily** and **monthly** token limits. `0` means unlimited. Exhaustion returns HTTP 429 with the message *"Your AI API quota has been exhausted…"* and the composer is disabled for that user.
- **Usage tracking:** every request writes a row to `ai_usage` (model, prompt tokens, completion tokens, request type) — the source of all admin analytics.
- **RAG pipeline:** notice files are parsed (PDF text extraction, image OCR via a vision model, plain text), summarized, chunked and indexed. Answers are grounded in the matched chunks, and citations link back to the source files.

---

## Deployment

Current live deployments:

- Frontend: **https://departmental-ai-chatbot-dkpf.vercel.app**
- Backend: **https://departmental-ai-chatbot-tzpe.vercel.app**

The repository is a single repo containing both apps. Each app deploys as its own Vercel (or Railway) project using **Root Directory** pointing at its folder.

### Backend — Vercel (serverless functions)
1. Import the repo into Vercel as a new project and set **Root Directory** to `AI-Chatbot-Backend`.
2. Framework preset **Other**, build command `npm run vercel-build`, install command `npm install` (defaults are fine).
3. Set the environment variables from [Environment Variables](#environment-variables) — especially `MONGO_URI`, `OPENROUTER_API_KEY`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `CORS_ORIGIN` (your frontend URL).
4. The API is served by the serverless function in `api/index.ts` (the Express app without `app.listen`). `vercel.json` configures it with:
   - `maxDuration: 60` — AI responses stream over SSE and can exceed the 10 s default (Pro plans may raise this to 300).
   - `regions: ["iad1"]` — a single region so in-memory rate-limiters and the model's streams stay consistent.
   - Streaming needs no extra flag — Vercel enables response streaming for Node.js functions by default.
5. Database connection: `src/config/db.ts` is serverless-safe (reuses the connection per warm instance, builds indexes and seeds the admin account on first connect).
6. Limitations to know: Vercel caps request bodies at ~4.5 MB, so very large notice uploads should be handled off-platform; SMTP is only used for password reset emails.

### Backend — Railway (or any Node host)
1. Import the repo and set **Root Directory** to `AI-Chatbot-Backend` (Railway auto-detects the Node service).
2. Set the environment variables from [Environment Variables](#environment-variables) (especially `MONGO_URI` and `OPENROUTER_API_KEY`).
3. The start command is `npm start` (builds then runs `dist/server.js`).
4. Whitelist your frontend origin in `CORS_ORIGIN`.

### Frontend — Vercel
1. Import the repo and set **Root Directory** to `AI-Chatbot-Frontend` (it contains a `vercel.json` with the correct SPA rewrite).
2. Set `VITE_API_BASE_URL` to the deployed backend URL.
3. Deploy — framework preset **Vite**, build command `npm run build`, output `dist`.

---

## Security

- Helmet security headers, disabled `x-powered-by`, CORS allow-list with credentials.
- Rate limiting: global (`/api`), auth endpoints, and a stricter limiter on AI endpoints.
- Zod request validation on every route + `express-mongo-sanitize` against query-injection.
- Passwords hashed with bcrypt; refresh tokens stored hashed and rotated.
- Admin secrets (OpenRouter key) are masked in the UI and never returned in full.
- Role guards (`user` / `admin`) on all admin routes.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Your AI API quota has been exhausted" | Top up your OpenRouter balance or increase `DAILY_QUOTA_PER_USER` / `MONTHLY_QUOTA_PER_USER` in Admin → Settings (or `.env`). |
| AI returns errors immediately | Check `OPENROUTER_API_KEY` in `.env` and the API-key card on **Admin → Settings**. |
| CORS error in the browser | Ensure `CORS_ORIGIN` includes your frontend origin (any `localhost` port is always allowed). |
| Files 404 in chat citations | The notice was uploaded without a file (text-only) or the file was deleted. Re-upload it in **Admin → Notices**. |
| Backend won't start | Verify `MONGO_URI` is set and reachable; check the console log for the startup error. |
| Password-reset email not sent | Configure the SMTP variables; without SMTP, reset links are only logged server-side. |
| Old UI still showing | Hard-refresh (Ctrl+Shift+R); Vite caches modules aggressively in dev. |

---

## User Manual

See **[USER_MANUAL.md](./USER_MANUAL.md)** for a complete guide covering:

- the **user panel** (chatting, sources, language, sharing, exporting, quotas),
- the **admin panel** (every page, feature and workflow explained step by step).
