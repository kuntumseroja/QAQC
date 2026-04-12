'use client';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusStyles: Record<string, { bg: string; color: string }> = {
  PASS: { bg: '#defbe6', color: '#198038' },
  FAIL: { bg: '#fff1f1', color: '#da1e28' },
  WARNING: { bg: '#fcf4d6', color: '#8e6a00' },
  healthy: { bg: '#defbe6', color: '#198038' },
  degraded: { bg: '#fcf4d6', color: '#8e6a00' },
  down: { bg: '#fff1f1', color: '#da1e28' },
  Critical: { bg: '#fff1f1', color: '#da1e28' },
  High: { bg: '#ffd8a8', color: '#5e2900' },
  Medium: { bg: '#fcf4d6', color: '#8e6a00' },
  Low: { bg: '#d0e2ff', color: '#002d9c' },
  OPEN: { bg: '#fff1f1', color: '#da1e28' },
  'UNDER REVIEW': { bg: '#fcf4d6', color: '#8e6a00' },
  CONFIRMED: { bg: '#ffd8a8', color: '#5e2900' },
  'IN PROGRESS': { bg: '#d0e2ff', color: '#002d9c' },
  RESOLVED: { bg: '#defbe6', color: '#198038' },
  CLOSED: { bg: '#e0e0e0', color: '#525252' },
  Positive: { bg: '#defbe6', color: '#198038' },
  Negative: { bg: '#fff1f1', color: '#da1e28' },
  'Edge Case': { bg: '#e8daff', color: '#491d8b' },
  Covered: { bg: '#defbe6', color: '#198038' },
  Gap: { bg: '#fff1f1', color: '#da1e28' },
  generated: { bg: '#d0e2ff', color: '#002d9c' },
  pending: { bg: '#fcf4d6', color: '#8e6a00' },
  completed: { bg: '#defbe6', color: '#198038' },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const style = statusStyles[status] || { bg: '#e0e0e0', color: '#525252' };
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      }`}
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status}
    </span>
  );
}
