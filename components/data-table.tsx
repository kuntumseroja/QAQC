'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Download } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
  width?: string;
}

interface DataTableProps {
  title?: string;
  description?: string;
  columns: Column[];
  data: Record<string, unknown>[];
  onExport?: () => void;
  actions?: React.ReactNode;
}

export default function DataTable({ title, description, columns, data, onExport, actions }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedData = sortKey
    ? [...data].sort((a, b) => {
        const va = String(a[sortKey] ?? '');
        const vb = String(b[sortKey] ?? '');
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      })
    : data;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="bg-white border border-[#e0e0e0]">
      {(title || onExport || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e0e0e0]">
          <div>
            {title && <h3 className="text-sm font-medium text-[#161616]">{title}</h3>}
            {description && <p className="text-xs text-[#525252] mt-0.5">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {onExport && (
              <button onClick={onExport} className="btn-ghost flex items-center gap-1 !min-h-[32px] !py-1 !px-3 text-xs">
                <Download size={14} />
                Export
              </button>
            )}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#e0e0e0]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-left text-xs font-semibold text-[#161616] px-4 py-2 ${col.sortable ? 'cursor-pointer select-none hover:bg-[#c6c6c6]' : ''}`}
                  style={{ width: col.width }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, i) => (
              <tr key={i} className="border-b border-[#e0e0e0] hover:bg-[#f4f4f4] transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2 text-sm text-[#161616]">
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-[#6f6f6f]">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-[#e0e0e0] text-xs text-[#6f6f6f]">
        {sortedData.length} {sortedData.length === 1 ? 'item' : 'items'}
      </div>
    </div>
  );
}
