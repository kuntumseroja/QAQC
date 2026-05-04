'use client';

import { useState } from 'react';
import {
  BarChart3,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/file-upload';
import StatusBadge from '@/components/status-badge';

interface SimilarDefect {
  id: string;
  similarity: number;
  title: string;
}

interface ClassifyResult {
  severity: 'Critical' | 'Major' | 'Minor' | 'Cosmetic';
  priority: 'High' | 'Medium' | 'Low';
  rootCause: string;
  assignedTeam: string;
  confidence: {
    severity: number;
    priority: number;
    rootCause: number;
  };
  similarDefects: SimilarDefect[];
  workflow: string[];
}

const ROOT_CAUSE_OPTIONS = [
  'Logic Error',
  'Data Validation',
  'Integration Failure',
  'UI/UX Issue',
  'Performance Degradation',
  'Security Vulnerability',
  'Configuration Error',
  'Third-party Dependency',
];

export default function DefectClassifierPage() {
  const [description, setDescription] = useState('');
  const [logs, setLogs] = useState('');
  const [screenshotContent, setScreenshotContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [error, setError] = useState('');

  const handleClassify = async () => {
    if (!description.trim()) {
      setError('Please enter a defect description before classifying.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/defect-classifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          logs,
          screenshot: screenshotContent,
        }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: ClassifyResult = await res.json();
      setResult(data);
    } catch (err) {
      setError('Failed: ' + (err instanceof Error ? err.message : 'Unknown error')); void err;
    } finally {
      setLoading(false);
    }
  };

  const severityColor: Record<string, string> = {
    Critical: '#da1e28',
    Major: '#ff832b',
    Minor: '#f1c21b',
    Cosmetic: '#0f62fe',
  };

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
              <BarChart3 size={20} />
            </div>
            <div>
              <div className="text-[10px] text-[#6f6f6f] font-medium uppercase tracking-wider mb-0.5">
                MS-DEFECT-001
              </div>
              <h1 className="text-xl font-light text-[#161616]">Intelligent Defect Classifier</h1>
              <p className="text-sm text-[#525252] mt-0.5">
                Describe a defect and optionally attach logs or screenshots. The AI model will
                classify severity, priority, root cause, and recommend an assigned team.
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
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-medium text-[#161616]">Defect Information</h2>
          <button
            type="button"
            onClick={() => {
              setDescription(`ICPR (Indonesia Credit Penjaminan Repository) Sertifikat Penjaminan upload to api.icpr.ojk.go.id is timing out (HTTP 504) for 6 of 22 sertifikat in the sprint 24 batch. Sertifikat status remains 'PENDING_ICPR' indefinitely. Affected CIFs include 1 Korporat Rp 2 B (CIF-2026-00011) and 1 Rp 1.2 B (CIF-2026-00024). Total exposure of dropped certs ≈ Rp 6.95 B (~26% of sprint plafon). Pattern is recurring — 4× across sprints 22-24, escalating 1 → 1 → 2 → 6 certs. OJK 7-day reporting SLA at risk.`);
              setLogs(`[2026-04-13 02:00:30] INFO  stage=06_icpr_upload_sertifikat rows_in=22 expected=22 attempted=22 endpoint=api.icpr.ojk.go.id
[2026-04-13 02:01:00] WARN  stage=06_icpr_upload_sertifikat response_time=29800ms threshold=15000ms
[2026-04-13 02:01:30] WARN  stage=06_icpr_upload_sertifikat response_time=30000ms timeout reached for 6 of 22 cert uploads
[2026-04-13 02:01:30] ERROR stage=06_icpr_upload_sertifikat rows_returned=16 expected=22 missing=6 reason="upstream timeout (HTTP 504 from api.icpr.ojk.go.id)"
[2026-04-13 02:01:30] ERROR stage=06_icpr_upload_sertifikat missing_cif_ids=[CIF-2026-00006,CIF-2026-00010,CIF-2026-00011,CIF-2026-00014,CIF-2026-00020,CIF-2026-00024]`);
            }}
            className="text-[11px] text-[#0f62fe] hover:underline"
          >
            Use Jamkrindo sample (ICPR upload failure)
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#525252] mb-1">
            Defect Description <span className="text-[#da1e28]">*</span>
          </label>
          <textarea
            className="ibm-textarea"
            rows={4}
            placeholder="e.g. ICPR Sertifikat Penjaminan upload timeout — 6 of 22 sertifikat dropped from the sprint 24 batch (HTTP 504 from api.icpr.ojk.go.id). OJK 7-day SLA at risk. Affected CIFs include 1 Korporat Rp 2 B."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#525252] mb-1">
            Error Logs / Stack Trace (optional)
          </label>
          <textarea
            className="ibm-textarea font-mono text-xs"
            rows={5}
            placeholder="e.g. JaGuarS pipeline log — paste the stage 06_icpr_upload_sertifikat ERROR lines, or any stack trace from the failing JaGuarS / Oracle GL job."
            value={logs}
            onChange={(e) => setLogs(e.target.value)}
          />
        </div>

        <FileUpload
          service="defect-classifier"
          label="Attach Screenshot (optional)"
          accept=".png,.jpg,.jpeg,.gif,.webp"
          description="Supports .png, .jpg, .gif, .webp — max 5MB"
          onFileContent={(content, _name) => setScreenshotContent(content)}
        />

        {error && (
          <div className="ibm-notification ibm-notification-error flex items-center gap-2">
            <AlertCircle size={16} className="text-[#da1e28] flex-shrink-0" />
            <span className="text-sm text-[#da1e28]">{error}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleClassify}
            disabled={loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: loading ? '#8d8d8d' : '#da1e28' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Classifying Defect...
              </>
            ) : (
              <>
                <BarChart3 size={16} />
                Classify Defect
              </>
            )}
          </button>
          {result && (
            <span className="flex items-center gap-1.5 text-xs text-[#198038]">
              <CheckCircle size={14} />
              Classification complete
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Classification Cards */}
          <div className="grid grid-cols-4 gap-4">
            {/* Severity */}
            <div className="bg-white border border-[#e0e0e0] p-4 space-y-2">
              <div className="text-xs text-[#525252] uppercase tracking-wider">Severity</div>
              <StatusBadge status={result.severity} size="md" />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#6f6f6f]">Confidence</span>
                  <span className="text-[10px] font-medium text-[#161616]">
                    {result.confidence.severity}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#e0e0e0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${result.confidence.severity}%`,
                      backgroundColor: severityColor[result.severity] ?? '#da1e28',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Priority */}
            <div className="bg-white border border-[#e0e0e0] p-4 space-y-2">
              <div className="text-xs text-[#525252] uppercase tracking-wider">Priority</div>
              <StatusBadge status={result.priority} size="md" />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#6f6f6f]">Confidence</span>
                  <span className="text-[10px] font-medium text-[#161616]">
                    {result.confidence.priority}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#e0e0e0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#ff832b] transition-all"
                    style={{ width: `${result.confidence.priority}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Root Cause */}
            <div className="bg-white border border-[#e0e0e0] p-4 space-y-2">
              <div className="text-xs text-[#525252] uppercase tracking-wider">Root Cause</div>
              <span className="ibm-tag ibm-tag-purple text-xs">{result.rootCause}</span>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#6f6f6f]">Confidence</span>
                  <span className="text-[10px] font-medium text-[#161616]">
                    {result.confidence.rootCause}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#e0e0e0] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#8a3ffc] transition-all"
                    style={{ width: `${result.confidence.rootCause}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Assigned Team */}
            <div className="bg-white border border-[#e0e0e0] p-4 space-y-2">
              <div className="text-xs text-[#525252] uppercase tracking-wider">Assigned Team</div>
              <span className="ibm-tag ibm-tag-teal text-xs">{result.assignedTeam}</span>
            </div>
          </div>

          {/* Workflow State Diagram */}
          <div className="bg-white border border-[#e0e0e0] p-5">
            <h3 className="text-sm font-medium text-[#161616] mb-4">Defect Lifecycle</h3>
            <div className="flex items-center gap-0">
              {(result.workflow || []).map((state, idx) => {
                const isActive = idx === 0;
                return (
                  <div key={state} className="flex items-center">
                    <div
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div
                        className="px-3 py-1.5 text-[11px] font-medium rounded whitespace-nowrap"
                        style={
                          isActive
                            ? { background: '#da1e28', color: '#fff' }
                            : { background: '#e0e0e0', color: '#525252' }
                        }
                      >
                        {state}
                      </div>
                      {isActive && (
                        <span className="text-[9px] text-[#da1e28] font-medium uppercase tracking-wider">
                          Current
                        </span>
                      )}
                    </div>
                    {idx < result.workflow.length - 1 && (
                      <ChevronRight size={16} className="text-[#c6c6c6] mx-1 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Similar Historical Defects */}
          <div className="bg-white border border-[#e0e0e0]">
            <div className="px-5 py-3 border-b border-[#e0e0e0]">
              <h3 className="text-sm font-medium text-[#161616]">Similar Historical Defects</h3>
              <p className="text-xs text-[#525252] mt-0.5">
                Matched from defect history — review resolutions for guidance
              </p>
            </div>
            <div className="divide-y divide-[#e0e0e0]">
              {(result.similarDefects || []).map((def) => (
                <div
                  key={def.id}
                  className="px-5 py-3 flex items-center justify-between hover:bg-[#f4f4f4] transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="ibm-tag ibm-tag-gray text-[11px] mt-0.5">{def.id}</span>
                    <div>
                      <div className="text-sm text-[#161616]">{def.title}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-medium text-[#da1e28]">{def.similarity}%</div>
                      <div className="text-[10px] text-[#6f6f6f]">similarity</div>
                    </div>
                    <div className="w-16">
                      <div className="h-1.5 bg-[#e0e0e0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#da1e28] rounded-full"
                          style={{ width: `${def.similarity}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Root Cause Reference */}
          <div className="bg-white border border-[#e0e0e0] p-5">
            <h3 className="text-sm font-medium text-[#161616] mb-3">Root Cause Categories</h3>
            <div className="flex flex-wrap gap-2">
              {ROOT_CAUSE_OPTIONS.map((cause) => (
                <span
                  key={cause}
                  className={`ibm-tag ${cause === result.rootCause ? 'ibm-tag-purple' : 'ibm-tag-gray'}`}
                >
                  {cause}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
