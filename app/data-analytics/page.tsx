'use client';

import { use } from 'react';
import { Search, Activity, Eye } from 'lucide-react';
import ServiceCard from '@/components/service-card';

const DOMAIN_COLOR = '#009d9a';

const services = [
  {
    id: 'MS-DATA-001',
    name: 'Data Quality Profiler',
    description:
      'AI-powered profiling engine that analyses dataset structure, column statistics, null rates, uniqueness, and quality dimensions across all six ISO 8000 criteria.',
    status: 'healthy' as const,
    href: '/data-analytics/data-profiler',
    icon: Search,
    color: DOMAIN_COLOR,
    stats: [
      { label: 'Dimensions', value: 6 },
      { label: 'Checks', value: '50+' },
    ],
  },
  {
    id: 'MS-DATA-002',
    name: 'ETL / Pipeline Validator',
    description:
      'Rule-based reconciliation engine that compares source and target datasets across configurable business rules to detect data loss, transformation drift, and integrity failures.',
    status: 'healthy' as const,
    href: '/data-analytics/pipeline-validator',
    icon: Activity,
    color: DOMAIN_COLOR,
    stats: [
      { label: 'Rule Types', value: 12 },
      { label: 'Avg Rules', value: '20–40' },
    ],
  },
  {
    id: 'MS-DATA-003',
    name: 'Visualization Validator',
    description:
      'Screenshot-aware validation service that cross-checks dashboard visuals against underlying query results, identifying labelling errors, data mismatches, and accessibility gaps.',
    status: 'healthy' as const,
    href: '/data-analytics/viz-validator',
    icon: Eye,
    color: DOMAIN_COLOR,
    stats: [
      { label: 'Check Areas', value: 8 },
      { label: 'Standards', value: 'WCAG 2.1' },
    ],
  },
];

export default function DataAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // searchParams is a Promise in Next.js 16 — consume it via React use()
  use(searchParams);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="ibm-tag ibm-tag-teal text-[11px] font-medium"
            >
              Data Analytics Domain
            </span>
            <span className="text-[11px] text-[#6f6f6f]">3 microservices</span>
          </div>
          <h1 className="text-xl font-light text-[#161616]">Data Analytics QA/QC</h1>
          <p className="text-sm text-[#525252] mt-0.5 max-w-xl">
            AI-powered quality assurance for datasets, ETL pipelines, and BI visualisations.
            Powered by Bank Indonesia QAQC4BI Platform.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded"
          style={{ backgroundColor: DOMAIN_COLOR + '1a', color: DOMAIN_COLOR }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DOMAIN_COLOR }} />
          All services operational
        </div>
      </div>

      {/* Domain description panel */}
      <div className="ibm-notification ibm-notification-info">
        <div className="flex-1">
          <p className="text-sm font-medium text-[#161616] mb-0.5">About this domain</p>
          <p className="text-xs text-[#525252]">
            The Data Analytics domain provides three specialised microservices that cover the
            full data quality lifecycle — from raw data profiling through pipeline reconciliation
            to dashboard validation. Select a service below to begin an analysis session.
          </p>
        </div>
      </div>

      {/* Service Cards */}
      <div>
        <h2 className="text-sm font-medium text-[#161616] mb-3">Available Services</h2>
        <div className="grid grid-cols-3 gap-4">
          {services.map((svc) => (
            <ServiceCard key={svc.id} {...svc} />
          ))}
        </div>
      </div>

      {/* Domain metrics strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Requests Today', value: '1,357' },
          { label: 'Avg Response Time', value: '2.4 s' },
          { label: 'Data Quality Score', value: '88 / 100' },
          { label: 'Active Validations', value: '3' },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-[#e0e0e0] p-4">
            <div className="text-[10px] text-[#6f6f6f] uppercase tracking-wider mb-1">{m.label}</div>
            <div className="text-2xl font-light" style={{ color: DOMAIN_COLOR }}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
