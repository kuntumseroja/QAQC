import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

interface DefectRow {
  defect_id?: string;
  module?: string;
  severity?: string;
  status?: string;
  reported_date?: string;
  recurring_tag?: string;
  root_cause?: string;
  resolved_date?: string | null;
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
  // Risk score: critical*30 + major*15 + minor*5 + cosmetic*1, capped at 100
  for (const r of byModule.values()) {
    r.riskScore = Math.min(100, r.critical * 30 + r.major * 15 + r.minor * 5 + r.cosmetic * 1);
  }
  return Array.from(byModule.values()).sort((a, b) => b.riskScore - a.riskScore);
}

function buildTrends(defects: DefectRow[]) {
  const total = defects.length;
  const open = defects.filter(d => isOpen(d.status)).length;

  const resolved = defects.filter(d => d.resolved_date && d.reported_date);
  const totalDays = resolved.reduce((sum, d) => {
    const t1 = new Date(d.reported_date!).getTime();
    const t2 = new Date(d.resolved_date!).getTime();
    return sum + Math.max(0, (t2 - t1) / 86_400_000);
  }, 0);
  const avgResolutionDays = resolved.length ? +(totalDays / resolved.length).toFixed(1) : 0;

  // Prefer recurring_tag (csv) → root_cause (db) for top causes
  const causeCount = new Map<string, number>();
  for (const d of defects) {
    const key = (d.recurring_tag && d.recurring_tag.trim()) || (d.root_cause && d.root_cause.trim()) || 'Other';
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

  // Recurring tags (CSV path)
  const tagCount = new Map<string, number>();
  for (const d of defects) {
    if (d.recurring_tag) tagCount.set(d.recurring_tag, (tagCount.get(d.recurring_tag) || 0) + 1);
  }
  for (const [tag, count] of Array.from(tagCount.entries()).sort((a, b) => b[1] - a[1])) {
    if (count >= 3) recs.push(`'${tag}' has recurred ${count} times — escalate as systemic; assign permanent fix owner.`);
    else if (count === 2) recs.push(`'${tag}' has recurred ${count} times — monitor; prepare permanent fix if it appears again.`);
  }

  // DB path: detect recurrence by module + root_cause when no tag exists
  if (tagCount.size === 0) {
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
  }

  if (heatmap.length > 0 && heatmap[0].riskScore >= 30) {
    recs.push(`Highest-risk module: '${heatmap[0].module}' (risk score ${heatmap[0].riskScore}). Focus QA effort here next sprint.`);
  }

  const openCritical = defects.filter(d => isOpen(d.status) && severityBucket(d.severity) === 'critical');
  if (openCritical.length > 0) {
    recs.push(`${openCritical.length} Critical defect(s) still OPEN: ${openCritical.map(d => d.defect_id).filter(Boolean).join(', ') || '(no IDs)'} — block release sign-off.`);
  }

  if (recs.length === 0) recs.push('No systemic patterns detected. Maintain current QA practice.');
  return recs;
}

function pickPeriodLabel(period: string): string {
  const map: Record<string, string> = {
    '30d': 'Last 30 days',
    '3m': 'Last 3 months',
    '6m': 'Last 6 months',
    '1y': 'Last year',
  };
  return map[period] || period || 'Last 6 months';
}

// Parse the Jamkrindo defect-history CSV. Naive comma split — the demo CSV
// doesn't quote fields. If you need quoted CSV support, swap to Papa Parse.
function parseCsv(csv: string): DefectRow[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const idx = (name: string) => headers.indexOf(name);
  const out: DefectRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 2) continue;
    const get = (k: string) => { const j = idx(k); return j >= 0 ? cols[j]?.trim() : undefined; };
    out.push({
      defect_id: get('defect_id'),
      module: get('module'),
      severity: get('severity'),
      status: get('status'),
      reported_date: get('reported_date'),
      recurring_tag: get('recurring_tag'),
      root_cause: get('root_cause'),
      resolved_date: get('resolved_date') || null,
    });
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const period = String(body.period || '6m');

    let defects: DefectRow[] = [];
    let source = '';

    if (body.csv && typeof body.csv === 'string' && body.csv.trim()) {
      defects = parseCsv(body.csv);
      source = `Uploaded CSV (${defects.length} defects)`;
    } else {
      try {
        const db = getDb();
        const rows = db.prepare(
          `SELECT defect_id, module, severity, status, root_cause FROM defects`
        ).all() as DefectRow[];
        defects = rows;
        source = `Database (${defects.length} defects)`;
      } catch {
        defects = [];
        source = 'No data source available';
      }
    }

    if (defects.length === 0) {
      return NextResponse.json({
        period: pickPeriodLabel(period),
        source,
        heatmap: [],
        trends: { totalDefects: 0, openDefects: 0, avgResolutionDays: 0, reopenRate: 0, topRootCauses: [] },
        recommendations: ['No defects to analyze. Upload a defect history CSV or seed the database.'],
      });
    }

    return NextResponse.json({
      period: pickPeriodLabel(period),
      source,
      heatmap: buildHeatmap(defects),
      trends: buildTrends(defects),
      recommendations: buildRecommendations(defects, heatmap_for(defects)),
    });
  } catch (error) {
    console.error('defect-patterns error:', error);
    const message = error instanceof Error ? error.message : 'Failed to analyze defect patterns';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Small helper to share the computed heatmap with recommendations without
// computing twice. (Inlined to keep the file small.)
function heatmap_for(defects: DefectRow[]) {
  return buildHeatmap(defects);
}
