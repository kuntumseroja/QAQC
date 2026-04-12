'use client';

import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportToCsv, exportDataToXlsx } from '@/lib/export-utils';

interface ExportButtonsProps {
  data: Record<string, unknown>[];
  fileNameBase: string;
  disabled?: boolean;
}

export default function ExportButtons({ data, fileNameBase, disabled }: ExportButtonsProps) {
  const ts = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => exportToCsv(data, `${fileNameBase}_${ts}.csv`)}
        disabled={disabled || data.length === 0}
        className="btn-ghost flex items-center gap-1 !min-h-[32px] !py-1 !px-3 text-xs disabled:opacity-40"
        title="Export as CSV"
      >
        <FileText size={14} />
        CSV
      </button>
      <button
        onClick={() => exportDataToXlsx(data, `${fileNameBase}_${ts}.xlsx`)}
        disabled={disabled || data.length === 0}
        className="btn-ghost flex items-center gap-1 !min-h-[32px] !py-1 !px-3 text-xs disabled:opacity-40"
        title="Export as Excel (XLSX)"
      >
        <FileSpreadsheet size={14} />
        XLS
      </button>
    </div>
  );
}
