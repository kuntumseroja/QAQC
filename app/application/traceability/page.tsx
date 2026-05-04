'use client';

import { useState } from 'react';
import { GitBranch, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/file-upload';
import DataTable from '@/components/data-table';
import StatusBadge from '@/components/status-badge';
import ExportButtons from '@/components/export-buttons';

interface MatrixRow {
  requirementId: string;
  description: string;
  testCaseIds: string[];
  coverageStatus: 'Covered' | 'Gap';
  gapNotes: string;
}

interface MatrixResult {
  matrix: MatrixRow[];
  coverage: {
    total: number;
    covered: number;
    gaps: number;
    percentage: number;
  };
}

export default function TraceabilityPage() {
  const [reqFileContent, setReqFileContent] = useState('');
  const [reqFileName, setReqFileName] = useState('');
  const [manualReqs, setManualReqs] = useState('');
  const [tcFileContent, setTcFileContent] = useState('');
  const [tcFileName, setTcFileName] = useState('');
  const [manualTestCases, setManualTestCases] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MatrixResult | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    const reqInput = reqFileContent || manualReqs.trim();
    const tcInput = tcFileContent || manualTestCases.trim();
    if (!reqInput) {
      setError('Please provide requirements (upload BRD/SRS or enter manually).');
      return;
    }
    if (!tcInput) {
      setError('Please provide test cases (upload test case document or enter manually).');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const combinedInput = `=== REQUIREMENTS ===\n${reqInput}\n\n=== TEST CASES ===\n${tcInput}`;
      const res = await fetch('/api/traceability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_content: combinedInput,
          document_name: reqFileName || 'manual-input',
          manual_requirements: '',
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const raw = await res.json();

      // Normalize response
      let matrix = raw.matrix || raw.traceability || raw.entries || [];
      if (!Array.isArray(matrix)) {
        for (const key of Object.keys(raw)) {
          if (Array.isArray(raw[key]) && raw[key].length > 0) { matrix = raw[key]; break; }
        }
      }
      matrix = (matrix as unknown as Record<string, unknown>[]).map((r, i) => ({
        requirementId: String(r.requirementId || r.requirement_id || r.reqId || r.id || `REQ-${String(i+1).padStart(3,'0')}`),
        description: String(r.description || r.requirement || r.text || ''),
        testCaseIds: Array.isArray(r.testCaseIds) ? r.testCaseIds : Array.isArray(r.test_case_ids) ? r.test_case_ids : Array.isArray(r.testCases) ? r.testCases : typeof r.testCaseIds === 'string' ? [r.testCaseIds] : [],
        coverageStatus: (r.coverageStatus || r.coverage_status || r.status || (Array.isArray(r.testCaseIds) && r.testCaseIds.length > 0 ? 'Covered' : 'Gap')) as MatrixRow['coverageStatus'],
        gapNotes: String(r.gapNotes || r.gap_notes || r.notes || r.gaps || ''),
      }));

      const covered = matrix.filter((r: MatrixRow) => r.coverageStatus === 'Covered').length;
      const data: MatrixResult = {
        matrix: matrix as MatrixRow[],
        coverage: raw.coverage ? {
          total: raw.coverage.total ?? matrix.length,
          covered: raw.coverage.covered ?? covered,
          gaps: raw.coverage.gaps ?? (matrix.length - covered),
          percentage: raw.coverage.percentage ?? (matrix.length > 0 ? Math.round((covered / matrix.length) * 100) : 0),
        } : {
          total: matrix.length,
          covered,
          gaps: matrix.length - covered,
          percentage: matrix.length > 0 ? Math.round((covered / matrix.length) * 100) : 0,
        },
      };
      setResult(data);
    } catch (err) {
      setError('Failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      void err;
    } finally {
      setLoading(false);
    }
  };

  const flattenedMatrix = (result?.matrix || []).map(r => ({
    requirementId: r.requirementId,
    description: r.description,
    testCaseIds: r.testCaseIds.join('; '),
    coverageStatus: r.coverageStatus,
    gapNotes: r.gapNotes,
  })) || [];

  const columns = [
    { key: 'requirementId', label: 'Req ID', sortable: true, width: '110px',
      render: (value: unknown) => (
        <span className="ibm-tag ibm-tag-blue">{String(value)}</span>
      ),
    },
    { key: 'description', label: 'Description' },
    {
      key: 'testCaseIds',
      label: 'Test Cases',
      width: '180px',
      render: (value: unknown) => {
        const cases = Array.isArray(value) ? value : [];
        if (cases.length === 0)
          return <span className="text-xs text-[#6f6f6f] italic">None mapped</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {cases.map((tc: string) => (
              <span key={tc} className="ibm-tag ibm-tag-teal text-[11px]">{tc}</span>
            ))}
          </div>
        );
      },
    },
    {
      key: 'coverageStatus',
      label: 'Coverage',
      width: '100px',
      render: (value: unknown) => <StatusBadge status={String(value)} />,
    },
    { key: 'gapNotes', label: 'Gap Notes',
      render: (value: unknown) => (
        <span className={`text-xs ${String(value) ? 'text-[#da1e28]' : 'text-[#6f6f6f]'}`}>
          {String(value) || '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/application"
          className="inline-flex items-center gap-1 text-xs text-[#0f62fe] hover:underline mb-3"
        >
          <ArrowLeft size={12} /> Application QA/QC
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-[#edf5ff] text-[#0f62fe] mt-0.5">
              <GitBranch size={20} />
            </div>
            <div>
              <div className="text-[10px] text-[#6f6f6f] font-medium uppercase tracking-wider mb-0.5">
                MS-APP-002
              </div>
              <h1 className="text-xl font-light text-[#161616]">Traceability Matrix Automator</h1>
              <p className="text-sm text-[#525252] mt-0.5">
                Generate requirement-to-test-case traceability matrices and automatically identify
                coverage gaps.
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 px-2 py-1 bg-[#defbe6] text-[#198038] text-xs rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-[#198038]" /> Healthy
          </span>
        </div>
      </div>

      {/* Input Panel */}
      <div className="bg-white border border-[#e0e0e0] p-5 space-y-5">
        <div className="ibm-notification ibm-notification-info">
          <span className="text-xs">A traceability matrix maps <strong>requirements</strong> to <strong>test cases</strong>. Provide both inputs below to generate the mapping and identify coverage gaps.</span>
        </div>

        {/* Input 1: Requirements */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-[#0f62fe] text-white rounded-full flex items-center justify-center text-xs font-medium">1</span>
            <h2 className="text-sm font-medium text-[#161616]">Requirements (BRD / SRS)</h2>
          </div>

          <FileUpload
            service="traceability"
            label="Upload Requirements Document"
            accept=".txt,.docx,.pdf,.xlsx"
            description="BRD, SRS, or requirements specification — .txt, .docx, .pdf"
            onFileContent={(content, name) => {
              setReqFileContent(content);
              setReqFileName(name);
            }}
          />

          {/* Document Preview - show extracted content so user can verify */}
          {reqFileContent && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-[#525252]">
                  Extracted Content Preview
                  <span className="ml-1 text-[#6f6f6f] font-normal">({reqFileContent.length.toLocaleString()} characters extracted from {reqFileName})</span>
                </label>
                <button
                  onClick={() => { setReqFileContent(''); setReqFileName(''); }}
                  className="text-xs text-[#da1e28] hover:underline"
                >
                  Clear
                </button>
              </div>
              <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-3 max-h-40 overflow-y-auto text-xs text-[#525252] font-mono whitespace-pre-wrap">
                {reqFileContent.substring(0, 2000)}{reqFileContent.length > 2000 ? '\n\n... (truncated for preview)' : ''}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1">
              Or Paste Requirements
            </label>
            <textarea
              className="ibm-textarea"
              rows={4}
              placeholder="REQ-001: System shall allow PSP registration through secure portal&#10;REQ-002: System shall perform KYC/AML screening&#10;REQ-003: System shall calculate composite risk score&#10;..."
              value={manualReqs}
              onChange={(e) => setManualReqs(e.target.value)}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[#e0e0e0]" />

        {/* Input 2: Test Cases */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 bg-[#009d9a] text-white rounded-full flex items-center justify-center text-xs font-medium">2</span>
            <h2 className="text-sm font-medium text-[#161616]">Test Cases (Test Repository / Jira Export)</h2>
          </div>

          <FileUpload
            service="traceability"
            label="Upload Test Case Document"
            accept=".txt,.docx,.pdf,.xlsx,.csv,.json"
            description="Test case list, Jira export, or test scenario document — .txt, .xlsx, .csv"
            onFileContent={(content, name) => {
              setTcFileContent(content);
              setTcFileName(name);
            }}
          />

          {/* Document Preview - show extracted content so user can verify */}
          {tcFileContent && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-[#525252]">
                  Extracted Content Preview
                  <span className="ml-1 text-[#6f6f6f] font-normal">({tcFileContent.length.toLocaleString()} characters extracted from {tcFileName})</span>
                </label>
                <button
                  onClick={() => { setTcFileContent(''); setTcFileName(''); }}
                  className="text-xs text-[#da1e28] hover:underline"
                >
                  Clear
                </button>
              </div>
              <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-3 max-h-40 overflow-y-auto text-xs text-[#525252] font-mono whitespace-pre-wrap">
                {tcFileContent.substring(0, 2000)}{tcFileContent.length > 2000 ? '\n\n... (truncated for preview)' : ''}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1">
              Or Paste Test Cases
            </label>
            <textarea
              className="ibm-textarea"
              rows={4}
              placeholder="TC-001: Verify PSP registration with valid data → Expected: Registration successful&#10;TC-002: Verify PSP registration with missing fields → Expected: Validation error&#10;TC-003: Verify KYC screening passes for clean applicant&#10;TC-004: Verify KYC screening flags watchlist match&#10;..."
              value={manualTestCases}
              onChange={(e) => setManualTestCases(e.target.value)}
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
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Building Traceability Matrix...
              </>
            ) : (
              <>
                <GitBranch size={16} />
                Generate Traceability Matrix
              </>
            )}
          </button>
          {result && (
            <span className="flex items-center gap-1.5 text-xs text-[#198038]">
              <CheckCircle size={14} />
              Matrix generated — {result.coverage?.percentage ?? 0}% coverage
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Coverage Summary Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border border-[#e0e0e0] p-4">
              <div className="text-xs text-[#525252] uppercase tracking-wider mb-1">Total Requirements</div>
              <div className="text-2xl font-light text-[#161616]">{result.coverage?.total ?? 0}</div>
              <div className="text-xs text-[#6f6f6f]">In document</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] p-4">
              <div className="text-xs text-[#525252] uppercase tracking-wider mb-1">Covered</div>
              <div className="text-2xl font-light text-[#198038]">{result.coverage?.covered ?? 0}</div>
              <div className="text-xs text-[#6f6f6f]">Have mapped test cases</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] p-4">
              <div className="text-xs text-[#525252] uppercase tracking-wider mb-1">Gaps</div>
              <div className="text-2xl font-light text-[#da1e28]">{result.coverage?.gaps ?? 0}</div>
              <div className="text-xs text-[#6f6f6f]">No test cases mapped</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] p-4">
              <div className="text-xs text-[#525252] uppercase tracking-wider mb-1">Coverage</div>
              <div
                className="text-2xl font-light"
                style={{ color: (result.coverage?.percentage ?? 0) >= 80 ? '#198038' : (result.coverage?.percentage ?? 0) >= 60 ? '#8e6a00' : '#da1e28' }}
              >
                {result.coverage?.percentage ?? 0}%
              </div>
              <div className="text-xs text-[#6f6f6f]">Requirements covered</div>
            </div>
          </div>

          {/* Coverage Progress Bar */}
          <div className="bg-white border border-[#e0e0e0] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#525252]">
                Overall Coverage — {result.coverage?.percentage ?? 0}%
              </span>
              <span className="text-xs text-[#525252]">
                {result.coverage?.covered ?? 0} of {result.coverage?.total ?? 0} requirements covered
              </span>
            </div>
            <div className="w-full h-3 bg-[#e0e0e0] rounded overflow-hidden">
              <div
                className="h-full transition-all duration-500 rounded"
                style={{
                  width: `${result.coverage?.percentage ?? 0}%`,
                  backgroundColor:
                    (result.coverage?.percentage ?? 0) >= 80
                      ? '#198038'
                      : (result.coverage?.percentage ?? 0) >= 60
                      ? '#f1c21b'
                      : '#da1e28',
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-[#6f6f6f]">0%</span>
              <span className="text-[10px] text-[#6f6f6f]">Target: 95%</span>
              <span className="text-[10px] text-[#6f6f6f]">100%</span>
            </div>
          </div>

          {/* Data Table */}
          <DataTable
            title="Traceability Matrix"
            description={`${result.coverage?.total ?? 0} requirements — ${result.coverage?.gaps ?? 0} gaps identified`}
            columns={columns}
            data={result.matrix as unknown as Record<string, unknown>[]}
            actions={
              <ExportButtons data={flattenedMatrix} fileNameBase="traceability_matrix" />
            }
          />
        </div>
      )}
    </div>
  );
}
