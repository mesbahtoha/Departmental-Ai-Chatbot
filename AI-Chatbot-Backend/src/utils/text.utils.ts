/**
 * Text normalization & search utilities.
 * Ported 1:1 from the legacy monolith (index.js) to preserve exact behavior.
 */

export function normalizeText(text: unknown): string {
  return String(text ?? '')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeForSearch(text: unknown): string {
  return normalizeText(text).toLowerCase();
}

/**
 * Keywords that indicate a question is about notices (exams, routines, fees,
 * scholarships, admission, results, etc.). Sources/RAG context should only be
 * surfaced when the query is notice-related. Covers English, Bengali, and
 * Banglish (Bengali written in Latin letters).
 */
const NOTICE_KEYWORDS = [
  // English
  'exam', 'routine', 'timetable', 'time table', 'schedule', 'class', 'classes',
  'fee', 'fees', 'scholarship', 'waiver', 'admission', 'result', 'results',
  'notice', 'notices', 'deadline', 'credit', 'credits', 'semester', 'course',
  'courses', 'attendance', 'lab', 'viva', 'thesis', 'syllabus', 'academic',
  'calendar', 'holiday', 'registration', 'withdraw', 'date sheet', 'marksheet',
  'transcript', 'bus', 'room', 'section', 'teacher', 'faculty', 'department',
  'session', 'stipend', 'tuition', 'fee waiver', 'admit card', 'hall',
  'dues', 'pay', 'payment', 'financial', 'aid', 'grant',
  // Bengali
  'পরীক্ষা', 'রুটিন', 'ফি', 'বৃত্তি', 'ভর্তি', 'ফলাফল', 'নোটিশ', 'ক্লাস',
  'শিক্ষার্থী', 'বাস', 'রুম', 'সেমিস্টার', 'কোর্স', 'ডেডলাইন', 'অ্যাডমিশন',
  'রেজাল্ট', 'সময়সূচি', 'তফসিল', 'নোটিশ', 'অনুমতি', 'ল্যাব', 'বিভাগ',
  'শিক্ষক', 'ভর্তি পরীক্ষা', 'বেতন', 'টিউশন', 'হল', 'আবেদন', 'ফরম',
  // Banglish
  'porikkha', 'exam', 'rutin', 'routine', 'fee', 'britti', 'scholarship',
  'vorti', 'admission', 'result', 'rezult', 'notis', 'notice', 'bus', 'room',
  'class', 'clas', 'semester', 'course', 'deadline', 'taka', 'bivag',
  'shikkhok', 'lab', 'dealine', 'fees',
];

export function isNoticeRelatedQuery(query: unknown): boolean {
  const q = normalizeForSearch(query);
  if (!q) return false;
  return NOTICE_KEYWORDS.some((keyword) => q.includes(keyword));
}

export function buildPreview(text: unknown, maxLength = 280): string {
  const clean = normalizeText(text).replace(/\n/g, ' ');
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength)}...`;
}

export function uniqueArray<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function tokenize(text: unknown): string[] {
  return normalizeForSearch(text)
    .replace(/[^\p{L}\p{N}\s/-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'am', 'i', 'you', 'he', 'she',
  'it', 'they', 'we', 'to', 'for', 'of', 'in', 'on', 'at', 'and', 'or', 'from',
  'with', 'by', 'about', 'what', 'when', 'where', 'which', 'who', 'how', 'do',
  'does', 'did', 'can', 'could', 'please', 'tell', 'me', 'my', 'our', 'your',
  'notice', 'notices', 'department', 'university', 'give', 'show',
]);

export function removeStopWords(words: string[]): string[] {
  return words.filter((w) => !STOP_WORDS.has(w));
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits a large document into overlapping chunks for keyword retrieval. */
export function chunkText(text: unknown, chunkWordSize = 180, overlapWords = 40): string[] {
  const clean = normalizeText(text);
  if (!clean) return [];

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paragraphs.length) return [];

  const chunks: string[] = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (!buffer.length) return;
    const piece = buffer.join('\n\n').trim();
    if (piece) chunks.push(piece);
    buffer = [];
  };

  for (const paragraph of paragraphs) {
    const paraWords = paragraph.split(/\s+/);
    if (paraWords.length > chunkWordSize * 1.4) {
      flushBuffer();
      let start = 0;
      while (start < paraWords.length) {
        const end = Math.min(start + chunkWordSize, paraWords.length);
        const chunk = paraWords.slice(start, end).join(' ').trim();
        if (chunk) chunks.push(chunk);
        if (end === paraWords.length) break;
        start = Math.max(end - overlapWords, start + 1);
      }
      continue;
    }

    const currentWords = buffer.join(' ').split(/\s+/).filter(Boolean).length;
    if (currentWords + paraWords.length <= chunkWordSize) {
      buffer.push(paragraph);
    } else {
      flushBuffer();
      buffer.push(paragraph);
    }
  }

  flushBuffer();
  return uniqueArray(chunks);
}

/** Ranks how strongly a query matches a piece of text (legacy scoring). */
export function computeKeywordScore(haystack: unknown, query: unknown): number {
  const text = normalizeForSearch(haystack);
  const q = normalizeForSearch(query);

  if (!text || !q) return 0;

  let score = 0;
  if (text.includes(q)) score += 50;

  const queryTokens = removeStopWords(tokenize(q));
  for (const token of queryTokens) {
    const regex = new RegExp(`\\b${escapeRegex(token)}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) score += matches.length * 6;
  }

  return score;
}

export function detectLanguage(query: string): 'bn' | 'en' {
  const bnRegex = /[\u0980-\u09FF]/;
  return bnRegex.test(query) ? 'bn' : 'en';
}

export function isGreetingIntent(query: string): boolean {
  const q = normalizeForSearch(query);
  return /^(hi|hello|hey|assalamu alaikum|salam|good morning|good evening|good afternoon)\b/.test(q);
}

export function isSummaryIntent(query: string): boolean {
  const q = normalizeForSearch(query);
  const patterns = [
    /\bsummar(y|ize|ise)\b/,
    /\bbrief\b/,
    /\bshort\b/,
    /\boverview\b/,
    /\bgist\b/,
    /সংক্ষেপ/,
    /সারাংশ/,
    /ছোট করে/,
  ];
  return patterns.some((pattern) => pattern.test(q));
}

export function isFullNoticeIntent(query: string): boolean {
  const q = normalizeForSearch(query);
  const patterns = [
    /\bfull\b/,
    /\bcomplete\b/,
    /\boriginal\b/,
    /\bopen\b/,
    /\bshow\b.*\b(pdf|image|notice|routine|document|file)\b/,
    /\bgive\b.*\b(pdf|image|notice|routine|document|file)\b/,
    /পুরো/,
    /ফুল/,
    /সম্পূর্ণ/,
    /নোটিশটা দাও/,
    /রুটিনটা দাও/,
    /পিডিএফ/,
    /ইমেজ/,
    /ছবিটা দাও/,
    /পুরোটা/,
  ];
  return patterns.some((pattern) => pattern.test(q));
}

export function safeJsonParse<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Estimates tokens from character count (used when the API omits usage). */
export function estimateTokens(text: string): number {
  const clean = normalizeText(text);
  if (!clean) return 0;
  return Math.max(1, Math.ceil(clean.length / 4));
}

/** Rough USD cost estimate per 1k tokens for common cheap models. */
export function estimateCostUsd(totalTokens: number): number {
  return (totalTokens / 1000) * 0.00015;
}

export function now(): Date {
  return new Date();
}
