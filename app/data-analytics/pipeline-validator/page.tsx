'use client';

import { use, useState } from 'react';
import { Activity, Play, CheckCircle, XCircle, RotateCcw, Code } from 'lucide-react';
import DataTable from '@/components/data-table';
import StatusBadge from '@/components/status-badge';

const DOMAIN_COLOR = '#009d9a';
const SERVICE_ID = 'MS-DATA-002';

interface ValidationRule {
  rule: string;
  source: string | number;
  target: string | number;
  status: 'PASS' | 'FAIL';
  sql: string;
  details?: string;
}

interface ValidationResult {
  pipelineName: string;
  rules: ValidationRule[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
}

const MOCK_QUERIES = {
  source: `SELECT
  COUNT(*) AS total_rows,
  SUM(amount) AS total_amount,
  COUNT(DISTINCT account_id) AS unique_accounts,
  MIN(transaction_date) AS earliest_date,
  MAX(transaction_date) AS latest_date,
  COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) AS settled_count
FROM source_db.transactions
WHERE transaction_date BETWEEN '2026-01-01' AND '2026-03-31';`,
  target: `SELECT
  COUNT(*) AS total_rows,
  SUM(amount) AS total_amount,
  COUNT(DISTINCT account_id) AS unique_accounts,
  MIN(transaction_date) AS earliest_date,
  MAX(transaction_date) AS latest_date,
  COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) AS settled_count
FROM dw.fact_transactions
WHERE transaction_date BETWEEN '2026-01-01' AND '2026-03-31';`,
};

const columnDefs = [
  { key: 'rule', label: 'Rule', sortable: true, width: '220px' },
  { key: 'source', label: 'Source Value', sortable: false, width: '200px',
    render: (v: unknown) => (
      <span className="font-mono text-xs text-[#161616]">{String(v)}</span>
    )},
  { key: 'target', label: 'Target Value', sortable: false, width: '200px',
    render: (v: unknown) => (
      <span className="font-mono text-xs text-[#161616]">{String(v)}</span>
    )},
  { key: 'status', label: 'Status', sortable: true, width: '90px',
    render: (v: unknown) => <StatusBadge status={String(v) as 'PASS' | 'FAIL'} /> },
  { key: 'sql', label: 'SQL Query', sortable: false,
    render: (v: unknown) => (
      <span
        className="font-mono text-[10px] text-[#525252] truncate block max-w-xs"
        title={String(v)}
      >
        {String(v)}
      </span>
    )},
  { key: 'details', label: 'Details', sortable: false,
    render: (v: unknown) => v ? (
      <span className="text-xs text-[#525252]">{String(v)}</span>
    ) : null },
];

export default function PipelineValidatorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  use(searchParams);

  const [pipelineName, setPipelineName] = useState('');
  const [sourceQuery, setSourceQuery] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [transformSpec, setTransformSpec] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!pipelineName.trim()) {
      setError('Pipeline name is required.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/pipeline-validator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineName, sourceQuery, targetQuery, transformSpec }),
      });

      if (response.ok) {
        const raw = await response.json();

        // Normalize LLM response
        let rules = raw.rules || raw.validationRules || raw.validation_rules || raw.checks || [];
        if (!Array.isArray(rules)) {
          for (const key of Object.keys(raw)) {
            if (Array.isArray(raw[key]) && raw[key].length > 0) { rules = raw[key]; break; }
          }
        }
        rules = (rules as unknown as Record<string, unknown>[]).map((r) => ({
          rule: String(r.rule || r.name || r.check || r.description || ''),
          source: r.source ?? r.sourceValue ?? r.source_value ?? '',
          target: r.target ?? r.targetValue ?? r.target_value ?? '',
          status: String(r.status || 'PASS').toUpperCase() as 'PASS' | 'FAIL',
          sql: String(r.sql || r.query || r.sqlQuery || r.sql_query || ''),
          details: r.details ? String(r.details) : r.detail ? String(r.detail) : undefined,
        }));

        const passed = rules.filter((r: ValidationRule) => r.status === 'PASS').length;
        const data: ValidationResult = {
          pipelineName: String(raw.pipelineName || raw.pipeline_name || pipelineName || 'Pipeline'),
          rules: rules as ValidationRule[],
          summary: raw.summary ? {
            total: Number(raw.summary.total ?? rules.length),
            passed: Number(raw.summary.passed ?? passed),
            failed: Number(raw.summary.failed ?? (rules.length - passed)),
            passRate: parseFloat(String(raw.summary.passRate ?? '0').replace('%', '')) || (rules.length > 0 ? Math.round((passed / rules.length) * 100) : 0),
          } : {
            total: rules.length,
            passed,
            failed: rules.length - passed,
            passRate: rules.length > 0 ? Math.round((passed / rules.length) * 100) : 0,
          },
        };
        setResult(data);
      } else {
        const text = await response.text();
        setError('Failed: ' + (text || response.statusText || 'Unknown error'));
      }
    } catch (err) {
      setError('Failed: ' + (err instanceof Error ? err.message : 'Unknown error')); void err;
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError('');
    setPipelineName('');
    setSourceQuery('');
    setTargetQuery('');
    setTransformSpec('');
    setExpandedRow(null);
  };

  const handleLoadExample = () => {
    setPipelineName('PSP Transaction ETL — Q1 2026');
    setSourceQuery(MOCK_QUERIES.source);
    setTargetQuery(MOCK_QUERIES.target);
    setTransformSpec(`TRANSFORMATION SPEC:
- source.currency → target.currency_code (direct map)
- source.amount → target.amount_local (convert non-IDR using dim_fx_rates)
- source.psp_id → target.psp_dim_id (lookup from dim_psp)
- source.status → target.tx_status (map: COMPLETED→SUCCESS, FAILED→FAILURE, REVERSED→REVERSAL)
- Exclude: status IN ('INITIATED', 'PROCESSING') — only settled/final states`);
  };

  const failedRules = (result?.rules || []).filter((r) => r.status === 'FAIL');

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="ibm-tag ibm-tag-teal text-[11px] font-medium">{SERVICE_ID}</span>
            <span className="text-[11px] text-[#6f6f6f]">Data Analytics Domain</span>
          </div>
          <h1 className="text-xl font-light text-[#161616] flex items-center gap-2">
            <Activity size={20} style={{ color: DOMAIN_COLOR }} />
            ETL / Pipeline Validator
          </h1>
          <p className="text-sm text-[#525252] mt-0.5 max-w-2xl">
            Reconcile source and target datasets across configurable business rules. Detect
            data loss, transformation drift, referential integrity failures, and statistical
            anomalies introduced during ETL processing.
          </p>
        </div>
        {result && (
          <button onClick={handleReset} className="btn-ghost flex items-center gap-2 !min-h-[36px] !py-1.5 !px-3 text-xs">
            <RotateCcw size={14} />
            New Validation
          </button>
        )}
      </div>

      {/* Input Panel */}
      {!result && (
        <div className="bg-white border border-[#e0e0e0] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[#161616]">Pipeline Configuration</h2>
            <button
              onClick={handleLoadExample}
              className="btn-ghost flex items-center gap-1 !min-h-[32px] !py-1 !px-3 text-xs"
            >
              <Code size={13} />
              Load Example
            </button>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[#525252]">Pipeline Name *</label>
            <input
              className="ibm-input"
              placeholder="e.g. PSP Transaction ETL — Q1 2026"
              value={pipelineName}
              onChange={(e) => setPipelineName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-[#009d9a] text-white rounded-full flex items-center justify-center text-[10px] font-medium">1</span>
                <label className="block text-xs font-medium text-[#525252]">
                  Source Query
                  <span className="ml-1 text-[#6f6f6f] font-normal">(SQL against source system)</span>
                </label>
              </div>
              <textarea
                className="ibm-textarea font-mono text-xs"
                style={{ minHeight: 160 }}
                placeholder="SELECT COUNT(*), SUM(amount) FROM source_db.transactions WHERE ..."
                value={sourceQuery}
                onChange={(e) => setSourceQuery(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-[#009d9a] text-white rounded-full flex items-center justify-center text-[10px] font-medium">2</span>
                <label className="block text-xs font-medium text-[#525252]">
                  Target Query
                  <span className="ml-1 text-[#6f6f6f] font-normal">(SQL against target / DW)</span>
                </label>
              </div>
              <textarea
                className="ibm-textarea font-mono text-xs"
                style={{ minHeight: 160 }}
                placeholder="SELECT COUNT(*), SUM(amount) FROM dw.fact_transactions WHERE ..."
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-[#8a3ffc] text-white rounded-full flex items-center justify-center text-[10px] font-medium">3</span>
              <label className="block text-xs font-medium text-[#525252]">
                Transformation Specification
                <span className="ml-1 text-[#6f6f6f] font-normal">(optional — column mappings, business rules, filters)</span>
              </label>
            </div>
            <textarea
              className="ibm-textarea text-xs"
              style={{ minHeight: 100 }}
              placeholder={"Describe transformation rules, e.g.:\n- source.currency → target.currency_code (direct map)\n- source.amount → target.amount_local (convert non-IDR using fx_rates)\n- Exclude: status IN ('INITIATED', 'PROCESSING')"}
              value={transformSpec}
              onChange={(e) => setTransformSpec(e.target.value)}
            />
          </div>

          {error && (
            <div className="ibm-notification ibm-notification-error">
              <XCircle size={16} className="text-[#da1e28] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-[#da1e28]">{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleValidate}
              disabled={loading}
              style={loading ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Validating pipeline...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Validate Pipeline
                </>
              )}
            </button>
            <span className="text-xs text-[#6f6f6f]">
              Powered by {SERVICE_ID} · IBM Carbon Design
            </span>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary Bar */}
          <div className="bg-white border border-[#e0e0e0] p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-[#161616]">{result.pipelineName}</h2>
                <p className="text-xs text-[#6f6f6f]">
                  {result.summary?.total ?? 0} rules executed
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-light text-[#161616]">{result.summary?.total ?? 0}</div>
                  <div className="text-[10px] text-[#6f6f6f]">Total Rules</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-light text-[#198038]">{result.summary?.passed ?? 0}</div>
                  <div className="text-[10px] text-[#6f6f6f]">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-light text-[#da1e28]">{result.summary?.failed ?? 0}</div>
                  <div className="text-[10px] text-[#6f6f6f]">Failed</div>
                </div>
                <div className="text-center">
                  <div
                    className="text-2xl font-light"
                    style={{
                      color:
                        (result.summary?.passRate ?? 0) >= 90
                          ? '#198038'
                          : (result.summary?.passRate ?? 0) >= 70
                          ? '#f1c21b'
                          : '#da1e28',
                    }}
                  >
                    {result.summary?.passRate ?? 0}%
                  </div>
                  <div className="text-[10px] text-[#6f6f6f]">Pass Rate</div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 h-2 bg-[#e0e0e0] rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-700"
                style={{
                  width: `${result.summary?.passRate ?? 0}%`,
                  backgroundColor:
                    (result.summary?.passRate ?? 0) >= 90
                      ? '#198038'
                      : (result.summary?.passRate ?? 0) >= 70
                      ? '#f1c21b'
                      : '#da1e28',
                }}
              />
            </div>
          </div>

          {/* Failed Rules Highlight */}
          {failedRules.length > 0 && (
            <div className="bg-white border border-[#e0e0e0]">
              <div className="px-4 py-3 border-b border-[#e0e0e0] flex items-center gap-2">
                <XCircle size={16} className="text-[#da1e28]" />
                <h3 className="text-sm font-medium text-[#da1e28]">
                  Failed Rules ({failedRules.length})
                </h3>
              </div>
              <div className="divide-y divide-[#e0e0e0]">
                {failedRules.map((rule, i) => (
                  <div key={i} className="px-4 py-3 bg-[#fff1f1] flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-[#161616]">{rule.rule}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-[#525252] font-mono">
                        <span>Source: <strong className="text-[#161616]">{rule.source}</strong></span>
                        <span>Target: <strong className="text-[#da1e28]">{rule.target}</strong></span>
                      </div>
                      {rule.details && (
                        <div className="mt-1 text-xs text-[#525252]">{rule.details}</div>
                      )}
                      <div
                        className={`mt-2 font-mono text-[10px] text-[#6f6f6f] transition-all ${
                          expandedRow === rule.rule ? '' : 'truncate'
                        }`}
                        style={{ maxWidth: '600px' }}
                      >
                        {rule.sql}
                      </div>
                    </div>
                    <button
                      className="text-[10px] text-[#0f62fe] hover:underline flex-shrink-0 mt-0.5"
                      onClick={() => setExpandedRow(expandedRow === rule.rule ? null : rule.rule)}
                    >
                      {expandedRow === rule.rule ? 'Less' : 'SQL'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Rules Table */}
          <DataTable
            title="Validation Rules — Full Report"
            description={`${result.summary?.total ?? 0} rules · ${result.summary?.passed ?? 0} passed · ${result.summary?.failed ?? 0} failed`}
            columns={columnDefs}
            data={(result.rules || []).map((r) => ({ ...r } as Record<string, unknown>))}
            onExport={() => {
              const headers = ['Rule', 'Source Value', 'Target Value', 'Status', 'SQL Query', 'Details'];
              const rows = (result.rules || []).map((r) =>
                [r.rule, r.source, r.target, r.status, r.sql, r.details ?? '']
                  .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                  .join(',')
              );
              const csv = [headers.join(','), ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `pipeline_validation_${result.pipelineName.replace(/\s/g, '_')}.csv`;
              a.click();
            }}
          />

          {/* Pass / Fail indicator badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#6f6f6f]">Rule Status:</span>
            {(result.rules || []).map((r, i) => (
              <span
                key={i}
                className="w-3 h-3 rounded-sm"
                title={`${r.rule}: ${r.status}`}
                style={{ backgroundColor: r.status === 'PASS' ? '#198038' : '#da1e28' }}
              />
            ))}
            <span className="ml-2 text-[10px] text-[#6f6f6f]">
              <CheckCircle size={11} className="inline text-[#198038] mr-0.5" /> = PASS
              &nbsp;&nbsp;
              <XCircle size={11} className="inline text-[#da1e28] mr-0.5" /> = FAIL
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
