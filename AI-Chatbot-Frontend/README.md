# NoticeFlow Frontend

A ready-to-run React + Vite frontend for your notice bot backend.

## Setup

1. Install Node.js 20+
2. Copy `.env.example` to `.env`
3. Run:

```bash
npm install
npm run dev
```

## Backend base URL

Set:

```env
VITE_API_BASE_URL=http://localhost:3000
```

## Product split

- Admin: upload/manage notices only
- User: search + AI ask + full notice view + feedback
