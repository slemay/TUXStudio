import { useState, useEffect, useCallback } from 'react';
import {
  fetchPayloads,
  fetchPayloadTypes,
  fetchTableData,
  fetchEntityDetail,
  fetchMetamodelGraph,
  clearDataset,
  switchPayload,
} from './api';
import type {
  PayloadInfo,
  PayloadTypesResponse,
  TableDataResponse,
  EntityDetailResponse,
  MetamodelGraphResponse,
} from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DataGrid } from './components/DataGrid';
import { RelationalDrawer } from './components/RelationalDrawer';
import { MetamodelGraph } from './components/MetamodelGraph';
import { UploadModal } from './components/UploadModal';
import { PayloadSummaryView } from './components/PayloadSummaryView';
import { EmptyUploadState } from './components/EmptyUploadState';

export function App() {
  // Global State with LocalStorage Persistence on Refresh
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('tux_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    localStorage.setItem('tux_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [payloads, setPayloads] = useState<PayloadInfo[]>([]);
  const [activePayloadId, setActivePayloadId] = useState<string>(() => {
    return localStorage.getItem('tuxdb_active_payload') || '';
  });
  const [activeView, setActiveView] = useState<'table' | 'graph' | 'summary'>(() => {
    const saved = localStorage.getItem('tuxdb_active_view');
    return saved === 'table' || saved === 'graph' || saved === 'summary' ? saved : 'table';
  });
  const [activeTable, setActiveTable] = useState<string>(() => {
    return localStorage.getItem('tuxdb_active_table') || '';
  });

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Schema & Types State
  const [typesData, setTypesData] = useState<PayloadTypesResponse | null>(null);

  // Table Data State
  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  // Relational Inspector & Breadcrumbs State
  const [selectedAlias, setSelectedAlias] = useState<string | null>(null);
  const [entityDetail, setEntityDetail] = useState<EntityDetailResponse | null>(null);
  const [isEntityLoading, setIsEntityLoading] = useState(false);
  const [breadcrumbStack, setBreadcrumbStack] = useState<string[]>([]);

  // Metamodel Graph State
  const [graphData, setGraphData] = useState<MetamodelGraphResponse | null>(null);
  const [isGraphLoading, setIsGraphLoading] = useState(false);

  // Left Sidebar Resizing State
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('tuxdb_sidebar_width');
    return saved ? Math.max(180, Math.min(700, Number(saved))) : 288;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const startResizingSidebar = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizingSidebar(true);

      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const newWidth = Math.max(180, Math.min(700, startWidth + deltaX));
        setSidebarWidth(newWidth);
      };

      const onMouseUp = () => {
        setIsResizingSidebar(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        setSidebarWidth((w) => {
          localStorage.setItem('tuxdb_sidebar_width', String(w));
          return w;
        });
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [sidebarWidth]
  );

  // 1. Load Payloads on mount
  const loadPayloads = useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await fetchPayloads();
      setPayloads(list);
      if (list.length > 0 && !list.some((p) => p.id === activePayloadId)) {
        setActivePayloadId(list[0].id);
        localStorage.setItem('tuxdb_active_payload', list[0].id);
      }
    } catch (err) {
      console.error('Failed to load payloads:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activePayloadId]);

  useEffect(() => {
    loadPayloads();
  }, [loadPayloads]);

  // 2. Load Types when Active Payload changes
  const loadTypes = useCallback(async () => {
    if (!activePayloadId) return;
    try {
      setIsLoading(true);
      const res = await fetchPayloadTypes(activePayloadId);
      setTypesData(res);
      // Select first component or relationship table if activeTable is invalid or unset
      const allTables = [
        ...res.component_types.map((c) => c.table_name),
        ...res.relationship_types.map((r) => r.table_name),
      ];
      if (!activeTable || !allTables.includes(activeTable)) {
        if (res.component_types.length > 0) {
          const defaultTbl = res.component_types[0].table_name;
          setActiveTable(defaultTbl);
          localStorage.setItem('tuxdb_active_table', defaultTbl);
        } else if (res.relationship_types.length > 0) {
          const defaultTbl = res.relationship_types[0].table_name;
          setActiveTable(defaultTbl);
          localStorage.setItem('tuxdb_active_table', defaultTbl);
        }
      }
    } catch (err) {
      console.error('Failed to load payload types:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activePayloadId, activeTable]);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = useCallback(async (newId?: string) => {
    setIsLoading(true);
    try {
      const list = await fetchPayloads();
      setPayloads(list);
      const targetId = newId || (list.length > 0 ? list[0].id : '');
      if (targetId) {
        setActivePayloadId(targetId);
        localStorage.setItem('tuxdb_active_payload', targetId);
        const res = await fetchPayloadTypes(targetId);
        setTypesData(res);
        if (res.component_types.length > 0) {
          const firstTbl = res.component_types[0].table_name;
          setActiveTable(firstTbl);
          localStorage.setItem('tuxdb_active_table', firstTbl);
        } else if (res.relationship_types.length > 0) {
          const firstTbl = res.relationship_types[0].table_name;
          setActiveTable(firstTbl);
          localStorage.setItem('tuxdb_active_table', firstTbl);
        }
      }
      setSelectedAlias(null);
      setEntityDetail(null);
      setBreadcrumbStack([]);
      setPage(1);
      setSearchQuery('');
      setSortBy(undefined);
      setActiveView('table');
      localStorage.setItem('tuxdb_active_view', 'table');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Failed to complete upload processing:', err);
    } finally {
      setIsLoading(false);
      setIsUploadOpen(false);
    }
  }, []);

  // 3. Load Table Data with race condition prevention and request cancellation
  useEffect(() => {
    if (activeView !== 'table' || !activePayloadId || !activeTable) return;

    const controller = new AbortController();
    setIsLoading(true);

    fetchTableData(
      activePayloadId,
      activeTable,
      page,
      pageSize,
      searchQuery,
      sortBy,
      sortOrder,
      controller.signal
    )
      .then((res) => {
        if (res.table_name === activeTable) {
          setTableData(res);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Failed to load table data:', err);
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [activePayloadId, activeTable, page, pageSize, searchQuery, sortBy, sortOrder, activeView, refreshKey]);

  // 4. Load Metamodel Graph when switching to graph view
  useEffect(() => {
    if (activeView === 'graph' && activePayloadId) {
      setIsGraphLoading(true);
      fetchMetamodelGraph(activePayloadId)
        .then((res) => setGraphData(res))
        .catch((err) => console.error('Failed to fetch metamodel graph:', err))
        .finally(() => setIsGraphLoading(false));
    }
  }, [activeView, activePayloadId]);

  // 5. Select Entity & Inspect Relational Graph
  const handleSelectEntity = useCallback(
    async (alias: string) => {
      setSelectedAlias(alias);
      setBreadcrumbStack([alias]);
      setIsEntityLoading(true);
      try {
        const detail = await fetchEntityDetail(activePayloadId, alias);
        setEntityDetail(detail);
      } catch (err) {
        console.error('Failed to fetch entity detail:', err);
      } finally {
        setIsEntityLoading(false);
      }
    },
    [activePayloadId]
  );

  // 6. Traverse to related entity (pushes to breadcrumb stack)
  const handleTraverse = useCallback(
    async (targetAlias: string) => {
      setSelectedAlias(targetAlias);
      setBreadcrumbStack((prev) => [...prev, targetAlias]);
      setIsEntityLoading(true);
      try {
        const detail = await fetchEntityDetail(activePayloadId, targetAlias);
        setEntityDetail(detail);
      } catch (err) {
        console.error('Failed to traverse to entity:', err);
      } finally {
        setIsEntityLoading(false);
      }
    },
    [activePayloadId]
  );

  // 7. Click breadcrumb step
  const handleBreadcrumbClick = useCallback(
    async (index: number) => {
      const targetAlias = breadcrumbStack[index];
      const newStack = breadcrumbStack.slice(0, index + 1);
      setBreadcrumbStack(newStack);
      setSelectedAlias(targetAlias);
      setIsEntityLoading(true);
      try {
        const detail = await fetchEntityDetail(activePayloadId, targetAlias);
        setEntityDetail(detail);
      } catch (err) {
        console.error('Failed to fetch entity from breadcrumb:', err);
      } finally {
        setIsEntityLoading(false);
      }
    },
    [activePayloadId, breadcrumbStack]
  );

  const handleSelectTable = (tblName: string) => {
    if (tblName === activeTable && activeView === 'table') return;
    setTableData(null);
    setActiveTable(tblName);
    localStorage.setItem('tuxdb_active_table', tblName);
    setPage(1);
    setSearchQuery('');
    setSortBy(undefined);
    if (activeView !== 'table') {
      handleChangeView('table');
    }
  };

  const handleChangeView = (view: 'table' | 'graph' | 'summary') => {
    setActiveView(view);
    localStorage.setItem('tuxdb_active_view', view);
  };

  const handleSelectPayload = async (id: string) => {
    if (!id) return;
    try {
      setIsLoading(true);
      setActivePayloadId(id);
      localStorage.setItem('tuxdb_active_payload', id);
      const res = await switchPayload(id);
      if (res && res.types_data) {
        setTypesData(res.types_data);
        if (res.types_data.component_types.length > 0) {
          const firstTbl = res.types_data.component_types[0].table_name;
          setActiveTable(firstTbl);
          localStorage.setItem('tuxdb_active_table', firstTbl);
        } else if (res.types_data.relationship_types.length > 0) {
          const firstTbl = res.types_data.relationship_types[0].table_name;
          setActiveTable(firstTbl);
          localStorage.setItem('tuxdb_active_table', firstTbl);
        }
      }
      setSelectedAlias(null);
      setEntityDetail(null);
      setBreadcrumbStack([]);
      setPage(1);
      setSearchQuery('');
      setSortBy(undefined);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('Failed to switch dataset:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearDataset = async () => {
    const toClearId = activePayloadId;
    if (!toClearId) return;

    try {
      setIsLoading(true);
      // Immediately reset React state to clear the active view without waiting
      setActivePayloadId('');
      setActiveTable('');
      setTypesData(null);
      setTableData(null);
      setGraphData(null);
      setSelectedAlias(null);
      setEntityDetail(null);
      setBreadcrumbStack([]);
      localStorage.removeItem('tuxdb_active_payload');
      localStorage.removeItem('tuxdb_active_table');

      await clearDataset(toClearId);
      const remaining = await fetchPayloads();
      setPayloads(remaining);

      if (remaining.length > 0) {
        const nextId = remaining[0].id;
        await handleSelectPayload(nextId);
      } else {
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      console.error('Failed to clear dataset:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSortChange = (col: string) => {
    const currentSortCol = sortBy || tableData?.sort_by;
    const currentSortOrder = tableData?.sort_by === col ? (tableData?.sort_order || sortOrder) : sortOrder;
    if (currentSortCol === col) {
      setSortOrder(currentSortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(col);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  return (
    <div className="h-screen max-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans overflow-hidden select-none transition-colors duration-150">
      {/* Top Header */}
      <Header
        payloads={payloads}
        activePayloadId={activePayloadId}
        onSelectPayload={handleSelectPayload}
        activeView={activeView}
        onChangeView={handleChangeView}
        onOpenUpload={() => setIsUploadOpen(true)}
        onClearDataset={handleClearDataset}
        isLoading={isLoading}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onRefresh={() => {
          loadPayloads();
          loadTypes();
          if (activeView === 'table') setRefreshKey((k) => k + 1);
          if (activeView === 'graph') {
            setIsGraphLoading(true);
            fetchMetamodelGraph(activePayloadId)
              .then((res) => setGraphData(res))
              .finally(() => setIsGraphLoading(false));
          }
        }}
      />

      {/* Main Workspace Layout (Fixed-Height Split View) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar (Pinned Entity Types List) */}
        {activePayloadId && activeView === 'table' && typesData && (
          <Sidebar
            componentTypes={typesData.component_types}
            relationshipTypes={typesData.relationship_types}
            activeTable={activeTable}
            onSelectTable={handleSelectTable}
            totalComponents={typesData.total_components}
            totalRelationships={typesData.total_relationships}
            width={sidebarWidth}
            onStartResize={startResizingSidebar}
            isResizing={isResizingSidebar}
          />
        )}

        {/* Center Main Content Area (Independent Right Pane) */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 relative">
          {!activePayloadId || payloads.length === 0 ? (
            <EmptyUploadState onUploadSuccess={handleUploadSuccess} />
          ) : (
            <>
              {activeView === 'table' && (
                <DataGrid
                  key={activeTable}
                  tableData={tableData}
                  isLoading={isLoading}
                  onPageChange={setPage}
                  onPageSizeChange={(sz) => {
                    setPageSize(sz);
                    setPage(1);
                  }}
                  onSearchChange={(q) => {
                    setSearchQuery(q);
                    setPage(1);
                  }}
                  onSortChange={handleSortChange}
                  onSelectEntity={handleSelectEntity}
                  activeEntityAlias={selectedAlias || undefined}
                  sortBy={sortBy || tableData?.sort_by}
                  sortOrder={tableData?.sort_order || sortOrder}
                />
              )}

              {activeView === 'graph' && (
                <MetamodelGraph
                  graphData={graphData}
                  isLoading={isGraphLoading}
                  payloadId={activePayloadId}
                  onSelectComponentType={(tableName) => {
                    handleSelectTable(tableName);
                  }}
                />
              )}

              {activeView === 'summary' && (
                <PayloadSummaryView
                  typesData={typesData}
                  onSelectTable={(tbl) => {
                    handleSelectTable(tbl);
                  }}
                />
              )}

              {/* Slide-over Relational Drawer */}
              {selectedAlias && (
                <RelationalDrawer
                  entityDetail={entityDetail}
                  isLoading={isEntityLoading}
                  onClose={() => {
                    setSelectedAlias(null);
                    setEntityDetail(null);
                    setBreadcrumbStack([]);
                  }}
                  onTraverse={handleTraverse}
                  breadcrumbStack={breadcrumbStack}
                  onBreadcrumbClick={handleBreadcrumbClick}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}

export default App;
