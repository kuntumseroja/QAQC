'use client';

import { usePathname } from 'next/navigation';
import { Bell, Settings, User, Search } from 'lucide-react';

const pathNames: Record<string, { title: string; breadcrumb: string[] }> = {
  '/dashboard': { title: 'Executive Dashboard', breadcrumb: ['Home', 'Dashboard'] },
  '/settings': { title: 'AI Model Settings', breadcrumb: ['Home', 'Settings'] },
  '/application': { title: 'Application QA/QC', breadcrumb: ['Home', 'Application'] },
  '/application/scenario-generator': { title: 'Test Scenario Generator', breadcrumb: ['Home', 'Application', 'Scenario Generator'] },
  '/application/traceability': { title: 'Traceability Matrix Automator', breadcrumb: ['Home', 'Application', 'Traceability Matrix'] },
  '/application/perf-scripts': { title: 'Performance Test Script Generator', breadcrumb: ['Home', 'Application', 'Perf Scripts'] },
  '/application/automation-codegen': { title: 'Automation Test Code Generator', breadcrumb: ['Home', 'Application', 'Automation CodeGen'] },
  '/data-analytics': { title: 'Data Analytics QA/QC', breadcrumb: ['Home', 'Data Analytics'] },
  '/data-analytics/data-profiler': { title: 'Data Quality Profiler', breadcrumb: ['Home', 'Data Analytics', 'Data Profiler'] },
  '/data-analytics/pipeline-validator': { title: 'ETL/Pipeline Validation', breadcrumb: ['Home', 'Data Analytics', 'Pipeline Validator'] },
  '/data-analytics/viz-validator': { title: 'Visualization Validation', breadcrumb: ['Home', 'Data Analytics', 'Viz Validator'] },
  '/infrastructure': { title: 'Infrastructure QA/QC', breadcrumb: ['Home', 'Infrastructure'] },
  '/infrastructure/iac-review': { title: 'IaC Code Review Agent', breadcrumb: ['Home', 'Infrastructure', 'IaC Review'] },
  '/infrastructure/security-scan': { title: 'Security Compliance Scanner', breadcrumb: ['Home', 'Infrastructure', 'Security Scan'] },
  '/infrastructure/dr-ha-test': { title: 'DR/HA Test Scenario Generator', breadcrumb: ['Home', 'Infrastructure', 'DR/HA Test'] },
  '/defects': { title: 'Defect Management', breadcrumb: ['Home', 'Defects'] },
  '/defects/classifier': { title: 'Intelligent Defect Classifier', breadcrumb: ['Home', 'Defects', 'Classifier'] },
  '/defects/pattern-analyzer': { title: 'Defect Pattern Analyzer', breadcrumb: ['Home', 'Defects', 'Pattern Analyzer'] },
  '/defects/report-generator': { title: 'Test Report Generator', breadcrumb: ['Home', 'Defects', 'Report Generator'] },
  '/documents': { title: 'Document Audit Trail', breadcrumb: ['Home', 'Documents'] },
};

export default function Header() {
  const pathname = usePathname();
  const info = pathNames[pathname] || { title: 'QAQC4BI', breadcrumb: ['Home'] };

  return (
    <header className="h-12 bg-white border-b border-[#e0e0e0] flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-1 text-sm">
          {info.breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-[#a8a8a8]">/</span>}
              <span className={i === info.breadcrumb.length - 1 ? 'text-[#161616] font-medium' : 'text-[#6f6f6f]'}>
                {item}
              </span>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-1">
        <button className="w-8 h-8 flex items-center justify-center text-[#525252] hover:bg-[#e0e0e0] transition-colors">
          <Search size={16} />
        </button>
        <button className="w-8 h-8 flex items-center justify-center text-[#525252] hover:bg-[#e0e0e0] transition-colors relative">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#da1e28] rounded-full" />
        </button>
        <button className="w-8 h-8 flex items-center justify-center text-[#525252] hover:bg-[#e0e0e0] transition-colors">
          <Settings size={16} />
        </button>
        <div className="ml-2 pl-2 border-l border-[#e0e0e0] flex items-center gap-2">
          <div className="w-7 h-7 bg-[#0f62fe] rounded-full flex items-center justify-center">
            <User size={14} className="text-white" />
          </div>
          <span className="text-sm text-[#161616]">Lead Tester</span>
        </div>
      </div>
    </header>
  );
}
