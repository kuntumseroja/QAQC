export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'unknown';
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type DefectStatus = 'OPEN' | 'UNDER REVIEW' | 'CONFIRMED' | 'IN PROGRESS' | 'RESOLVED' | 'CLOSED';

export const DOMAIN_COLORS: Record<string, string> = {
  application: '#0f62fe',
  'data-analytics': '#009d9a',
  infrastructure: '#8a3ffc',
  defects: '#da1e28',
};

export const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#da1e28',
  High: '#ff832b',
  Medium: '#f1c21b',
  Low: '#009d9a',
};

export const STATUS_COLORS: Record<string, string> = {
  healthy: '#198038',
  degraded: '#f1c21b',
  down: '#da1e28',
  unknown: '#8d8d8d',
  PASS: '#198038',
  FAIL: '#da1e28',
  WARNING: '#f1c21b',
};
