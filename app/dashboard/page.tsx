'use client';

import { useState, useEffect } from 'react';
import MetricCard from '@/components/metric-card';
import QualityGauge from '@/components/quality-gauge';
import QualityTrendChart from '@/components/charts/quality-trend';
import DefectHeatmapChart from '@/components/charts/defect-heatmap';
import CoverageRadarChart from '@/components/charts/coverage-radar';
import ServiceHealthGrid from '@/components/charts/service-health';
import StatusBadge from '@/components/status-badge';
import { Shield, Bug, FlaskConical, Gauge, Activity, Clock, CheckCircle, AlertTriangle, ToggleLeft, ToggleRight, Database, Layers } from 'lucide-react';

type DashboardData = {
  services: Array<{ id: string; name: string; domain: string; status: string; requests_total: number; avg_response_ms: number }>;
  metrics: { qualityScore: number; testCoverage: number; automationRate: number; defectDensity: number };
  trendData: Array<{ date: string; quality_score: number; test_coverage: number; automation_rate: number }>;
  defectData: Array<{ module: string; critical: number; major: number; minor: number; cosmetic: number }>;
  activities: Array<{ service: string; action: string; details: string; user_name: string; created_at: string }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [mode, setMode] = useState<'real' | 'mock'>('real');
  const [dataSource, setDataSource] = useState<'real' | 'mock'>('real');

  const fetchData = (fetchMode: 'real' | 'mock') => {
    setData(null);
    fetch(`/api/services?mode=${fetchMode}`)
      .then(r => r.json())
      .then((apiData) => {
        const m = apiData.metrics || {};
        setDataSource(apiData.mode || fetchMode);
        setData({
          services: (apiData.services || []).map((s: Record<string, unknown>) => ({
            ...s,
            requests_total: Number(s.requests_total ?? 0),
            avg_response_ms: Number(s.avg_response_ms ?? 0),
          })),
          metrics: {
            qualityScore: Number(m.qualityScore ?? m.quality_score ?? 0),
            testCoverage: Number(m.testCoverage ?? m.test_coverage ?? 0),
            automationRate: Number(m.automationRate ?? m.automation_rate ?? 0),
            defectDensity: Number(m.defectDensity ?? m.defect_density ?? 0),
          },
          trendData: apiData.trendData || [],
          defectData: apiData.defectData || [],
          activities: apiData.recentActivities || apiData.activities || [],
        });
      })
      .catch(() => setData(null));
  };

  useEffect(() => {
    fetchData(mode);
  }, [mode]);

  if (!data) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#0f62fe] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#525252]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const radarData = [
    { dimension: 'Functionality', score: 92, target: 90 },
    { dimension: 'Reliability', score: 87, target: 90 },
    { dimension: 'Usability', score: 78, target: 85 },
    { dimension: 'Performance', score: 85, target: 90 },
    { dimension: 'Security', score: 82, target: 95 },
    { dimension: 'Maintainability', score: 76, target: 80 },
  ];

  const healthyCount = data.services.filter(s => s.status === 'healthy').length;

  return (
    <div className="p-6 space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-light text-[#161616]">Executive Quality Dashboard</h1>
          <p className="text-sm text-[#525252] mt-0.5">Jamkrindo CashLoan QA/QC Platform — HCD-ID Quality Consulting Services / IBM Consulting</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Data Source Toggle */}
          <button
            onClick={() => setMode(mode === 'real' ? 'mock' : 'real')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs border transition-colors rounded ${
              mode === 'real'
                ? 'bg-[#defbe6] border-[#198038] text-[#198038]'
                : 'bg-[#edf5ff] border-[#0f62fe] text-[#0f62fe]'
            }`}
          >
            {mode === 'real' ? (
              <>
                <Database size={13} />
                Live Data
                <ToggleRight size={16} />
              </>
            ) : (
              <>
                <Layers size={13} />
                Demo Data
                <ToggleLeft size={16} />
              </>
            )}
          </button>
          {dataSource !== mode && (
            <span className="text-[10px] text-[#6f6f6f] italic">showing {dataSource}</span>
          )}
          <div className="flex items-center gap-2 text-xs text-[#6f6f6f]">
            <Clock size={14} />
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard title="Quality Score" value={data.metrics.qualityScore} subtitle="ISO 25010 Composite" change={3.2} icon={Shield} color="#0f62fe" />
        <MetricCard title="Test Coverage" value={`${data.metrics.testCoverage}%`} subtitle="Across all modules" change={5.1} icon={FlaskConical} color="#009d9a" />
        <MetricCard title="Automation Rate" value={`${data.metrics.automationRate}%`} subtitle="AI-generated artifacts" change={12.4} icon={Gauge} color="#8a3ffc" />
        <MetricCard title="Defect Density" value={data.metrics.defectDensity} subtitle="Per 1000 lines of code" change={-8.5} icon={Bug} color="#da1e28" />
      </div>

      {/* Quality Gauges */}
      <div className="grid grid-cols-6 gap-4">
        <div className="col-span-1 bg-white border border-[#e0e0e0] p-4 flex flex-col items-center justify-center">
          <QualityGauge value={data.metrics.qualityScore} label="Overall Quality" size={100} />
        </div>
        <div className="col-span-1 bg-white border border-[#e0e0e0] p-4 flex flex-col items-center justify-center">
          <QualityGauge value={92} label="Application" size={100} color="#0f62fe" />
        </div>
        <div className="col-span-1 bg-white border border-[#e0e0e0] p-4 flex flex-col items-center justify-center">
          <QualityGauge value={88} label="Data Analytics" size={100} color="#009d9a" />
        </div>
        <div className="col-span-1 bg-white border border-[#e0e0e0] p-4 flex flex-col items-center justify-center">
          <QualityGauge value={76} label="Infrastructure" size={100} color="#8a3ffc" />
        </div>
        <div className="col-span-2 bg-white border border-[#e0e0e0] p-4">
          <h3 className="text-sm font-medium text-[#161616] mb-3">Platform Status</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-[#198038]" />
              <span className="text-sm text-[#161616]">{healthyCount} services healthy</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-[#f1c21b]" />
              <span className="text-sm text-[#161616]">{data.services.length - healthyCount} degraded</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-[#0f62fe]" />
              <span className="text-sm text-[#161616]">{data.services.reduce((s, v) => s + v.requests_total, 0).toLocaleString()} total requests</span>
            </div>
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-[#8a3ffc]" />
              <span className="text-sm text-[#161616]">Avg {Math.round(data.services.reduce((s, v) => s + v.avg_response_ms, 0) / data.services.length)}ms response</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        <QualityTrendChart data={data.trendData} />
        <DefectHeatmapChart data={data.defectData} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <CoverageRadarChart data={radarData} />
        <ServiceHealthGrid services={data.services} />
      </div>

      {/* Recent Activity */}
      <div className="bg-white border border-[#e0e0e0]">
        <div className="px-4 py-3 border-b border-[#e0e0e0]">
          <h3 className="text-sm font-medium text-[#161616]">Recent Activity</h3>
        </div>
        <div className="divide-y divide-[#e0e0e0]">
          {data.activities.map((activity, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4 hover:bg-[#f4f4f4] transition-colors">
              <div className="w-8 h-8 bg-[#edf5ff] rounded flex items-center justify-center flex-shrink-0">
                <Activity size={14} className="text-[#0f62fe]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#0f62fe]">{activity.service}</span>
                  <span className="text-xs text-[#6f6f6f]">{activity.action}</span>
                </div>
                <p className="text-sm text-[#161616] truncate">{activity.details}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs text-[#6f6f6f]">{activity.user_name}</div>
                <div className="text-[10px] text-[#a8a8a8]">{new Date(activity.created_at).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap Summary */}
      <div className="bg-white border border-[#e0e0e0] p-4">
        <h3 className="text-sm font-medium text-[#161616] mb-4">Jamkrindo CashLoan Delivery Roadmap — JaGuarS Modernization</h3>
        <div className="flex gap-2">
          {[
            { phase: 'Sprint 22-23', label: 'Foundation: CIF + NIK/NPWP Validation', period: 'Mar-Apr 2026', status: 'RESOLVED', color: '#198038' },
            { phase: 'Sprint 24', label: 'Penjaminan Submission + ICPR Upload', period: 'Apr 2026', status: 'IN PROGRESS', color: '#0f62fe' },
            { phase: 'Sprint 25-26', label: 'Klaim & Subrogasi + Oracle GL', period: 'May-Jun 2026', status: 'pending', color: '#009d9a' },
            { phase: 'Sprint 27-28', label: 'Reporting OJK SPLM + Compliance', period: 'Jul-Aug 2026', status: 'pending', color: '#8a3ffc' },
            { phase: 'Sprint 29-30', label: 'Partner Bank Integration (BTN/BNI)', period: 'Sep-Oct 2026', status: 'pending', color: '#ff832b' },
          ].map((item) => (
            <div key={item.phase} className="flex-1 p-3 border border-[#e0e0e0] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: item.color }} />
              <div className="text-[10px] font-medium" style={{ color: item.color }}>{item.phase}</div>
              <div className="text-xs font-medium text-[#161616] mt-0.5">{item.label}</div>
              <div className="text-[10px] text-[#6f6f6f] mt-0.5">{item.period}</div>
              <div className="mt-2">
                <StatusBadge status={item.status} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
