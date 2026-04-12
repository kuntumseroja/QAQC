import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'real'; // 'real' or 'mock'

  if (mode === 'mock') {
    return NextResponse.json(getMockData());
  }

  try {
    const db = getDb();

    // Services
    const services = db.prepare('SELECT * FROM services').all() as Array<Record<string, unknown>>;

    // Metrics from quality_metrics table
    const metricsRows = db.prepare(
      `SELECT metric_name, AVG(metric_value) as avg_value
       FROM quality_metrics
       WHERE recorded_at >= date('now', '-7 days')
       GROUP BY metric_name`
    ).all() as Array<{ metric_name: string; avg_value: number }>;
    const metricsMap: Record<string, number> = {};
    for (const m of metricsRows) {
      metricsMap[m.metric_name] = Math.round(m.avg_value * 10) / 10;
    }

    // Trend data from quality_metrics
    const trendRows = db.prepare(
      `SELECT DATE(recorded_at) as date, metric_name, AVG(metric_value) as value
       FROM quality_metrics
       WHERE recorded_at >= date('now', '-30 days')
       GROUP BY DATE(recorded_at), metric_name
       ORDER BY date ASC`
    ).all() as Array<{ date: string; metric_name: string; value: number }>;

    // Group trend rows by date
    const trendMap = new Map<string, Record<string, number>>();
    for (const row of trendRows) {
      if (!trendMap.has(row.date)) trendMap.set(row.date, {});
      trendMap.get(row.date)![row.metric_name] = Math.round(row.value * 10) / 10;
    }
    const trendData = Array.from(trendMap.entries()).map(([date, vals]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      quality_score: vals.quality_score ?? 0,
      test_coverage: vals.test_coverage ?? 0,
      automation_rate: vals.automation_rate ?? 0,
    }));

    // Real defect distribution from defects table
    const defects = db.prepare('SELECT severity, module FROM defects').all() as Array<{ severity: string; module: string }>;
    const defectByModule = new Map<string, { critical: number; major: number; minor: number; cosmetic: number }>();
    for (const d of defects) {
      const mod = d.module || 'Unknown';
      if (!defectByModule.has(mod)) defectByModule.set(mod, { critical: 0, major: 0, minor: 0, cosmetic: 0 });
      const entry = defectByModule.get(mod)!;
      const sev = d.severity?.toLowerCase() || '';
      if (sev === 'critical') entry.critical++;
      else if (sev === 'major') entry.major++;
      else if (sev === 'minor') entry.minor++;
      else entry.cosmetic++;
    }
    const defectData = Array.from(defectByModule.entries())
      .map(([module, counts]) => ({ module, ...counts }))
      .sort((a, b) => (b.critical * 4 + b.major * 3 + b.minor * 2 + b.cosmetic) - (a.critical * 4 + a.major * 3 + a.minor * 2 + a.cosmetic));

    // Real activity log
    const activities = db.prepare(
      'SELECT service, action, details, user_name, created_at FROM activity_log ORDER BY created_at DESC LIMIT 10'
    ).all();

    // Count real stats
    const scenarioCount = (db.prepare('SELECT COUNT(*) as c FROM test_scenarios').get() as { c: number }).c;
    const docCount = (db.prepare("SELECT COUNT(*) as c FROM uploaded_documents WHERE status = 'active'").get() as { c: number }).c;

    // Compute real metrics
    const totalDefects = defects.length;
    const criticalDefects = defects.filter(d => d.severity === 'Critical').length;
    const openDefects = (db.prepare("SELECT COUNT(*) as c FROM defects WHERE status IN ('OPEN', 'IN PROGRESS', 'UNDER REVIEW', 'CONFIRMED')").get() as { c: number }).c;

    return NextResponse.json({
      mode: 'real',
      services: services.map(s => ({
        ...s,
        requests_total: s.requests_total ?? 0,
        avg_response_ms: s.avg_response_ms ?? 0,
      })),
      metrics: {
        qualityScore: metricsMap.quality_score ?? 0,
        testCoverage: metricsMap.test_coverage ?? 0,
        automationRate: metricsMap.automation_rate ?? 0,
        defectDensity: metricsMap.defect_density ?? 0,
      },
      trendData: trendData.length > 0 ? trendData : undefined,
      defectData: defectData.length > 0 ? defectData : undefined,
      activities: (activities as Array<Record<string, unknown>>).length > 0 ? activities : undefined,
      stats: {
        totalDefects,
        criticalDefects,
        openDefects,
        scenariosGenerated: scenarioCount,
        documentsUploaded: docCount,
      },
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json(getMockData());
  }
}

function getMockData() {
  return {
    mode: 'mock',
    services: [
      { id: 'MS-APP-001', name: 'Test Scenario Generator', domain: 'application', status: 'healthy', requests_total: 1247, avg_response_ms: 1200 },
      { id: 'MS-APP-002', name: 'Traceability Matrix', domain: 'application', status: 'healthy', requests_total: 856, avg_response_ms: 800 },
      { id: 'MS-APP-003', name: 'Perf Script Generator', domain: 'application', status: 'healthy', requests_total: 432, avg_response_ms: 1500 },
      { id: 'MS-APP-004', name: 'Automation CodeGen', domain: 'application', status: 'degraded', requests_total: 321, avg_response_ms: 2200 },
      { id: 'MS-DATA-001', name: 'Data Profiler', domain: 'data-analytics', status: 'healthy', requests_total: 678, avg_response_ms: 3400 },
      { id: 'MS-DATA-002', name: 'Pipeline Validator', domain: 'data-analytics', status: 'healthy', requests_total: 445, avg_response_ms: 2100 },
      { id: 'MS-DATA-003', name: 'Viz Validator', domain: 'data-analytics', status: 'healthy', requests_total: 234, avg_response_ms: 1800 },
      { id: 'MS-INFRA-001', name: 'IaC Reviewer', domain: 'infrastructure', status: 'healthy', requests_total: 567, avg_response_ms: 2500 },
      { id: 'MS-INFRA-002', name: 'Security Scanner', domain: 'infrastructure', status: 'healthy', requests_total: 389, avg_response_ms: 4200 },
      { id: 'MS-INFRA-003', name: 'DR/HA Test Gen', domain: 'infrastructure', status: 'healthy', requests_total: 156, avg_response_ms: 1900 },
      { id: 'MS-DEFECT-001', name: 'Defect Classifier', domain: 'defects', status: 'healthy', requests_total: 1534, avg_response_ms: 600 },
      { id: 'MS-DEFECT-002', name: 'Pattern Analyzer', domain: 'defects', status: 'healthy', requests_total: 267, avg_response_ms: 5100 },
      { id: 'MS-DEFECT-003', name: 'Report Generator', domain: 'defects', status: 'healthy', requests_total: 923, avg_response_ms: 3800 },
    ],
    metrics: { qualityScore: 87, testCoverage: 84, automationRate: 62, defectDensity: 3.2 },
    trendData: Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        quality_score: 75 + Math.random() * 15,
        test_coverage: 70 + Math.random() * 20,
        automation_rate: 50 + Math.random() * 20,
      };
    }),
    defectData: [
      { module: 'Payment Gateway', critical: 2, major: 5, minor: 8, cosmetic: 3 },
      { module: 'PSP Onboarding', critical: 1, major: 4, minor: 6, cosmetic: 2 },
      { module: 'Transaction Proc', critical: 0, major: 3, minor: 5, cosmetic: 4 },
      { module: 'Currency Module', critical: 1, major: 2, minor: 3, cosmetic: 1 },
      { module: 'API Gateway', critical: 0, major: 2, minor: 4, cosmetic: 2 },
      { module: 'Data Pipeline', critical: 1, major: 3, minor: 2, cosmetic: 0 },
    ],
    activities: [
      { service: 'MS-APP-001', action: 'Scenario Generation', details: 'Generated 47 test scenarios from BRD-PSP-2026-v3.docx', user_name: 'Lead Tester', created_at: '2026-04-10T09:30:00' },
      { service: 'MS-DEFECT-001', action: 'Defect Classification', details: 'Auto-classified 12 new defects with 89% avg confidence', user_name: 'System', created_at: '2026-04-10T10:15:00' },
      { service: 'MS-DATA-001', action: 'Data Profiling', details: 'Completed profiling on PSP transaction dataset (2.3M rows)', user_name: 'Data Analyst', created_at: '2026-04-10T11:00:00' },
      { service: 'MS-INFRA-001', action: 'IaC Review', details: 'Reviewed 23 Terraform files, found 5 critical findings', user_name: 'DevOps Engineer', created_at: '2026-04-10T11:45:00' },
      { service: 'MS-DEFECT-003', action: 'Report Generation', details: 'Generated Sprint 14 QC Summary Report', user_name: 'Technical Writer', created_at: '2026-04-10T14:00:00' },
      { service: 'MS-APP-002', action: 'Traceability Update', details: 'Updated traceability matrix: 94% coverage achieved', user_name: 'Senior Tester', created_at: '2026-04-10T15:30:00' },
    ],
  };
}
