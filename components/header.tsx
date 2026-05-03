'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Settings, Search, LogOut } from 'lucide-react';

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

interface MeUser {
  username: string;
  name: string;
  role: string;
  roleLabel: string;
  initials: string;
  color: string;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const info = pathNames[pathname] || { title: 'QAQC4BI', breadcrumb: ['Home'] };
  const [user, setUser] = useState<MeUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user || null)).catch(() => setUser(null));
  }, [pathname]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

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

        {/* User menu */}
        <div className="ml-2 pl-2 border-l border-[#e0e0e0] relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 hover:bg-[#f4f4f4] px-2 py-1 transition-colors"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
              style={{ background: user?.color || '#0f62fe' }}
            >
              {user?.initials || '··'}
            </div>
            <div className="text-left leading-tight">
              <div className="text-xs font-medium text-[#161616]">{user?.name || 'Guest'}</div>
              <div className="text-[10px] text-[#6f6f6f]">{user?.roleLabel || 'Not signed in'}</div>
            </div>
          </button>

          {open && user && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-[#e0e0e0] shadow-lg z-50">
              <div className="p-3 border-b border-[#e0e0e0]">
                <div className="text-xs font-medium text-[#161616]">{user.name}</div>
                <div className="text-[11px] text-[#6f6f6f]">{user.roleLabel}</div>
                <div className="text-[10px] text-[#a8a8a8] font-mono mt-1">@{user.username}</div>
              </div>
              <button
                onClick={logout}
                className="w-full text-left px-3 py-2 text-xs text-[#161616] hover:bg-[#f4f4f4] flex items-center gap-2"
              >
                <LogOut size={12} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
