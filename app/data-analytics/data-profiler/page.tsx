'use client';

import { use, useState } from 'react';
import { Search, Play, AlertTriangle, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import QualityGauge from '@/components/quality-gauge';
import DataTable from '@/components/data-table';
import FileUpload from '@/components/file-upload';
import StatusBadge from '@/components/status-badge';

const DOMAIN_COLOR = '#009d9a';
const SERVICE_ID = 'MS-DATA-001';

interface ColumnProfile {
  column: string;
  dataType: string;
  totalRows: number;
  nullCount: number;
  nullRate: string;
  uniqueCount: number;
  completeness: string;
  validity: string;
  anomalies: number;
}

interface QualityDimensionEntry {
  score: number;
  status: 'PASS' | 'FAIL';
  threshold: number;
}

interface ProfileResult {
  datasetName: string;
  rowCount: number;
  columnCount: number;
  profileDate: string;
  columns: ColumnProfile[];
  qualityDimensions: {
    accuracy: QualityDimensionEntry;
    completeness: QualityDimensionEntry;
    consistency: QualityDimensionEntry;
    timeliness: QualityDimensionEntry;
    uniqueness: QualityDimensionEntry;
    validity: QualityDimensionEntry;
  };
  anomalySummary: {
    total: number;
    critical: number;
    medium: number;
    low: number;
  };
}

const DIMENSION_LABELS: { key: keyof ProfileResult['qualityDimensions']; label: string }[] = [
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'completeness', label: 'Completeness' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'timeliness', label: 'Timeliness' },
  { key: 'uniqueness', label: 'Uniqueness' },
  { key: 'validity', label: 'Validity' },
];

const columnDefs = [
  { key: 'column', label: 'Column', sortable: true, width: '160px' },
  { key: 'dataType', label: 'Data Type', sortable: false, width: '140px' },
  { key: 'totalRows', label: 'Total Rows', sortable: true, width: '110px',
    render: (v: unknown) => Number(v).toLocaleString() },
  { key: 'nullCount', label: 'Null Count', sortable: true, width: '110px',
    render: (v: unknown) => Number(v).toLocaleString() },
  { key: 'nullRate', label: 'Null Rate', sortable: true, width: '100px' },
  { key: 'uniqueCount', label: 'Unique Count', sortable: true, width: '110px',
    render: (v: unknown) => Number(v).toLocaleString() },
  { key: 'completeness', label: 'Completeness', sortable: true, width: '120px' },
  { key: 'validity', label: 'Validity', sortable: true, width: '100px' },
  { key: 'anomalies', label: 'Anomalies', sortable: true, width: '100px',
    render: (v: unknown) => {
      const n = Number(v);
      return (
        <span className={n > 20 ? 'text-[#da1e28] font-medium' : n > 0 ? 'text-[#8e6a00]' : 'text-[#198038]'}>
          {n}
        </span>
      );
    } },
];

export default function DataProfilerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  use(searchParams);

  const [datasetName, setDatasetName] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [sampleContent, setSampleContent] = useState('');
  const [sampleFileName, setSampleFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [error, setError] = useState('');

  const handleProfile = async () => {
    if (!datasetName.trim() && !connectionString.trim() && !sampleContent.trim()) {
      setError('Please provide a dataset name, connection string, or upload a data sample.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/data-profiler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetName, connectionString, sampleContent, sampleFileName }),
      });

      if (response.ok) {
        const raw = await response.json();

        // Normalize LLM response - handle different field naming conventions
        const normalizeDimension = (d: Record<string, unknown> | undefined, fallbackScore: number) => ({
          score: Number(d?.score ?? d?.value ?? fallbackScore),
          status: String(d?.status ?? (Number(d?.score ?? fallbackScore) >= (Number(d?.threshold ?? 95)) ? 'PASS' : 'FAIL')) as 'PASS' | 'FAIL',
          threshold: Number(d?.threshold ?? 95),
        });

        const qd = raw.qualityDimensions || raw.quality_dimensions || raw.dimensions || {};
        // If dimensions is an array, convert to object keyed by name
        let qdObj = qd;
        if (Array.isArray(qd)) {
          qdObj = {} as Record<string, unknown>;
          for (const dim of qd) {
            const name = String(dim.name || dim.dimension || dim.label || '').toLowerCase();
            (qdObj as Record<string, unknown>)[name] = dim;
          }
        }

        const cols = raw.columns || raw.column_profiles || raw.fields || raw.profile || [];
        const normalizedCols = (Array.isArray(cols) ? cols : []).map((c: Record<string, unknown>) => ({
          column: String(c.column || c.name || c.field || c.column_name || ''),
          dataType: String(c.dataType || c.data_type || c.type || 'unknown'),
          totalRows: Number(c.totalRows || c.total_rows || c.row_count || raw.rowCount || raw.row_count || raw.totalRows || 0),
          nullCount: Number(c.nullCount || c.null_count || c.nulls || 0),
          nullRate: String(c.nullRate || c.null_rate || c.null_percentage || ((Number(c.nullCount || c.null_count || 0) / Math.max(Number(c.totalRows || c.total_rows || raw.rowCount || 1), 1)) * 100).toFixed(2) + '%'),
          uniqueCount: Number(c.uniqueCount || c.unique_count || c.unique || c.distinct || 0),
          completeness: String(c.completeness || c.completeness_pct || '100%'),
          validity: String(c.validity || c.validity_pct || '100%'),
          anomalies: Array.isArray(c.anomalies) ? c.anomalies.length : Number(c.anomalies || c.anomaly_count || 0),
        }));

        const as = raw.anomalySummary || raw.anomaly_summary || raw.anomalies || {};
        const anomalySummary = Array.isArray(as)
          ? { total: as.length, critical: as.filter((a: Record<string, unknown>) => String(a.severity).toLowerCase() === 'critical').length, medium: as.filter((a: Record<string, unknown>) => String(a.severity).toLowerCase() === 'medium').length, low: as.filter((a: Record<string, unknown>) => String(a.severity).toLowerCase() === 'low').length }
          : { total: Number(as.total ?? 0), critical: Number(as.critical ?? 0), medium: Number(as.medium ?? 0), low: Number(as.low ?? 0) };

        const normalized: ProfileResult = {
          datasetName: String(raw.datasetName || raw.dataset_name || raw.name || datasetName || sampleFileName || 'Dataset'),
          rowCount: Number(raw.rowCount || raw.row_count || raw.totalRows || raw.total_rows || 0),
          columnCount: Number(raw.columnCount || raw.column_count || raw.totalColumns || normalizedCols.length || 0),
          profileDate: String(raw.profileDate || raw.profile_date || raw.timestamp || new Date().toISOString()),
          columns: normalizedCols,
          qualityDimensions: {
            accuracy: normalizeDimension((qdObj as Record<string, Record<string, unknown>>).accuracy, 95),
            completeness: normalizeDimension((qdObj as Record<string, Record<string, unknown>>).completeness, 98),
            consistency: normalizeDimension((qdObj as Record<string, Record<string, unknown>>).consistency, 90),
            timeliness: normalizeDimension((qdObj as Record<string, Record<string, unknown>>).timeliness, 95),
            uniqueness: normalizeDimension((qdObj as Record<string, Record<string, unknown>>).uniqueness, 99),
            validity: normalizeDimension((qdObj as Record<string, Record<string, unknown>>).validity, 95),
          },
          anomalySummary,
        };

        setResult(normalized);
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
    setDatasetName('');
    setConnectionString('');
    setSampleContent('');
    setSampleFileName('');
  };

  const dimensions = result?.qualityDimensions
    ? DIMENSION_LABELS.map(({ key, label }) => ({
        label,
        score: result.qualityDimensions?.[key]?.score ?? 0,
        status: (result.qualityDimensions?.[key]?.status ?? 'PASS') as 'PASS' | 'FAIL',
        threshold: result.qualityDimensions?.[key]?.threshold ?? 95,
      }))
    : [];

  const passCount = dimensions.filter((d) => d.status === 'PASS').length;
  const failCount = dimensions.filter((d) => d.status === 'FAIL').length;
  const totalAnomalies = result?.anomalySummary?.total ?? 0;

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
            <Search size={20} style={{ color: DOMAIN_COLOR }} />
            Data Quality Profiler
          </h1>
          <p className="text-sm text-[#525252] mt-0.5 max-w-2xl">
            Analyse datasets across six ISO 8000 quality dimensions — Accuracy, Completeness,
            Consistency, Timeliness, Uniqueness, and Validity — with column-level statistics
            and anomaly detection.
          </p>
        </div>
        {result && (
          <button onClick={handleReset} className="btn-ghost flex items-center gap-2 !min-h-[36px] !py-1.5 !px-3 text-xs">
            <RotateCcw size={14} />
            New Profile
          </button>
        )}
      </div>

      {/* Input Panel */}
      {!result && (
        <div className="bg-white border border-[#e0e0e0] p-6 space-y-5">
          <h2 className="text-sm font-medium text-[#161616]">Dataset Configuration</h2>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#525252]">Dataset Name *</label>
              <input
                className="ibm-input"
                placeholder="e.g. PSP Transaction Log Q1 2026"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-[#525252]">
                Connection String / Table Reference
              </label>
              <input
                className="ibm-input"
                placeholder="e.g. jdbc:postgresql://host/db — table: transactions"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[#525252]">
              CSV Headers / Column Metadata (paste or type)
            </label>
            <textarea
              className="ibm-textarea"
              style={{ minHeight: 100 }}
              placeholder={`transaction_id,account_number,amount,currency,transaction_date,status\nVARCHAR(36),VARCHAR(20),DECIMAL(18,2),CHAR(3),TIMESTAMP,VARCHAR(20)`}
              value={connectionString.includes('\n') ? connectionString : undefined}
              onChange={(e) => setConnectionString(e.target.value)}
            />
          </div>

          <FileUpload
            label="Data Sample File (CSV, JSON, Parquet schema)"
            accept=".csv,.json,.parquet,.xlsx,.txt"
            description="Upload a sample file — headers and up to 1,000 rows will be profiled."
            onFileContent={(content, name) => {
              setSampleContent(content);
              setSampleFileName(name);
            }}
          />

          {/* Document Preview - show extracted content so user can verify */}
          {sampleContent && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-[#525252]">
                  Extracted Content Preview
                  <span className="ml-1 text-[#6f6f6f] font-normal">({sampleContent.length.toLocaleString()} characters extracted from {sampleFileName})</span>
                </label>
                <button
                  onClick={() => { setSampleContent(''); setSampleFileName(''); }}
                  className="text-xs text-[#da1e28] hover:underline"
                >
                  Clear
                </button>
              </div>
              <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-3 max-h-40 overflow-y-auto text-xs text-[#525252] font-mono whitespace-pre-wrap">
                {sampleContent.substring(0, 2000)}{sampleContent.length > 2000 ? '\n\n... (truncated for preview)' : ''}
              </div>
            </div>
          )}

          {error && (
            <div className="ibm-notification ibm-notification-error">
              <XCircle size={16} className="text-[#da1e28] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-[#da1e28]">{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleProfile}
              disabled={loading}
              style={loading ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Profiling dataset...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Profile Dataset
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
          {/* Result Summary Bar */}
          <div className="bg-white border border-[#e0e0e0] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-medium text-[#161616]">{result.datasetName}</h2>
                <p className="text-xs text-[#6f6f6f]">
                  {(result.rowCount ?? 0).toLocaleString()} rows · {(result.columnCount ?? 0)} columns ·
                  Profiled at {new Date(result.profileDate).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-[#198038]" />
                  <span className="text-sm text-[#161616]">{passCount} PASS</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle size={16} className="text-[#da1e28]" />
                  <span className="text-sm text-[#161616]">{failCount} FAIL</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-[#f1c21b]" />
                  <span className="text-sm text-[#161616]">{totalAnomalies.toLocaleString()} Anomalies</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quality Dimension Gauges */}
          <div className="bg-white border border-[#e0e0e0] p-6">
            <h3 className="text-sm font-medium text-[#161616] mb-5">
              Quality Dimensions — ISO 8000
            </h3>
            <div className="grid grid-cols-6 gap-6">
              {dimensions.map((dim) => (
                <div key={dim.label} className="flex flex-col items-center gap-2">
                  <QualityGauge
                    value={dim.score}
                    label={dim.label}
                    size={110}
                  />
                  <StatusBadge status={dim.status} />
                  <span className="text-[10px] text-[#6f6f6f] text-center">
                    Threshold: {dim.threshold}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Anomaly Summary Bar */}
          <div className="bg-white border border-[#e0e0e0] p-4">
            <h3 className="text-sm font-medium text-[#161616] mb-3">Anomaly Summary</h3>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total', value: (result.anomalySummary?.total ?? 0), color: '#161616' },
                { label: 'Critical', value: (result.anomalySummary?.critical ?? 0), color: '#da1e28' },
                { label: 'Medium', value: (result.anomalySummary?.medium ?? 0), color: '#f1c21b' },
                { label: 'Low', value: (result.anomalySummary?.low ?? 0), color: '#0f62fe' },
              ].map((a) => (
                <div key={a.label} className="flex items-center justify-between p-3 border border-[#e0e0e0]">
                  <div>
                    <div className="text-xs text-[#525252]">{a.label}</div>
                    <div className="text-lg font-light" style={{ color: a.color }}>
                      {a.value.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Visual bar */}
            <div className="mt-4">
              <div className="flex h-3 rounded overflow-hidden">
                {(() => {
                  const total = (result.anomalySummary?.total ?? 0) || 1;
                  const segments = [
                    { key: 'critical', color: '#da1e28' },
                    { key: 'medium', color: '#f1c21b' },
                    { key: 'low', color: '#0f62fe' },
                  ] as const;
                  return segments.map((s) => {
                    const count = result.anomalySummary?.[s.key] ?? 0;
                    return (
                      <div
                        key={s.key}
                        style={{ width: `${(count / total) * 100}%`, backgroundColor: s.color }}
                        title={`${s.key}: ${count}`}
                      />
                    );
                  });
                })()}
              </div>
              <div className="flex gap-4 mt-2">
                {[
                  { label: 'Critical', color: '#da1e28' },
                  { label: 'Medium', color: '#f1c21b' },
                  { label: 'Low', color: '#0f62fe' },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: l.color }} />
                    <span className="text-[10px] text-[#6f6f6f]">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column Profile Table */}
          <DataTable
            title="Column-Level Profile"
            description={`${(result.columns || []).length} columns analysed across ${(result.rowCount ?? 0).toLocaleString()} rows`}
            columns={columnDefs}
            data={(result.columns || []).map((c) => ({ ...c } as Record<string, unknown>))}
            onExport={() => {
              const csv = [
                columnDefs.map((c) => c.label).join(','),
                ...(result.columns || []).map((r) =>
                  columnDefs.map((c) => String((r as unknown as Record<string, unknown>)[c.key] ?? '')).join(',')
                ),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `profile_${result.datasetName.replace(/\s/g, '_')}.csv`;
              a.click();
            }}
          />
        </div>
      )}
    </div>
  );
}
