'use client';

import ServiceCard from '@/components/service-card';
import { FlaskConical, GitBranch, Gauge, Code2, LayoutGrid } from 'lucide-react';

const services = [
  {
    id: 'MS-APP-001',
    name: 'Test Scenario Generator',
    description:
      'AI-powered generation of comprehensive test scenarios from BRD/SRS documents. Covers positive, negative, and edge case paths with full traceability to requirements.',
    href: '/application/scenario-generator',
    icon: FlaskConical,
    stats: [
      { label: 'Avg Scenarios', value: '47' },
      { label: 'Avg Time', value: '1.2s' },
    ],
  },
  {
    id: 'MS-APP-002',
    name: 'Traceability Matrix Automator',
    description:
      'Automated generation of requirement-to-test traceability matrices. Instantly identifies coverage gaps and maps every requirement to its corresponding test cases.',
    href: '/application/traceability',
    icon: GitBranch,
    stats: [
      { label: 'Avg Coverage', value: '94%' },
      { label: 'Avg Time', value: '0.8s' },
    ],
  },
  {
    id: 'MS-APP-003',
    name: 'Performance Test Script Generator',
    description:
      'Generates production-ready JMeter or Gatling scripts from OpenAPI/Swagger specifications for load, stress, soak, and spike testing scenarios.',
    href: '/application/perf-scripts',
    icon: Gauge,
    stats: [
      { label: 'Frameworks', value: '2' },
      { label: 'Avg Time', value: '1.5s' },
    ],
  },
  {
    id: 'MS-APP-004',
    name: 'Automation Test Code Generator',
    description:
      'Transforms manual test step documentation into fully structured Selenium or Katalon automation code following page object model best practices.',
    href: '/application/automation-codegen',
    icon: Code2,
    stats: [
      { label: 'Frameworks', value: '2' },
      { label: 'Avg Time', value: '2.2s' },
    ],
  },
];

export default function ApplicationPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid size={18} className="text-[#0f62fe]" />
            <span className="text-xs font-medium text-[#0f62fe] uppercase tracking-wider">
              Application QA/QC
            </span>
          </div>
          <h1 className="text-xl font-light text-[#161616]">Application Testing Services</h1>
          <p className="text-sm text-[#525252] mt-1 max-w-2xl">
            AI-powered microservices for automated test artifact generation. Generate scenarios,
            traceability matrices, performance scripts, and automation code from your requirement
            documents.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#defbe6] rounded text-xs text-[#198038] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[#198038]" />
          4 Services Healthy
        </div>
      </div>

      {/* Domain breadcrumb */}
      <div className="ibm-notification ibm-notification-info text-sm text-[#161616]">
        <div>
          <span className="font-medium">QAQC4BI — Application Domain</span>
          <span className="text-[#525252] ml-2">
            Select a microservice below to generate AI-powered QA artifacts from your documents.
          </span>
        </div>
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        {services.map((service) => (
          <ServiceCard
            key={service.id}
            id={service.id}
            name={service.name}
            description={service.description}
            status="healthy"
            href={service.href}
            icon={service.icon}
            color="#0f62fe"
            stats={service.stats}
          />
        ))}
      </div>

      {/* Domain Footer Info */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Requests Today', value: '2,856', sub: 'Across all 4 services' },
          { label: 'AI Models Active', value: '4', sub: 'Gemini 1.5 Pro powered' },
          { label: 'Avg Response Time', value: '1.4s', sub: 'P50 latency' },
          { label: 'Artifacts Generated', value: '12,430', sub: 'This month' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-[#e0e0e0] p-4"
          >
            <div className="text-xs text-[#525252] uppercase tracking-wider mb-1">
              {stat.label}
            </div>
            <div className="text-2xl font-light text-[#0f62fe]">{stat.value}</div>
            <div className="text-xs text-[#6f6f6f] mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
