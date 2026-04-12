'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  color?: string;
}

export default function MetricCard({ title, value, subtitle, change, changeLabel, icon: Icon, color = '#0f62fe' }: MetricCardProps) {
  return (
    <div className="bg-white border border-[#e0e0e0] p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#525252] uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className="w-8 h-8 flex items-center justify-center" style={{ color }}>
            <Icon size={20} />
          </div>
        )}
      </div>
      <div className="text-3xl font-light text-[#161616]" style={{ color }}>
        {value}
      </div>
      <div className="flex items-center justify-between">
        {subtitle && <span className="text-xs text-[#6f6f6f]">{subtitle}</span>}
        {change !== undefined && (
          <span className={`text-xs flex items-center gap-0.5 ${change > 0 ? 'text-[#198038]' : change < 0 ? 'text-[#da1e28]' : 'text-[#6f6f6f]'}`}>
            {change > 0 ? <ArrowUp size={12} /> : change < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}
            {Math.abs(change)}%
            {changeLabel && <span className="ml-1 text-[#a8a8a8]">{changeLabel}</span>}
          </span>
        )}
      </div>
    </div>
  );
}
