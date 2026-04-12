'use client';

import { useState } from 'react';
import { Zap, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface DrHaScenario {
  id: string;
  name: string;
  category: string;
  rpoTarget: string;
  rtoTarget: string;
  steps: string[];
  expectedOutcome: string;
}

interface DrHaResult {
  scenarios: DrHaScenario[];
  infrastructure?: string;
  summary: { totalScenarios: number; categories: string[] };
}

const categoryColors: Record<string, { bg: string; color: string }> = {
  Failover: { bg: '#d0e2ff', color: '#002d9c' },
  'Data Replication': { bg: '#defbe6', color: '#044317' },
  'Chaos Engineering': { bg: '#fff1f1', color: '#750e13' },
  'Network Partition': { bg: '#ffd8a8', color: '#5e2900' },
  'Storage Failure': { bg: '#fcf4d6', color: '#8e6a00' },
  Recovery: { bg: '#e8daff', color: '#491d8b' },
  'Load Testing': { bg: '#9ef0f0', color: '#004144' },
};

function CategoryBadge({ category }: { category: string }) {
  const style = categoryColors[category] || { bg: '#e0e0e0', color: '#393939' };
  return (
    <span
      className="ibm-tag text-[11px] px-2 py-0.5"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {category}
    </span>
  );
}

function ScenarioCard({ scenario }: { scenario: DrHaScenario }) {
  return (
    <div className="bg-white border border-[#e0e0e0] rounded overflow-hidden">
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-[#e0e0e0] flex items-center justify-between gap-3 bg-[#f4f4f4]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-medium text-[#8a3ffc]">{scenario.id}</span>
          <CategoryBadge category={scenario.category} />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Scenario Name */}
        <h3 className="text-sm font-medium text-[#161616]">{scenario.name}</h3>

        {/* RPO / RTO Targets */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#6f6f6f]">RPO Target:</span>
            <span className="ibm-tag ibm-tag-purple text-[11px] px-2 py-0.5">{scenario.rpoTarget}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#6f6f6f]">RTO Target:</span>
            <span className="ibm-tag ibm-tag-blue text-[11px] px-2 py-0.5">{scenario.rtoTarget}</span>
          </div>
        </div>

        {/* Steps */}
        <div>
          <p className="text-xs font-medium text-[#525252] mb-2 uppercase tracking-wider">Test Steps</p>
          <ol className="space-y-1.5">
            {scenario.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#8a3ffc] text-white text-[10px] font-medium flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-xs text-[#161616] leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Expected Outcome */}
        <div className="pt-2 border-t border-[#e0e0e0]">
          <p className="text-xs font-medium text-[#525252] mb-1">Expected Outcome</p>
          <div className="ibm-notification ibm-notification-success py-2 px-3">
            <p className="text-xs text-[#161616]">{scenario.expectedOutcome}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DrHaTestPage() {
  const [architectureDescription, setArchitectureDescription] = useState('');
  const [rpoTarget, setRpoTarget] = useState('');
  const [rtoTarget, setRtoTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DrHaResult | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!architectureDescription.trim()) {
      setError('Please provide an architecture description to generate DR/HA test scenarios.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/dr-ha-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          architectureDescription,
          rpoTarget: rpoTarget || undefined,
          rtoTarget: rtoTarget || undefined,
        }),
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
              <Zap size={18} className="text-[#8a3ffc]" />
              <span className="text-xs font-medium text-[#8a3ffc] uppercase tracking-wider">
                MS-INFRA-003
              </span>
            </div>
            <h1 className="text-xl font-light text-[#161616]">DR/HA Test Scenario Generator</h1>
            <p className="text-sm text-[#525252] mt-1 max-w-2xl">
              Generate comprehensive Disaster Recovery and High Availability test scenarios from
              your architecture description. Covers failover, data replication, RTO/RPO validation,
              chaos engineering, and network partition scenarios.
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e8daff] rounded text-xs text-[#6929c4] font-medium flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8a3ffc]" />
            MS-INFRA-003
          </div>
        </div>
      </div>

      {/* Input Panel */}
      <div className="bg-white border border-[#e0e0e0] p-5 space-y-4">
        <h2 className="text-sm font-medium text-[#161616]">Input — Architecture & Recovery Targets</h2>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-[#525252]">
            Architecture Description <span className="text-[#da1e28]">*</span>
          </label>
          <textarea
            className="ibm-textarea w-full"
            rows={8}
            placeholder={`Describe your infrastructure architecture:\n\n- Primary region: AWS ap-southeast-1 (Singapore)\n- DR region: AWS ap-southeast-3 (Jakarta)\n- Database: Aurora PostgreSQL with Multi-AZ and cross-region read replica\n- Application: EKS cluster with 3 nodes, auto-scaling enabled\n- Storage: S3 with cross-region replication\n- Cache: ElastiCache Redis cluster\n- Load Balancer: ALB with health checks\n- DNS: Route53 with latency-based routing and failover records`}
            value={architectureDescription}
            onChange={(e) => setArchitectureDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[#525252]">
              RPO Target (Recovery Point Objective)
            </label>
            <input
              type="text"
              className="ibm-input w-full"
              placeholder="e.g. 15 minutes, 1 hour, 4 hours"
              value={rpoTarget}
              onChange={(e) => setRpoTarget(e.target.value)}
            />
            <p className="text-[11px] text-[#6f6f6f]">
              Maximum acceptable data loss duration
            </p>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[#525252]">
              RTO Target (Recovery Time Objective)
            </label>
            <input
              type="text"
              className="ibm-input w-full"
              placeholder="e.g. 30 minutes, 2 hours, 8 hours"
              value={rtoTarget}
              onChange={(e) => setRtoTarget(e.target.value)}
            />
            <p className="text-[11px] text-[#6f6f6f]">
              Maximum acceptable downtime duration
            </p>
          </div>
        </div>

        {error && (
          <div className="ibm-notification ibm-notification-error text-sm text-[#da1e28]">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap size={16} />
                Generate DR/HA Scenarios
              </>
            )}
          </button>
          {result && (
            <span className="text-xs text-[#525252]">
              {result.summary.totalScenarios} scenario{result.summary.totalScenarios !== 1 ? 's' : ''} generated
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white border border-[#e0e0e0] p-4">
            <h2 className="text-sm font-medium text-[#161616] mb-3">Generation Summary</h2>
            <div className="flex items-start gap-6 flex-wrap">
              <div>
                <div className="text-2xl font-light text-[#8a3ffc]">{result.summary.totalScenarios}</div>
                <div className="text-xs text-[#525252] mt-0.5">Total Scenarios Generated</div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-[#525252] mb-2">Categories covered:</div>
                <div className="flex flex-wrap gap-2">
                  {result.summary.categories.map((cat) => (
                    <CategoryBadge key={cat} category={cat} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Scenario Cards */}
          <div>
            <h2 className="text-sm font-medium text-[#161616] mb-3">
              Generated Scenarios ({result.summary.totalScenarios})
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {(result.scenarios || []).map((scenario) => (
                <ScenarioCard key={scenario.id} scenario={scenario} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
