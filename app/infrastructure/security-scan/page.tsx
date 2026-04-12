'use client';

import { useState } from 'react';
import { Shield, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/file-upload';
import StatusBadge from '@/components/status-badge';
import DataTable from '@/components/data-table';

interface ComplianceControl {
  controlId: string;
  title: string;
  status: 'PASS' | 'FAIL';
  details: string;
  remediation?: string;
}

interface SecurityScanResult {
  framework: string;
  scanDate: string;
  controls: ComplianceControl[];
  summary: { total: number; passed: number; failed: number; complianceRate: number };
}

function RemediationExpander({ remediation }: { remediation: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-[#8a3ffc] hover:text-[#6929c4] transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? 'Hide' : 'Show'} remediation
      </button>
      {open && (
        <p className="mt-2 text-xs text-[#525252]">{remediation}</p>
      )}
    </div>
  );
}

export default function SecurityScanPage() {
  const [scanInput, setScanInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SecurityScanResult | null>(null);
  const [error, setError] = useState('');

  const handleFileContent = (content: string, name: string) => {
    setScanInput(content);
    setFileName(name);
  };

  const handleScan = async () => {
    if (!scanInput.trim()) {
      setError('Please provide scan input — upload a Prowler/Scout Suite results file or paste JSON below.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/security-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: scanInput, fileName }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError('Failed: ' + (err instanceof Error ? err.message : 'Unknown error')); void err;
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      key: 'controlId',
      label: 'Control ID',
      sortable: true,
      width: '140px',
    },
    {
      key: 'title',
      label: 'Title',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Status',
      width: '90px',
      render: (value: unknown) => <StatusBadge status={String(value)} />,
    },
    {
      key: 'details',
      label: 'Details / Remediation',
      render: (value: unknown, row: Record<string, unknown>) => {
        const control = row as unknown as ComplianceControl;
        return (
          <div>
            <p className="text-xs text-[#525252]">{String(value)}</p>
            {control.status === 'FAIL' && control.remediation && (
              <RemediationExpander remediation={control.remediation} />
            )}
          </div>
        );
      },
    },
  ];

  const tableData = result
    ? (result.controls || []).map((c) => ({
        controlId: c.controlId,
        title: c.title,
        status: c.status,
        details: c.details,
        remediation: c.remediation,
      }))
    : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/infrastructure"
          className="inline-flex items-center gap-1 text-xs text-[#8a3ffc] hover:text-[#6929c4] mb-3 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Infrastructure Services
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={18} className="text-[#8a3ffc]" />
              <span className="text-xs font-medium text-[#8a3ffc] uppercase tracking-wider">
                MS-INFRA-002
              </span>
            </div>
            <h1 className="text-xl font-light text-[#161616]">Security Compliance Scanner</h1>
            <p className="text-sm text-[#525252] mt-1 max-w-2xl">
              AI-powered security compliance assessment against CIS Benchmarks, NIST SP 800-53,
              and Bank Indonesia security frameworks. Upload Prowler or Scout Suite output for
              automated analysis with remediation recommendations.
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e8daff] rounded text-xs text-[#6929c4] font-medium flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8a3ffc]" />
            MS-INFRA-002
          </div>
        </div>
      </div>

      {/* Input Panel */}
      <div className="bg-white border border-[#e0e0e0] p-5 space-y-4">
        <h2 className="text-sm font-medium text-[#161616]">Input — Upload or Paste Scan Results</h2>

        <FileUpload
          label="Upload Prowler / Scout Suite Results"
          accept=".json,.csv,.txt,.yaml,.yml"
          description="Supports Prowler JSON, Scout Suite JSON, and CSV output formats"
          onFileContent={handleFileContent}
        />

        {/* Document Preview - show extracted content so user can verify */}
        {scanInput && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-[#525252]">
                Extracted Content Preview
                <span className="ml-1 text-[#6f6f6f] font-normal">({scanInput.length.toLocaleString()} characters extracted from {fileName})</span>
              </label>
              <button
                onClick={() => { setScanInput(''); setFileName(''); }}
                className="text-xs text-[#da1e28] hover:underline"
              >
                Clear
              </button>
            </div>
            <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-3 max-h-40 overflow-y-auto text-xs text-[#525252] font-mono whitespace-pre-wrap">
              {scanInput.substring(0, 2000)}{scanInput.length > 2000 ? '\n\n... (truncated for preview)' : ''}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-medium text-[#525252]">
            Or paste scan results / target description as JSON
          </label>
          <textarea
            className="ibm-textarea w-full"
            rows={8}
            placeholder={`// Paste Prowler or Scout Suite JSON output, or describe your target infrastructure:\n{\n  "framework": "CIS AWS Benchmark v1.5",\n  "findings": [...]\n}`}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
          />
        </div>

        {error && (
          <div className="ibm-notification ibm-notification-error text-sm text-[#da1e28]">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleScan}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Shield size={16} />
                Run Compliance Scan
              </>
            )}
          </button>
          {result && (
            <span className="text-xs text-[#525252]">
              Scan completed — {result.summary?.total ?? 0} controls assessed
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Framework Header */}
          <div className="bg-white border border-[#e0e0e0] p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-medium text-[#161616]">{result.framework}</h2>
                <p className="text-xs text-[#6f6f6f] mt-0.5">
                  Scan date: {new Date(result.scanDate).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="text-right">
                <div
                  className="text-2xl font-light"
                  style={{ color: (result.summary?.complianceRate ?? 0) >= 80 ? '#198038' : (result.summary?.complianceRate ?? 0) >= 60 ? '#8e6a00' : '#da1e28' }}
                >
                  {result.summary?.complianceRate ?? 0}%
                </div>
                <div className="text-xs text-[#6f6f6f]">Compliance Rate</div>
              </div>
            </div>

            {/* Compliance Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-[#525252] mb-1">
                <span>Overall Compliance</span>
                <span>{result.summary?.passed ?? 0} / {result.summary?.total ?? 0} controls passed</span>
              </div>
              <div className="h-3 bg-[#e0e0e0] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${result.summary?.complianceRate ?? 0}%`,
                    backgroundColor: (result.summary?.complianceRate ?? 0) >= 80 ? '#198038' : (result.summary?.complianceRate ?? 0) >= 60 ? '#f1c21b' : '#da1e28',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-[#e0e0e0] p-4 text-center">
              <div className="text-2xl font-light text-[#161616]">{result.summary?.total ?? 0}</div>
              <div className="text-xs text-[#525252] mt-0.5">Total Controls</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] p-4 text-center" style={{ borderTopWidth: 2, borderTopColor: '#198038' }}>
              <div className="text-2xl font-light text-[#198038]">{result.summary?.passed ?? 0}</div>
              <div className="text-xs text-[#198038] font-medium mt-0.5">Passed</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] p-4 text-center" style={{ borderTopWidth: 2, borderTopColor: '#da1e28' }}>
              <div className="text-2xl font-light text-[#da1e28]">{result.summary?.failed ?? 0}</div>
              <div className="text-xs text-[#da1e28] font-medium mt-0.5">Failed</div>
            </div>
          </div>

          {/* Controls DataTable */}
          <DataTable
            title="Compliance Controls"
            description={`${result.framework} — all assessed controls with status and remediation`}
            columns={columns}
            data={tableData}
          />
        </div>
      )}
    </div>
  );
}
