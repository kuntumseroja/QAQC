'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileArchive,
  Trash2,
  RotateCcw,
  AlertCircle,
  FileText,
  Files,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import MetricCard from '@/components/metric-card';
import StatusBadge from '@/components/status-badge';

interface UploadedDocument {
  id: number;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  content_hash: string | null;
  service_used: string | null;
  uploaded_by: string;
  status: string;
  content_preview: string | null;
  result_summary: string | null;
  created_at: string;
  last_accessed: string;
  deleted_at: string | null;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function fileTypeLabel(mime: string | null): string {
  if (!mime) return '—';
  const map: Record<string, string> = {
    'text/plain': 'TXT',
    'application/json': 'JSON',
    'text/csv': 'CSV',
    'application/pdf': 'PDF',
    'application/xml': 'XML',
  };
  return map[mime] ?? mime.split('/').pop()?.toUpperCase() ?? mime;
}

export default function DocumentAuditPage() {
  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active');
  const [activeDocs, setActiveDocs] = useState<UploadedDocument[]>([]);
  const [deletedDocs, setDeletedDocs] = useState<UploadedDocument[]>([]);
  const [selectedActive, setSelectedActive] = useState<Set<number>>(new Set());
  const [selectedDeleted, setSelectedDeleted] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showNotification = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const [activeRes, deletedRes] = await Promise.all([
        fetch('/api/documents?status=active'),
        fetch('/api/documents?status=deleted'),
      ]);
      const activeData = await activeRes.json();
      const deletedData = await deletedRes.json();
      setActiveDocs(activeData.documents || []);
      setDeletedDocs(deletedData.documents || []);
    } catch {
      showNotification('error', 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const totalSize = [...activeDocs, ...deletedDocs].reduce((sum, d) => sum + (d.file_size ?? 0), 0);

  // --- Action handlers ---
  const handleSoftDelete = async (id: number) => {
    await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'soft-delete', id }),
    });
    showNotification('success', 'Document moved to deleted.');
    fetchDocs();
    setSelectedActive(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const handlePermanentDelete = async (id: number) => {
    if (!window.confirm('Permanently delete this document? This action cannot be undone.')) return;
    await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    showNotification('success', 'Document permanently deleted.');
    fetchDocs();
    setSelectedDeleted(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const handleRestore = async (id: number) => {
    await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', id }),
    });
    showNotification('success', 'Document restored to active.');
    fetchDocs();
    setSelectedDeleted(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const handleBulkSoftDelete = async () => {
    if (selectedActive.size === 0) return;
    if (!window.confirm(`Move ${selectedActive.size} document(s) to deleted?`)) return;
    for (const id of selectedActive) {
      await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'soft-delete', id }),
      });
    }
    showNotification('success', `${selectedActive.size} document(s) moved to deleted.`);
    setSelectedActive(new Set());
    fetchDocs();
  };

  const handleBulkPermanentDelete = async () => {
    const ids = Array.from(selectedDeleted);
    if (ids.length === 0) return;
    if (!window.confirm(`Permanently delete ${ids.length} document(s)? This cannot be undone.`)) return;
    await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk-delete', ids }),
    });
    showNotification('success', `${ids.length} document(s) permanently deleted.`);
    setSelectedDeleted(new Set());
    fetchDocs();
  };

  const handlePurgeAllDeleted = async () => {
    if (deletedDocs.length === 0) return;
    if (!window.confirm(`Permanently delete ALL ${deletedDocs.length} deleted document(s)? This cannot be undone.`)) return;
    const ids = deletedDocs.map(d => d.id);
    await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk-delete', ids }),
    });
    showNotification('success', `All deleted documents have been purged.`);
    setSelectedDeleted(new Set());
    fetchDocs();
  };

  // --- Selection helpers ---
  const toggleActiveSelect = (id: number) => {
    setSelectedActive(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleDeletedSelect = (id: number) => {
    setSelectedDeleted(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSelectAllActive = () => {
    if (selectedActive.size === activeDocs.length) {
      setSelectedActive(new Set());
    } else {
      setSelectedActive(new Set(activeDocs.map(d => d.id)));
    }
  };

  const toggleSelectAllDeleted = () => {
    if (selectedDeleted.size === deletedDocs.length) {
      setSelectedDeleted(new Set());
    } else {
      setSelectedDeleted(new Set(deletedDocs.map(d => d.id)));
    }
  };

  const docs = activeTab === 'active' ? activeDocs : deletedDocs;
  const selected = activeTab === 'active' ? selectedActive : selectedDeleted;

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 flex items-center justify-center bg-[#e8daff] text-[#8a3ffc] mt-0.5 flex-shrink-0">
          <FileArchive size={20} />
        </div>
        <div>
          <h1 className="text-xl font-light text-[#161616]">Document Audit Trail</h1>
          <p className="text-sm text-[#525252] mt-0.5">
            Track, manage, and audit all documents uploaded to QAQC4BI services. Maintain a complete record for compliance and project governance.
          </p>
        </div>
      </div>

      {/* Notification Banner (Info) */}
      <div className="flex items-start gap-3 px-4 py-3 bg-[#edf5ff] border border-[#0f62fe] border-l-4">
        <ShieldCheck size={16} className="text-[#0f62fe] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[#0043ce]">
          Documents are auditable. Deleted documents can be restored or permanently removed when a project ends.
        </p>
      </div>

      {/* Transient notification */}
      {notification && (
        <div
          className={`flex items-center gap-2 px-4 py-3 border-l-4 text-sm ${
            notification.type === 'success'
              ? 'bg-[#defbe6] border-[#198038] text-[#198038]'
              : 'bg-[#fff1f1] border-[#da1e28] text-[#da1e28]'
          }`}
        >
          <AlertCircle size={14} className="flex-shrink-0" />
          {notification.msg}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          title="Total Documents"
          value={activeDocs.length + deletedDocs.length}
          subtitle="All time"
          icon={Files}
          color="#0f62fe"
        />
        <MetricCard
          title="Active Documents"
          value={activeDocs.length}
          subtitle="Available for use"
          icon={FileText}
          color="#198038"
        />
        <MetricCard
          title="Deleted Documents"
          value={deletedDocs.length}
          subtitle="Awaiting purge"
          icon={Trash2}
          color="#da1e28"
        />
        <MetricCard
          title="Total Size"
          value={formatBytes(totalSize)}
          subtitle="Across all documents"
          icon={HardDrive}
          color="#8a3ffc"
        />
      </div>

      {/* Tab Bar */}
      <div className="border-b border-[#e0e0e0] flex gap-0">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-[#0f62fe] text-[#0f62fe]'
              : 'border-transparent text-[#6f6f6f] hover:text-[#161616] hover:border-[#c6c6c6]'
          }`}
        >
          Active Documents
          <span className="ml-2 px-1.5 py-0.5 text-[11px] rounded-full bg-[#e0e0e0] text-[#525252]">
            {activeDocs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('deleted')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'deleted'
              ? 'border-[#da1e28] text-[#da1e28]'
              : 'border-transparent text-[#6f6f6f] hover:text-[#161616] hover:border-[#c6c6c6]'
          }`}
        >
          Deleted Documents
          <span className="ml-2 px-1.5 py-0.5 text-[11px] rounded-full bg-[#fff1f1] text-[#da1e28]">
            {deletedDocs.length}
          </span>
        </button>
      </div>

      {/* Document Table */}
      <div className="bg-white border border-[#e0e0e0]">
        {/* Table toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e0e0e0]">
          <div>
            <h3 className="text-sm font-medium text-[#161616]">
              {activeTab === 'active' ? 'Active Documents' : 'Deleted Documents'}
            </h3>
            <p className="text-xs text-[#525252] mt-0.5">
              {activeTab === 'active'
                ? 'Documents currently in use across QAQC4BI services'
                : 'Soft-deleted documents — can be restored or permanently removed'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'active' && selectedActive.size > 0 && (
              <button
                onClick={handleBulkSoftDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#da1e28] border border-[#da1e28] hover:bg-[#fff1f1] transition-colors"
              >
                <Trash2 size={13} />
                Delete Selected ({selectedActive.size})
              </button>
            )}
            {activeTab === 'deleted' && selectedDeleted.size > 0 && (
              <button
                onClick={handleBulkPermanentDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#da1e28] hover:bg-[#a2191f] transition-colors"
              >
                <Trash2 size={13} />
                Permanently Delete Selected ({selectedDeleted.size})
              </button>
            )}
            {activeTab === 'deleted' && deletedDocs.length > 0 && (
              <button
                onClick={handlePurgeAllDeleted}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#6f6f6f] border border-[#c6c6c6] hover:bg-[#f4f4f4] transition-colors"
              >
                <Trash2 size={13} />
                Permanently Delete All Deleted
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#e0e0e0]">
                <th className="px-4 py-2 w-8">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 accent-[#0f62fe]"
                    checked={
                      docs.length > 0 &&
                      (activeTab === 'active'
                        ? selectedActive.size === activeDocs.length
                        : selectedDeleted.size === deletedDocs.length)
                    }
                    onChange={activeTab === 'active' ? toggleSelectAllActive : toggleSelectAllDeleted}
                  />
                </th>
                <th className="text-left text-xs font-semibold text-[#161616] px-4 py-2">File Name</th>
                <th className="text-left text-xs font-semibold text-[#161616] px-4 py-2 w-24">Size</th>
                <th className="text-left text-xs font-semibold text-[#161616] px-4 py-2 w-20">Type</th>
                <th className="text-left text-xs font-semibold text-[#161616] px-4 py-2 w-32">Service Used</th>
                <th className="text-left text-xs font-semibold text-[#161616] px-4 py-2 w-36">Uploaded By</th>
                <th className="text-left text-xs font-semibold text-[#161616] px-4 py-2 w-40">Date</th>
                <th className="text-left text-xs font-semibold text-[#161616] px-4 py-2 w-16">Status</th>
                <th className="text-left text-xs font-semibold text-[#161616] px-4 py-2 w-36">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#6f6f6f]">
                    Loading documents...
                  </td>
                </tr>
              )}
              {!loading && docs.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#6f6f6f]">
                    No {activeTab} documents found.
                  </td>
                </tr>
              )}
              {!loading && docs.map((doc) => {
                const isSelected = selected.has(doc.id);
                return (
                  <tr
                    key={doc.id}
                    className={`border-b border-[#e0e0e0] transition-colors ${
                      isSelected ? 'bg-[#edf5ff]' : 'hover:bg-[#f4f4f4]'
                    }`}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 accent-[#0f62fe]"
                        checked={isSelected}
                        onChange={() =>
                          activeTab === 'active'
                            ? toggleActiveSelect(doc.id)
                            : toggleDeletedSelect(doc.id)
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-start gap-2">
                        <FileText size={14} className="text-[#6f6f6f] flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-[#161616] leading-tight">{doc.file_name}</div>
                          {doc.content_preview && (
                            <div className="text-[11px] text-[#6f6f6f] mt-0.5 line-clamp-1">{doc.content_preview}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm text-[#525252]">{formatBytes(doc.file_size)}</td>
                    <td className="px-4 py-2">
                      <span className="px-1.5 py-0.5 text-[11px] font-medium bg-[#e0e0e0] text-[#525252] rounded">
                        {fileTypeLabel(doc.file_type)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-[#525252]">
                      <span className="font-mono text-[11px] bg-[#f4f4f4] px-1.5 py-0.5 rounded">
                        {doc.service_used ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-[#525252]">{doc.uploaded_by}</td>
                    <td className="px-4 py-2 text-xs text-[#6f6f6f] whitespace-nowrap">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={doc.status === 'active' ? 'healthy' : 'down'} />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        {activeTab === 'active' && (
                          <button
                            onClick={() => handleSoftDelete(doc.id)}
                            title="Move to deleted"
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#da1e28] border border-[#da1e28] hover:bg-[#fff1f1] transition-colors rounded"
                          >
                            <Trash2 size={11} />
                            Delete
                          </button>
                        )}
                        {activeTab === 'deleted' && (
                          <>
                            <button
                              onClick={() => handleRestore(doc.id)}
                              title="Restore document"
                              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#198038] border border-[#198038] hover:bg-[#defbe6] transition-colors rounded"
                            >
                              <RotateCcw size={11} />
                              Restore
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(doc.id)}
                              title="Permanently delete"
                              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-[#da1e28] hover:bg-[#a2191f] transition-colors rounded"
                            >
                              <Trash2 size={11} />
                              Purge
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="px-4 py-2 border-t border-[#e0e0e0] text-xs text-[#6f6f6f] flex items-center justify-between">
          <span>
            {docs.length} {docs.length === 1 ? 'document' : 'documents'}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </span>
          {activeTab === 'deleted' && deletedDocs.length > 0 && (
            <span className="text-[#da1e28]">
              Deleted documents consume {formatBytes(deletedDocs.reduce((s, d) => s + (d.file_size ?? 0), 0))} of storage
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
