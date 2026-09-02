import type {
  PayloadInfo,
  PayloadTypesResponse,
  TableDataResponse,
  EntityDetailResponse,
  MetamodelGraphResponse,
  NeighborhoodGraphResponse,
} from './types';
import type { WorkerProgressMessage } from './workers/tuxWorker';

let worker: Worker | null = null;
let msgId = 0;
const pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();
const progressListeners = new Set<(progress: WorkerProgressMessage) => void>();

export function getTuxWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./workers/tuxWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'PROGRESS') {
        progressListeners.forEach((listener) => listener(data));
        return;
      }
      if (data.type === 'READY') {
        // Broadcast ready
        return;
      }
      if (data.id !== undefined) {
        const req = pendingRequests.get(data.id);
        if (req) {
          pendingRequests.delete(data.id);
          if (data.success) {
            req.resolve(data.data);
          } else {
            req.reject(new Error(data.error));
          }
        }
      }
    };
  }
  return worker;
}

function callWorker<T>(action: string, payload?: any): Promise<T> {
  const w = getTuxWorker();
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    w.postMessage({ id, action, payload });
  });
}

export async function uploadTuxPayload(
  file: File | Blob,
  filename: string,
  onProgress?: (progress: WorkerProgressMessage) => void
): Promise<{ payload_info: PayloadInfo; types_data: PayloadTypesResponse }> {
  let unsubscribe: (() => void) | null = null;
  if (onProgress) {
    const listener = (progress: WorkerProgressMessage) => {
      onProgress(progress);
    };
    progressListeners.add(listener);
    unsubscribe = () => progressListeners.delete(listener);
  }

  try {
    return await callWorker<{ payload_info: PayloadInfo; types_data: PayloadTypesResponse }>('INGEST_FILE', {
      file,
      filename,
    });
  } finally {
    if (unsubscribe) {
      unsubscribe();
    }
  }
}

export async function fetchPayloads(): Promise<{ payloads: PayloadInfo[] }> {
  return callWorker<{ payloads: PayloadInfo[] }>('GET_PAYLOADS');
}

export async function fetchPayloadTypes(_payloadId: string): Promise<PayloadTypesResponse> {
  return callWorker<PayloadTypesResponse>('GET_PAYLOAD_TYPES');
}

export async function fetchTableData(
  _payloadId: string,
  tableName: string,
  page: number = 1,
  pageSize: number = 50,
  search: string = '',
  sortBy?: string,
  sortOrder: string = 'ASC',
  _signal?: AbortSignal
): Promise<TableDataResponse> {
  return callWorker<TableDataResponse>('GET_TABLE_DATA', {
    tableName,
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
  });
}

export async function fetchEntityDetail(
  _payloadId: string,
  alias: string
): Promise<EntityDetailResponse> {
  return callWorker<EntityDetailResponse>('GET_ENTITY_DETAIL', { alias });
}

export async function fetchMetamodelGraph(
  _payloadId: string
): Promise<MetamodelGraphResponse> {
  return callWorker<MetamodelGraphResponse>('GET_METAMODEL_GRAPH');
}

export async function fetchNeighborhoodGraph(
  _payloadId: string,
  alias: string,
  depth: number = 1
): Promise<NeighborhoodGraphResponse> {
  return callWorker<NeighborhoodGraphResponse>('GET_NEIGHBORHOOD_GRAPH', { alias, depth });
}

export async function exportSqlite(filename: string = 'tuxdb_export.db'): Promise<void> {
  const binary = await callWorker<Uint8Array>('EXPORT_SQLITE');
  const blob = new Blob([new Uint8Array(binary)], { type: 'application/x-sqlite3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.db') ? filename : `${filename}.db`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportCsvZip(filename: string = 'tuxdb_csv_bundle.zip'): Promise<void> {
  const blob = await callWorker<Blob>('EXPORT_CSV_ZIP');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
