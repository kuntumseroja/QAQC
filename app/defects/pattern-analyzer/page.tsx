'use client';

import { useState } from 'react';
import { Activity, ArrowLeft, Loader2, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import DataTable from '@/components/data-table';
import ExportButtons from '@/components/export-buttons';

interface HeatmapRow {
  module: string;
  critical: number;
  major: number;
  minor: number;
  cosmetic: number;
  riskScore: number;
}

interface TrendStats {
  totalDefects: number;
  openDefects: number;
  avgResolutionDays: number;
  reopenRate: number;
  topRootCauses: { cause: string; count: number; percentage: number }[];
}

interface PatternResult {
  period: string;
  heatmap: HeatmapRow[];
  trends: TrendStats;
  recommendations: string[];
}

function RiskBar({ score }: { score: number }) {
  const color = score >= 75 ? '#da1e28' : score >= 50 ? '#ff832b' : score >= 30 ? '#f1c21b' : '#198038';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-[#e0e0e0] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="text-xs font-medium w-8 text-right"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

export default function PatternAnalyzerPage() {
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PatternResult | null>(null);
  const [error, setError] = useState('');

  const periodLabels: Record<string, string> = {
    '30d': 'Last 30 days',
    '3m': 'Last 3 months',
    '6m': 'Last 6 months',
    '1y': 'Last year',
  };

  const handleAnalyze = async () => {
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/defect-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: PatternResult = await res.json();
      setResult(data);
    } catch (err) {
      setError('Failed: ' + (err instanceof Error ? err.message : 'Unknown error')); void err;
    } finally {
      setLoading(false);
    }
  };

  const maxCount = result
    ? Math.max(...(result.trends?.topRootCauses || []).map((r) => r.count), 1)
    : 1;

  const heatmapColumns = [
    { key: 'module', label: 'Module', sortable: true, width: '180px' },
    {
      key: 'critical',
      label: 'Critical',
      sortable: true,
      width: '80px',
      render: (value: unknown) => (
        <span className="text-sm font-medium text-[#da1e28]">{String(value)}</span>
      ),
    },
    {
      key: 'major',
      label: 'Major',
      sortable: true,
      width: '80px',
      render: (value: unknown) => (
        <span className="text-sm font-medium text-[#ff832b]">{String(value)}</span>
      ),
    },
    {
      key: 'minor',
      label: 'Minor',
      sortable: true,
      width: '80px',
      render: (value: unknown) => (
        <span className="text-sm font-medium text-[#8e6a00]">{String(value)}</span>
      ),
    },
    {
      key: 'cosmetic',
      label: 'Cosmetic',
      sortable: true,
      width: '80px',
      render: (value: unknown) => (
        <span className="text-sm font-medium text-[#0043ce]">{String(value)}</span>
      ),
    },
    {
      key: 'riskScore',
      label: 'Risk Score',
      sortable: true,
      render: (_value: unknown, row: Record<string, unknown>) => (
        <RiskBar score={Number(row.riskScore)} />
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/defects"
          className="inline-flex items-center gap-1 text-xs text-[#da1e28] hover:underline mb-3"
        >
          <ArrowLeft size={12} /> Defect Management
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-[#fff1f1] text-[#da1e28] mt-0.5">
              <Activity size={20} />
            </div>
            <div>
              <div className="text-[10px] text-[#6f6f6f] font-medium uppercase tracking-wider mb-0.5">
                MS-DEFECT-002
              </div>
              <h1 className="text-xl font-light text-[#161616]">Defect Pattern Analyzer</h1>
              <p className="text-sm text-[#525252] mt-0.5">
                Analyze defect trends across modules and time periods to surface risk hotspots,
                recurring root causes, and AI-generated remediation recommendations.
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-[#defbe6] text-[#198038] text-xs rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-[#198038]" /> Healthy
          </span>
        </div>
      </div>

      {/* Input Panel */}
      <div className="bg-white border border-[#e0e0e0] p-5 space-y-4">
        <h2 className="text-sm font-medium text-[#161616]">Analysis Parameters</h2>

        <div className="max-w-xs">
          <label className="block text-xs font-medium text-[#525252] mb-1">Time Period</label>
          <select
            className="ibm-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="30d">Last 30 days</option>
            <option value="3m">Last 3 months</option>
            <option value="6m">Last 6 months</option>
            <option value="1y">Last year</option>
          </select>
        </div>

        {error && (
          <div className="ibm-notification ibm-notification-error flex items-center gap-2">
            <AlertCircle size={16} className="text-[#da1e28] flex-shrink-0" />
            <span className="text-sm text-[#da1e28]">{error}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: loading ? '#8d8d8d' : '#da1e28' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analyzing Patterns...
              </>
            ) : (
              <>
                <Activity size={16} />
                Analyze Patterns
              </>
            )}
          </button>
          {result && (
            <span className="flex items-center gap-1.5 text-xs text-[#198038]">
              <CheckCircle size={14} />
              Analysis complete for {result.period}
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Trend Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              {
                label: 'Total Defects',
                value: (result.trends?.totalDefects ?? 0).toLocaleString(),
                sub: result.period,
                color: '#da1e28',
              },
              {
                label: 'Open Defects',
                value: result.trends?.openDefects ?? 0,
                sub: 'Awaiting resolution',
                color: '#ff832b',
              },
              {
                label: 'Avg Resolution',
                value: `${result.trends?.avgResolutionDays ?? 0}d`,
                sub: 'Calendar days P50',
                color: '#0f62fe',
              },
              {
                label: 'Reopen Rate',
                value: `${result.trends?.reopenRate ?? 0}%`,
                sub: 'Defects reopened after close',
                color: (result.trends?.reopenRate ?? 0) > 10 ? '#da1e28' : '#198038',
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-white border border-[#e0e0e0] p-4">
                <div className="text-xs text-[#525252] uppercase tracking-wider mb-1">
                  {stat.label}
                </div>
                <div className="text-2xl font-light" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="text-xs text-[#6f6f6f] mt-1">{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Risk Heatmap */}
          <DataTable
            title="Module Risk Heatmap"
            description={`Defect distribution by module and severity — ${result.period}`}
            columns={heatmapColumns}
            data={(result.heatmap || []) as unknown as Record<string, unknown>[]}
            actions={
              <ExportButtons data={(result.heatmap || []) as unknown as Record<string, unknown>[]} fileNameBase="defect_heatmap" />
            }
          />

          {/* Top Root Causes + AI Recommendations side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Top Root Causes */}
            <div className="bg-white border border-[#e0e0e0] p-5">
              <h3 className="text-sm font-medium text-[#161616] mb-4">Top Root Causes</h3>
              <div className="space-y-3">
                {(result.trends?.topRootCauses || []).map((rc) => (
                  <div key={rc.cause}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#161616]">{rc.cause}</span>
                      <span className="text-xs font-medium text-[#da1e28]">{rc.count}</span>
                    </div>
                    <div className="h-2 bg-[#e0e0e0] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#da1e28] rounded-full transition-all"
                        style={{ width: `${(rc.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="bg-white border border-[#e0e0e0] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb size={16} className="text-[#da1e28]" />
                <h3 className="text-sm font-medium text-[#161616]">AI Recommendations</h3>
              </div>
              <div className="space-y-3">
                {(result.recommendations || []).map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                      style={{ background: '#da1e28' }}
                    >
                      {idx + 1}
                    </span>
                    <p className="text-xs text-[#525252] leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
