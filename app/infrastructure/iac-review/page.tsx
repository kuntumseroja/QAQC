'use client';

import { useState } from 'react';
import { Code2, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/file-upload';
import StatusBadge from '@/components/status-badge';
import ExportButtons from '@/components/export-buttons';

interface IacFinding {
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  file: string;
  line: number;
  rule?: string;
  finding: string;
  recommendation: string;
  fix?: string;
}

interface IacReviewResult {
  filesReviewed: number;
  findings: IacFinding[];
  summary: { critical: number; high: number; medium: number; low: number };
  complianceScore: number;
}

const severityColors: Record<string, { bg: string; color: string; border: string }> = {
  Critical: { bg: '#fff1f1', color: '#da1e28', border: '#da1e28' },
  High: { bg: '#ffd8a8', color: '#5e2900', border: '#ff832b' },
  Medium: { bg: '#fcf4d6', color: '#8e6a00', border: '#f1c21b' },
  Low: { bg: '#d0e2ff', color: '#002d9c', border: '#4589ff' },
};

function FindingCard({ finding }: { finding: IacFinding }) {
  const [showFix, setShowFix] = useState(false);
  const sc = severityColors[finding.severity];

  return (
    <div
      className="bg-white border border-[#e0e0e0] rounded"
      style={{ borderLeftWidth: 3, borderLeftColor: sc.border }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={finding.severity} />
            <span className="text-xs font-mono text-[#6f6f6f] bg-[#f4f4f4] px-2 py-0.5 rounded">
              {finding.file}:{finding.line}
            </span>
            {finding.rule && (
              <span className="text-xs text-[#525252] font-medium">{finding.rule}</span>
            )}
          </div>
        </div>
        <p className="text-sm text-[#161616] mb-2">{finding.finding}</p>
        <div className="flex items-start gap-1.5">
          <span className="text-xs font-medium text-[#198038] flex-shrink-0 mt-0.5">Recommendation:</span>
          <p className="text-xs text-[#525252]">{finding.recommendation}</p>
        </div>
        {finding.fix && (
          <button
            onClick={() => setShowFix(!showFix)}
            className="mt-3 flex items-center gap-1 text-xs text-[#8a3ffc] hover:text-[#6929c4] transition-colors"
          >
            {showFix ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {showFix ? 'Hide' : 'Show'} suggested fix
          </button>
        )}
      </div>
      {showFix && finding.fix && (
        <div className="border-t border-[#e0e0e0]">
          <pre className="bg-[#161616] text-[#f4f4f4] text-xs font-mono p-4 overflow-x-auto leading-relaxed">
            <code>{finding.fix}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

export default function IacReviewPage() {
  const [iacCode, setIacCode] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IacReviewResult | null>(null);
  const [error, setError] = useState('');

  const handleFileContent = (content: string, name: string) => {
    setIacCode(content);
    setFileName(name);
  };

  const handleReview = async () => {
    if (!iacCode.trim()) {
      setError('Please provide IaC code to review — upload a file or paste code below.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/iac-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: iacCode, fileName }),
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

  const totalFindings = result
    ? result.summary.critical + result.summary.high + result.summary.medium + result.summary.low
    : 0;

  const flattenedFindings = (result?.findings || []).map((f, i) => ({
    index: i + 1,
    severity: f.severity,
    file: f.file,
    line: f.line,
    rule: f.rule,
    finding: f.finding,
    recommendation: f.recommendation,
  })) || [];

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
              <Code2 size={18} className="text-[#8a3ffc]" />
              <span className="text-xs font-medium text-[#8a3ffc] uppercase tracking-wider">
                MS-INFRA-001
              </span>
            </div>
            <h1 className="text-xl font-light text-[#161616]">IaC Code Review Agent</h1>
            <p className="text-sm text-[#525252] mt-1 max-w-2xl">
              AI-powered review of Infrastructure as Code files. Upload Terraform, Ansible, or
              CloudFormation files to detect misconfigurations, security anti-patterns, and
              compliance violations with actionable remediation guidance.
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e8daff] rounded text-xs text-[#6929c4] font-medium flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8a3ffc]" />
            MS-INFRA-001
          </div>
        </div>
      </div>

      {/* Input Panel */}
      <div className="bg-white border border-[#e0e0e0] p-5 space-y-4">
        <h2 className="text-sm font-medium text-[#161616]">Input — Upload or Paste IaC Code</h2>

        <FileUpload
          service="iac-review"
          label="Upload Terraform / Ansible / CloudFormation File"
          accept=".tf,.yaml,.yml,.json,.hcl,.template"
          description="Supports .tf, .yaml, .yml, .json, .hcl, .template files"
          onFileContent={handleFileContent}
        />

        {/* Document Preview - show extracted IaC code so user can verify */}
        {iacCode && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-[#525252]">
                Extracted IaC Code Preview
                <span className="ml-1 text-[#6f6f6f] font-normal">({iacCode.length.toLocaleString()} characters extracted from {fileName})</span>
              </label>
              <button
                onClick={() => { setIacCode(''); setFileName(''); }}
                className="text-xs text-[#da1e28] hover:underline"
              >
                Clear
              </button>
            </div>
            <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-3 max-h-40 overflow-y-auto text-xs text-[#525252] font-mono whitespace-pre-wrap">
              {iacCode.substring(0, 2000)}{iacCode.length > 2000 ? '\n\n... (truncated for preview)' : ''}
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-medium text-[#525252]">
            Or paste IaC code directly
          </label>
          <textarea
            className="ibm-textarea w-full"
            rows={10}
            placeholder={`# Paste your Terraform, Ansible, or CloudFormation code here\n\nresource "aws_s3_bucket" "example" {\n  bucket = "my-bucket"\n}`}
            value={iacCode}
            onChange={(e) => setIacCode(e.target.value)}
          />
        </div>

        {error && (
          <div className="ibm-notification ibm-notification-error text-sm text-[#da1e28]">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleReview}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Reviewing...
              </>
            ) : (
              <>
                <Code2 size={16} />
                Review IaC Code
              </>
            )}
          </button>
          {result && (
            <span className="text-xs text-[#525252]">
              Review completed — {totalFindings} finding{totalFindings !== 1 ? 's' : ''} identified
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary Bar */}
          <div className="bg-white border border-[#e0e0e0] p-4">
            <h2 className="text-sm font-medium text-[#161616] mb-3">Review Summary</h2>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-3 bg-[#f4f4f4] border border-[#e0e0e0]">
                <div className="text-2xl font-light text-[#161616]">{result.filesReviewed}</div>
                <div className="text-xs text-[#525252] mt-0.5">Files Reviewed</div>
              </div>
              <div className="text-center p-3" style={{ backgroundColor: '#fff1f1', border: '1px solid #da1e28' }}>
                <div className="text-2xl font-light text-[#da1e28]">{result.summary.critical}</div>
                <div className="text-xs text-[#da1e28] font-medium mt-0.5">Critical</div>
              </div>
              <div className="text-center p-3" style={{ backgroundColor: '#ffd8a8', border: '1px solid #ff832b' }}>
                <div className="text-2xl font-light text-[#5e2900]">{result.summary.high}</div>
                <div className="text-xs text-[#5e2900] font-medium mt-0.5">High</div>
              </div>
              <div className="text-center p-3" style={{ backgroundColor: '#fcf4d6', border: '1px solid #f1c21b' }}>
                <div className="text-2xl font-light text-[#8e6a00]">{result.summary.medium}</div>
                <div className="text-xs text-[#8e6a00] font-medium mt-0.5">Medium</div>
              </div>
              <div className="text-center p-3" style={{ backgroundColor: '#d0e2ff', border: '1px solid #4589ff' }}>
                <div className="text-2xl font-light text-[#002d9c]">{result.summary.low}</div>
                <div className="text-xs text-[#002d9c] font-medium mt-0.5">Low</div>
              </div>
            </div>
          </div>

          {/* Compliance Score */}
          <div className="bg-white border border-[#e0e0e0] p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-[#161616]">Compliance Score</h2>
              <span
                className="text-lg font-medium"
                style={{ color: result.complianceScore >= 80 ? '#198038' : result.complianceScore >= 60 ? '#8e6a00' : '#da1e28' }}
              >
                {result.complianceScore}%
              </span>
            </div>
            <div className="h-3 bg-[#e0e0e0] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${result.complianceScore}%`,
                  backgroundColor:
                    result.complianceScore >= 80
                      ? '#198038'
                      : result.complianceScore >= 60
                      ? '#f1c21b'
                      : '#da1e28',
                }}
              />
            </div>
            <p className="text-xs text-[#525252] mt-2">
              {result.summary.critical} critical, {result.summary.high} high, {result.summary.medium} medium, {result.summary.low} low
            </p>
          </div>

          {/* Findings List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#161616]">
                Findings ({totalFindings})
              </h2>
              <div className="flex items-center gap-2">
                {(['Critical', 'High', 'Medium', 'Low'] as const).map((sev) => (
                  result.summary[sev.toLowerCase() as keyof typeof result.summary] > 0 && (
                    <StatusBadge key={sev} status={sev} />
                  )
                ))}
                <ExportButtons data={flattenedFindings} fileNameBase="iac_review_findings" />
              </div>
            </div>

            {result.findings.length === 0 ? (
              <div className="ibm-notification ibm-notification-success text-sm text-[#198038]">
                No findings detected. Your IaC code appears compliant.
              </div>
            ) : (
              <div className="space-y-3">
                {(result.findings || []).map((finding, idx) => (
                  <FindingCard key={`${finding.file}-${finding.line}-${idx}`} finding={finding} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
