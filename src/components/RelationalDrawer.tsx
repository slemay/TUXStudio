import React, { useState } from 'react';
import {
  X,
  Link2,
  Box,
  ChevronRight,
  Search,
  Copy,
  Check,
  Network,
  ListFilter,
  User,
  Building,
  Briefcase,
  MapPin,
  Building2,
} from 'lucide-react';
import type { EntityDetailResponse, ConnectedRelationship } from '../types';

interface RelationalDrawerProps {
  entityDetail: EntityDetailResponse | null;
  isLoading: boolean;
  onClose: () => void;
  onTraverse: (alias: string) => void;
  breadcrumbStack: string[];
  onBreadcrumbClick: (index: number) => void;
}

export const RelationalDrawer: React.FC<RelationalDrawerProps> = ({
  entityDetail,
  isLoading,
  onClose,
  onTraverse,
  breadcrumbStack,
  onBreadcrumbClick,
}) => {
  const [activeTab, setActiveTab] = useState<'attributes' | 'relationships' | 'graph'>('relationships');
  const [propFilter, setPropFilter] = useState('');
  const [copied, setCopied] = useState(false);

  // Drawer Width Resizing State with Persistence
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    const saved = localStorage.getItem('tuxdb_drawer_width');
    return saved ? Math.max(320, Math.min(1000, Number(saved))) : 480;
  });
  const [isResizingDrawer, setIsResizingDrawer] = useState(false);

  const startResizeDrawer = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingDrawer(true);

    const startX = e.clientX;
    const startW = drawerWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX; // Dragging left increases width
      const newWidth = Math.max(320, Math.min(1000, startW + delta));
      setDrawerWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsResizingDrawer(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      setDrawerWidth((w) => {
        localStorage.setItem('tuxdb_drawer_width', String(w));
        return w;
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Group relationships by type
  const groupedRelationships = React.useMemo(() => {
    if (!entityDetail) return {};
    const groups: Record<string, ConnectedRelationship[]> = {};
    for (const rel of entityDetail.relationships) {
      if (!groups[rel.relationship_type]) {
        groups[rel.relationship_type] = [];
      }
      groups[rel.relationship_type].push(rel);
    }
    return groups;
  }, [entityDetail]);

  if (!entityDetail && !isLoading) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const getTypeIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('person')) return <User className="w-3.5 h-3.5 text-indigo-400" />;
    if (t.includes('role')) return <Briefcase className="w-3.5 h-3.5 text-amber-400" />;
    if (t.includes('location')) return <MapPin className="w-3.5 h-3.5 text-emerald-400" />;
    if (t.includes('company')) return <Building2 className="w-3.5 h-3.5 text-violet-400" />;
    if (t.includes('organization')) return <Building className="w-3.5 h-3.5 text-purple-400" />;
    return <Box className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div
      style={{ width: `${drawerWidth}px`, maxWidth: '90vw' }}
      className="fixed inset-y-0 right-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex flex-col transition-all duration-75"
    >
      {/* Draggable Resizer Handle on Left Edge */}
      <div
        onMouseDown={startResizeDrawer}
        className={`absolute top-0 left-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-500 active:bg-indigo-600 transition-colors z-50 group ${
          isResizingDrawer ? 'bg-indigo-500' : 'bg-transparent hover:w-2'
        }`}
        title="Drag to resize inspector drawer"
      >
        <div className="h-8 w-1 bg-slate-400 dark:bg-slate-600 rounded-full mx-auto my-auto absolute top-1/2 -translate-y-1/2 left-0.5 group-hover:bg-white transition" />
      </div>
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center">
            {entityDetail ? getTypeIcon(entityDetail.type) : <Box className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
          </div>
          <div>
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              {entityDetail?.type || 'Entity Inspector'}
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[320px]">
              {entityDetail?.name || 'Loading...'}
            </h3>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Breadcrumb Navigation Bar */}
      {breadcrumbStack.length > 1 && (
        <div className="px-4 py-2 bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px] text-slate-600 dark:text-slate-400">
          <span className="text-slate-400 dark:text-slate-600 font-semibold uppercase text-[9px]">Path:</span>
          {breadcrumbStack.map((alias, idx) => {
            const isLast = idx === breadcrumbStack.length - 1;
            const shortAlias = alias.split(':').pop() || alias;
            return (
              <React.Fragment key={alias + idx}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-400 dark:text-slate-600 flex-shrink-0" />}
                <button
                  onClick={() => onBreadcrumbClick(idx)}
                  disabled={isLast}
                  className={`truncate max-w-[120px] font-mono px-1.5 py-0.5 rounded transition ${
                    isLast
                      ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 font-semibold'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title={alias}
                >
                  {shortAlias}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Primary Key / Alias Badge Bar */}
      {entityDetail && (
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-600 dark:text-slate-500 font-mono text-[11px]">Primary Key:</span>
            <span className="font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-transparent px-2 py-0.5 rounded text-[11px] truncate font-medium">
              {entityDetail.alias}
            </span>
          </div>
          <button
            onClick={() => handleCopy(entityDetail.alias)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-transparent hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] transition shadow-sm"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/40">
        <button
          onClick={() => setActiveTab('relationships')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === 'relationships'
              ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-indigo-500/5 shadow-sm'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>Relationships ({entityDetail?.total_relationships || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('attributes')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === 'attributes'
              ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-indigo-500/5 shadow-sm'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>All Properties</span>
        </button>
        <button
          onClick={() => setActiveTab('graph')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeTab === 'graph'
              ? 'border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-indigo-500/5 shadow-sm'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>Local Graph</span>
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block mb-2" />
            <p>Traversing graph relationships...</p>
          </div>
        ) : activeTab === 'relationships' ? (
          <div className="space-y-4">
            {Object.keys(groupedRelationships).length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No connected relationships found for this entity.
              </div>
            ) : (
              Object.entries(groupedRelationships).map(([relType, relList]) => (
                <div key={relType} className="bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                      {relType}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono">
                      {relList.length}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {relList.map((rel, i) => {
                      const cp = rel.counterpart;
                      return (
                        <div
                          key={i}
                          onClick={() => cp.alias && onTraverse(cp.alias)}
                          className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800/90 border border-slate-200 dark:border-slate-800/80 hover:border-indigo-400 dark:hover:border-indigo-500/40 shadow-sm cursor-pointer transition group"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-600/20 text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                              {getTypeIcon(cp.type)}
                            </div>
                            <div className="truncate text-left">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-white truncate">
                                {cp.name}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-500 font-mono truncate">{cp.alias}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 text-xs flex-shrink-0">
                            <span className="text-[10px] font-medium hidden group-hover:inline">
                              Traverse
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'attributes' ? (
          <div className="space-y-3">
            {/* Property Filter Input */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Filter properties..."
                value={propFilter}
                onChange={(e) => setPropFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none w-full"
              />
            </div>

            {/* Properties List */}
            <div className="space-y-1.5">
              {Object.entries(entityDetail?.entity || {})
                .filter(([k]) => k.toLowerCase().includes(propFilter.toLowerCase()))
                .map(([key, val]) => (
                  <div
                    key={key}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col gap-1 text-xs"
                  >
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{key.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-slate-900 dark:text-slate-200 break-words select-text">
                      {val !== null && val !== undefined && val !== '' ? String(val) : '—'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          /* Mini Local Graph View */
          <div className="flex flex-col items-center justify-center p-4 text-center space-y-4">
            <div className="w-full bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center justify-center shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-600/20 border-2 border-indigo-400 dark:border-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-4">
                {entityDetail && getTypeIcon(entityDetail.type)}
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{entityDetail?.name}</h4>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono mb-4">{entityDetail?.alias}</span>

              <div className="w-full border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-2">Connected Neighborhood:</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {entityDetail?.relationships.map((rel, idx) => (
                    <button
                      key={idx}
                      onClick={() => rel.counterpart.alias && onTraverse(rel.counterpart.alias)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-indigo-500 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-[11px] flex items-center gap-1.5 transition shadow-sm"
                    >
                      {getTypeIcon(rel.counterpart.type)}
                      <span className="truncate max-w-[120px]">{rel.counterpart.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
