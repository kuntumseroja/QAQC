import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'qaqc4bi.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      port INTEGER,
      status TEXT DEFAULT 'healthy',
      last_health_check TEXT,
      requests_total INTEGER DEFAULT 0,
      avg_response_ms REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS test_scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id TEXT DEFAULT 'MS-APP-001',
      module TEXT,
      scenario_id TEXT,
      test_type TEXT,
      priority TEXT,
      precondition TEXT,
      steps TEXT,
      expected_result TEXT,
      mapped_requirement TEXT,
      status TEXT DEFAULT 'generated',
      source_document TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS traceability_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requirement_id TEXT,
      requirement_desc TEXT,
      test_case_ids TEXT,
      coverage_status TEXT,
      gap_notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS defects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      defect_id TEXT UNIQUE,
      title TEXT,
      description TEXT,
      severity TEXT,
      priority TEXT,
      status TEXT DEFAULT 'OPEN',
      root_cause TEXT,
      module TEXT,
      assigned_team TEXT,
      confidence_score REAL,
      similar_defects TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quality_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_name TEXT,
      metric_value REAL,
      domain TEXT,
      recorded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_type TEXT,
      title TEXT,
      content TEXT,
      format TEXT DEFAULT 'json',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pipeline_validations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pipeline_name TEXT,
      source_query TEXT,
      target_query TEXT,
      validation_rules TEXT,
      results TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS iac_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT,
      findings TEXT,
      severity_summary TEXT,
      compliance_status TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS perf_scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      script_type TEXT,
      target_api TEXT,
      tool TEXT DEFAULT 'jmeter',
      script_content TEXT,
      config TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service TEXT,
      action TEXT,
      details TEXT,
      user_name TEXT DEFAULT 'system',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS uploaded_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      file_type TEXT,
      content_hash TEXT,
      service_used TEXT,
      uploaded_by TEXT DEFAULT 'Lead Tester',
      status TEXT DEFAULT 'active',
      content_preview TEXT,
      result_summary TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_accessed TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );
  `);

  // Seed services if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM services').get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare('INSERT INTO services (id, name, domain, port, status) VALUES (?, ?, ?, ?, ?)');
    const services = [
      ['MS-APP-001', 'Test Scenario Generator', 'application', 8081, 'healthy'],
      ['MS-APP-002', 'Traceability Matrix Automator', 'application', 8082, 'healthy'],
      ['MS-APP-003', 'Performance Test Script Generator', 'application', 8083, 'healthy'],
      ['MS-APP-004', 'Automation Test Code Generator', 'application', 8084, 'healthy'],
      ['MS-DATA-001', 'Data Quality Profiler', 'data-analytics', 8085, 'healthy'],
      ['MS-DATA-002', 'ETL/Pipeline Validation Agent', 'data-analytics', 8086, 'healthy'],
      ['MS-DATA-003', 'Visualization Validation Agent', 'data-analytics', 8087, 'healthy'],
      ['MS-INFRA-001', 'IaC Code Review Agent', 'infrastructure', 8088, 'healthy'],
      ['MS-INFRA-002', 'Security Compliance Scanner', 'infrastructure', 8089, 'healthy'],
      ['MS-INFRA-003', 'DR/HA Test Scenario Generator', 'infrastructure', 8090, 'healthy'],
      ['MS-DEFECT-001', 'Intelligent Defect Classifier', 'defects', 8091, 'healthy'],
      ['MS-DEFECT-002', 'Defect Pattern Analyzer', 'defects', 8092, 'healthy'],
      ['MS-DEFECT-003', 'Test Report Generator', 'defects', 8093, 'healthy'],
    ];
    for (const s of services) {
      insert.run(...s);
    }

    // Seed sample metrics
    const insertMetric = db.prepare('INSERT INTO quality_metrics (metric_name, metric_value, domain, recorded_at) VALUES (?, ?, ?, ?)');
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      insertMetric.run('test_coverage', 65 + Math.random() * 25, 'application', dateStr);
      insertMetric.run('defect_density', 2 + Math.random() * 4, 'application', dateStr);
      insertMetric.run('quality_score', 70 + Math.random() * 20, 'overall', dateStr);
      insertMetric.run('automation_rate', 40 + Math.random() * 35, 'application', dateStr);
    }

    // Seed sample defects — Jamkrindo Cash Loan / Penjaminan domain
    const insertDefect = db.prepare('INSERT INTO defects (defect_id, title, description, severity, priority, status, root_cause, module, assigned_team, confidence_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const sampleDefects = [
      // Recurring pattern: ICPR upload failure (4 occurrences across sprints 22-24)
      ['DEF-2026-0120', 'ICPR Sertifikat upload timeout (sprint 22)', 'ICPR (Indonesia Credit Penjaminan Repository) Sertifikat Penjaminan upload to api.icpr.ojk.go.id timed out (HTTP 504); 1 cert dropped from sprint 22 batch — OJK 7-day SLA at risk', 'Major', 'High', 'RESOLVED', 'Integration Timeout', 'Penjaminan / ICPR', 'Backend Team', 0.93],
      ['DEF-2026-0122', 'ICPR Sertifikat upload timeout (sprint 23 #1)', 'ICPR upload timeout — 1 cert dropped from sprint 23 batch (recurring from DEF-0120); raised HTTP timeout to 60s, still insufficient for >2MB cert PDFs', 'Major', 'High', 'RESOLVED', 'Integration Timeout', 'Penjaminan / ICPR', 'Backend Team', 0.94],
      ['DEF-2026-0125', 'ICPR Sertifikat upload timeout (sprint 23 #2)', 'ICPR upload timeout — 2 certs dropped this run (escalating); ICPR upstream slow during 09:00-11:00 WIB, no retry logic in client', 'Major', 'High', 'RESOLVED', 'Integration Timeout', 'Penjaminan / ICPR', 'Backend Team', 0.95],
      ['DEF-2026-0130', 'ICPR Sertifikat upload timeout (sprint 24)', '4th occurrence — 6 certs dropped (escalation 1→1→2→6); pattern systemic; needs retry+circuit breaker+DLQ before OJK 7-day SLA breach on 2026-04-22', 'Critical', 'High', 'OPEN', 'Integration Timeout', 'Penjaminan / ICPR', 'Backend Team', 0.97],

      // Recurring pattern: IJP calculation drift (2 occurrences)
      ['DEF-2026-0128', 'IJP rate calculation drift between Maker and Approver', 'IJP rate Maker calculated 1.25% but Approver saw 1.50% — using stale PKS rate cached before mid-day update', 'Major', 'High', 'IN_PROGRESS', 'Cache Invalidation', 'Penjaminan / IJP Calculation', 'Backend Team', 0.88],
      ['DEF-2026-0133', 'IJP rate type drift (number vs string)', 'IJP rate for cabang Bandung saved as 1.5 (number) but stored as "1.5" (string) in MySQL; type coercion lost during JSON marshalling', 'Minor', 'Medium', 'RESOLVED', 'Type Coercion', 'Master Data / IJP Rate', 'Backend Team', 0.82],

      // Data integrity: NULL NIK + NPWP format
      ['DEF-2026-0129', '3 rows with NULL nik in cif_registrations', 'Upstream form allows save-as-draft without NIK; staging table missing NOT NULL constraint', 'Critical', 'High', 'OPEN', 'Data Integrity', 'Registrasi CIF', 'Frontend Team', 0.99],
      ['DEF-2026-0127', 'NPWP accepts hyphen format (should be dotted DJP)', 'NPWP validation accepts XX-XXX-XXX-X-XXX-XXX (legacy hyphen) instead of dotted DJP format; legacy data carries hyphens', 'Minor', 'Low', 'OPEN', 'Validation Rule', 'Registrasi CIF', 'Backend Team', 0.86],
      ['DEF-2026-0124', 'NIK validation accepts 15-digit value', 'NIK regex bug — used \\d{15,16} instead of \\d{16}', 'Major', 'High', 'RESOLVED', 'Validation Rule', 'Registrasi CIF', 'Backend Team', 0.95],

      // Klaim & Subrogasi
      ['DEF-2026-0131', 'Klaim payout rejected: invalid BTN account format', 'Klaim payout to partner bank rejected — BTN savings uses 13-digit account but validator only accepts 10-digit', 'Major', 'High', 'OPEN', 'Validation Rule', 'Klaim / Bank Payment', 'Integration Team', 0.91],
      ['DEF-2026-0132', 'Subrogasi recovery not posted to Oracle GL', 'Subrogasi recovery (Rp 250jt) not reflected in Oracle GL journal — integration job ran but transaction was rolled back silently', 'Major', 'High', 'IN_PROGRESS', 'Silent Failure', 'Subrogasi / Oracle GL', 'Backend Team', 0.89],

      // Master data + workflow + housekeeping
      ['DEF-2026-0123', 'New PKS partner code not in dropdown', 'BTN cabang Bandung PKS code not visible in dropdown — master sync job missed nightly window', 'Minor', 'Medium', 'RESOLVED', 'Master Sync', 'Master Data / PKS LOV', 'Data Team', 0.84],
      ['DEF-2026-0126', 'Checker approval email not delivered', 'Maker did not receive Checker approval notification — SMTP relay misconfig after firewall change', 'Minor', 'Medium', 'RESOLVED', 'Configuration Error', 'Workflow / Approval', 'Platform Team', 0.85],
      ['DEF-2026-0121', 'JaGuarS session expires too aggressively', 'Hardcoded 15min idle TTL — moved to config (30min default)', 'Minor', 'Medium', 'RESOLVED', 'Configuration Error', 'Authentication / Session', 'Platform Team', 0.79],
      ['DEF-2026-0119', 'Long Indonesian names truncated in CIF form', 'nama_lengkap > 50 chars truncated; widened varchar to 100', 'Minor', 'Low', 'RESOLVED', 'Schema Limit', 'Registrasi CIF / UI', 'Frontend Team', 0.77],
      ['DEF-2026-0118', 'Sprint 22 month-end report off by 1 row', 'Off-by-one in date range filter for fact_penjaminan', 'Low', 'Low', 'RESOLVED', 'Logic Error', 'Reporting', 'Backend Team', 0.75],
    ];
    for (const d of sampleDefects) {
      insertDefect.run(...d);
    }

    // Seed activity log
    const insertActivity = db.prepare('INSERT INTO activity_log (service, action, details, user_name, created_at) VALUES (?, ?, ?, ?, ?)');
    const activities = [
      ['MS-APP-001', 'Scenario Generation', 'Generated 47 test scenarios from BRD-PSP-2026-v3.docx', 'Lead Tester', '2026-04-10T09:30:00'],
      ['MS-DEFECT-001', 'Defect Classification', 'Auto-classified 12 new defects with 89% avg confidence', 'System', '2026-04-10T10:15:00'],
      ['MS-DATA-001', 'Data Profiling', 'Completed profiling on PSP transaction dataset (2.3M rows)', 'Data Analyst', '2026-04-10T11:00:00'],
      ['MS-INFRA-001', 'IaC Review', 'Reviewed 23 Terraform files, found 5 critical findings', 'DevOps Engineer', '2026-04-10T11:45:00'],
      ['MS-DEFECT-003', 'Report Generation', 'Generated Sprint 14 QC Summary Report', 'Technical Writer', '2026-04-10T14:00:00'],
      ['MS-APP-002', 'Traceability Update', 'Updated traceability matrix: 94% coverage achieved', 'Senior Tester', '2026-04-10T15:30:00'],
    ];
    for (const a of activities) {
      insertActivity.run(...a);
    }

    // Seed uploaded documents
    const insertDoc = db.prepare('INSERT INTO uploaded_documents (file_name, file_size, file_type, content_hash, service_used, uploaded_by, status, content_preview, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const docs = [
      ['BRD-PSP-Onboarding-v3.txt', 4521, 'text/plain', 'a1b2c3d4e5', 'MS-APP-001', 'Lead Tester', 'active', 'Business Requirements Document - PSP Onboarding System', '2026-04-08T09:00:00'],
      ['SRS-Transaction-Processing-v2.txt', 6234, 'text/plain', 'f6g7h8i9j0', 'MS-APP-001', 'Senior Tester', 'active', 'Software Requirements Specification - Transaction Processing', '2026-04-09T10:30:00'],
      ['swagger-payment-api.json', 8912, 'application/json', 'k1l2m3n4o5', 'MS-APP-003', 'Performance Tester', 'active', 'OpenAPI 3.0 Specification - Payment API', '2026-04-09T14:00:00'],
      ['terraform-payment-infra.tf', 5678, 'text/plain', 'p6q7r8s9t0', 'MS-INFRA-001', 'DevOps Engineer', 'active', 'Terraform configuration for payment infrastructure', '2026-04-10T08:00:00'],
      ['data-sample-transactions.csv', 3456, 'text/csv', 'u1v2w3x4y5', 'MS-DATA-001', 'Data Analyst', 'active', 'PSP Transaction data sample - 20 rows', '2026-04-10T11:00:00'],
    ];
    for (const d of docs) { insertDoc.run(...d); }
  }
}
