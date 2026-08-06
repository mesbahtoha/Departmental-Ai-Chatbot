# NoticeFlow — User Manual

This manual explains how to use the **NoticeFlow** AI chatbot, covering both the **User Panel** (regular accounts) and the **Admin Panel** (dashboard and all administrative features).

> Two kinds of accounts exist:
>
> - **User account** — created via the public registration page; used to chat with the AI assistant.
> - **Admin account** — created automatically by the backend on first boot (default `admin@gmail.com` / `admin123`, changeable via `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars).

---

## Table of Contents

- [1. Getting Started](#1-getting-started)
  - [Create an account](#create-an-account)
  - [Log in](#log-in)
  - [Log in as administrator](#log-in-as-administrator)
  - [Forgot password](#forgot-password)
- [2. User Panel](#2-user-panel)
  - [The chat screen](#the-chat-screen)
  - [Asking questions](#asking-questions)
  - [Languages](#languages)
  - [Sources & citations](#sources--citations)
  - [Message actions](#message-actions)
  - [Sidebar & conversation management](#sidebar--conversation-management)
  - [Sharing a conversation](#sharing-a-conversation)
  - [Exporting a conversation](#exporting-a-conversation)
  - [Viewing a shared chat](#viewing-a-shared-chat)
  - [Account & sidebar footer](#account--sidebar-footer)
  - [Token quota](#token-quota)
- [3. Admin Panel](#3-admin-panel)
  - [Accessing the admin panel](#accessing-the-admin-panel)
  - [Dashboard](#dashboard)
  - [Users](#users)
  - [Notices](#notices)
  - [Chat History](#chat-history)
  - [Analytics](#analytics)
  - [Token Usage](#token-usage)
  - [Settings](#settings)
  - [Prompt Templates](#prompt-templates)
  - [System Logs](#system-logs)
  - [System Info](#system-info)
- [4. FAQ](#4-faq)

---

## 1. Getting Started

### Create an account

1. Open the app home page and click **Start Chatting Free** (or **Get started** in the top-right corner).
2. Fill in your **name**, **email** and **password**, then submit.
3. You are logged in automatically and land on a fresh chat screen.

> Registration can be disabled by an administrator (see [Settings → App Settings](#app-settings)).

### Log in

1. Click **Log In** (on the landing page) or **Login** in the header.
2. Enter your email and password, then click **Log in**.
3. You land on your latest conversation (or a new one if you have none).

### Log in as administrator

1. On the **Login** page, tick **"Sign in as administrator"**.
2. Enter the admin email and password, then click **Log in**.
3. You are redirected to the **Admin Panel** (`/admin`).

> Ticking the checkbox sends the credentials to the dedicated admin-login endpoint — regular user accounts will **not** authenticate there.

### Forgot password

1. On the login page click **Forgot password?**.
2. Enter your email and submit. If SMTP is configured, a reset link is emailed to you; otherwise the reset link is written to the backend logs.
3. Open the link, enter a new password and confirm — you can then log in with it.

---

## 2. User Panel

### The chat screen

The chat area is divided into:

- **Sidebar (left)** — "New chat" button, conversation search box, your conversation list, your **daily token quota** meter, and the footer (your name/email, theme toggle, logout, and — for admins — the **Admin panel** shortcut).
- **Main area** — the top bar ("Clear all" + conversation title with Rename / Share / Export / Delete) and the message thread.
- **Composer (bottom)** — always visible and fixed: the input box, the **language selector** inside the box, and the Send/Stop button.

### Asking questions

1. Type your question in the input box.
2. Press **Enter** (or click the **send** button) to send.
3. The AI answer **streams in token by token**. While it streams, a **stop** button appears — click it to halt generation.
4. When the answer finishes it is stored in the conversation history.

Tips:

- Questions about **exam routines, results, fees, admission, scholarships and notices** give the best answers — they trigger a search of the uploaded notice documents.
- Casual greetings ("hi", "hello") are answered directly without document search.
- You can ask follow-up questions; the assistant keeps the conversation context.

### Languages

The composer has a language dropdown with four options:

| Option | Behavior |
|---|---|
| 🌐 **Auto** | The AI answers in the same language you used (English ↔ বাংলা ↔ Banglish). |
| **English** | Answers are forced to English. |
| **বাংলা** | Answers are forced to Bengali. |
| **Banglish** | Answers are forced to Banglish (Bengali written in Latin script, e.g. "porikkha kobe?") |

The selection is remembered for your browser (stored locally) and applies to every answer in every conversation until you change it.

### Sources & citations

- When the answer is based on notices, the message shows **file chips** below the text (e.g. `PDF` `IMG` `DOCX`) with the notice title.
- Clicking a chip opens the **original document** (PDF / image / etc.) in a new tab.
- A separate icon links to the **full notice** in the admin notice viewer (if the URL is available).

### Message actions

Every AI message offers:

- **Copy** — copies the full answer text to the clipboard (icon shown on hover).
- **Like / Dislike** — gives feedback that appears in the admin **Chat History** page (👍 Like / 👎 Dislike badges).
- **Markdown rendering** — answers support bold, lists, tables, inline code, fenced code blocks (syntax-highlighted), math (LaTeX via KaTeX) and images.

### Sidebar & conversation management

| Action | How |
|---|---|
| **New chat** | Click **"New chat"** at the top of the sidebar. |
| **Resume a chat** | Click any conversation in the list. |
| **Search conversations** | Type in the search box above the list (searches titles). |
| **Rename** | In the open conversation, click **Rename**, type the new title, save. |
| **Delete one** | Hover a conversation and click the trash icon; confirm. |
| **Clear all** | Click **"Clear all"** in the top bar of the chat screen; confirm to remove every conversation. |

> Conversations that were pinned by an administrator are shown at the top of the list with a 📌 icon. After deleting all conversations, the app automatically creates a fresh chat — no error is shown.

### Sharing a conversation

1. Open the conversation and click **Share**.
2. A share link is created and **copied to your clipboard** (a toast confirms it).
3. Anyone with the link can view the chat **without an account** at `/share/<token>`.

> The link stays valid while the conversation exists. There is no "unshare" toggle in the UI — deleting the conversation disables the link.

### Exporting a conversation

1. Open the conversation and click **Export**.
2. Choose **Markdown** (`.md`) or **JSON** (`.json`) — the file downloads immediately.
3. JSON contains the full structured data (messages, roles, timestamps); Markdown is human-readable for sharing in documents.

### Viewing a shared chat

The public share page shows the conversation title, the sharer's name, the date, and every message rendered with markdown. A footer invites visitors to create their own account.

### Account & sidebar footer

The sidebar footer shows your **avatar, name and email**, plus three buttons:

- **Theme toggle** — switch between light and dark mode (your choice is remembered).
- **Admin panel** — visible only for admin accounts; jumps to `/admin`.
- **Logout** — ends the session and returns to the landing page.

### Token quota

- Your **daily token usage** is shown at the bottom of the sidebar as a "Daily tokens" progress bar (used / limit), whenever a limit is configured.
- When your daily (or monthly) quota is exhausted the composer is disabled with the message *"Your AI API quota has been exhausted…"*.
- Limits are set by an administrator in **Admin → Settings → AI & Quotas** (0 = unlimited).

---

## 3. Admin Panel

### Accessing the admin panel

- Log in with the **admin** account using the **"Sign in as administrator"** checkbox on the login page, or
- Click **Open app** after logging in as an admin, then use the **Back to chat app** link in the admin sidebar to switch back.

The admin panel has a sidebar with **10 pages**. On smaller screens use the **hamburger menu** (☰) in the top bar.

### Dashboard

A high-level overview of the whole deployment:

- **Total users** (with the number of active accounts)
- **Conversations** (all time)
- **Messages** (all time, plus how many in the last 7 days)
- **Notices** (uploaded documents)
- **Tokens today** (with request count)
- **Tokens this month** (with total requests)

Plus **Quick actions** shortcuts to manage notices, users and settings.

### Users

Manage every registered account:

| Feature | How it works |
|---|---|
| **Search** | Filter by name or email (searches as you type). |
| **Pagination** | 20 users per page with page controls. |
| **Disable / Enable** | Toggle `isActive` — disabled users cannot log in or chat (their data is kept). |
| **Make admin / Demote** | Promote a user to admin (gives full panel access) or demote back to user. |
| **Delete** | Permanently removes the user **and cascades**: their conversations and messages are deleted too. A confirmation dialog warns about this. |

Columns show avatar, name/email, role badge, status badge (Active/Disabled), last login and join date.

### Notices

This is the heart of the product — the documents the AI answers from.

**Adding a notice**

1. Click **New notice**.
2. **Title** (required) — e.g. "Spring 2026 Final Exam Routine".
3. **Category** — one of: `general`, `exam`, `routine`, `result`, `admission`, `scholarship` (used for filtering and search hints).
4. Provide the content **one of two ways**:
   - **File** — upload a PDF, image (PNG/JPG — OCR extracts the text automatically) or a text file (`.txt`, `.md`); or
   - **Notice text** — paste the raw notice content in the textarea.
5. Click **Create notice**.

On creation the backend: extracts the text (PDF parse / image OCR / raw text), generates a short AI **summary**, **chunks** the text for search, and marks the notice `ready`.

**Notice table**

| Column | Meaning |
|---|---|
| Notice | Title + AI-generated summary |
| Category | The notice category badge |
| Type | `pdf` / `image` / `text` / `file` (+ mime type) |
| Searchable | Number of search chunks, or "Not indexed" warning |
| Added | Creation date |

**Actions per notice**

- **Open** — opens the original uploaded file in a new tab.
- **Reindex** — rebuilds the search chunks from the stored text. Use this after fixing a notice's content or if search results look stale.
- **Delete** — removes the notice, its chunks and its stored file.

**Editing** — the modal supports changing title/category and pasting updated notice text; when text changes the notice is **automatically re-indexed**.

> The **category filter** at the top filters the list (e.g. show only `routine` notices).

### Chat History

Browse **every message** sent by every user across all conversations:

- **Search** filters by message content or conversation title.
- Columns: role (User/Assistant), message preview (tooltip shows the full text), conversation title, AI model, tokens used, **feedback** (👍 Like / 👎 Dislike badges) and timestamp.
- Paginated, 20 rows per page, newest first.

Use this page to audit answers, monitor quality and see how users are interacting.

### Analytics

Visualize AI usage over time:

- **Group by** toggle: day or month.
- Stat cards: tokens in the range, requests (with average tokens/request), tokens today.
- **Bar chart** of token usage over time.
- **Top models** with percentage bars (tokens, requests and share of usage).

### Token Usage

A focused view of LLM cost consumption:

- **API key status** badge (configured/missing) and account counts (users · admins).
- **Tokens today / this month / all time** and **average tokens per request**.
- **Usage by model (last 30 days)** — table of model, tokens, requests, avg tokens/request.

Use this to estimate OpenRouter spend and decide on quota limits.

### Settings

A key-value settings editor grouped into cards, saved with **Save changes**:

**Application** (`app.*`)
- `app.title` — the app name shown in emails/UI.
- `app.tagline` — short tagline.
- `app.allowRegistration` — toggle **public registration** on/off.

**AI & Quotas** (`ai.*`)
- `ai.model` — the active OpenRouter model (Gemini 2.5 Flash Lite / Pro, GPT-4o / 4o-mini, Claude 3.5 Sonnet, Llama 3.3 70B, DeepSeek Chat…).
- `ai.temperature` — creativity slider (0–1; 0.15 recommended for factual notice answers).
- `ai.maxTokens` — max completion length per answer.
- `ai.systemPrompt` — extra system instructions prepended to every request.
- `ai.dailyQuotaPerUser` / `ai.monthlyQuotaPerUser` — per-user token limits (**0 = unlimited**).
- `ai.openRouterApiKey` — can be set here instead of `.env` (stored in the database).

**Interface** (`ui.*`)
- `ui.showTokenUsage` — show/hide the user's quota meter in the sidebar.
- `ui.showSuggestedPrompts` — show/hide suggested prompt chips.

At the top of the page a status card shows whether the **OpenRouter API key** is configured (masked preview, e.g. `sk-or-v1-…aB3`).

> Changes apply immediately — no restart needed.

### Prompt Templates

Templates are reusable **system instructions (personas)** for the assistant:

- **Default templates** are seeded on first boot: "Helpful Assistant" (default, active) and "Notice Assistant (RAG)" (inactive — a strict notices-only persona).
- **Create** a template with Name, Key (auto-format `lowercase-letters-and-dashes`, unique), Description and Prompt content.
- Each card shows: name, key, description, the prompt content (monospace preview), badges for **default** and **active/inactive**, created date.
- **Toggle Active** turns the template on/off for chat requests.
- **Edit** opens the modal pre-filled; **Delete** removes it (with confirmation).

> A template must be active to influence answers; only one can be flagged `isDefault`.

### System Logs

A searchable view of backend logs written by Winston:

- Filter by **level**: `error`, `warn`, `info`, `debug`, `http` (or "All levels").
- Columns: level badge, message, metadata (JSON, tooltip with full details) and timestamp.
- 50 entries per page, newest first.

Use `error` level to debug failures (AI calls, uploads, auth issues).

### System Info

Live server diagnostics:

- **Uptime** (human-readable) and Node version.
- **CPU cores** and load average.
- **Server memory** — free MB, percentage used.
- **Process memory** — heap used/total and RSS.
- **Server details** — environment, platform, app base URL, AI model.
- **MongoDB card** — connection status badge (connected/disconnected), server version, database size (MB) and collection count.

---

## 4. FAQ

**Q: Why does the AI sometimes answer without sources?**
The question was a greeting or general conversation (no notice search), or the notice content doesn't contain a matching answer — the AI says so explicitly rather than inventing facts.

**Q: A PDF I uploaded doesn't give good answers.**
Scanned PDFs contain images, not text. Upload the scan as an **image** (OCR extracts it) or paste the text version. After fixing, use **Reindex** on the notice.

**Q: Users say "quota exhausted" but we just topped up OpenRouter.**
Quotas are independent of the OpenRouter balance. Raise `ai.dailyQuotaPerUser` / `ai.monthlyQuotaPerUser` in **Admin → Settings** (0 = unlimited).

**Q: Can I make someone an admin from the panel?**
Yes — **Admin → Users → "Make admin"**. They can then log in via the "Sign in as administrator" checkbox.

**Q: Where are uploaded files stored?**
In **MongoDB GridFS** (same database). Deleting a notice deletes its file too.

**Q: How do I change the default admin password?**
Set `ADMIN_PASSWORD` in the backend `.env` **before** first boot, or manage admins through **Admin → Users** (promote/demote) once running.
