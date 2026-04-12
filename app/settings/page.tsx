'use client';

import { useState, useEffect } from 'react';
import { Settings, Server, Cloud, Cpu, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import StatusBadge from '@/components/status-badge';

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  size?: number;
}

interface SettingsData {
  currentProvider: string;
  currentModel: string;
  ollamaBaseUrl: string;
  hasAnthropicKey: boolean;
  availableModels: {
    ollama: ModelInfo[];
    anthropic: ModelInfo[];
    mock: ModelInfo[];
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('mock');
  const [selectedModel, setSelectedModel] = useState('mock-engine');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState<{ success: boolean; message: string; models: ModelInfo[] } | null>(null);
  const [anthropicStatus, setAnthropicStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((data: SettingsData) => {
        setSettings(data);
        setSelectedProvider(data.currentProvider);
        setSelectedModel(data.currentModel);
        setOllamaUrl(data.ollamaBaseUrl);
      })
      .catch(() => {
        setSettings({
          currentProvider: 'mock',
          currentModel: 'mock-engine',
          ollamaBaseUrl: 'http://localhost:11434',
          hasAnthropicKey: false,
          availableModels: {
            ollama: [
              { id: 'llama3.1', name: 'Llama 3.1 (8B)', description: 'Fast local inference' },
              { id: 'codellama', name: 'Code Llama', description: 'Optimized for code generation' },
              { id: 'mistral', name: 'Mistral 7B', description: 'Efficient general-purpose model' },
            ],
            anthropic: [
              { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Latest Sonnet - fast & capable' },
              { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable model' },
              { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fastest, cost-efficient' },
            ],
            mock: [{ id: 'mock-engine', name: 'Built-in Mock Engine', description: 'Simulated responses' }],
          },
        });
      });
  }, []);

  const testOllama = async () => {
    setTesting('ollama');
    setOllamaStatus(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-ollama', baseUrl: ollamaUrl }),
      });
      const data = await res.json();
      setOllamaStatus(data);
      if (data.success && data.models) {
        setOllamaModels(data.models);
      }
    } catch {
      setOllamaStatus({ success: false, message: 'Failed to test connection', models: [] });
    }
    setTesting(null);
  };

  const testAnthropic = async () => {
    setTesting('anthropic');
    setAnthropicStatus(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-anthropic' }),
      });
      const data = await res.json();
      setAnthropicStatus(data);
    } catch {
      setAnthropicStatus({ success: false, message: 'Failed to test connection' });
    }
    setTesting(null);
  };

  const providers = [
    {
      id: 'mock',
      name: 'Built-in Mock Engine',
      description: 'Simulated AI responses for testing and demonstration. No external LLM required.',
      icon: Cpu,
      color: '#6f6f6f',
      badge: 'Default',
    },
    {
      id: 'ollama',
      name: 'Ollama (Local LLM)',
      description: 'Run AI models locally on your machine. Supports Llama 3.1, Code Llama, Mistral, and more.',
      icon: Server,
      color: '#009d9a',
      badge: 'Local',
    },
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      description: 'Cloud-based Claude models including Sonnet 4, Opus 4, and Haiku 4.5. Requires API key.',
      icon: Cloud,
      color: '#8a3ffc',
      badge: 'Cloud',
    },
  ];

  const getModelsForProvider = (provider: string): ModelInfo[] => {
    if (provider === 'ollama' && ollamaModels.length > 0) {
      return ollamaModels;
    }
    return settings?.availableModels[provider as keyof typeof settings.availableModels] || [];
  };

  if (!settings) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#0f62fe] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-light text-[#161616] flex items-center gap-2">
          <Settings size={20} />
          AI Model Settings
        </h1>
        <p className="text-sm text-[#525252] mt-1">
          Configure the LLM provider and model used for AI-powered QA/QC processing
        </p>
      </div>

      {/* Current Configuration */}
      <div className="bg-white border border-[#e0e0e0] p-4">
        <h2 className="text-sm font-medium text-[#161616] mb-3">Current Configuration</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-[#6f6f6f]">Provider</div>
            <div className="text-sm font-medium text-[#161616] mt-0.5 capitalize">{settings.currentProvider}</div>
          </div>
          <div>
            <div className="text-xs text-[#6f6f6f]">Model</div>
            <div className="text-sm font-medium text-[#161616] mt-0.5">{settings.currentModel}</div>
          </div>
          <div>
            <div className="text-xs text-[#6f6f6f]">Status</div>
            <div className="mt-0.5">
              <StatusBadge status="healthy" />
            </div>
          </div>
        </div>
      </div>

      {/* Provider Selection */}
      <div>
        <h2 className="text-sm font-medium text-[#161616] mb-3">Select LLM Provider</h2>
        <div className="grid grid-cols-3 gap-4">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelectedProvider(p.id);
                const models = getModelsForProvider(p.id);
                if (models.length > 0) setSelectedModel(models[0].id);
              }}
              className={`text-left p-4 border transition-colors ${
                selectedProvider === p.id
                  ? 'border-[#0f62fe] bg-[#edf5ff]'
                  : 'border-[#e0e0e0] bg-white hover:border-[#c6c6c6]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p.icon size={24} style={{ color: p.color }} />
                <span className="ibm-tag ibm-tag-gray text-[10px]">{p.badge}</span>
              </div>
              <div className="text-sm font-medium text-[#161616]">{p.name}</div>
              <div className="text-xs text-[#525252] mt-1 leading-relaxed">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Ollama Configuration */}
      {selectedProvider === 'ollama' && (
        <div className="bg-white border border-[#e0e0e0] p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-[#009d9a]" />
            <h2 className="text-sm font-medium text-[#161616]">Ollama Configuration</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1">Ollama Server URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="ibm-input flex-1"
                placeholder="http://localhost:11434"
              />
              <button onClick={testOllama} disabled={testing === 'ollama'} className="btn-primary !px-4 !min-h-[40px] flex items-center gap-2">
                {testing === 'ollama' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Test Connection
              </button>
            </div>
          </div>

          {ollamaStatus && (
            <div className={`ibm-notification ${ollamaStatus.success ? 'ibm-notification-success' : 'ibm-notification-error'}`}>
              {ollamaStatus.success ? <CheckCircle size={16} className="text-[#198038] flex-shrink-0" /> : <XCircle size={16} className="text-[#da1e28] flex-shrink-0" />}
              <span>{ollamaStatus.message}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1">Select Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="ibm-select"
            >
              {ollamaModels.length > 0 ? (
                ollamaModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name || m.id}</option>
                ))
              ) : (
                settings.availableModels.ollama.map(m => (
                  <option key={m.id} value={m.id}>{m.name} - {m.description}</option>
                ))
              )}
            </select>
          </div>

          <div className="ibm-notification ibm-notification-info">
            <span className="text-xs">
              Install Ollama from <strong>ollama.com</strong> and run <code className="bg-[#e0e0e0] px-1 py-0.5 rounded text-[11px]">ollama pull llama3.1</code> to get started.
            </span>
          </div>
        </div>
      )}

      {/* Anthropic Configuration */}
      {selectedProvider === 'anthropic' && (
        <div className="bg-white border border-[#e0e0e0] p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Cloud size={16} className="text-[#8a3ffc]" />
            <h2 className="text-sm font-medium text-[#161616]">Anthropic Claude Configuration</h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1">API Key Status</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 ibm-input flex items-center text-[#6f6f6f] bg-[#f4f4f4]" style={{ cursor: 'default' }}>
                {settings.hasAnthropicKey
                  ? '••••••••••••••••••••••••••••••• (configured in .env.local)'
                  : 'Not configured — set ANTHROPIC_API_KEY in .env.local'}
              </div>
              <button onClick={testAnthropic} disabled={testing === 'anthropic' || !settings.hasAnthropicKey} className="btn-primary !px-4 !min-h-[40px] flex items-center gap-2 disabled:opacity-50">
                {testing === 'anthropic' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Verify Key
              </button>
            </div>
            {!settings.hasAnthropicKey && (
              <p className="text-xs text-[#da1e28] mt-1">API key not found. Add it to .env.local and restart the server.</p>
            )}
          </div>

          {anthropicStatus && (
            <div className={`ibm-notification ${anthropicStatus.success ? 'ibm-notification-success' : 'ibm-notification-error'}`}>
              {anthropicStatus.success ? <CheckCircle size={16} className="text-[#198038] flex-shrink-0" /> : <XCircle size={16} className="text-[#da1e28] flex-shrink-0" />}
              <span>{anthropicStatus.message}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#525252] mb-1">Select Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="ibm-select"
            >
              {settings.availableModels.anthropic.map(m => (
                <option key={m.id} value={m.id}>{m.name} - {m.description}</option>
              ))}
            </select>
          </div>

          <div className="ibm-notification ibm-notification-warning">
            <span className="text-xs">
              For security, the API key is only configurable via the server-side file <code className="bg-[#e0e0e0] px-1 py-0.5 rounded text-[11px]">.env.local</code> and is never exposed in the browser. Set <code className="bg-[#e0e0e0] px-1 py-0.5 rounded text-[11px]">ANTHROPIC_API_KEY=sk-ant-...</code> and restart the dev server.
            </span>
          </div>
        </div>
      )}

      {/* Mock Configuration */}
      {selectedProvider === 'mock' && (
        <div className="bg-white border border-[#e0e0e0] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={16} className="text-[#6f6f6f]" />
            <h2 className="text-sm font-medium text-[#161616]">Mock Engine</h2>
          </div>
          <p className="text-sm text-[#525252]">
            The built-in mock engine generates realistic simulated responses for all 13 microservices without requiring any external LLM.
            This is ideal for demonstration, UI testing, and development.
          </p>
          <div className="mt-3 ibm-notification ibm-notification-success">
            <CheckCircle size={16} className="text-[#198038] flex-shrink-0" />
            <span className="text-xs">Mock engine is always available and requires no configuration.</span>
          </div>
        </div>
      )}

      {/* Save Configuration */}
      <div className="bg-white border border-[#e0e0e0] p-4">
        <h2 className="text-sm font-medium text-[#161616] mb-3">Apply Configuration</h2>
        <p className="text-xs text-[#525252] mb-4">
          To change the default provider, update <code className="bg-[#e0e0e0] px-1 py-0.5 rounded text-[11px]">.env.local</code> in the project root:
        </p>
        <pre className="bg-[#161616] text-[#f4f4f4] p-4 text-xs leading-relaxed overflow-x-auto">
{`# .env.local
LLM_PROVIDER=${selectedProvider}
${selectedProvider === 'ollama' ? `OLLAMA_BASE_URL=${ollamaUrl}\nOLLAMA_MODEL=${selectedModel}` : ''}${selectedProvider === 'anthropic' ? `ANTHROPIC_API_KEY=sk-ant-****** # set your key here, never expose in browser\nANTHROPIC_MODEL=${selectedModel}` : ''}${selectedProvider === 'mock' ? '# No additional config needed for mock engine' : ''}`}
        </pre>
        <p className="text-xs text-[#6f6f6f] mt-3">
          After updating <code className="bg-[#e0e0e0] px-1 py-0.5 rounded text-[11px]">.env.local</code>, restart the dev server for changes to take effect.
        </p>
      </div>

      {/* Per-request override info */}
      <div className="bg-white border border-[#e0e0e0] p-4">
        <h2 className="text-sm font-medium text-[#161616] mb-3">Per-Request Model Override</h2>
        <p className="text-xs text-[#525252] mb-3">
          Each microservice page has a model selector that allows you to override the default provider on a per-request basis.
          This lets you compare results between different models without changing the global configuration.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 border border-[#e0e0e0]">
            <div className="text-xs font-medium text-[#009d9a]">Ollama (Local)</div>
            <div className="text-[10px] text-[#525252] mt-1">Zero latency, full privacy, runs offline</div>
          </div>
          <div className="p-3 border border-[#e0e0e0]">
            <div className="text-xs font-medium text-[#8a3ffc]">Claude Sonnet</div>
            <div className="text-[10px] text-[#525252] mt-1">Best accuracy, cloud-based, requires API key</div>
          </div>
          <div className="p-3 border border-[#e0e0e0]">
            <div className="text-xs font-medium text-[#6f6f6f]">Mock Engine</div>
            <div className="text-[10px] text-[#525252] mt-1">Instant response, no LLM needed, for testing</div>
          </div>
        </div>
      </div>
    </div>
  );
}
