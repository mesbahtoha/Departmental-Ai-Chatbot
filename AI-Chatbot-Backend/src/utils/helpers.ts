import { Types } from 'mongoose';

/** Converts a value to a Mongoose ObjectId or null. */
export function toMongooseId(id: string | Types.ObjectId | null | undefined): Types.ObjectId | null {
  try {
    if (!id) return null;
    if (id instanceof Types.ObjectId) return id;
    return new Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/** Safe pagination parsing: returns { page, limit, skip }. */
export function parsePagination(
  query: Record<string, unknown>,
  defaultLimit = 20,
  maxLimit = 100
): { page: number; limit: number; skip: number } {
  const rawPage = Number(query.page ?? 1);
  const rawLimit = Number(query.limit ?? defaultLimit);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), maxLimit)
      : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
}

/** Strips an object down to allowed keys (whitelist DTO). */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  source: T,
  keys: readonly K[]
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) {
      (out as Record<string, unknown>)[key as string] = value;
    }
  }
  return out;
}
