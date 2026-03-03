'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/app/contexts/ToastContext';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  green: '#059669',
  lightGray: '#F5F5F5',
};

type ReportType =
  | 'office_completed'
  | 'office_all_statuses'
  | 'testing_completed'
  | 'testing_all_statuses'
  | 'orders';

interface Upload {
  id: number;
  report_type: string;
  report_month: string;
  file_name: string;
  row_count: number;
  uploaded_at: string;
  status: string;
  error_message: string | null;
}

const REPORT_CONFIG: Record<
  ReportType,
  { title: string; subtitle: string; description: string; encrypted: boolean }
> = {
  office_completed: {
    title: 'Completed (Billing)',
    subtitle: 'Billing/transactions report',
    description: 'Source of truth for patient volume counts',
    encrypted: true,
  },
  office_all_statuses: {
    title: 'All Statuses',
    subtitle: 'All appointment statuses',
    description: 'Used for no-show and cancellation rates',
    encrypted: true,
  },
  testing_completed: {
    title: 'Completed (Billing)',
    subtitle: 'Billing/transactions report',
    description: 'Source of truth for testing volume counts',
    encrypted: true,
  },
  testing_all_statuses: {
    title: 'All Statuses',
    subtitle: 'All appointment statuses',
    description: 'Used for testing no-show and cancel rates',
    encrypted: true,
  },
  orders: {
    title: 'Orders (1000 10th)',
    subtitle: 'Orders placed & referring providers',
    description: 'Not encrypted — plain .xlsx file',
    encrypted: false,
  },
};

// ── Upload Zone Component (compact for side-by-side) ──

function UploadZone({
  reportType,
  onUploadComplete,
  uploading,
  setUploading,
}: {
  reportType: ReportType;
  onUploadComplete: () => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
}) {
  const config = REPORT_CONFIG[reportType];
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<{ rowCount: number; month: string } | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) validateAndSetFile(files[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateAndSetFile = (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Please select an Excel file (.xlsx)');
      return;
    }
    setSelectedFile(file);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('reportType', reportType);

      const response = await fetch('/api/statistics/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.status === 409) {
        toast.error(data.message || 'Duplicate upload');
        return;
      }

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Upload failed');
      }

      setUploadResult({ rowCount: data.rowCount, month: data.reportMonth });
      toast.success(`Uploaded ${data.rowCount.toLocaleString()} rows`);
      onUploadComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-gray-900">{config.title}</h4>
          {config.encrypted && (
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700 font-medium">
              Encrypted
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500">{config.description}</p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          uploading ? 'cursor-wait opacity-60' :
          isDragging ? 'border-blue-400 bg-blue-50 cursor-pointer' :
          uploadResult ? 'border-green-300 bg-green-50 cursor-pointer' :
          selectedFile ? 'border-blue-300 bg-blue-50 cursor-pointer' :
          'border-gray-300 hover:border-gray-400 cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={(e) => {
            if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
          }}
          className="hidden"
        />

        {uploadResult ? (
          <div className="py-1">
            <svg className="w-6 h-6 mx-auto text-green-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-medium text-green-700">
              {uploadResult.rowCount.toLocaleString()} rows uploaded
            </p>
            <p className="text-[10px] text-green-600 mt-0.5">Click to replace</p>
          </div>
        ) : selectedFile ? (
          <div className="py-1">
            <div className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-left min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-gray-400 hover:text-red-500 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-2">
            <svg className="w-8 h-8 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-xs text-gray-500">Drop .xlsx or click to browse</p>
          </div>
        )}
      </div>

      {/* Upload button */}
      {selectedFile && !uploadResult && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="mt-2 w-full px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors disabled:opacity-50"
          style={{ backgroundColor: uploading ? '#9CA3AF' : colors.primaryBlue }}
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </span>
          ) : (
            'Upload & Process'
          )}
        </button>
      )}
    </div>
  );
}

// ── Upload Group ──

function UploadGroup({
  title,
  icon,
  reportTypes,
  onUploadComplete,
}: {
  title: string;
  icon: React.ReactNode;
  reportTypes: ReportType[];
  onUploadComplete: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-base font-semibold" style={{ color: colors.primaryBlue }}>
          {title}
        </h3>
      </div>
      <div className={`flex gap-4 ${reportTypes.length === 1 ? 'max-w-md' : ''}`}>
        {reportTypes.map((type) => (
          <UploadZone
            key={type}
            reportType={type}
            onUploadComplete={onUploadComplete}
            uploading={uploading}
            setUploading={setUploading}
          />
        ))}
      </div>
    </div>
  );
}

// ── Upload History Component ──

function UploadHistory({
  uploads,
  loading,
  onDelete,
}: {
  uploads: Upload[];
  loading: boolean;
  onDelete: (id: number) => void;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const formatReportType = (type: string) => {
    const labels: Record<string, string> = {
      office_completed: 'Office - Completed',
      office_all_statuses: 'Office - All Statuses',
      testing_completed: 'Testing - Completed',
      testing_all_statuses: 'Testing - All Statuses',
      orders: 'Orders',
      // Legacy types
      office_visits: 'Office Visits (legacy)',
      testing_visits: 'Testing Visits (legacy)',
    };
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatMonth = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
        Loading upload history...
      </div>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
        No uploads yet. Upload an Epic report above to get started.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Type</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Report Month</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">File</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Rows</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Uploaded</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {uploads.map((upload, idx) => (
            <tr key={upload.id} className={`hover:bg-gray-50 transition-colors duration-150 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                {formatReportType(upload.report_type)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {upload.report_month ? formatMonth(upload.report_month) : '-'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate" title={upload.file_name}>
                {upload.file_name}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 text-right">
                {upload.row_count?.toLocaleString() ?? '-'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {new Date(upload.uploaded_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    upload.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : upload.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {upload.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {confirmDeleteId === upload.id ? (
                  <span className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        onDelete(upload.id);
                        setConfirmDeleteId(null);
                      }}
                      className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(upload.id)}
                    className="text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Data Page ──

export default function DataPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'upload' | 'history'>('upload');
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchUploads = async () => {
    try {
      const res = await fetch('/api/statistics/uploads');
      const data = await res.json();
      setUploads(data.uploads || []);
    } catch {
      console.error('Failed to fetch upload history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/statistics/uploads?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUploads(prev => prev.filter(u => u.id !== id));
        toast.success('Upload deleted successfully');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Failed to delete upload');
    }
  };

  // Icons for groups
  const officeIcon = (
    <svg className="w-5 h-5" style={{ color: colors.primaryBlue }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );

  const testingIcon = (
    <svg className="w-5 h-5" style={{ color: colors.primaryBlue }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );

  const ordersIcon = (
    <svg className="w-5 h-5" style={{ color: colors.primaryBlue }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: colors.lightGray }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm hover:underline mb-2 inline-block"
            style={{ color: colors.primaryBlue }}
          >
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: colors.primaryBlue }}>
            Data Upload
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload monthly Epic report exports to populate the Statistics dashboard
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Upload Files
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Upload History
            {uploads.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600">
                {uploads.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            {/* Group 1: Office Visits */}
            <UploadGroup
              title="Office Visits"
              icon={officeIcon}
              reportTypes={['office_completed', 'office_all_statuses']}
              onUploadComplete={fetchUploads}
            />

            {/* Group 2: Testing Visits */}
            <UploadGroup
              title="Testing Visits"
              icon={testingIcon}
              reportTypes={['testing_completed', 'testing_all_statuses']}
              onUploadComplete={fetchUploads}
            />

            {/* Group 3: Orders */}
            <UploadGroup
              title="Orders"
              icon={ordersIcon}
              reportTypes={['orders']}
              onUploadComplete={fetchUploads}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <UploadHistory uploads={uploads} loading={loadingHistory} onDelete={handleDelete} />
        )}
      </div>
    </div>
  );
}
