import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySessionCookie, SESSION_COOKIE, ROLE_LABEL } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const session = verifySessionCookie(raw);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({
    user: {
      username: session.username,
      name: session.name,
      role: session.role,
      roleLabel: ROLE_LABEL[session.role],
      initials: session.initials,
      color: session.color,
    },
  });
}
