import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { verifySessionCookie, SESSION_COOKIE, ROLE_LABEL } from '@/lib/auth';

export const runtime = 'nodejs';

async function currentUserLabel(): Promise<string> {
  try {
    const c = await cookies();
    const session = verifySessionCookie(c.get(SESSION_COOKIE)?.value);
    if (session) return `${session.name} (${ROLE_LABEL[session.role]})`;
  } catch {}
  return 'Anonymous';
}

export async function GET(request: Request) {
  try {
    const db = getDb();
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'active';
    const docs = db.prepare(
      `SELECT * FROM uploaded_documents WHERE status = ? ORDER BY created_at DESC`
    ).all(status);
    return NextResponse.json({ documents: docs });
  } catch (error) {
    return NextResponse.json({ documents: [] });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = await request.json();

    if (body.action === 'track') {
      // Track a new upload — uploaded_by always derived from session, never trusted from client
      const stmt = db.prepare(
        `INSERT INTO uploaded_documents (file_name, file_size, file_type, content_hash, service_used, uploaded_by, content_preview) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      const hash = Array.from(String(body.fileName || '')).reduce((h: number, c: string) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(16);
      const uploadedBy = await currentUserLabel();
      stmt.run(body.fileName, body.fileSize, body.fileType, hash, body.service, uploadedBy, body.preview || '');
      return NextResponse.json({ success: true });
    }

    if (body.action === 'delete') {
      // Permanent delete
      db.prepare(`DELETE FROM uploaded_documents WHERE id = ?`).run(body.id);
      return NextResponse.json({ success: true, message: 'Document permanently deleted' });
    }

    if (body.action === 'soft-delete') {
      // Soft delete (mark as deleted)
      db.prepare(`UPDATE uploaded_documents SET status = 'deleted', deleted_at = datetime('now') WHERE id = ?`).run(body.id);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'restore') {
      db.prepare(`UPDATE uploaded_documents SET status = 'active', deleted_at = NULL WHERE id = ?`).run(body.id);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'bulk-delete') {
      const placeholders = body.ids.map(() => '?').join(',');
      db.prepare(`DELETE FROM uploaded_documents WHERE id IN (${placeholders})`).run(...body.ids);
      return NextResponse.json({ success: true, message: `${body.ids.length} documents permanently deleted` });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
