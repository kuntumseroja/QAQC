'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ServiceCardProps {
  id: string;
  name: string;
  description: string;
  status: 'healthy' | 'degraded' | 'down';
  href: string;
  icon: LucideIcon;
  color?: string;
  stats?: { label: string; value: string | number }[];
}

const statusMap = {
  healthy: { label: 'Healthy', bg: '#defbe6', color: '#198038', dot: '#198038' },
  degraded: { label: 'Degraded', bg: '#fcf4d6', color: '#8e6a00', dot: '#f1c21b' },
  down: { label: 'Down', bg: '#fff1f1', color: '#da1e28', dot: '#da1e28' },
};

export default function ServiceCard({ id, name, description, status, href, icon: Icon, color = '#0f62fe', stats }: ServiceCardProps) {
  const s = statusMap[status];
  return (
    <Link href={href} className="block bg-white border border-[#e0e0e0] hover:border-[#0f62fe] transition-colors group">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 flex items-center justify-center rounded" style={{ backgroundColor: color + '1a', color }}>
            <Icon size={20} />
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]" style={{ backgroundColor: s.bg, color: s.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
            {s.label}
          </div>
        </div>
        <div className="text-[10px] text-[#6f6f6f] mb-0.5">{id}</div>
        <div className="text-sm font-medium text-[#161616] mb-1">{name}</div>
        <div className="text-xs text-[#525252] leading-relaxed mb-3">{description}</div>
        {stats && (
          <div className="flex gap-4 pt-3 border-t border-[#e0e0e0]">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-xs text-[#6f6f6f]">{stat.label}</div>
                <div className="text-sm font-medium text-[#161616]">{stat.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="h-8 px-4 flex items-center justify-between bg-[#f4f4f4] text-xs text-[#0f62fe] group-hover:bg-[#e0e0e0] transition-colors">
        <span>Open Service</span>
        <ArrowRight size={14} />
      </div>
    </Link>
  );
}
