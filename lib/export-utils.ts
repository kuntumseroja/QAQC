import * as XLSX from 'xlsx';

export function exportToXlsx(data: Record<string, unknown>[], fileName: string, sheetName = 'Sheet1'): Blob {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportMultiSheetXlsx(sheets: { name: string; data: Record<string, unknown>[] }[]): Blob {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31)); // Excel sheet name max 31 chars
  }
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToCsv(data: Record<string, unknown>[], fileName: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = Array.isArray(val) ? val.join('; ') : String(val ?? '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  downloadBlob(blob, fileName);
}

export function exportDataToXlsx(data: Record<string, unknown>[], fileName: string) {
  const blob = exportToXlsx(data, fileName);
  downloadBlob(blob, fileName);
}

export function exportMultiSheet(sheets: { name: string; data: Record<string, unknown>[] }[], fileName: string) {
  const blob = exportMultiSheetXlsx(sheets);
  downloadBlob(blob, fileName);
}

// Download text content as a specific file type
export function downloadTextFile(content: string, fileName: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, fileName);
}

// Download JMeter .jmx file
export function downloadJmx(xmlContent: string, fileName: string) {
  downloadTextFile(xmlContent, fileName.endsWith('.jmx') ? fileName : `${fileName}.jmx`, 'application/xml');
}

// Download Gatling .scala file
export function downloadScala(scalaContent: string, fileName: string) {
  downloadTextFile(scalaContent, fileName.endsWith('.scala') ? fileName : `${fileName}.scala`, 'text/x-scala');
}

// Download Python file
export function downloadPython(pyContent: string, fileName: string) {
  downloadTextFile(pyContent, fileName.endsWith('.py') ? fileName : `${fileName}.py`, 'text/x-python');
}

// Download JSON file
export function downloadJson(data: unknown, fileName: string) {
  const content = JSON.stringify(data, null, 2);
  downloadTextFile(content, fileName.endsWith('.json') ? fileName : `${fileName}.json`, 'application/json');
}

// Download as simple HTML report (printable as PDF via browser)
export function downloadHtmlReport(title: string, sections: Array<{ title: string; content: string }>, fileName: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'IBM Plex Sans', sans-serif; color: #161616; padding: 40px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 24px; font-weight: 300; margin-bottom: 8px; color: #0f62fe; }
  h2 { font-size: 16px; font-weight: 600; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0; }
  p { font-size: 14px; line-height: 1.6; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #e0e0e0; text-align: left; padding: 8px 12px; font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid #e0e0e0; }
  tr:hover td { background: #f4f4f4; }
  .meta { color: #6f6f6f; font-size: 12px; margin-bottom: 24px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
  .badge-pass { background: #defbe6; color: #198038; }
  .badge-fail { background: #fff1f1; color: #da1e28; }
  .badge-warn { background: #fcf4d6; color: #8e6a00; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #a8a8a8; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<h1>${title}</h1>
<div class="meta">Generated: ${new Date().toLocaleString()} | QAQC4BI - Bank Indonesia Payment Infrastructure</div>
${sections.map(s => `<h2>${s.title}</h2>\n${s.content}`).join('\n')}
<div class="footer">QAQC4BI - AI-Powered QA/QC Platform | Bank Indonesia BSPI 2030 | Confidential</div>
</body>
</html>`;
  downloadTextFile(html, fileName.endsWith('.html') ? fileName : `${fileName}.html`, 'text/html');
}
