'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FlaskConical, Database, Server, Bug,
  FileText, GitBranch, Gauge, Code2, Search, Shield,
  Activity, BarChart3, FileOutput, ChevronDown, ChevronRight,
  Zap, Eye, Settings, FileArchive
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'AI Settings', href: '/settings', icon: Settings },
  { name: 'Document Audit', href: '/documents', icon: FileArchive },
  {
    name: 'Application QA/QC',
    icon: FlaskConical,
    color: '#0f62fe',
    children: [
      { name: 'Scenario Generator', href: '/application/scenario-generator', icon: FileText, id: 'MS-APP-001' },
      { name: 'Traceability Matrix', href: '/application/traceability', icon: GitBranch, id: 'MS-APP-002' },
      { name: 'Perf Test Scripts', href: '/application/perf-scripts', icon: Gauge, id: 'MS-APP-003' },
      { name: 'Automation CodeGen', href: '/application/automation-codegen', icon: Code2, id: 'MS-APP-004' },
    ],
  },
  {
    name: 'Data Analytics QA/QC',
    icon: Database,
    color: '#009d9a',
    children: [
      { name: 'Data Profiler', href: '/data-analytics/data-profiler', icon: Search, id: 'MS-DATA-001' },
      { name: 'Pipeline Validator', href: '/data-analytics/pipeline-validator', icon: Activity, id: 'MS-DATA-002' },
      { name: 'Viz Validator', href: '/data-analytics/viz-validator', icon: Eye, id: 'MS-DATA-003' },
    ],
  },
  {
    name: 'Infrastructure QA/QC',
    icon: Server,
    color: '#8a3ffc',
    children: [
      { name: 'IaC Code Review', href: '/infrastructure/iac-review', icon: Code2, id: 'MS-INFRA-001' },
      { name: 'Security Scan', href: '/infrastructure/security-scan', icon: Shield, id: 'MS-INFRA-002' },
      { name: 'DR/HA Test Gen', href: '/infrastructure/dr-ha-test', icon: Zap, id: 'MS-INFRA-003' },
    ],
  },
  {
    name: 'Defect Management',
    icon: Bug,
    color: '#da1e28',
    children: [
      { name: 'Defect Classifier', href: '/defects/classifier', icon: BarChart3, id: 'MS-DEFECT-001' },
      { name: 'Pattern Analyzer', href: '/defects/pattern-analyzer', icon: Activity, id: 'MS-DEFECT-002' },
      { name: 'Report Generator', href: '/defects/report-generator', icon: FileOutput, id: 'MS-DEFECT-003' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    'Application QA/QC': true,
    'Data Analytics QA/QC': true,
    'Infrastructure QA/QC': true,
    'Defect Management': true,
  });

  const toggle = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <aside className="w-[256px] min-h-screen bg-[#161616] text-[#f4f4f4] flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-[#393939]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#0f62fe] rounded flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-sm">QA</span>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold leading-tight">HCD-ID Quality Consulting Services</div>
            <div className="text-[10px] text-[#a8a8a8] leading-none mt-0.5">IBM Consulting</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navigation.map((item) => {
          if ('href' in item && item.href) {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href as string}
                className={`flex items-center gap-3 px-4 h-8 text-sm transition-colors ${
                  isActive
                    ? 'bg-[#393939] text-white font-medium'
                    : 'text-[#c6c6c6] hover:bg-[#262626] hover:text-white'
                }`}
              >
                <item.icon size={16} />
                <span>{item.name}</span>
              </Link>
            );
          }

          const isExpanded = expanded[item.name];
          const hasActiveChild = item.children?.some(child => pathname === child.href);

          return (
            <div key={item.name}>
              <button
                onClick={() => toggle(item.name)}
                className={`w-full flex items-center gap-3 px-4 h-8 text-sm transition-colors ${
                  hasActiveChild ? 'text-white' : 'text-[#c6c6c6] hover:bg-[#262626] hover:text-white'
                }`}
              >
                <item.icon size={16} style={{ color: item.color }} />
                <span className="flex-1 text-left">{item.name}</span>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              {isExpanded && item.children && (
                <div className="ml-4">
                  {item.children.map((child) => {
                    const isActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-3 pl-5 pr-4 h-8 text-[13px] border-l transition-colors ${
                          isActive
                            ? 'bg-[#393939] text-white border-[#0f62fe]'
                            : 'text-[#a8a8a8] border-[#393939] hover:bg-[#262626] hover:text-white hover:border-[#6f6f6f]'
                        }`}
                      >
                        <child.icon size={14} />
                        <span className="flex-1">{child.name}</span>
                        <span className="text-[10px] text-[#6f6f6f]">{child.id}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#393939] px-4 py-3">
        <div className="text-[10px] text-[#6f6f6f]">QAQC4BI v1.0</div>
        <div className="text-[10px] text-[#6f6f6f]">AI-Powered QA/QC Platform</div>
        <div className="text-[10px] text-[#525252] mt-1">BSPI 2030</div>
      </div>
    </aside>
  );
}
