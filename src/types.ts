export interface PayloadInfo {
  id: string;
  filename: string;
  size_bytes: number;
  size_mb: number;
  last_modified: number;
  status: string;
  total_components?: number;
  total_relationships?: number;
  total_tables?: number;
}

export interface UploadProgressInfo {
  stage: string;
  stage_name?: string;
  percent: number;
  message: string;
  id?: string;
  filename?: string;
  dataset_name?: string;
  size_mb?: number;
  components_discovered?: number;
  relationships_discovered?: number;
  components_ingested?: number;
  relationships_ingested?: number;
  elements_parsed?: number;
  bytes_processed?: number;
  total_bytes?: number;
  conversion_time_seconds?: number;
  status?: string;
}

export interface TableTypeInfo {
  name: string;
  table_name: string;
  count: number;
  columns: string[];
  is_relationship: boolean;
}

export interface PayloadTypesResponse {
  payload_id: string;
  total_components: number;
  total_relationships: number;
  component_types: TableTypeInfo[];
  relationship_types: TableTypeInfo[];
}

export interface TableDataResponse {
  table_name: string;
  is_relationship?: boolean;
  page: number;
  page_size: number;
  total_rows: number;
  total_pages: number;
  columns: string[];
  sort_by: string;
  sort_order: 'ASC' | 'DESC';
  data: Record<string, any>[];
}

export interface EntityCounterpart {
  alias: string;
  name: string;
  type: string;
  table: string;
}

export interface ConnectedRelationship {
  relationship_type: string;
  relationship_table: string;
  direction: 'inbound' | 'outbound';
  is_source: boolean;
  comp1_alias: string;
  comp2_alias: string;
  counterpart: EntityCounterpart;
  properties: Record<string, any>;
}

export interface EntityDetailResponse {
  entity: Record<string, any>;
  table_name: string;
  type: string;
  alias: string;
  name: string;
  total_relationships: number;
  relationships: ConnectedRelationship[];
}

export interface MetamodelNode {
  id: string;
  label: string;
  stereotype?: string;
  count: number;
  properties: string[];
  uml_properties?: string[];
  uml_attributes?: string[];
}

export interface MetamodelEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  uml_name?: string;
  stereotype?: string;
  source_multiplicity?: string;
  target_multiplicity?: string;
  source_role?: string;
  target_role?: string;
  count: number;
}

export interface MetamodelGraphResponse {
  nodes: MetamodelNode[];
  edges: MetamodelEdge[];
}

export interface NeighborhoodNode {
  id: string;
  name: string;
  type: string;
  is_root: boolean;
}

export interface NeighborhoodEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface NeighborhoodGraphResponse {
  nodes: NeighborhoodNode[];
  edges: NeighborhoodEdge[];
}
