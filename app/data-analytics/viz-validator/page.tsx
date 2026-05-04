'use client';

import { use, useState } from 'react';
import { Eye, Play, CheckCircle, XCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import FileUpload from '@/components/file-upload';
import StatusBadge from '@/components/status-badge';

const DOMAIN_COLOR = '#009d9a';
const SERVICE_ID = 'MS-DATA-003';

type CheckStatus = 'PASS' | 'WARNING' | 'FAIL';

interface VizCheck {
  check: string;
  status: CheckStatus;
  details: string;
}

interface VizResult {
  dashboardName: string;
  checks: VizCheck[];
  summary: {
    pass: number;
    warning: number;
    fail: number;
  };
}

const STATUS_ICONS: Record<CheckStatus, React.ReactNode> = {
  PASS: <CheckCircle size={16} className="text-[#198038] flex-shrink-0 mt-0.5" />,
  WARNING: <AlertTriangle size={16} className="text-[#8e6a00] flex-shrink-0 mt-0.5" />,
  FAIL: <XCircle size={16} className="text-[#da1e28] flex-shrink-0 mt-0.5" />,
};

export default function VizValidatorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  use(searchParams);

  const [dashboardName, setDashboardName] = useState('');
  const [screenshotContent, setScreenshotContent] = useState('');
  const [screenshotFileName, setScreenshotFileName] = useState('');
  const [dataQuery, setDataQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VizResult | null>(null);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | CheckStatus>('All');

  const handleValidate = async () => {
    if (!dashboardName.trim()) {
      setError('Dashboard name is required.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/viz-validator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboardName,
          screenshot: screenshotContent,
          screenshotFileName,
          dataQuery,
        }),
      });

      if (response.ok) {
        const data = await response.json();
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
    setDashboardName('');
    setScreenshotContent('');
    setScreenshotFileName('');
    setDataQuery('');
    setActiveFilter('All');
  };

  const totalChecks = result
    ? result.summary.pass + result.summary.warning + result.summary.fail
    : 0;

  const filteredChecks =
    result?.checks.filter(
      (c) => activeFilter === 'All' || c.status === activeFilter
    ) ?? [];

  const actionItems =
    result?.checks.filter((c) => c.status === 'FAIL' || c.status === 'WARNING') ?? [];

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
            <Eye size={20} style={{ color: DOMAIN_COLOR }} />
            Visualization Validator
          </h1>
          <p className="text-sm text-[#525252] mt-0.5 max-w-2xl">
            Cross-check dashboard visuals against underlying data, validate labelling accuracy,
            assess WCAG 2.1 accessibility compliance, and verify completeness against BI
            specifications.
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
          <h2 className="text-sm font-medium text-[#161616]">Dashboard Configuration</h2>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[#525252]">Dashboard Name *</label>
            <input
              className="ibm-input"
              placeholder="e.g. PSP Transaction Executive Dashboard — Q1 2026"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
            />
          </div>

          <FileUpload
            service="viz-validator"
            label="Dashboard Screenshot"
            accept=".png,.jpg,.jpeg,.webp,.pdf"
            description="Upload a screenshot of the dashboard (PNG, JPG, or PDF). The AI will analyse visual elements, labels, and layout."
            onFileContent={(content, name) => {
              setScreenshotContent(content);
              setScreenshotFileName(name);
            }}
          />

          {/* Document Preview - show extracted content so user can verify */}
          {screenshotContent && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-[#525252]">
                  Extracted Content Preview
                  <span className="ml-1 text-[#6f6f6f] font-normal">({screenshotContent.length.toLocaleString()} characters extracted from {screenshotFileName})</span>
                </label>
                <button
                  onClick={() => { setScreenshotContent(''); setScreenshotFileName(''); }}
                  className="text-xs text-[#da1e28] hover:underline"
                >
                  Clear
                </button>
              </div>
              <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-3 max-h-40 overflow-y-auto text-xs text-[#525252] font-mono whitespace-pre-wrap">
                {screenshotContent.substring(0, 2000)}{screenshotContent.length > 2000 ? '\n\n... (truncated for preview)' : ''}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[#525252]">
              Data Query Results
              <span className="ml-1 text-[#6f6f6f] font-normal">
                (paste the SQL query and/or result set that powers the dashboard)
              </span>
            </label>
            <textarea
              className="ibm-textarea font-mono text-xs"
              style={{ minHeight: 160 }}
              placeholder={`-- Paste your dashboard data query and/or result set here\nSELECT\n  SUM(amount) AS total_amount,\n  COUNT(*) AS transaction_count,\n  AVG(amount) AS avg_amount\nFROM dw.fact_transactions\nWHERE reporting_period = '2026-Q1';\n\n-- Result:\n-- total_amount: 14238452000\n-- transaction_count: 2341876\n-- avg_amount: 6080.45`}
              value={dataQuery}
              onChange={(e) => setDataQuery(e.target.value)}
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
                  Validating dashboard...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Validate Dashboard
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
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Checks', value: totalChecks, color: '#161616' },
              { label: 'Passed', value: result.summary.pass, color: '#198038' },
              { label: 'Warnings', value: result.summary.warning, color: '#8e6a00' },
              { label: 'Failed', value: result.summary.fail, color: '#da1e28' },
            ].map((m) => (
              <div key={m.label} className="bg-white border border-[#e0e0e0] p-4">
                <div className="text-[10px] text-[#6f6f6f] uppercase tracking-wider mb-1">{m.label}</div>
                <div className="text-3xl font-light" style={{ color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="bg-white border border-[#e0e0e0] p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-[#161616]">{result.dashboardName}</h3>
              {screenshotFileName && (
                <span className="text-xs text-[#6f6f6f]">{screenshotFileName}</span>
              )}
            </div>
            <div className="flex h-3 rounded overflow-hidden">
              <div
                style={{
                  width: totalChecks > 0 ? `${(result.summary.pass / totalChecks) * 100}%` : '0%',
                  backgroundColor: '#198038',
                }}
              />
              <div
                style={{
                  width: totalChecks > 0 ? `${(result.summary.warning / totalChecks) * 100}%` : '0%',
                  backgroundColor: '#f1c21b',
                }}
              />
              <div
                style={{
                  width: totalChecks > 0 ? `${(result.summary.fail / totalChecks) * 100}%` : '0%',
                  backgroundColor: '#da1e28',
                }}
              />
            </div>
            <div className="flex gap-4 mt-2">
              {[
                { label: 'PASS', color: '#198038' },
                { label: 'WARNING', color: '#f1c21b' },
                { label: 'FAIL', color: '#da1e28' },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                  <span className="text-[10px] text-[#6f6f6f]">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white border border-[#e0e0e0]">
            <div className="border-b border-[#e0e0e0] px-4 pt-4">
              <div className="flex gap-1 flex-wrap">
                {(['All', 'PASS', 'WARNING', 'FAIL'] as const).map((filter) => {
                  const isActive = activeFilter === filter;
                  const count =
                    filter === 'All'
                      ? totalChecks
                      : filter === 'PASS'
                      ? result.summary.pass
                      : filter === 'WARNING'
                      ? result.summary.warning
                      : result.summary.fail;
                  const dotColor =
                    filter === 'PASS'
                      ? '#198038'
                      : filter === 'WARNING'
                      ? '#f1c21b'
                      : filter === 'FAIL'
                      ? '#da1e28'
                      : null;
                  return (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                        isActive
                          ? 'border-[#009d9a] text-[#009d9a]'
                          : 'border-transparent text-[#525252] hover:text-[#161616]'
                      }`}
                    >
                      {dotColor && (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: dotColor }}
                        />
                      )}
                      {filter === 'All' ? `All Checks (${count})` : `${filter} (${count})`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Checklist */}
            <div className="divide-y divide-[#e0e0e0]">
              {filteredChecks.map((check, i) => (
                <div
                  key={i}
                  className={`px-4 py-3 flex items-start gap-3 ${
                    check.status === 'FAIL'
                      ? 'bg-[#fff8f8]'
                      : check.status === 'WARNING'
                      ? 'bg-[#fffdf0]'
                      : ''
                  }`}
                >
                  {STATUS_ICONS[check.status]}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-medium text-[#161616]">{check.check}</span>
                    </div>
                    <p className="text-xs text-[#525252] leading-relaxed">{check.details}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <StatusBadge status={check.status} size="sm" />
                  </div>
                </div>
              ))}
              {filteredChecks.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-[#6f6f6f]">
                  No checks in this category.
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t border-[#e0e0e0] text-xs text-[#6f6f6f]">
              {filteredChecks.length} {filteredChecks.length === 1 ? 'check' : 'checks'}
              {activeFilter !== 'All' && ` — ${activeFilter}`}
            </div>
          </div>

          {/* Action Items */}
          {actionItems.length > 0 && (
            <div className="bg-white border border-[#e0e0e0] p-4">
              <h3 className="text-sm font-medium text-[#161616] mb-3">Action Items</h3>
              <div className="space-y-2">
                {actionItems
                  .sort((a, b) => (a.status === 'FAIL' ? -1 : 1))
                  .map((check, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 border border-[#e0e0e0]">
                      {STATUS_ICONS[check.status]}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-[#161616]">{check.check}</span>
                          <StatusBadge status={check.status} size="sm" />
                        </div>
                        <p className="text-xs text-[#525252]">{check.details}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
