import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionCookie, SESSION_COOKIE } from './lib/auth';

// Public paths — no auth required.
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/auth/me'];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // static assets / next internals
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) return true;
  if (pathname.startsWith('/samples/')) return true;   // public sample files
  return false;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySessionCookie(cookie);

  if (!session) {
    // For API routes — return 401 JSON; for pages — redirect to /login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|samples/).*)'],
};
