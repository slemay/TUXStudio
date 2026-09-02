import React from 'react';
import { Box, Link2, ShieldCheck, FileSpreadsheet, ArrowUpRight } from 'lucide-react';
import type { PayloadTypesResponse } from '../types';

interface PayloadSummaryViewProps {
  typesData: PayloadTypesResponse | null;
  onSelectTable: (tableName: string) => void;
}

export const PayloadSummaryView: React.FC<PayloadSummaryViewProps> = ({
  typesData,
  onSelectTable,
}) => {
  if (!typesData) return null;

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-950 space-y-8 h-full min-h-0 transition-colors">
      {/* Metric Cards & Overview Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Payload Overview: {typesData.payload_id}</h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase">
              <span>Total Components</span>
              <Box className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {typesData.total_components.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Discovered Fact Tables</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase">
              <span>Total Relationships</span>
              <Link2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {typesData.total_relationships.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Discovered Dimension Links</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase">
              <span>Component Types</span>
              <FileSpreadsheet className="w-4 h-4 text-purple-500 dark:text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {typesData.component_types.length}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Distinct Entity Classes</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs font-semibold uppercase">
              <span>DTD Compliance</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">DTD V5</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">TrouxUpload Grammar Valid</p>
          </div>
        </div>
      </div>

      {/* Component Fact Tables Breakdown */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Box className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          <span>Discovered Component Types (Fact Tables)</span>
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {typesData.component_types.map((ct) => (
            <div
              key={ct.table_name}
              onClick={() => onSelectTable(ct.table_name)}
              className="p-4 rounded-xl bg-white dark:bg-slate-900/60 hover:bg-indigo-50/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/40 shadow-sm cursor-pointer transition group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition">
                    {ct.name}
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                    <span>{ct.count.toLocaleString()} rows</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
                    Discovered Columns ({ct.columns.length}):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {ct.columns.map((c) => (
                      <span
                        key={c}
                        className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-[10px] font-mono border border-slate-300 dark:border-slate-800"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Relationship Dimension Tables Breakdown */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Link2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          <span>Discovered Relationship Types (Dimension Tables)</span>
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {typesData.relationship_types.map((rt) => (
            <div
              key={rt.table_name}
              onClick={() => onSelectTable(rt.table_name)}
              className="p-4 rounded-xl bg-white dark:bg-slate-900/60 hover:bg-emerald-50/40 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500/40 shadow-sm cursor-pointer transition group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition">
                    {rt.name}
                  </h4>
                  <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                    <span>{rt.count.toLocaleString()} rows</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Columns:</span>
                  <div className="flex flex-wrap gap-1">
                    {rt.columns.map((c) => (
                      <span
                        key={c}
                        className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 text-[10px] font-mono border border-slate-300 dark:border-slate-800"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
