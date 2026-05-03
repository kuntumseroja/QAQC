import { NextResponse } from 'next/server';
import { findUser, createSessionCookie, SESSION_COOKIE, ROLE_LABEL } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
    }
    const user = findUser(String(username), String(password));
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }
    const cookie = createSessionCookie(user);
    const res = NextResponse.json({
      ok: true,
      user: {
        username: user.username,
        name: user.name,
        role: user.role,
        roleLabel: ROLE_LABEL[user.role],
        initials: user.initials,
        color: user.color,
        email: user.email,
      },
    });
    res.cookies.set(SESSION_COOKIE, cookie.value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: cookie.maxAge,
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 });
  }
}
