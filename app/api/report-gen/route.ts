import { NextResponse } from 'next/server';
import { processAI } from '@/lib/ai-engine';
import { getDb } from '@/lib/db';
import { eventBus, TOPICS } from '@/lib/event-bus';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Gather real platform data for the report
    let platformContext = '';
    try {
      const db = getDb();

      const defects = db.prepare('SELECT severity, priority, status, module, root_cause, title FROM defects').all() as Array<Record<string, string>>;
      const scenarios = db.prepare('SELECT COUNT(*) as count FROM test_scenarios').get() as { count: number };
      const activities = db.prepare('SELECT service, action, details, created_at FROM activity_log ORDER BY created_at DESC LIMIT 20').all();
      const docs = db.prepare("SELECT COUNT(*) as count FROM uploaded_documents WHERE status = 'active'").get() as { count: number };

      const defectsBySeverity: Record<string, number> = {};
      const defectsByStatus: Record<string, number> = {};
      const defectsByModule: Record<string, number> = {};
      for (const d of defects) {
        defectsBySeverity[d.severity] = (defectsBySeverity[d.severity] || 0) + 1;
        defectsByStatus[d.status] = (defectsByStatus[d.status] || 0) + 1;
        defectsByModule[d.module] = (defectsByModule[d.module] || 0) + 1;
      }

      platformContext = `
ACTUAL PLATFORM DATA (use this real data in the report):
- Total defects tracked: ${defects.length}
- Defects by severity: ${JSON.stringify(defectsBySeverity)}
- Defects by status: ${JSON.stringify(defectsByStatus)}
- Defects by module: ${JSON.stringify(defectsByModule)}
- Open defects: ${defects.filter(d => d.status === 'OPEN' || d.status === 'IN PROGRESS').length}
- Resolved defects: ${defects.filter(d => d.status === 'RESOLVED' || d.status === 'CLOSED').length}
- Test scenarios generated: ${scenarios.count}
- Documents uploaded: ${docs.count}
- Recent activities: ${JSON.stringify(activities.slice(0, 5))}
- Critical defects: ${defects.filter(d => d.severity === 'Critical').map(d => d.title).join(', ') || 'None'}
`;
    } catch {
      platformContext = '\nNote: Could not fetch platform data. Generate realistic sample data.\n';
    }

    const response = await processAI({
      service: 'report-gen',
      prompt: `Generate a comprehensive QC report for: ${body.sprint || 'Current Sprint'}. ${platformContext}`,
      input: body.sprint || body.input || '',
      options: {
        reportType: body.reportType,
        ...body.options,
      },
    });

    eventBus.publish(TOPICS.REPORT_GENERATED, {
      reportType: body.reportType,
      input: body.sprint || body.input || '',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(response.result);
  } catch (error) {
    console.error('report-gen error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
