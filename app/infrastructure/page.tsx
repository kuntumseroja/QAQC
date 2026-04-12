'use client';

import ServiceCard from '@/components/service-card';
import { Code2, Shield, Zap, Server } from 'lucide-react';

const services = [
  {
    id: 'MS-INFRA-001',
    name: 'IaC Code Review Agent',
    description:
      'AI-powered review of Terraform, Ansible, and CloudFormation code. Detects misconfigurations, security anti-patterns, and compliance violations with actionable remediation guidance.',
    href: '/infrastructure/iac-review',
    icon: Code2,
    stats: [
      { label: 'Avg Findings', value: '12' },
      { label: 'Avg Time', value: '2.5s' },
    ],
  },
  {
    id: 'MS-INFRA-002',
    name: 'Security Compliance Scanner',
    description:
      'Automated compliance assessment against CIS Benchmarks, NIST, and Bank Indonesia security frameworks. Ingests Prowler and Scout Suite results for AI-driven remediation recommendations.',
    href: '/infrastructure/security-scan',
    icon: Shield,
    stats: [
      { label: 'Frameworks', value: '5' },
      { label: 'Avg Time', value: '4.2s' },
    ],
  },
  {
    id: 'MS-INFRA-003',
    name: 'DR/HA Test Scenario Generator',
    description:
      'Generates comprehensive Disaster Recovery and High Availability test scenarios tailored to your architecture. Covers failover, data replication, RTO/RPO validation, and chaos engineering cases.',
    href: '/infrastructure/dr-ha-test',
    icon: Zap,
    stats: [
      { label: 'Avg Scenarios', value: '8' },
      { label: 'Avg Time', value: '1.9s' },
    ],
  },
];

export default function InfrastructurePage() {
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Server size={18} className="text-[#8a3ffc]" />
            <span className="text-xs font-medium text-[#8a3ffc] uppercase tracking-wider">
              Infrastructure QA/QC
            </span>
          </div>
          <h1 className="text-xl font-light text-[#161616]">Infrastructure Testing Services</h1>
          <p className="text-sm text-[#525252] mt-1 max-w-2xl">
            AI-powered microservices for infrastructure quality assurance. Review IaC code,
            scan for security compliance violations, and generate DR/HA test scenarios from
            your architecture documentation.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#defbe6] rounded text-xs text-[#198038] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-[#198038]" />
          3 Services Healthy
        </div>
      </div>

      {/* Domain breadcrumb */}
      <div className="ibm-notification ibm-notification-info text-sm text-[#161616]">
        <div>
          <span className="font-medium">QAQC4BI — Infrastructure Domain</span>
          <span className="text-[#525252] ml-2">
            Select a microservice below to perform AI-powered infrastructure quality checks.
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
            color="#8a3ffc"
            stats={service.stats}
          />
        ))}
      </div>

      {/* Domain Footer Info */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Requests Today', value: '1,112', sub: 'Across all 3 services' },
          { label: 'AI Models Active', value: '3', sub: 'Gemini 1.5 Pro powered' },
          { label: 'Avg Response Time', value: '2.9s', sub: 'P50 latency' },
          { label: 'Findings Identified', value: '4,870', sub: 'This month' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-[#e0e0e0] p-4">
            <div className="text-xs text-[#525252] uppercase tracking-wider mb-1">
              {stat.label}
            </div>
            <div className="text-2xl font-light text-[#8a3ffc]">{stat.value}</div>
            <div className="text-xs text-[#6f6f6f] mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
