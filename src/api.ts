import type {
  PayloadInfo,
  PayloadTypesResponse,
  TableDataResponse,
  EntityDetailResponse,
  MetamodelGraphResponse,
  NeighborhoodGraphResponse,
  UploadProgressInfo,
} from './types';
import * as clientDb from './clientDb';

export async function fetchPayloads(): Promise<PayloadInfo[]> {
  const res = await clientDb.fetchPayloads();
  return res.payloads;
}

export async function uploadTuxFile(file: File, _datasetName?: string): Promise<any> {
  const result = await clientDb.uploadTuxPayload(file, file.name);
  return result;
}

export async function uploadTuxFileWithProgress(
  file: File,
  _datasetName: string | undefined,
  onProgress: (progress: UploadProgressInfo) => void
): Promise<any> {
  const result = await clientDb.uploadTuxPayload(file, file.name, (p) => {
    onProgress({
      stage: p.stage,
      stage_name:
        p.stage === 'ingest'
          ? 'Pass 1/2: Streaming Ingestion'
          : p.stage === 'indexing'
          ? 'Pass 2/2: Building B-Tree Indexes'
          : 'Ready',
      percent: p.percent,
      message: p.message,
      components_ingested: p.components_ingested,
      relationships_ingested: p.relationships_ingested,
      bytes_processed: p.bytes_processed,
      total_bytes: p.total_bytes,
      conversion_time_seconds: p.elapsed_seconds,
    });
  });

  return {
    status: 'success',
    payload_id: result.payload_info.id,
    components_ingested: result.payload_info.total_components,
    relationships_ingested: result.payload_info.total_relationships,
    conversion_time_seconds: (result.payload_info as any).elapsed_seconds || 1,
    table_count: result.payload_info.total_tables,
  };
}

export async function fetchPayloadTypes(payloadId: string): Promise<PayloadTypesResponse> {
  return clientDb.fetchPayloadTypes(payloadId);
}

export async function fetchTableData(
  payloadId: string,
  tableName: string,
  page = 1,
  pageSize = 50,
  search?: string,
  sortBy?: string,
  sortOrder?: 'ASC' | 'DESC',
  signal?: AbortSignal
): Promise<TableDataResponse> {
  return clientDb.fetchTableData(payloadId, tableName, page, pageSize, search, sortBy, sortOrder, signal);
}

export async function fetchEntityDetail(payloadId: string, alias: string): Promise<EntityDetailResponse> {
  return clientDb.fetchEntityDetail(payloadId, alias);
}

export async function fetchMetamodelGraph(payloadId: string): Promise<MetamodelGraphResponse> {
  return clientDb.fetchMetamodelGraph(payloadId);
}

export async function fetchNeighborhoodGraph(
  payloadId: string,
  alias: string,
  depth = 1
): Promise<NeighborhoodGraphResponse> {
  return clientDb.fetchNeighborhoodGraph(payloadId, alias, depth);
}

export function getExportSqliteUrl(_payloadId: string): string {
  return '#export-sqlite';
}

export function getExportCsvZipUrl(_payloadId: string): string {
  return '#export-csv';
}

export async function triggerExportSqlite(filename?: string): Promise<void> {
  return clientDb.exportSqlite(filename);
}

export async function triggerExportCsvZip(filename?: string): Promise<void> {
  return clientDb.exportCsvZip(filename);
}

export async function clearDataset(_payloadId?: string): Promise<any> {
  return { status: 'success' };
}
