import React, { useState, useEffect, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle, Network, Table, FileSpreadsheet, ShieldCheck, Layers, Zap, Database, ArrowRight, Clock, HardDrive, Keyboard } from 'lucide-react';
import { uploadTuxFileWithProgress } from '../api';
import type { UploadProgressInfo } from '../types';

interface EmptyUploadStateProps {
  onUploadSuccess: (payloadId: string) => void;
}

export const EmptyUploadState: React.FC<EmptyUploadStateProps> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressInfo, setProgressInfo] = useState<UploadProgressInfo | null>(null);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProceed = () => {
    if (uploadResult) {
      onUploadSuccess(uploadResult.payload_id || uploadResult.id);
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
      message: `Preparing ${file.name} for streaming ingestion...`,
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
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8 select-none transition-colors">
      <div className="max-w-3xl w-full space-y-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Hero Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            <span>Planview Troux Upload XML (TUX DTD V5) Studio</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Import TUX Dataset
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xl mx-auto">
            Upload any Troux XML payload to generate a dedicated relational SQLite database, interactive UML metamodel graph, and fast searchable tabular views.
          </p>
        </div>

        {/* Upload Dropzone Card */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 transition-colors">
          {!isUploading && !uploadResult && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-950 rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-4 group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xml"
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-200 dark:border-indigo-500/20 group-hover:scale-105 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-600/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 transition shadow-inner">
                <Upload className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-white transition">
                  {file ? file.name : 'Click to browse or drag & drop .xml file'}
                </p>
                <p className="text-xs text-slate-500">
                  Supports any Troux Upload XML payload up to 250MB+ (DTD V5 compliant)
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
              />
              <p className="text-[11px] text-slate-500">
                A custom label to identify this dataset and switch between datasets in the header.
              </p>
            </div>
          )}

          {/* Real-time Ingestion Progress Card */}
          {isUploading && !uploadResult && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              {/* Top Progress Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Zap className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white tracking-wide block">
                      {progressInfo?.stage_name || 'Processing Ingestion'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {file?.name} {progressInfo?.size_mb ? `(${progressInfo.size_mb} MB)` : ''}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                    {percent}%
                  </span>
                  <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">Progress</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-800">
                <div
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out shadow-lg shadow-indigo-500/50"
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Live Status Message */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping flex-shrink-0" />
                <p className="text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                  {progressInfo?.message || 'Streaming elements and building schema...'}
                </p>
              </div>

              {/* Live Ingestion Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">Components</span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                      {progressInfo?.components_ingested?.toLocaleString() ?? progressInfo?.components_discovered?.toLocaleString() ?? '—'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                    <Network className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">Relationships</span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                      {progressInfo?.relationships_ingested?.toLocaleString() ?? progressInfo?.relationships_discovered?.toLocaleString() ?? '—'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">Processed</span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                      {progressInfo?.bytes_processed && progressInfo?.total_bytes
                        ? `${(progressInfo.bytes_processed / (1024 * 1024)).toFixed(1)} / ${(progressInfo.total_bytes / (1024 * 1024)).toFixed(1)} MB`
                        : `${percent}%`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Ingestion Complete & Statistics Summary Card */}
          {uploadResult && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-emerald-500/30 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              {/* Header Badge */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner flex-shrink-0">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Dataset Successfully Ingested!</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Dataset <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">"{uploadResult.dataset_name || uploadResult.id}"</span> ({Number(uploadResult.components_ingested ?? progressInfo?.components_ingested ?? 0).toLocaleString()} components, {Number(uploadResult.relationships_ingested ?? progressInfo?.relationships_ingested ?? 0).toLocaleString()} relationships)
                  </p>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Layers className="w-4 h-4" />
                    <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">Components Ingested</span>
                  </div>
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono block">
                    {Number(uploadResult.components_ingested ?? progressInfo?.components_ingested ?? 0).toLocaleString()}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <Network className="w-4 h-4" />
                    <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">Relationships Ingested</span>
                  </div>
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono block">
                    {Number(uploadResult.relationships_ingested ?? progressInfo?.relationships_ingested ?? 0).toLocaleString()}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <HardDrive className="w-4 h-4" />
                    <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">XML Payload Size</span>
                  </div>
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono block">
                    {uploadResult.size_mb} MB
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-500 dark:text-slate-400">Conversion Duration</span>
                  </div>
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono block">
                    {uploadResult.conversion_time_seconds}s
                  </span>
                </div>
              </div>

              {/* Database Reference Info */}
              <div className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
                  <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Target SQLite Database:</span>
                </div>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{uploadResult.id}.db</span>
              </div>

              {/* Keyboard Prompt Hint */}
              <div className="flex items-center justify-center gap-2 pt-1 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                <Keyboard className="w-4 h-4 animate-pulse text-indigo-600 dark:text-indigo-400" />
                <span>Press <strong>ANY KEY</strong> or click below to explore dataset</span>
              </div>

              {/* Primary Action Button */}
              <button
                onClick={handleProceed}
                autoFocus
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-bold shadow-xl shadow-emerald-500/25 transition active:scale-95 flex items-center justify-center gap-2.5"
              >
                <span>Explore Dataset in Studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {!isUploading && !uploadResult && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Supports multiple datasets simultaneously
              </span>
              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xl shadow-indigo-500/25 transition active:scale-95 flex items-center gap-2"
              >
                <span>Ingest & Open Studio</span>
              </button>
            </div>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2 shadow-sm transition-colors">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Table className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">Tabular Explorer</h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Paginated data grids, real-time search, column pickers, and global SQL sorting.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2 shadow-sm transition-colors">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Network className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">UML Metamodel Graph</h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Standard UML 2.5 classifier boxes with calculated multiplicities and reading directions.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 space-y-2 shadow-sm transition-colors">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">SQLite & CSV Exports</h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Download clean SQLite `.db` or a ZIP archive containing ALL CAPS `.csv` files per type.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
