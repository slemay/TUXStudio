import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Box,
  Link2,
} from 'lucide-react';
import type { TableDataResponse } from '../types';

interface DataGridProps {
  tableData: TableDataResponse | null;
  isLoading: boolean;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (column: string) => void;
  onSelectEntity: (alias: string) => void;
  activeEntityAlias?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const DataGrid: React.FC<DataGridProps> = ({
  tableData,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onSortChange,
  onSelectEntity,
  activeEntityAlias,
  sortBy,
  sortOrder,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [copiedAlias, setCopiedAlias] = useState<string | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Per-table Column Visibility to prevent column leakage between tables
  const [visibleColumnsByTable, setVisibleColumnsByTable] = useState<Record<string, string[]>>({});

  // Per-table Column Widths State with Persistence
  const [columnWidthsByTable, setColumnWidthsByTable] = useState<Record<string, Record<string, number>>>({});
  const [resizingCol, setResizingCol] = useState<string | null>(null);

  const currentTableName = tableData?.table_name || '';

  const isRelationship = tableData?.is_relationship ?? (
    tableData ? (tableData.columns.includes('comp1_alias') && tableData.columns.includes('comp2_alias')) : false
  );

  // Load saved column widths when table changes
  React.useEffect(() => {
    if (currentTableName && !columnWidthsByTable[currentTableName]) {
      try {
        const saved = localStorage.getItem(`tuxdb_col_widths_${currentTableName}`);
        if (saved) {
          setColumnWidthsByTable((prev) => ({
            ...prev,
            [currentTableName]: JSON.parse(saved),
          }));
        }
      } catch {
        // ignore
      }
    }
  }, [currentTableName]);

  // Reset search input on table switch
  React.useEffect(() => {
    setSearchInput('');
  }, [currentTableName]);

  // Determine active visible columns for current table
  const displayColumns = useMemo(() => {
    if (!tableData?.columns || !currentTableName) return [];
    const savedCols = visibleColumnsByTable[currentTableName];
    if (savedCols && savedCols.length > 0) {
      const valid = tableData.columns.filter((c) => savedCols.includes(c));
      if (valid.length > 0) return valid;
    }
    // Default: first 10 columns of the current table
    return tableData.columns.slice(0, 10);
  }, [tableData?.columns, currentTableName, visibleColumnsByTable]);

  const toggleColumn = (col: string) => {
    if (!tableData?.columns || !currentTableName) return;
    const current = new Set(displayColumns);
    if (current.has(col)) {
      if (current.size > 1) current.delete(col);
    } else {
      current.add(col);
    }
    const nextArr = tableData.columns.filter((c) => current.has(c));
    setVisibleColumnsByTable((prev) => ({
      ...prev,
      [currentTableName]: nextArr,
    }));
  };

  const getColWidth = (col: string): number => {
    const lower = col.toLowerCase();
    if (lower === 'id') return 64;
    const tableWidths = columnWidthsByTable[currentTableName] || {};
    if (tableWidths[col]) return tableWidths[col];
    if (lower === 'alias' || lower === 'comp1_alias' || lower === 'comp2_alias') return 200;
    if (lower === 'name') return 200;
    if (lower === 'type') return 150;
    if (lower.includes('email')) return 220;
    if (lower.includes('date') || lower.includes('status') || lower.includes('code')) return 140;
    return 170;
  };

  const startResizeCol = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(col);

    const startX = e.clientX;
    const initialWidth = getColWidth(col);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(70, Math.min(900, initialWidth + delta));
      setColumnWidthsByTable((prev) => {
        const currentTableW = prev[currentTableName] || {};
        return {
          ...prev,
          [currentTableName]: {
            ...currentTableW,
            [col]: newWidth,
          },
        };
      });
    };

    const onMouseUp = () => {
      setResizingCol(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setColumnWidthsByTable((prev) => {
        if (currentTableName) {
          localStorage.setItem(
            `tuxdb_col_widths_${currentTableName}`,
            JSON.stringify(prev[currentTableName] || {})
          );
        }
        return prev;
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedAlias(text);
    setTimeout(() => setCopiedAlias(null), 1500);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(searchInput);
  };

  if (!tableData) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        Select an entity type to view data
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-white dark:bg-slate-900/60 flex-shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              {isRelationship ? (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <Link2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Relationship
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
                  <Box className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  Component
                </span>
              )}

              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {tableData.table_name.replace(/_/g, ' ')}
              </h2>

              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                {tableData.total_rows.toLocaleString()} {isRelationship ? 'records' : 'entities'}
              </span>

              {tableData.sort_by && (
                <div className="hidden sm:flex items-center gap-1 text-[11px] bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md">
                  <span className="text-slate-500 dark:text-slate-400">Sorted:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {tableData.sort_by === 'id' ? '#' : tableData.sort_by.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">({tableData.sort_order})</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isRelationship
                ? 'Each row represents 1 relationship link between comp1 and comp2.'
                : 'Each row represents 1 unique component entity with its direct properties.'}
            </p>
          </div>
        </div>

        {/* Search & Column Controls */}
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search table... (Press Enter)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64 transition"
            />
          </form>

          {/* Column Visibility Picker Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition"
            >
              <Columns className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Columns ({displayColumns.length}/{tableData.columns.length})</span>
            </button>

            {showColumnPicker && (
              <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 z-50 space-y-1">
                <div className="flex items-center justify-between px-2 py-1 border-b border-slate-200 dark:border-slate-800 mb-1">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Toggle Columns
                  </span>
                  <button
                    onClick={() => {
                      if (currentTableName) {
                        setColumnWidthsByTable((prev) => {
                          const next = { ...prev };
                          delete next[currentTableName];
                          return next;
                        });
                        localStorage.removeItem(`tuxdb_col_widths_${currentTableName}`);
                      }
                    }}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                    title="Reset all column widths to defaults"
                  >
                    Reset Widths
                  </button>
                </div>
                {tableData.columns.map((col) => (
                  <label
                    key={col}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={displayColumns.includes(col)}
                      onChange={() => toggleColumn(col)}
                      className="rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span className="truncate">{col === 'id' ? '#' : col.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto relative min-h-0">
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center z-20">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-xs text-slate-800 dark:text-slate-300">
              <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Loading records...
            </div>
          </div>
        )}

        <table
          className="text-left border-collapse text-xs"
          style={{ tableLayout: 'fixed', minWidth: 'max-content', width: '100%' }}
        >
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 z-10 select-none shadow-sm">
            <tr>
              {!isRelationship && (() => {
                const isSorted = (sortBy || tableData.sort_by) === 'rowid' || (sortBy || tableData.sort_by) === '_rowid';
                const activeSortOrder = isSorted ? (tableData.sort_by === 'rowid' || tableData.sort_by === '_rowid' ? tableData.sort_order : (sortOrder || 'ASC')) : 'ASC';

                return (
                  <th
                    style={{ width: '64px', minWidth: '64px', maxWidth: '64px' }}
                    onClick={() => onSortChange('rowid')}
                    title={`Click to sort by # (${isSorted && activeSortOrder === 'ASC' ? 'DESC' : 'ASC'})`}
                    className={`relative p-3 cursor-pointer transition select-none group/th text-center ${
                      isSorted
                        ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-200 border-b-2 border-indigo-500 dark:border-indigo-400 font-bold'
                        : 'hover:bg-slate-200/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-400 font-semibold'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>#</span>
                      {isSorted ? (
                        activeSortOrder === 'ASC' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 stroke-[2.5] flex-shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 stroke-[2.5] flex-shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 opacity-0 group-hover/th:opacity-100 transition flex-shrink-0" />
                      )}
                    </div>
                  </th>
                );
              })()}
              {displayColumns.map((col) => {
                const activeSortCol = sortBy || tableData.sort_by;
                const activeSortOrder = tableData.sort_by === col ? tableData.sort_order : (sortOrder || 'ASC');
                const isResizable = col !== 'id';
                const isSorted = activeSortCol === col;
                const colWidth = getColWidth(col);
                const headerLabel = col === 'id' ? '#' : col.replace(/_/g, ' ');

                return (
                  <th
                    key={col}
                    style={{
                      width: `${colWidth}px`,
                      minWidth: `${colWidth}px`,
                      maxWidth: `${colWidth}px`,
                    }}
                    onClick={() => onSortChange(col)}
                    title={`Click to sort by ${headerLabel} (${isSorted && activeSortOrder === 'ASC' ? 'DESC' : 'ASC'}) • Drag right border to resize`}
                    className={`relative p-3 cursor-pointer transition select-none group/th ${
                      isSorted
                        ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-200 border-b-2 border-indigo-500 dark:border-indigo-400 font-bold'
                        : 'hover:bg-slate-200/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 ${col === 'id' ? 'justify-center pr-1' : 'pr-3 overflow-hidden'}`}>
                      <span className="truncate">{headerLabel}</span>
                      {isSorted ? (
                        activeSortOrder === 'ASC' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 stroke-[2.5] flex-shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 stroke-[2.5] flex-shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 opacity-0 group-hover/th:opacity-100 transition flex-shrink-0" />
                      )}
                    </div>

                    {/* Draggable Column Resizer Handle (Disabled on # / id column) */}
                    {isResizable && (
                      <div
                        onMouseDown={(e) => startResizeCol(col, e)}
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-500 active:bg-indigo-600 transition-colors z-20 group/resizer ${
                          resizingCol === col ? 'bg-indigo-500 w-2' : 'bg-transparent hover:w-2'
                        }`}
                        title="Drag to resize column"
                      >
                        <div className="h-4 w-0.5 bg-slate-300 dark:bg-slate-700 mx-auto my-auto absolute top-1/2 -translate-y-1/2 right-0.5 group-hover/resizer:bg-white transition" />
                      </div>
                    )}
                  </th>
                );
              })}
              <th
                style={{ width: '64px', minWidth: '64px', maxWidth: '64px' }}
                className="p-3 text-center"
              >
                Inspect
              </th>
            </tr>
          </thead>
          <tbody key={`${tableData.table_name}_page_${tableData.page}`} className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {tableData.data.map((row, idx) => {
              const rowAlias = row.alias || row.comp1_alias || row.id;
              const isSelected = activeEntityAlias === rowAlias;
              const rowNum = row._rowid ?? row.id ?? ((tableData.page - 1) * tableData.page_size + idx + 1);

              return (
                <tr
                  key={`${tableData.table_name}_row_${rowAlias || idx}_${idx}`}
                  onClick={() => row.alias && onSelectEntity(row.alias)}
                  className={`cursor-pointer transition group ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-600/15 text-indigo-900 dark:text-indigo-200 font-medium'
                      : 'hover:bg-indigo-50/40 dark:hover:bg-slate-900/80 text-slate-800 dark:text-slate-300'
                  }`}
                >
                  {!isRelationship && (
                    <td
                      style={{ width: '64px', minWidth: '64px', maxWidth: '64px' }}
                      className="p-3 text-center text-slate-400 dark:text-slate-600 font-mono text-[11px]"
                    >
                      {rowNum}
                    </td>
                  )}
                  {displayColumns.map((col) => {
                    const val = row[col];
                    const isAliasCol = col === 'alias' || col === 'comp1_alias' || col === 'comp2_alias';
                    const colWidth = getColWidth(col);

                    return (
                      <td
                        key={col}
                        style={{
                          width: `${colWidth}px`,
                          minWidth: `${colWidth}px`,
                          maxWidth: `${colWidth}px`,
                        }}
                        className={`p-3 truncate overflow-hidden ${col === 'id' ? 'text-center font-mono text-[11px] text-slate-400 dark:text-slate-600' : ''}`}
                      >
                        {col === 'id' ? (
                          <span className="font-mono text-slate-400 dark:text-slate-600 text-[11px]">{val}</span>
                        ) : isAliasCol && val ? (
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="font-mono text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded text-[11px] truncate font-medium">
                              {String(val)}
                            </span>
                            <button
                              onClick={(e) => handleCopy(e, String(val))}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded transition flex-shrink-0"
                              title="Copy alias"
                            >
                              {copiedAlias === String(val) ? (
                                <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : col.toLowerCase().includes('status') && val ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium inline-block truncate ${
                              val === 'Active'
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                : val === 'Terminated'
                                ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                            }`}
                          >
                            {String(val)}
                          </span>
                        ) : (
                          <span className="truncate block">{val !== null && val !== undefined ? String(val) : '—'}</span>
                        )}
                      </td>
                    );
                  })}
                  <td
                    style={{ width: '64px', minWidth: '64px', maxWidth: '64px' }}
                    className="p-3 text-center"
                  >
                    {row.alias && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEntity(row.alias);
                        }}
                        className="p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200 transition"
                        title="Inspect Relational Links"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {tableData.data.length === 0 && !isLoading && (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
            No matching records found.
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 flex-shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <span>
            Page <span className="font-semibold text-slate-900 dark:text-slate-200">{tableData.page}</span> of{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-200">{tableData.total_pages}</span>
          </span>
          <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-3">
            <span>Show</span>
            <select
              value={tableData.page_size}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-200 outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
            <span>rows per page</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={tableData.page <= 1}
            onClick={() => onPageChange(tableData.page - 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 font-medium transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>
          <button
            disabled={tableData.page >= tableData.total_pages}
            onClick={() => onPageChange(tableData.page + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 font-medium transition"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
