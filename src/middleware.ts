import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'rm_session';

const adminRoutes = ['/games', '/report', '/agents', '/available', '/verify'];
const agentRoutes = ['/agent/games', '/agent/summary', '/agent/numbers'];

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');
}

async function getSessionFromRequest(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as { role?: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await getSessionFromRequest(req);

  if (pathname === '/admin/login') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (pathname === '/login') {
    if (session?.role === 'agent') {
      return NextResponse.redirect(new URL('/agent/games', req.url));
    }
    if (session?.role === 'admin') {
      return NextResponse.redirect(new URL('/games', req.url));
    }
    return NextResponse.next();
  }

  if (adminRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    if (!session) return NextResponse.redirect(new URL('/login', req.url));
    if (session.role !== 'admin') return NextResponse.redirect(new URL('/agent/games', req.url));
  }

  if (agentRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    if (!session) return NextResponse.redirect(new URL('/login', req.url));
    if (session.role !== 'agent') return NextResponse.redirect(new URL('/games', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/admin/login',
    '/games/:path*',
    '/report/:path*',
    '/agents/:path*',
    '/available/:path*',
    '/verify/:path*',
    '/agent/:path*',
  ],
};
