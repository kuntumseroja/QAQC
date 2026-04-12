'use client';

import ServiceCard from '@/components/service-card';
import { BarChart3, Activity, FileOutput, Bug } from 'lucide-react';

const services = [
  {
    id: 'MS-DEFECT-001',
    name: 'Intelligent Defect Classifier',
    description:
      'AI-powered defect classification by severity, priority, and root cause category. Matches new defects to historical patterns and recommends the responsible team for faster triage.',
    href: '/defects/classifier',
    icon: BarChart3,
    stats: [
      { label: 'Avg Accuracy', value: '91%' },
      { label: 'Avg Time', value: '0.9s' },
    ],
  },
  {
    id: 'MS-DEFECT-002',
    name: 'Defect Pattern Analyzer',
    description:
      'Identifies recurring defect patterns across modules and time periods. Surfaces risk hotspots, reopen trends, and root cause distributions with AI-generated remediation recommendations.',
    href: '/defects/pattern-analyzer',
    icon: Activity,
    stats: [
      { label: 'Patterns Found', value: '24' },
      { label: 'Risk Modules', value: '6' },
    ],
  },
  {
    id: 'MS-DEFECT-003',
    name: 'Test Report Generator',
    description:
      'Generates structured QC summary, test progress, and defect analysis reports from live data. Includes executive summary, quality gate assessments, and risk narratives ready for export.',
    href: '/defects/report-generator',
    icon: FileOutput,
    stats: [
      { label: 'Report Types', value: '3' },
      { label: 'Avg Time', value: '1.8s' },
    ],
  },
];

export default function DefectsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bug size={18} className="text-[#da1e28]" />
            <span className="text-xs font-medium text-[#da1e28] uppercase tracking-wider">
              Defect Management
            </span>
          </div>
          <h1 className="text-xl font-light text-[#161616]">Defect Management Services</h1>
          <p className="text-sm text-[#525252] mt-1 max-w-2xl">
            AI-powered microservices for intelligent defect classification, pattern analysis, and
            automated test reporting. Reduce triage time and surface risk before it reaches
            production.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#defbe6] rounded text-xs text-[#198038] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[#198038]" />
          3 Services Healthy
        </div>
      </div>

      {/* Domain notification */}
      <div className="ibm-notification ibm-notification-error text-sm text-[#161616]">
        <div>
          <span className="font-medium">QAQC4BI — Defect Management Domain</span>
          <span className="text-[#525252] ml-2">
            Select a microservice below to classify defects, analyze patterns, or generate QC
            reports.
          </span>
        </div>
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-3 gap-4">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            id={service.id}
            name={service.name}
            description={service.description}
            status="healthy"
            href={service.href}
            icon={service.icon}
            color="#da1e28"
            stats={service.stats}
          />
        ))}
      </div>

      {/* Domain stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Defects (MTD)', value: '1,247', sub: 'Month to date' },
          { label: 'Open Defects', value: '183', sub: 'Awaiting resolution' },
          { label: 'Avg Resolution Time', value: '3.2d', sub: 'Calendar days P50' },
          { label: 'Classification Accuracy', value: '91%', sub: 'AI model confidence' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-[#e0e0e0] p-4">
            <div className="text-xs text-[#525252] uppercase tracking-wider mb-1">
              {stat.label}
            </div>
            <div className="text-2xl font-light text-[#da1e28]">{stat.value}</div>
            <div className="text-xs text-[#6f6f6f] mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
