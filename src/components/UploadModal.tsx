import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, FileCode, CheckCircle, AlertCircle, Layers, Network, Database, ArrowRight, Clock, HardDrive, Keyboard } from 'lucide-react';
import { uploadTuxFileWithProgress } from '../api';
import type { UploadProgressInfo } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (payloadId: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressInfo, setProgressInfo] = useState<UploadProgressInfo | null>(null);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setDatasetName('');
      setIsUploading(false);
      setError(null);
      setProgressInfo(null);
      setUploadResult(null);
    }
  }, [isOpen]);

  const handleProceed = () => {
    if (uploadResult) {
      onUploadSuccess(uploadResult.payload_id || uploadResult.id);
      onClose();
    }
  };

  useEffect(() => {
    if (!uploadResult) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      handleProceed();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uploadResult]);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = e.dataTransfer.files[0];
      setFile(selected);
      setDatasetName(selected.name.replace(/\.xml$/i, ''));
      setError(null);
      setProgressInfo(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setFile(selected);
      setDatasetName(selected.name.replace(/\.xml$/i, ''));
      setError(null);
      setProgressInfo(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setProgressInfo({
      stage: 'starting',
      stage_name: 'Initializing Ingestion',
      percent: 1,
      message: `Preparing ${file.name} for ingestion...`,
    });

    try {
      const res = await uploadTuxFileWithProgress(file, datasetName, (progress) => {
        setProgressInfo(progress);
      });
      setUploadResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to upload and convert TUX file.');
    } finally {
      setIsUploading(false);
    }
  };

  const percent = progressInfo ? Math.min(100, Math.max(0, progressInfo.percent)) : 0;

  return (
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 transition-colors">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Import TUX Dataset</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Stream-ingests Troux XML into a dedicated SQLite database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {!isUploading && !uploadResult && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500/80 bg-slate-50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-950/80 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-3"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xml"
                className="hidden"
              />
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {file ? file.name : 'Click to select or drag & drop .xml file'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supports Troux Upload XML (DTD V5 compliant) up to 250MB+
                </p>
              </div>
            </div>
          )}

          {/* Dataset Name Prompt */}
          {file && !isUploading && !uploadResult && (
            <div className="space-y-1.5 animate-in fade-in duration-150">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Dataset Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="e.g. Workday HR, ServiceNow CMDB, Enterprise Arch"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
              />
              <p className="text-[11px] text-slate-500">
                A custom label used to identify and switch between multiple datasets.
              </p>
            </div>
          )}

          {/* Ingestion In-Progress Display */}
          {isUploading && !uploadResult && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-3.5 animate-in fade-in zoom-in-95 duration-150 shadow-inner">
              {/* Top Progress Info Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">
                    {progressInfo?.stage_name || 'Processing Dataset'}
                  </span>
                </div>
                <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                  {percent}%
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700/60">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out shadow-lg shadow-indigo-500/50"
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Status Message */}
              <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed font-medium">
                {progressInfo?.message || 'Processing XML stream...'}
              </p>

              {/* Live Metric Badges */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-slate-500 block leading-none">Components</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {progressInfo?.components_ingested?.toLocaleString() ?? progressInfo?.components_discovered?.toLocaleString() ?? '—'}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                  <Network className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-slate-500 block leading-none">Relationships</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {progressInfo?.relationships_ingested?.toLocaleString() ?? progressInfo?.relationships_discovered?.toLocaleString() ?? '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Ingestion Complete & Statistics Summary Card */}
          {uploadResult && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-950 border border-emerald-500/30 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              {/* Header Badge */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner flex-shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Import Successfully Completed!</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Dataset <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">"{uploadResult.dataset_name || uploadResult.id}"</span> ({Number(uploadResult.components_ingested ?? progressInfo?.components_ingested ?? 0).toLocaleString()} components, {Number(uploadResult.relationships_ingested ?? progressInfo?.relationships_ingested ?? 0).toLocaleString()} relationships)
                  </p>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">Components</span>
                  </div>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                    {Number(uploadResult.components_ingested ?? progressInfo?.components_ingested ?? 0).toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                    <Network className="w-3.5 h-3.5" />
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">Relationships</span>
                  </div>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                    {Number(uploadResult.relationships_ingested ?? progressInfo?.relationships_ingested ?? 0).toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                    <HardDrive className="w-3.5 h-3.5" />
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">Payload Size</span>
                  </div>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                    {uploadResult.size_mb} MB
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">Conversion Time</span>
                  </div>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                    {uploadResult.conversion_time_seconds}s
                  </span>
                </div>
              </div>

              {/* Database Reference */}
              <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>SQLite Database:</span>
                </div>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{uploadResult.id}.db</span>
              </div>

              {/* Keyboard Prompt Hint */}
              <div className="flex items-center justify-center gap-2 py-1 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                <Keyboard className="w-3.5 h-3.5 animate-pulse text-indigo-600 dark:text-indigo-400" />
                <span>Press <strong>ANY KEY</strong> or click below to continue</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-end gap-3">
          {!uploadResult ? (
            <>
              <button
                onClick={onClose}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
              >
                {isUploading && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{isUploading ? 'Ingesting...' : 'Ingest & Open'}</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleProceed}
              autoFocus
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-xl shadow-emerald-500/25 transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Continue to Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
