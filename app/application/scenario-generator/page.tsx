'use client';

import { useState, useEffect } from 'react';
import { FlaskConical, ArrowLeft, Loader2, CheckCircle, AlertCircle, Layers } from 'lucide-react';
import Link from 'next/link';
import FileUpload from '@/components/file-upload';
import DataTable from '@/components/data-table';
import StatusBadge from '@/components/status-badge';
import ExportButtons from '@/components/export-buttons';

interface Scenario {
  scenarioId: string;
  module: string;
  testType: 'Positive' | 'Negative' | 'Edge Case';
  priority: string;
  precondition?: string;
  steps: string[];
  expectedResult: string;
  mappedRequirement: string;
  functionalRequirement: string;
}

interface GenerateMeta {
  provider: string;
  model: string;
  processingTime: number;
  confidence: number;
  tokens: { input: number; output: number };
  inputLength: number;
}

interface GenerateResult {
  scenarios: Scenario[];
  summary: {
    total: number;
    positive: number;
    negative: number;
    edge: number;
  };
  sourceRequirements?: number;
  inputLength?: number;
  _meta?: GenerateMeta;
}

export default function ScenarioGeneratorPage() {
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [manualReqs, setManualReqs] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<string>('');
  const [model, setModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<Record<string, { id: string; name: string }[]>>({});

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(data => {
      setProvider(data.currentProvider || 'mock');
      setModel(data.currentModel || '');
      setAvailableModels(data.availableModels || {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // When provider changes, reset model to first available
    const list = availableModels[provider];
    if (list && list.length > 0 && !list.find(m => m.id === model)) {
      setModel(list[0].id);
    }
  }, [provider, availableModels]);

  const handleGenerate = async () => {
    if (!fileContent && !manualReqs.trim()) {
      setError('Please upload a document or enter requirements manually.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/scenario-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_content: fileContent,
          document_name: fileName,
          manual_requirements: manualReqs,
          provider: provider || undefined,
          model: model || undefined,
        }),
      });

      const raw = await res.json();
      if (!res.ok) throw new Error(raw.error || `API error: ${res.status}`);

      // Normalize response - Ollama may return different shapes
      let scenarios: Scenario[] = [];
      if (Array.isArray(raw.scenarios)) {
        scenarios = raw.scenarios;
      } else if (Array.isArray(raw)) {
        scenarios = raw;
      } else if (raw.test_scenarios && Array.isArray(raw.test_scenarios)) {
        scenarios = raw.test_scenarios;
      } else if (raw.testScenarios && Array.isArray(raw.testScenarios)) {
        scenarios = raw.testScenarios;
      } else {
        // Try to find any array in the response
        for (const key of Object.keys(raw)) {
          if (Array.isArray(raw[key]) && raw[key].length > 0 && typeof raw[key][0] === 'object') {
            scenarios = raw[key];
            break;
          }
        }
      }

      // Normalize field names (LLM might return snake_case or different names)
      scenarios = (scenarios as unknown as Record<string, unknown>[]).map((s, i) => ({
        scenarioId: String(s.scenarioId || s.scenario_id || s.id || `TC-${String(i + 1).padStart(3, '0')}`),
        module: String(s.module || s.category || s.component || 'General'),
        testType: String(s.testType || s.test_type || s.type || 'Positive') as Scenario['testType'],
        priority: String(s.priority || s.severity || 'Medium'),
        precondition: String(s.precondition || s.preconditions || s.prerequisites || ''),
        steps: Array.isArray(s.steps) ? s.steps.map(String) : typeof s.steps === 'string' ? [s.steps] : ['Execute test'],
        expectedResult: String(s.expectedResult || s.expected_result || s.expected || s.outcome || ''),
        mappedRequirement: String(s.mappedRequirement || s.mapped_requirement || s.requirement || s.req_id || `REQ-${String(i + 1).padStart(3, '0')}`),
        functionalRequirement: String(s.functionalRequirement || s.functional_requirement || s.fr || s.fr_id || s.frId || `FR-${String(i + 1).padStart(3, '0')}`),
      }));

      const positive = scenarios.filter(s => s.testType.toLowerCase().includes('positive') || s.testType.toLowerCase().includes('happy')).length;
      const negative = scenarios.filter(s => s.testType.toLowerCase().includes('negative') || s.testType.toLowerCase().includes('error')).length;
      const edge = scenarios.length - positive - negative;

      const data: GenerateResult = {
        scenarios,
        summary: raw.summary ? {
          total: raw.summary.total ?? scenarios.length,
          positive: raw.summary.positive ?? positive,
          negative: raw.summary.negative ?? negative,
          edge: raw.summary.edge ?? raw.summary.edge_case ?? edge,
        } : { total: scenarios.length, positive, negative, edge },
        _meta: raw._meta,
      };
      setResult(data);
    } catch (err) {
      setError(`Failed to generate scenarios: ${err instanceof Error ? err.message : 'Unknown error'}`);
      void err;
    } finally {
      setLoading(false);
    }
  };

  const flattenedScenarios = (result?.scenarios || []).map(s => ({
    scenarioId: s.scenarioId,
    module: s.module,
    functionalRequirement: s.functionalRequirement,
    testType: s.testType,
    priority: s.priority,
    steps: Array.isArray(s.steps) ? s.steps.join(' -> ') : String(s.steps || ''),
    expectedResult: s.expectedResult,
    mappedRequirement: s.mappedRequirement,
  })) || [];

  const columns = [
    { key: 'scenarioId', label: 'Scenario ID', sortable: true, width: '90px' },
    { key: 'module', label: 'Module', sortable: true, width: '140px' },
    { key: 'functionalRequirement', label: 'FR', sortable: true, width: '100px',
      render: (value: unknown) => (
        <span className="ibm-tag ibm-tag-teal">{String(value)}</span>
      ),
    },
    {
      key: 'testType',
      label: 'Test Type',
      width: '110px',
      render: (value: unknown) => <StatusBadge status={String(value)} />,
    },
    { key: 'priority', label: 'Priority', sortable: true, width: '90px',
      render: (value: unknown) => <StatusBadge status={String(value)} />,
    },
    {
      key: 'steps',
      label: 'Steps',
      render: (value: unknown) => (
        <span className="text-xs text-[#525252]">
          {Array.isArray(value) ? value.join(' → ') : String(value)}
        </span>
      ),
    },
    { key: 'expectedResult', label: 'Expected Result', width: '200px' },
    { key: 'mappedRequirement', label: 'Mapped Req', sortable: true, width: '110px',
      render: (value: unknown) => (
        <span className="ibm-tag ibm-tag-blue">{String(value)}</span>
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
              <FlaskConical size={20} />
            </div>
            <div>
              <div className="text-[10px] text-[#6f6f6f] font-medium uppercase tracking-wider mb-0.5">
                MS-APP-001
              </div>
              <h1 className="text-xl font-light text-[#161616]">Test Scenario Generator</h1>
              <p className="text-sm text-[#525252] mt-0.5">
                Upload a BRD/SRS document or enter requirements to generate comprehensive test
                scenarios with full traceability.
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
        <h2 className="text-sm font-medium text-[#161616]">Input Requirements</h2>

        {/* Provider / Model Override */}
        <div className="flex flex-wrap items-end gap-3 p-3 bg-[#f4f4f4] border border-[#e0e0e0]">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-[#525252] mb-1">LLM Provider</label>
            <select className="ibm-select" value={provider} onChange={e => setProvider(e.target.value)}>
              {Object.keys(availableModels).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-medium text-[#525252] mb-1">Model</label>
            <select className="ibm-select" value={model} onChange={e => setModel(e.target.value)}>
              {(availableModels[provider] || []).map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-[#6f6f6f] pb-2">
            Per-request override — overrides default in <code className="bg-white px-1">.env.local</code>
          </div>
        </div>

        <FileUpload
          label="Upload BRD/SRS Document"
          accept=".txt,.docx,.pdf"
          description="Supports .txt, .docx, .pdf — max 10MB"
          onFileContent={(content, name) => {
            setFileContent(content);
            setFileName(name);
          }}
        />

        {/* Document Preview - show extracted content so user can verify */}
        {fileContent && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-[#525252]">
                Extracted Content Preview
                <span className="ml-1 text-[#6f6f6f] font-normal">({fileContent.length.toLocaleString()} characters extracted from {fileName})</span>
              </label>
              <button
                onClick={() => { setFileContent(''); setFileName(''); }}
                className="text-xs text-[#da1e28] hover:underline"
              >
                Clear
              </button>
            </div>
            <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-3 max-h-40 overflow-y-auto text-xs text-[#525252] font-mono whitespace-pre-wrap">
              {fileContent.substring(0, 2000)}{fileContent.length > 2000 ? '\n\n... (truncated for preview)' : ''}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-[#525252] mb-1">
            Or Enter Requirements Manually
          </label>
          <textarea
            className="ibm-textarea"
            rows={5}
            placeholder="Paste requirement text here, one per line...&#10;e.g. REQ-001: System shall allow users to login with OTP"
            value={manualReqs}
            onChange={(e) => setManualReqs(e.target.value)}
          />
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
                Generating Scenarios...
              </>
            ) : (
              <>
                <FlaskConical size={16} />
                Generate Test Scenarios
              </>
            )}
          </button>
          {result && (
            <span className="flex items-center gap-1.5 text-xs text-[#198038]">
              <CheckCircle size={14} />
              {(result.summary?.total ?? 0)} scenarios generated
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary Bar */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white border border-[#e0e0e0] p-4 flex flex-col gap-1">
              <div className="text-xs text-[#525252] uppercase tracking-wider">Total</div>
              <div className="text-2xl font-light text-[#161616]">{(result.summary?.total ?? 0)}</div>
              <div className="text-xs text-[#6f6f6f]">Scenarios generated</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] p-4 flex flex-col gap-1">
              <div className="text-xs text-[#525252] uppercase tracking-wider">Positive</div>
              <div className="text-2xl font-light text-[#198038]">{(result.summary?.positive ?? 0)}</div>
              <div className="text-xs text-[#6f6f6f]">Happy path scenarios</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] p-4 flex flex-col gap-1">
              <div className="text-xs text-[#525252] uppercase tracking-wider">Negative</div>
              <div className="text-2xl font-light text-[#da1e28]">{(result.summary?.negative ?? 0)}</div>
              <div className="text-xs text-[#6f6f6f]">Error & failure paths</div>
            </div>
            <div className="bg-white border border-[#e0e0e0] p-4 flex flex-col gap-1">
              <div className="text-xs text-[#525252] uppercase tracking-wider">Edge Case</div>
              <div className="text-2xl font-light text-[#8a3ffc]">{(result.summary?.edge ?? 0)}</div>
              <div className="text-xs text-[#6f6f6f]">Boundary conditions</div>
            </div>
          </div>

          {/* Provider Info */}
          {result._meta && (
            <div className={`flex items-center justify-between px-4 py-2.5 border text-xs ${
              result._meta.provider === 'mock'
                ? 'bg-[#fff8e1] border-[#f1c21b] text-[#8e6a00]'
                : 'bg-[#defbe6] border-[#42be65] text-[#198038]'
            }`}>
              <div className="flex items-center gap-3">
                <span className="font-medium">
                  {result._meta.provider === 'mock' ? '⚠ Mock Engine' : `✓ ${result._meta.provider.toUpperCase()}`}
                </span>
                <span className="text-[#525252]">Model: {result._meta.model}</span>
                <span className="text-[#525252]">•</span>
                <span className="text-[#525252]">{(result._meta.processingTime / 1000).toFixed(1)}s</span>
                <span className="text-[#525252]">•</span>
                <span className="text-[#525252]">{result._meta.inputLength.toLocaleString()} chars input</span>
              </div>
              {result._meta.provider === 'mock' && (
                <span className="text-[10px] italic">
                  Results are template-based. Configure LLM_PROVIDER in .env.local for AI-generated scenarios.
                </span>
              )}
            </div>
          )}

          {/* Type distribution bar */}
          <div className="bg-white border border-[#e0e0e0] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#525252]">Distribution by Test Type</span>
              <div className="flex items-center gap-4 text-xs text-[#525252]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#198038]"/>Positive</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#da1e28]"/>Negative</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#8a3ffc]"/>Edge Case</span>
              </div>
            </div>
            <div className="flex h-2 rounded overflow-hidden gap-0.5">
              <div
                className="bg-[#198038] transition-all"
                style={{ width: `${((result.summary?.positive ?? 0) / (result.summary?.total ?? 0)) * 100}%` }}
              />
              <div
                className="bg-[#da1e28] transition-all"
                style={{ width: `${((result.summary?.negative ?? 0) / (result.summary?.total ?? 0)) * 100}%` }}
              />
              <div
                className="bg-[#8a3ffc] transition-all"
                style={{ width: `${((result.summary?.edge ?? 0) / (result.summary?.total ?? 0)) * 100}%` }}
              />
            </div>
          </div>

          {/* Data Table */}
          <DataTable
            title="Generated Test Scenarios"
            description={`${(result.summary?.total ?? 0)} scenarios ready for export`}
            columns={columns}
            data={result.scenarios as unknown as Record<string, unknown>[]}
            actions={
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs text-[#525252]">
                  <Layers size={14} />
                  {(result.summary?.total ?? 0)} scenarios
                </div>
                <ExportButtons data={flattenedScenarios} fileNameBase="test_scenarios" />
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
