import React, { useState } from 'react';
import { Box, Link2, Search, ChevronRight } from 'lucide-react';
import type { TableTypeInfo } from '../types';

interface SidebarProps {
  componentTypes: TableTypeInfo[];
  relationshipTypes: TableTypeInfo[];
  activeTable: string;
  onSelectTable: (tableName: string) => void;
  totalComponents: number;
  totalRelationships: number;
  width?: number;
  onStartResize?: (e: React.MouseEvent) => void;
  isResizing?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  componentTypes,
  relationshipTypes,
  activeTable,
  onSelectTable,
  totalComponents,
  totalRelationships,
  width = 288,
  onStartResize,
  isResizing,
}) => {
  const [filterText, setFilterText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'components' | 'relationships'>('all');

  const filteredComponents = componentTypes.filter((ct) =>
    ct.name.toLowerCase().includes(filterText.toLowerCase())
  );
  const filteredRelationships = relationshipTypes.filter((rt) =>
    rt.name.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <aside
      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
      className="relative border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-col h-full flex-shrink-0 min-h-0 overflow-hidden select-none transition-colors"
    >
      {/* Category Filter Tabs */}
      <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60">
        <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`py-1.5 px-1 rounded-md text-center transition truncate text-[11px] ${
              categoryFilter === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-bold border border-slate-200/60 dark:border-slate-700/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({componentTypes.length + relationshipTypes.length})
          </button>
          <button
            onClick={() => {
              setCategoryFilter('components');
              if (!componentTypes.some((c) => c.table_name === activeTable) && componentTypes.length > 0) {
                onSelectTable(componentTypes[0].table_name);
              }
            }}
            className={`py-1.5 px-1 rounded-md text-center transition truncate text-[11px] ${
              categoryFilter === 'components'
                ? 'bg-indigo-600 text-white shadow-sm font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Components ({componentTypes.length})
          </button>
          <button
            onClick={() => {
              setCategoryFilter('relationships');
              if (!relationshipTypes.some((r) => r.table_name === activeTable) && relationshipTypes.length > 0) {
                onSelectTable(relationshipTypes[0].table_name);
              }
            }}
            className={`py-1.5 px-1 rounded-md text-center transition truncate text-[11px] ${
              categoryFilter === 'relationships'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Relations ({relationshipTypes.length})
          </button>
        </div>
      </div>

      {/* Search within Types */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5 focus-within:border-indigo-500 transition">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder={
              categoryFilter === 'components'
                ? 'Filter component types...'
                : categoryFilter === 'relationships'
                ? 'Filter relationship types...'
                : 'Filter entity types...'
            }
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="bg-transparent text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none w-full"
          />
        </div>
      </div>

      {/* Type Lists */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Component Fact Tables */}
        {(categoryFilter === 'all' || categoryFilter === 'components') && (
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <Box className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Components</span>
              </div>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono font-medium">
                {totalComponents.toLocaleString()}
              </span>
            </div>

            <div className="space-y-1">
              {filteredComponents.map((ct) => {
                const isActive = activeTable === ct.table_name;
                return (
                  <button
                    key={ct.table_name}
                    onClick={() => onSelectTable(ct.table_name)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition group ${
                      isActive
                        ? 'bg-indigo-100 border border-indigo-300 text-indigo-900 dark:bg-indigo-600/20 dark:border-indigo-500/30 dark:text-indigo-300'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isActive ? 'bg-indigo-500 dark:bg-indigo-400 shadow-sm shadow-indigo-400' : 'bg-slate-400 dark:bg-slate-600'
                        }`}
                      />
                      <span className="truncate">{ct.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          isActive
                            ? 'bg-indigo-200 dark:bg-indigo-500/30 text-indigo-900 dark:text-indigo-200 font-semibold'
                            : 'bg-slate-200 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-300'
                        }`}
                      >
                        {ct.count.toLocaleString()}
                      </span>
                      <ChevronRight
                        className={`w-3 h-3 text-slate-400 dark:text-slate-500 transition-transform ${
                          isActive ? 'rotate-90 text-indigo-600 dark:text-indigo-400' : 'group-hover:translate-x-0.5'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
              {filteredComponents.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                  No matching components found
                </p>
              )}
            </div>
          </div>
        )}

        {/* Relationship Dimension Tables */}
        {(categoryFilter === 'all' || categoryFilter === 'relationships') && (
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <Link2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Relationships</span>
              </div>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono font-medium">
                {totalRelationships.toLocaleString()}
              </span>
            </div>

            <div className="space-y-1">
              {filteredRelationships.map((rt) => {
                const isActive = activeTable === rt.table_name;
                return (
                  <button
                    key={rt.table_name}
                    onClick={() => onSelectTable(rt.table_name)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition group ${
                      isActive
                        ? 'bg-emerald-100 border border-emerald-300 text-emerald-900 dark:bg-emerald-600/20 dark:border-emerald-500/30 dark:text-emerald-300'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/80 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isActive ? 'bg-emerald-500 dark:bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-400 dark:bg-slate-600'
                        }`}
                      />
                      <span className="truncate">{rt.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          isActive
                            ? 'bg-emerald-200 dark:bg-emerald-500/30 text-emerald-900 dark:text-emerald-200 font-semibold'
                            : 'bg-slate-200 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-300'
                        }`}
                      >
                        {rt.count.toLocaleString()}
                      </span>
                      <ChevronRight
                        className={`w-3 h-3 text-slate-400 dark:text-slate-500 transition-transform ${
                          isActive ? 'rotate-90 text-emerald-600 dark:text-emerald-400' : 'group-hover:translate-x-0.5'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
              {filteredRelationships.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                  No matching relationships found
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Draggable Resizer Handle */}
      {onStartResize && (
        <div
          onMouseDown={onStartResize}
          className={`absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500 active:bg-indigo-600 transition-colors z-30 group ${
            isResizing ? 'bg-indigo-500 w-2' : 'bg-transparent hover:w-2'
          }`}
          title="Drag to resize pane"
        >
          <div className="h-8 w-1 bg-slate-400 dark:bg-slate-600 rounded-full mx-auto my-auto absolute top-1/2 -translate-y-1/2 right-0 group-hover:bg-indigo-400 transition" />
        </div>
      )}
    </aside>
  );
};
