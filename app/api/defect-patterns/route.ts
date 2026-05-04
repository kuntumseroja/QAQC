import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

interface DefectRow {
  defect_id?: string;
  module?: string;
  severity?: string;
  status?: string;
  root_cause?: string;
  created_at?: string;
  updated_at?: string;
}

interface HeatmapRow {
  module: string;
  critical: number;
  major: number;
  minor: number;
  cosmetic: number;
  riskScore: number;
}

interface RootCause {
  cause: string;
  count: number;
  percentage: number;
}

function severityBucket(sev: string | undefined): 'critical' | 'major' | 'minor' | 'cosmetic' {
  const s = String(sev || '').toLowerCase();
  if (s.includes('critical') || s === 'crit') return 'critical';
  if (s.includes('major') || s === 'high') return 'major';
  if (s.includes('minor') || s === 'medium') return 'minor';
  return 'cosmetic';
}

function isOpen(status: string | undefined): boolean {
  const s = String(status || '').toUpperCase();
  return s === 'OPEN' || s === 'IN_PROGRESS' || s === 'IN PROGRESS' || s === 'CONFIRMED' || s === 'UNDER REVIEW';
}

function buildHeatmap(defects: DefectRow[]): HeatmapRow[] {
  const byModule = new Map<string, HeatmapRow>();
  for (const d of defects) {
    const mod = (d.module || 'Unknown').trim();
    if (!byModule.has(mod)) {
      byModule.set(mod, { module: mod, critical: 0, major: 0, minor: 0, cosmetic: 0, riskScore: 0 });
    }
    const row = byModule.get(mod)!;
    row[severityBucket(d.severity)] += 1;
  }
  for (const r of byModule.values()) {
    r.riskScore = Math.min(100, r.critical * 30 + r.major * 15 + r.minor * 5 + r.cosmetic * 1);
  }
  return Array.from(byModule.values()).sort((a, b) => b.riskScore - a.riskScore);
}

function buildTrends(defects: DefectRow[]) {
  const total = defects.length;
  const open = defects.filter(d => isOpen(d.status)).length;

  const resolved = defects.filter(d => d.updated_at && d.created_at && !isOpen(d.status));
  const totalDays = resolved.reduce((sum, d) => {
    const t1 = new Date(d.created_at!).getTime();
    const t2 = new Date(d.updated_at!).getTime();
    return sum + Math.max(0, (t2 - t1) / 86_400_000);
  }, 0);
  const avgResolutionDays = resolved.length ? +(totalDays / resolved.length).toFixed(1) : 0;

  const causeCount = new Map<string, number>();
  for (const d of defects) {
    const key = (d.root_cause && d.root_cause.trim()) || 'Other';
    causeCount.set(key, (causeCount.get(key) || 0) + 1);
  }
  const topRootCauses: RootCause[] = Array.from(causeCount.entries())
    .map(([cause, count]) => ({ cause, count, percentage: +((count / Math.max(1, total)) * 100).toFixed(1) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalDefects: total,
    openDefects: open,
    avgResolutionDays,
    reopenRate: 0,
    topRootCauses,
  };
}

function buildRecommendations(defects: DefectRow[], heatmap: HeatmapRow[]): string[] {
  const recs: string[] = [];

  // Detect recurrence by module + root_cause signature
  const sigCount = new Map<string, { count: number; module: string; cause: string }>();
  for (const d of defects) {
    const sig = `${d.module || ''}|${d.root_cause || ''}`;
    const cur = sigCount.get(sig) || { count: 0, module: d.module || '', cause: d.root_cause || '' };
    cur.count += 1;
    sigCount.set(sig, cur);
  }
  for (const v of Array.from(sigCount.values()).sort((a, b) => b.count - a.count)) {
    if (v.count >= 3) recs.push(`'${v.module} / ${v.cause}' recurred ${v.count} times — systemic, escalate.`);
    else if (v.count === 2) recs.push(`'${v.module} / ${v.cause}' recurred ${v.count} times — monitor.`);
  }

  if (heatmap.length > 0 && heatmap[0].riskScore >= 30) {
    recs.push(`Highest-risk module: '${heatmap[0].module}' (risk score ${heatmap[0].riskScore}). Focus QA effort here next sprint.`);
  }

  const openCritical = defects.filter(d => isOpen(d.status) && severityBucket(d.severity) === 'critical');
  if (openCritical.length > 0) {
    recs.push(`${openCritical.length} Critical defect(s) still OPEN: ${openCritical.map(d => d.defect_id).filter(Boolean).join(', ') || '(no IDs)'} — block release sign-off.`);
  }

  if (recs.length === 0) recs.push('No systemic patterns detected in the selected window. Maintain current QA practice.');
  return recs;
}

// Map period code → SQLite "datetime modifier" for the WHERE clause
function periodToModifier(period: string): { modifier: string; label: string } {
  switch (period) {
    case '30d': return { modifier: '-30 days', label: 'Last 30 days' };
    case '3m':  return { modifier: '-90 days', label: 'Last 3 months' };
    case '6m':  return { modifier: '-180 days', label: 'Last 6 months' };
    case '1y':  return { modifier: '-365 days', label: 'Last year' };
    default:    return { modifier: '-180 days', label: period || 'Last 6 months' };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const period = String(body.period || '6m');
    const { modifier, label } = periodToModifier(period);

    let defects: DefectRow[] = [];
    let source = '';

    try {
      const db = getDb();
      // Try to filter by created_at if present; fall back to all rows if column absent.
      try {
        defects = db.prepare(
          `SELECT defect_id, module, severity, status, root_cause, created_at, updated_at
           FROM defects
           WHERE created_at >= datetime('now', ?)
           ORDER BY created_at DESC`
        ).all(modifier) as DefectRow[];
      } catch {
        defects = db.prepare(`SELECT defect_id, module, severity, status, root_cause FROM defects`).all() as DefectRow[];
      }
      source = `Database (${defects.length} defects in ${label.toLowerCase()})`;
    } catch {
      defects = [];
      source = 'Database unavailable';
    }

    if (defects.length === 0) {
      return NextResponse.json({
        period: label,
        source,
        heatmap: [],
        trends: { totalDefects: 0, openDefects: 0, avgResolutionDays: 0, reopenRate: 0, topRootCauses: [] },
        recommendations: [`No defects logged in ${label.toLowerCase()}. Try a longer window or seed the defects table.`],
      });
    }

    return NextResponse.json({
      period: label,
      source,
      heatmap: buildHeatmap(defects),
      trends: buildTrends(defects),
      recommendations: buildRecommendations(defects, buildHeatmap(defects)),
    });
  } catch (error) {
    console.error('defect-patterns error:', error);
    const message = error instanceof Error ? error.message : 'Failed to analyze defect patterns';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
