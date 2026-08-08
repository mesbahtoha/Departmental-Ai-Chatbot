/**
 * Edge Middleware - runs at the edge, before Vercel's route resolution.
 *
 * The legacy root index.js function (deleted long ago) left a ghost route
 * for "/" that hangs until the 300s runtime timeout. Rewrites and static
 * files can't overtake it, but edge middleware executes first, so "/" is
 * rewritten here to the live API function.
 */
import { NextRequest, NextResponse } from '@vercel/edge';

export default function middleware(req: NextRequest): NextResponse {
  const { pathname } = new URL(req.url);
  if (pathname === '/') {
    return NextResponse.rewrite(new URL('/api', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/'] };
