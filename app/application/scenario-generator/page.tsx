'use client';

import { useState, useEffect } from 'react';
import { FlaskConical, ArrowLeft, Loader2, CheckCircle, AlertCircle, Layers, ListChecks } from 'lucide-react';
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

interface PlanModule {
  name: string;
  chapter?: string;
  summary?: string;
  expectedScenarios?: number;
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

  // Plan-then-generate state
  const [planning, setPlanning] = useState(false);
  const [planModules, setPlanModules] = useState<PlanModule[] | null>(null);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string } | null>(null);

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

  // When user picks Ollama, query the local server for the actually installed
  // models so the dropdown reflects reality (not a hardcoded guess).
  useEffect(() => {
    if (provider !== 'ollama') return;
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test-ollama' }),
    })
      .then(r => r.json())
      .then(data => {
        if (data?.success && Array.isArray(data.models) && data.models.length > 0) {
          const live = data.models.map((m: { id: string; name?: string; size?: number }) => ({
            id: m.id,
            name: m.name || m.id,
          }));
          setAvailableModels(prev => ({ ...prev, ollama: live }));
          if (!live.find((m: { id: string }) => m.id === model)) {
            setModel(live[0].id);
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // Extract scenarios from any LLM response shape (handles snake_case, alt keys, plain arrays).
  const extractScenarios = (raw: Record<string, unknown>): Scenario[] => {
    let arr: unknown[] = [];
    if (Array.isArray(raw.scenarios)) arr = raw.scenarios;
    else if (Array.isArray(raw)) arr = raw;
    else if (Array.isArray((raw as Record<string, unknown>).test_scenarios)) arr = (raw as { test_scenarios: unknown[] }).test_scenarios;
    else if (Array.isArray((raw as Record<string, unknown>).testScenarios)) arr = (raw as { testScenarios: unknown[] }).testScenarios;
    else {
      for (const key of Object.keys(raw)) {
        const v = (raw as Record<string, unknown>)[key];
        if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') {
          arr = v as unknown[];
          break;
        }
      }
    }
    return (arr as Record<string, unknown>[]).map((s, i): Scenario => ({
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
  };

  const summarize = (scenarios: Scenario[]) => {
    const positive = scenarios.filter(s => s.testType.toLowerCase().includes('positive') || s.testType.toLowerCase().includes('happy')).length;
    const negative = scenarios.filter(s => s.testType.toLowerCase().includes('negative') || s.testType.toLowerCase().includes('error')).length;
    const edge = scenarios.length - positive - negative;
    return { total: scenarios.length, positive, negative, edge };
  };

  // Step 1 — ask the LLM to enumerate modules in the document.
  const handlePlan = async () => {
    if (!fileContent && !manualReqs.trim()) {
      setError('Please upload a document or enter requirements manually.');
      return;
    }
    setError('');
    setPlanning(true);
    setPlanModules(null);
    setResult(null);
    setProgress(null);
    try {
      const res = await fetch('/api/scenario-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'plan',
          document_content: fileContent,
          document_name: fileName,
          manual_requirements: manualReqs,
          provider: provider || undefined,
          model: model || undefined,
        }),
      });
      const raw = await res.json();
      if (!res.ok) throw new Error(raw.error || `API error: ${res.status}`);
      const modules: PlanModule[] = Array.isArray(raw.modules) ? raw.modules : [];
      if (modules.length === 0) {
        const onOllama = provider === 'ollama';
        throw new Error(
          onOllama
            ? `${model} returned a response but no recognizable user stories. Small local models often free-form. Try llama3.1:8b for short FSDs or switch to Anthropic / DeepSeek for cloud-grade reliability. You can also click "Generate All At Once" to skip the planning pass.`
            : 'No user stories detected. Try a different document or click "Generate All At Once" to skip planning.'
        );
      }
      setPlanModules(modules);
      // Pre-select all modules by default
      setSelectedModules(new Set(modules.map(m => m.name)));
    } catch (err) {
      setError(`Failed to identify user stories: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPlanning(false);
    }
  };

  // Step 2 — generate scenarios for selected modules sequentially, accumulating results.
  const handleGenerateSelected = async () => {
    if (!planModules || selectedModules.size === 0) {
      setError('Select at least one user story to generate.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    const toRun = planModules.filter(m => selectedModules.has(m.name));
    setProgress({ done: 0, total: toRun.length });

    const allScenarios: Scenario[] = [];
    let lastMeta: GenerateResult['_meta'] | undefined;

    for (let i = 0; i < toRun.length; i++) {
      const mod = toRun[i];
      setProgress({ done: i, total: toRun.length, current: mod.name });
      try {
        const res = await fetch('/api/scenario-gen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'generate-module',
            module: mod,
            document_content: fileContent,
            document_name: fileName,
            manual_requirements: manualReqs,
            provider: provider || undefined,
            model: model || undefined,
          }),
        });
        const raw = await res.json();
        if (!res.ok) {
          console.warn(`Module "${mod.name}" failed:`, raw.error);
          continue;
        }
        const scs = extractScenarios(raw);
        allScenarios.push(...scs);
        if (raw._meta) lastMeta = raw._meta;
        // Show partial results as we go
        const renumbered = allScenarios.map((s, idx) => ({ ...s, scenarioId: `TC-${String(idx + 1).padStart(3, '0')}` }));
        setResult({ scenarios: renumbered, summary: summarize(renumbered), _meta: lastMeta });
      } catch (err) {
        console.warn(`Module "${mod.name}" error:`, err);
      }
    }

    setProgress({ done: toRun.length, total: toRun.length });
    setLoading(false);
  };

  // Single-shot generation (legacy / small docs / no planning needed)
  const handleGenerate = async () => {
    if (!fileContent && !manualReqs.trim()) {
      setError('Please upload a document or enter requirements manually.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    setPlanModules(null);
    try {
      const res = await fetch('/api/scenario-gen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          document_content: fileContent,
          document_name: fileName,
          manual_requirements: manualReqs,
          provider: provider || undefined,
          model: model || undefined,
        }),
      });
      const raw = await res.json();
      if (!res.ok) throw new Error(raw.error || `API error: ${res.status}`);
      const scenarios = extractScenarios(raw);
      const summary = raw.summary ? {
        total: raw.summary.total ?? scenarios.length,
        positive: raw.summary.positive ?? summarize(scenarios).positive,
        negative: raw.summary.negative ?? summarize(scenarios).negative,
        edge: raw.summary.edge ?? raw.summary.edge_case ?? summarize(scenarios).edge,
      } : summarize(scenarios);
      setResult({ scenarios, summary, _meta: raw._meta });
    } catch (err) {
      setError(`Failed to generate scenarios: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (name: string) => {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleAllModules = () => {
    if (!planModules) return;
    if (selectedModules.size === planModules.length) {
      setSelectedModules(new Set());
    } else {
      setSelectedModules(new Set(planModules.map(m => m.name)));
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
    { key: 'module', label: 'User Story', sortable: true, width: '160px' },
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
          service="scenario-generator"
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

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handlePlan}
            disabled={planning || loading}
            className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Recommended for multi-domain FSDs — lists user stories so you can pick which to generate"
          >
            {planning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Identifying user stories...
              </>
            ) : (
              <>
                <ListChecks size={16} />
                Identify User Stories
              </>
            )}
          </button>

          <button
            onClick={handleGenerate}
            disabled={loading || planning}
            className="btn-secondary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            title="Single-shot generation — best for small documents"
          >
            {loading && !planModules ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FlaskConical size={16} />
                Generate All At Once
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

      {/* User Story Plan Panel — shown after Identify User Stories */}
      {planModules && planModules.length > 0 && (
        <div className="bg-white border border-[#e0e0e0] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-[#161616] flex items-center gap-2">
                <Layers size={16} className="text-[#0f62fe]" />
                Detected User Stories ({planModules.length})
              </h2>
              <p className="text-xs text-[#525252] mt-1">
                Select the user stories you want to generate test scenarios for. Each runs as a separate, smaller LLM call.
              </p>
            </div>
            <button
              onClick={toggleAllModules}
              className="text-xs text-[#0f62fe] hover:underline"
            >
              {selectedModules.size === planModules.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto border border-[#e0e0e0] p-2">
            {planModules.map((mod, i) => {
              const checked = selectedModules.has(mod.name);
              return (
                <label
                  key={`${mod.name}-${i}`}
                  className={`flex items-start gap-2 p-3 border cursor-pointer transition-colors ${
                    checked ? 'border-[#0f62fe] bg-[#edf5ff]' : 'border-[#e0e0e0] bg-white hover:border-[#c6c6c6]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleModule(mod.name)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#161616] flex items-center gap-2 flex-wrap">
                      <span>{mod.name}</span>
                      {mod.chapter && <span className="ibm-tag ibm-tag-gray text-[10px]">Ch. {mod.chapter}</span>}
                      <span className="ibm-tag ibm-tag-blue text-[10px]">~{mod.expectedScenarios || 10} TC</span>
                    </div>
                    {mod.summary && (
                      <div className="text-[11px] text-[#525252] mt-1 leading-relaxed">{mod.summary}</div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleGenerateSelected}
              disabled={loading || selectedModules.size === 0}
              className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating ({progress?.done ?? 0}/{progress?.total ?? 0})…
                </>
              ) : (
                <>
                  <FlaskConical size={16} />
                  Generate Selected ({selectedModules.size})
                </>
              )}
            </button>
            {progress && progress.current && (
              <span className="text-xs text-[#525252]">
                Currently: <strong>{progress.current}</strong>
              </span>
            )}
          </div>
        </div>
      )}

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
