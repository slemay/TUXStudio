import React, { useState } from 'react';
import { Database, Upload, Network, Table, Info, RefreshCw, Download, FileSpreadsheet, Trash2, AlertTriangle, Layers, ChevronDown, Sun, Moon } from 'lucide-react';
import type { PayloadInfo } from '../types';
import { triggerExportSqlite, triggerExportCsvZip } from '../api';

interface HeaderProps {
  payloads: PayloadInfo[];
  activePayloadId: string;
  onSelectPayload: (id: string) => void;
  activeView: 'table' | 'graph' | 'summary';
  onChangeView: (view: 'table' | 'graph' | 'summary') => void;
  onOpenUpload: () => void;
  onClearDataset: () => void;
  isLoading: boolean;
  onRefresh: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  payloads,
  activePayloadId,
  onSelectPayload,
  activeView,
  onChangeView,
  onOpenUpload,
  onClearDataset,
  isLoading,
  onRefresh,
  theme,
  onToggleTheme,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleConfirmClear = () => {
    setShowClearConfirm(false);
    onClearDataset();
  };

  return (
    <>
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30 select-none transition-colors duration-150">
        {/* Brand, Import Dataset, Dataset Switcher, Clear Dataset */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pr-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">TUX Studio</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 font-mono font-medium">
                  DTD v5
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Relational Data Explorer</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

          {/* Import Dataset Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition active:scale-95 flex-shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Dataset</span>
          </button>

          {/* Dataset Dropdown Switcher */}
          {payloads.length > 0 ? (
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-sm transition-colors">
              <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Dataset:</span>
              <div className="relative flex items-center">
                <select
                  value={activePayloadId}
                  onChange={(e) => onSelectPayload(e.target.value)}
                  className="bg-transparent text-sm font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer pr-6 appearance-none hover:text-slate-950 dark:hover:text-white transition"
                >
                  {payloads.map((p) => (
                    <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                      {p.dataset_name || p.id} ({p.size_mb} MB)
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-0" />
              </div>
              {payloads.length > 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono font-medium">
                  {payloads.length} loaded
                </span>
              )}
              <button
                onClick={onRefresh}
                title="Refresh datasets metadata"
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded transition ml-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-500 dark:text-indigo-400' : ''}`} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">No Datasets Loaded</span>
            </div>
          )}

          {/* Clear Dataset Action Button */}
          {activePayloadId && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:border-rose-500/20 dark:text-rose-400 dark:hover:text-rose-300 text-xs font-semibold transition active:scale-95 flex-shrink-0"
              title={`Clear currently selected dataset (${activePayloadId})`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Dataset</span>
            </button>
          )}
        </div>

        {/* Navigation View Switcher, Export Buttons & Dark/Light Switch */}
        <div className="flex items-center gap-2.5">
          {activePayloadId && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 transition-colors">
              <button
                onClick={() => onChangeView('table')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeView === 'table'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                Tabular Explorer
              </button>
              <button
                onClick={() => onChangeView('graph')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeView === 'graph'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                Metamodel Graph
              </button>
              <button
                onClick={() => onChangeView('summary')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeView === 'summary'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                Payload Summary
              </button>
            </div>
          )}

          {/* Export Action Buttons */}
          {activePayloadId && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
              <button
                onClick={() => triggerExportSqlite(`${activePayloadId}.db`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-transparent text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white text-xs font-semibold transition shadow-sm active:scale-95 cursor-pointer"
                title="Download relational SQLite database file (.db)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Export SQLite</span>
              </button>
              <button
                onClick={() => triggerExportCsvZip(`${activePayloadId}_csv.zip`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-transparent text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white text-xs font-semibold transition shadow-sm active:scale-95 cursor-pointer"
                title="Download all component & relationship types as CSVs in a ZIP archive"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>Export CSV</span>
              </button>
            </div>
          )}

          {/* Dark / Light Mode Switch */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex items-center gap-2 p-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 transition active:scale-95 shadow-sm"
          >
            <div className="relative w-8 h-4 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center p-0.5 transition-colors">
              <div
                className={`w-3 h-3 rounded-full shadow-md transform transition-transform ${
                  theme === 'light' ? 'translate-x-4 bg-amber-500' : 'translate-x-0 bg-indigo-400'
                }`}
              />
            </div>
            <div className="flex items-center gap-1 text-xs font-semibold">
              {theme === 'dark' ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline text-slate-300">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden sm:inline text-slate-700">Light</span>
                </>
              )}
            </div>
          </button>
        </div>
      </header>

      {/* Clear Selected Dataset Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-white">Clear "{activePayloadId}" Dataset?</h3>
              <p className="text-xs text-slate-400">
                This will delete the SQLite database for <strong className="text-slate-200">{activePayloadId}</strong>. {payloads.length > 1 ? 'Other loaded datasets will remain intact in your workspace.' : 'You will need to upload another TUX dataset to continue.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Clear Dataset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


