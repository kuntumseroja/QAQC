'use client';

import { useState } from 'react';
import { FileOutput, ArrowLeft, Loader2, AlertCircle, CheckCircle, Download, Printer } from 'lucide-react';
import Link from 'next/link';
import { downloadHtmlReport, downloadJson } from '@/lib/export-utils';

interface ReportSection {
  title: string;
  content?: string;
  data?: unknown;
}

interface ReportResult {
  reportType: string;
  title: string;
  generatedAt: string;
  sections: ReportSection[];
}

export default function ReportGeneratorPage() {
  const [reportType, setReportType] = useState('qc-summary');
  const [sprint, setSprint] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState('');

  const reportTypeLabels: Record<string, string> = {
    'qc-summary': 'QC Summary',
    'test-progress': 'Test Progress',
    'defect-analysis': 'Defect Analysis',
  };

  const handleGenerate = async () => {
    if (!sprint.trim()) {
      setError('Please enter a sprint or period name.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/report-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType, sprint }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: ReportResult = await res.json();
      setResult(data);
    } catch (err) {
      setError('Failed: ' + (err instanceof Error ? err.message : 'Unknown error')); void err;
    } finally {
      setLoading(false);
    }
  };

  const buildHtmlSections = (r: ReportResult) => {
    return r.sections.map((section) => ({
      title: section.title,
      content: section.content
        ? `<p>${String(section.content)}</p>`
        : section.data
        ? dataToHtmlTable(section.data)
        : '',
    }));
  };

  // Convert data object/array to HTML table for export
  const dataToHtmlTable = (data: unknown): string => {
    if (Array.isArray(data)) {
      if (data.length === 0) return '<p>No data</p>';
      const keys = Object.keys(data[0] as Record<string, unknown>);
      const rows = data.map(row => {
        const r = row as Record<string, unknown>;
        return `<tr>${keys.map(k => `<td>${formatCellValue(r[k])}</td>`).join('')}</tr>`;
      }).join('');
      return `<table><thead><tr>${keys.map(k => `<th>${k}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    }
    if (typeof data === 'object' && data !== null) {
      const entries = Object.entries(data as Record<string, unknown>);
      const rows = entries.map(([k, v]) => `<tr><td style="font-weight:600">${k}</td><td>${formatCellValue(v)}</td></tr>`).join('');
      return `<table><tbody>${rows}</tbody></table>`;
    }
    return `<p>${String(data)}</p>`;
  };

  const formatCellValue = (v: unknown): string => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return formatObjectValue(v);
    return String(v);
  };

  // Render section data as formatted UI (not JSON dump)
  const renderSectionData = (data: unknown) => {
    if (Array.isArray(data)) {
      if (data.length === 0) return <p className="text-xs text-[#6f6f6f]">No data</p>;
      const keys = Object.keys(data[0] as Record<string, unknown>);
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#e0e0e0]">
                {keys.map(k => (
                  <th key={k} className="text-left px-3 py-2 font-semibold text-[#161616] capitalize">
                    {k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const r = row as Record<string, unknown>;
                return (
                  <tr key={i} className="border-b border-[#e0e0e0] hover:bg-[#f4f4f4]">
                    {keys.map(k => (
                      <td key={k} className="px-3 py-2 text-[#161616]">
                        {renderCellValue(r[k], k)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }
    if (typeof data === 'object' && data !== null) {
      const entries = Object.entries(data as Record<string, unknown>);
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {entries.map(([k, v]) => (
            <div key={k} className="p-3 border border-[#e0e0e0] bg-[#f4f4f4]">
              <div className="text-[10px] text-[#6f6f6f] uppercase tracking-wider mb-0.5">
                {k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
              </div>
              <div className="text-sm font-medium text-[#161616]">
                {typeof v === 'object' && v !== null
                  ? formatObjectValue(v)
                  : String(v ?? '—')}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return <p className="text-sm text-[#525252]">{String(data)}</p>;
  };

  // Format nested objects/arrays as human-readable text
  const formatObjectValue = (v: unknown): string => {
    if (v === null || v === undefined) return '—';
    if (Array.isArray(v)) {
      return v.map(item => typeof item === 'object' && item !== null ? formatObjectValue(item) : String(item)).join(', ');
    }
    if (typeof v === 'object') {
      return Object.entries(v as Record<string, unknown>)
        .map(([k, val]) => {
          const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
          const value = typeof val === 'object' && val !== null ? formatObjectValue(val) : String(val ?? '—');
          return `${label}: ${value}`;
        })
        .join(', ');
    }
    return String(v);
  };

  const renderCellValue = (v: unknown, key: string) => {
    if (v === null || v === undefined) return <span className="text-[#a8a8a8]">—</span>;
    const s = String(v);
    // Color-code status-like values
    if (s === 'PASS' || s === 'pass') return <span className="ibm-tag ibm-tag-green text-[10px]">PASS</span>;
    if (s === 'FAIL' || s === 'fail') return <span className="ibm-tag ibm-tag-red text-[10px]">FAIL</span>;
    if (s === 'WARNING' || s === 'warning') return <span className="ibm-tag ibm-tag-yellow text-[10px]">WARNING</span>;
    if (key.toLowerCase().includes('status') && (s === 'Critical' || s === 'High' || s === 'Medium' || s === 'Low'))
      return <span className={`ibm-tag text-[10px] ${s === 'Critical' ? 'ibm-tag-red' : s === 'High' ? 'ibm-tag-orange' : s === 'Medium' ? 'ibm-tag-yellow' : 'ibm-tag-blue'}`}>{s}</span>;
    if (typeof v === 'object') return <span className="text-[#525252]">{formatObjectValue(v)}</span>;
    return <span>{s}</span>;
  };

  const handleExportHtml = () => {
    if (!result) return;
    const sections = buildHtmlSections(result);
    const fileName = result.title.replace(/\s+/g, '-').toLowerCase();
    downloadHtmlReport(result.title, sections, fileName);
  };

  const handleExportJson = () => {
    if (!result) return;
    const fileName = result.title.replace(/\s+/g, '-').toLowerCase();
    downloadJson(result, fileName);
  };

  const handlePrintToPdf = () => {
    window.print();
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

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
              <FileOutput size={20} />
            </div>
            <div>
              <div className="text-[10px] text-[#6f6f6f] font-medium uppercase tracking-wider mb-0.5">
                MS-DEFECT-003
              </div>
              <h1 className="text-xl font-light text-[#161616]">Test Report Generator</h1>
              <p className="text-sm text-[#525252] mt-0.5">
                Generate structured QC summary, test progress, or defect analysis reports.
                Includes executive summary, metrics, quality gate assessments, and risk narrative.
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
        <h2 className="text-sm font-medium text-[#161616]">Report Parameters</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1">Report Type</label>
            <select
              className="ibm-select"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="qc-summary">QC Summary</option>
              <option value="test-progress">Test Progress</option>
              <option value="defect-analysis">Defect Analysis</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1">
              Sprint / Period <span className="text-[#da1e28]">*</span>
            </label>
            <input
              type="text"
              className="ibm-input"
              placeholder="e.g. Sprint 24, Q1 2025, March 2025"
              value={sprint}
              onChange={(e) => setSprint(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="ibm-notification ibm-notification-error flex items-center gap-2">
            <AlertCircle size={16} className="text-[#da1e28] flex-shrink-0" />
            <span className="text-sm text-[#da1e28]">{error}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: loading ? '#8d8d8d' : '#da1e28' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileOutput size={16} />
                Generate Report
              </>
            )}
          </button>
          {result && (
            <span className="flex items-center gap-1.5 text-xs text-[#198038]">
              <CheckCircle size={14} />
              Report generated
            </span>
          )}
        </div>
      </div>

      {/* Rendered Report */}
      {result && (
        <div className="bg-white border border-[#e0e0e0]">
          {/* Report Header */}
          <div
            className="px-8 py-6 border-b border-[#e0e0e0]"
            style={{ borderTop: '4px solid #da1e28' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] text-[#6f6f6f] uppercase tracking-wider mb-1">
                  QAQC4BI — Bank Indonesia AI-Powered QA Platform
                </div>
                <h2 className="text-2xl font-light text-[#161616]">{result.title}</h2>
                <div className="flex items-center gap-4 mt-2 text-xs text-[#525252]">
                  <span>
                    <span className="font-medium">Report Type:</span> {result.reportType}
                  </span>
                  <span>
                    <span className="font-medium">Generated:</span>{' '}
                    {formatDate(result.generatedAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportHtml}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs bg-[#edf5ff] text-[#0f62fe] hover:bg-[#d0e2ff] transition-colors border border-[#d0e2ff]"
                >
                  <Download size={14} />
                  Export HTML
                </button>
                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs bg-[#f4f4f4] text-[#525252] hover:bg-[#e0e0e0] transition-colors border border-[#e0e0e0]"
                >
                  <Download size={14} />
                  Export JSON
                </button>
                <button
                  onClick={handlePrintToPdf}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs bg-[#fff1f1] text-[#da1e28] hover:bg-[#ffd7d9] transition-colors border border-[#ffd7d9]"
                >
                  <Printer size={14} />
                  Print to PDF
                </button>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-8">
            {(result.sections || []).map((section, idx) => (
              <section key={idx}>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-1 h-5 rounded-sm flex-shrink-0"
                    style={{ background: '#da1e28' }}
                  />
                  <h3 className="text-sm font-semibold text-[#161616] uppercase tracking-wider">
                    {section.title}
                  </h3>
                </div>
                {section.content && (
                  <p className="text-sm text-[#525252] leading-relaxed whitespace-pre-wrap">
                    {String(section.content)}
                  </p>
                )}
                {section.data != null && (
                  <div className="mt-2">
                    {renderSectionData(section.data)}
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Report Footer */}
          <div className="px-8 py-4 border-t border-[#e0e0e0] bg-[#f4f4f4] flex items-center justify-between">
            <span className="text-xs text-[#6f6f6f]">
              Generated by QAQC4BI — MS-DEFECT-003 Test Report Generator
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportHtml}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#edf5ff] text-[#0f62fe] hover:bg-[#d0e2ff] transition-colors border border-[#d0e2ff]"
              >
                <Download size={12} />
                Export HTML
              </button>
              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#f4f4f4] text-[#525252] hover:bg-[#e0e0e0] transition-colors border border-[#e0e0e0]"
              >
                <Download size={12} />
                Export JSON
              </button>
              <button
                onClick={handlePrintToPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#fff1f1] text-[#da1e28] hover:bg-[#ffd7d9] transition-colors border border-[#ffd7d9]"
              >
                <Printer size={12} />
                Print to PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
