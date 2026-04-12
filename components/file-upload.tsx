'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';

interface FileUploadProps {
  label: string;
  accept?: string;
  description?: string;
  onFileContent: (content: string, fileName: string) => void;
}

// Extract text from PDF using pdfjs-dist
async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  // Set worker source to the copied file in public/
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: unknown) => (item as { str?: string }).str || '')
      .join(' ');
    pages.push(text);
  }
  return pages.join('\n\n');
}

// Extract text from DOCX using mammoth library
async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

// Extract text from Excel/XLSX files using xlsx library
async function extractSpreadsheetText(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheets: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) {
      sheets.push(`=== Sheet: ${sheetName} ===\n${csv}`);
    }
  }
  return sheets.join('\n\n');
}

export default function FileUpload({ label, accept = '.txt,.docx,.pdf,.json,.yaml,.yml,.tf,.py,.java,.scala', description, onFileContent }: FileUploadProps) {
  const [fileName, setFileName] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setProcessing(true);
    setError('');

    try {
      let text: string;
      const ext = file.name.toLowerCase().split('.').pop() || '';

      if (ext === 'pdf') {
        text = await extractPdfText(file);
        if (!text.trim()) {
          setError('Could not extract text from PDF. The file may be scanned/image-based.');
          text = `[PDF file: ${file.name}, ${(file.size / 1024).toFixed(1)} KB - text extraction yielded no content]`;
        }
      } else if (ext === 'docx') {
        text = await extractDocxText(file);
        if (!text.trim()) {
          setError('Could not extract text from DOCX.');
          text = `[DOCX file: ${file.name}, ${(file.size / 1024).toFixed(1)} KB]`;
        }
      } else if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
        text = await extractSpreadsheetText(file);
      } else if (ext === 'csv' || ext === 'tsv') {
        text = await file.text();
      } else {
        // Plain text, JSON, YAML, TF, code files
        text = await file.text();
      }

      onFileContent(text, file.name);
    } catch (err) {
      console.error('File processing error:', err);
      setError(`Failed to process file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      // Still try plain text as fallback
      try {
        const text = await file.text();
        onFileContent(text, file.name);
      } catch {
        onFileContent(`[Unable to read file: ${file.name}]`, file.name);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const clear = () => {
    setFileName('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-[#525252] mb-1">{label}</label>
      <div
        className={`border-2 border-dashed rounded px-4 py-6 text-center cursor-pointer transition-colors ${
          dragActive ? 'border-[#0f62fe] bg-[#edf5ff]' : 'border-[#c6c6c6] hover:border-[#8d8d8d] bg-[#f4f4f4]'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => !processing && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
        {processing ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 size={20} className="text-[#0f62fe] animate-spin" />
            <span className="text-sm text-[#525252]">Processing {fileName}...</span>
          </div>
        ) : fileName ? (
          <div className="flex items-center justify-center gap-2">
            <FileText size={20} className="text-[#0f62fe]" />
            <span className="text-sm text-[#161616]">{fileName}</span>
            <button onClick={(e) => { e.stopPropagation(); clear(); }} className="text-[#6f6f6f] hover:text-[#161616]">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div>
            <Upload size={24} className="mx-auto text-[#6f6f6f] mb-2" />
            <p className="text-sm text-[#161616]">Drag and drop a file here or click to upload</p>
            {description && <p className="text-xs text-[#6f6f6f] mt-1">{description}</p>}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-[#da1e28] mt-1">{error}</p>
      )}
    </div>
  );
}
