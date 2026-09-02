import initSqlJs, { type Database, type Statement } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import JSZip from 'jszip';

// =====================================================================
// Type Definitions & Helpers
// =====================================================================

export interface WorkerProgressMessage {
  type: 'PROGRESS';
  stage: 'init' | 'ingest' | 'indexing' | 'complete' | 'error';
  percent: number;
  message: string;
  components_ingested: number;
  relationships_ingested: number;
  bytes_processed: number;
  total_bytes: number;
  elapsed_seconds?: number;
}

export interface WorkerReadyMessage {
  type: 'READY';
  payload_info: {
    id: string;
    filename: string;
    size_bytes: number;
    size_mb: number;
    total_components: number;
    total_relationships: number;
    total_tables: number;
  };
  types_data: {
    component_types: Array<{ type: string; table_name: string; count: number; columns: string[] }>;
    relationship_types: Array<{ type: string; table_name: string; count: number; columns: string[] }>;
    total_components: number;
    total_relationships: number;
  };
}

let db: Database | null = null;
let currentPayloadInfo: any = null;
const tableColumns = new Map<string, Set<string>>();
const compTableMap = new Map<string, string>();
const relTableMap = new Map<string, string>();

function sanitizeIdentifier(name: string): string {
  if (!name) return '';
  return name.trim().replace(/ /g, '_').replace(/-/g, '_').replace(/\?/g, '').replace(/&/g, 'and').replace(/\./g, '_');
}

function decodeXmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function parseXmlAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = regex.exec(attrStr)) !== null) {
    attrs[match[1]] = decodeXmlEntities(match[2] !== undefined ? match[2] : match[3]);
  }
  return attrs;
}

// =====================================================================
// SQLite WASM Initialization
// =====================================================================

async function getOrInitDb(): Promise<Database> {
  if (db) return db;
  const SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl,
  });
  db = new SQL.Database();
  db.exec('PRAGMA synchronous = OFF; PRAGMA journal_mode = MEMORY;');
  return db;
}

// =====================================================================
// Streaming Ingestion Engine
// =====================================================================

async function ingestTuxFile(file: File | Blob, filename: string) {
  const startTime = performance.now();
  tableColumns.clear();
  compTableMap.clear();
  relTableMap.clear();

  try {
    const database = await getOrInitDb();
    // Clear any existing tables
    try {
      const existing = database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
      if (existing.length > 0 && existing[0].values) {
        for (const row of existing[0].values) {
          database.exec(`DROP TABLE IF EXISTS "${row[0]}";`);
        }
      }
    } catch (e) {
      console.error('Error clearing database:', e);
    }

    const totalBytes = file.size || 1;
    let bytesProcessed = 0;
    let compCount = 0;
    let relCount = 0;

    const compBuffers = new Map<string, Array<Record<string, string>>>();
    const relBuffers = new Map<string, Array<Record<string, string>>>();
    const seenAliases = new Set<string>();

    const ensureCompTable = (tableName: string, rowCols: string[]) => {
      if (!tableColumns.has(tableName)) {
        database.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" ("alias" TEXT PRIMARY KEY, "name" TEXT, "type" TEXT);`);
        tableColumns.set(tableName, new Set(['alias', 'name', 'type']));
      }
      const colsSet = tableColumns.get(tableName)!;
      for (const c of rowCols) {
        if (!colsSet.has(c)) {
          try {
            database.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${c}" TEXT;`);
            colsSet.add(c);
          } catch {
            // column might already exist
          }
        }
      }
    };

    const ensureRelTable = (tableName: string, rowCols: string[]) => {
      if (!tableColumns.has(tableName)) {
        database.exec(`CREATE TABLE IF NOT EXISTS "${tableName}" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "type" TEXT, "comp1_alias" TEXT, "comp2_alias" TEXT);`);
        tableColumns.set(tableName, new Set(['id', 'type', 'comp1_alias', 'comp2_alias']));
      }
      const colsSet = tableColumns.get(tableName)!;
      for (const c of rowCols) {
        if (!colsSet.has(c)) {
          try {
            database.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${c}" TEXT;`);
            colsSet.add(c);
          } catch {
            // column might already exist
          }
        }
      }
    };

    const flushCompBuffer = (tableName: string) => {
      const buffer = compBuffers.get(tableName);
      if (!buffer || buffer.length === 0) return;

      const colsSet = tableColumns.get(tableName)!;
      const cols = Array.from(colsSet);
      const placeholders = cols.map(() => '?').join(', ');
      const colSql = cols.map((c) => `"${c}"`).join(', ');
      const sql = `INSERT OR REPLACE INTO "${tableName}" (${colSql}) VALUES (${placeholders})`;

      database.exec('BEGIN TRANSACTION;');
      let stmt: Statement | null = null;
      try {
        stmt = database.prepare(sql);
        for (const row of buffer) {
          const values = cols.map((c) => (row[c] !== undefined ? row[c] : ''));
          stmt.run(values);
        }
      } finally {
        if (stmt) stmt.free();
        database.exec('COMMIT;');
      }
      buffer.length = 0;
    };

    const flushRelBuffer = (tableName: string) => {
      const buffer = relBuffers.get(tableName);
      if (!buffer || buffer.length === 0) return;

      const colsSet = tableColumns.get(tableName)!;
      // Exclude 'id' which is auto-increment
      const cols = Array.from(colsSet).filter((c) => c !== 'id');
      const placeholders = cols.map(() => '?').join(', ');
      const colSql = cols.map((c) => `"${c}"`).join(', ');
      const sql = `INSERT INTO "${tableName}" (${colSql}) VALUES (${placeholders})`;

      database.exec('BEGIN TRANSACTION;');
      let stmt: Statement | null = null;
      try {
        stmt = database.prepare(sql);
        for (const row of buffer) {
          const values = cols.map((c) => (row[c] !== undefined ? row[c] : ''));
          stmt.run(values);
        }
      } finally {
        if (stmt) stmt.free();
        database.exec('COMMIT;');
      }
      buffer.length = 0;
    };

    self.postMessage({
      type: 'PROGRESS',
      stage: 'ingest',
      percent: 5,
      message: 'Initializing streaming XML parser in WebAssembly worker...',
      components_ingested: 0,
      relationships_ingested: 0,
      bytes_processed: 0,
      total_bytes: totalBytes,
    } as WorkerProgressMessage);

    // Stream XML using ReadableStream
    const stream = file.stream();
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';
    let lastReport = performance.now();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesProcessed += value.byteLength;
      buffer += decoder.decode(value, { stream: true });

      // Process complete XML elements in the buffer
      let pos = 0;
      let lastUnparsedPos = 0;

      while (pos < buffer.length) {
        // Look for <component or <relationship
        const nextComp = buffer.indexOf('<component', pos);
        const nextRel = buffer.indexOf('<relationship', pos);

        let targetPos = -1;
        let isComp = false;

        if (nextComp !== -1 && nextRel !== -1) {
          if (nextComp < nextRel) {
            targetPos = nextComp;
            isComp = true;
          } else {
            targetPos = nextRel;
            isComp = false;
          }
        } else if (nextComp !== -1) {
          targetPos = nextComp;
          isComp = true;
        } else if (nextRel !== -1) {
          targetPos = nextRel;
          isComp = false;
        } else {
          lastUnparsedPos = pos;
          break; // No more elements in this buffer chunk
        }

        const openTagEnd = buffer.indexOf('>', targetPos);
        if (openTagEnd === -1) {
          // Opening tag incomplete, wait for more stream chunks
          lastUnparsedPos = targetPos;
          break;
        }

        const openTagStr = buffer.substring(targetPos, openTagEnd + 1);
        const isSelfClosing = openTagStr.trimEnd().endsWith('/>');

        let elemEnd = -1;
        if (isSelfClosing) {
          elemEnd = openTagEnd + 1;
        } else {
          const closeTag = isComp ? '</component>' : '</relationship>';
          const endTagPos = buffer.indexOf(closeTag, openTagEnd);
          if (endTagPos === -1) {
            // Closing tag not yet received in this chunk
            lastUnparsedPos = targetPos;
            break;
          }
          elemEnd = endTagPos + closeTag.length;
        }

        const elemXml = buffer.substring(targetPos, elemEnd);
        pos = elemEnd;
        lastUnparsedPos = pos;

        if (isComp) {
          compCount++;
          const openTag = elemXml.substring(0, elemXml.indexOf('>'));
          const attrs = parseXmlAttributes(openTag);
          const ctype = attrs['type'] || 'Component';
          const tableName = sanitizeIdentifier(ctype);
          compTableMap.set(ctype, tableName);

          let alias = attrs['alias'] || '';
          const name = attrs['name'] || '';
          if (!alias) {
            alias = name ? `${ctype}:${name}` : `${ctype}:Auto_${compCount}`;
            if (seenAliases.has(alias)) {
              alias = `${alias}:${compCount}`;
            }
          }
          seenAliases.add(alias);

          const row: Record<string, string> = {
            alias,
            name,
            type: ctype,
          };

          for (const [k, v] of Object.entries(attrs)) {
            if (k !== 'alias' && k !== 'name' && k !== 'type') {
              row[sanitizeIdentifier(k)] = v;
            }
          }

          if (!isSelfClosing) {
            const body = elemXml.substring(openTagEnd - targetPos + 1, elemXml.length - 12); // length of </component> is 12

            const parentMatch = /<parentalias\s+([^>]*)\/?>/i.exec(body);
            if (parentMatch) {
              const pAttrs = parseXmlAttributes(parentMatch[1]);
              if (pAttrs['alias']) row['parent_alias'] = pAttrs['alias'];
            }

            const descMatch = /<description>([\s\S]*?)<\/description>/i.exec(body);
            if (descMatch) {
              row['description'] = decodeXmlEntities(descMatch[1].trim());
            }

            const locMatch = /<locator\s+([^>]*)\/?>/i.exec(body);
            if (locMatch) {
              const lAttrs = parseXmlAttributes(locMatch[1]);
              if (lAttrs['class']) row['locator_class'] = lAttrs['class'];
            }

            const propRegex = /<property\s+([^>]*)>([\s\S]*?)<\/property>|<property\s+([^>]*)\/>/gi;
            let propMatch;
            while ((propMatch = propRegex.exec(body)) !== null) {
              const pAttrStr = propMatch[1] || propMatch[3] || '';
              const pAttrs = parseXmlAttributes(pAttrStr);
              const pname = pAttrs['name'];
              let pval = pAttrs['value'] || '';
              if (!pval && propMatch[2]) {
                const inner = propMatch[2].trim();
                if (inner.includes('<listItem')) {
                  const items: string[] = [];
                  const itemRegex = /<listItem[^>]*>([\s\S]*?)<\/listItem>/gi;
                  let itemMatch;
                  while ((itemMatch = itemRegex.exec(inner)) !== null) {
                    items.push(decodeXmlEntities(itemMatch[1].trim()));
                  }
                  pval = items.join(', ');
                } else {
                  pval = decodeXmlEntities(inner);
                }
              }
              if (pname) {
                row[sanitizeIdentifier(pname)] = pval;
              }
            }
          }

          ensureCompTable(tableName, Object.keys(row));
          if (!compBuffers.has(tableName)) compBuffers.set(tableName, []);
          compBuffers.get(tableName)!.push(row);

          if (compBuffers.get(tableName)!.length >= 2500) {
            flushCompBuffer(tableName);
          }
        } else {
          relCount++;
          const openTag = elemXml.substring(0, elemXml.indexOf('>'));
          const attrs = parseXmlAttributes(openTag);
          const rtype = attrs['type'] || 'Relationship';
          const tableName = sanitizeIdentifier(rtype);
          relTableMap.set(rtype, tableName);

          const row: Record<string, string> = {
            type: rtype,
            comp1_alias: '',
            comp2_alias: '',
          };

          for (const [k, v] of Object.entries(attrs)) {
            if (k !== 'type') {
              row[sanitizeIdentifier(k)] = v;
            }
          }

          if (!isSelfClosing) {
            const body = elemXml.substring(openTagEnd - targetPos + 1, elemXml.length - 15); // length of </relationship> is 15

            const c1Match = /<comp1alias\s+([^>]*)\/?>/i.exec(body);
            if (c1Match) {
              const c1Attrs = parseXmlAttributes(c1Match[1]);
              if (c1Attrs['alias']) row['comp1_alias'] = c1Attrs['alias'];
            }

            const c2Match = /<comp2alias\s+([^>]*)\/?>/i.exec(body);
            if (c2Match) {
              const c2Attrs = parseXmlAttributes(c2Match[1]);
              if (c2Attrs['alias']) row['comp2_alias'] = c2Attrs['alias'];
            }

            const descMatch = /<description>([\s\S]*?)<\/description>/i.exec(body);
            if (descMatch) {
              row['description'] = decodeXmlEntities(descMatch[1].trim());
            }

            const locMatch = /<locator\s+([^>]*)\/?>/i.exec(body);
            if (locMatch) {
              const lAttrs = parseXmlAttributes(locMatch[1]);
              if (lAttrs['class']) row['locator_class'] = lAttrs['class'];
            }

            const propRegex = /<property\s+([^>]*)>([\s\S]*?)<\/property>|<property\s+([^>]*)\/>/gi;
            let propMatch;
            while ((propMatch = propRegex.exec(body)) !== null) {
              const pAttrStr = propMatch[1] || propMatch[3] || '';
              const pAttrs = parseXmlAttributes(pAttrStr);
              const pname = pAttrs['name'];
              let pval = pAttrs['value'] || '';
              if (!pval && propMatch[2]) {
                const inner = propMatch[2].trim();
                if (inner.includes('<listItem')) {
                  const items: string[] = [];
                  const itemRegex = /<listItem[^>]*>([\s\S]*?)<\/listItem>/gi;
                  let itemMatch;
                  while ((itemMatch = itemRegex.exec(inner)) !== null) {
                    items.push(decodeXmlEntities(itemMatch[1].trim()));
                  }
                  pval = items.join(', ');
                } else {
                  pval = decodeXmlEntities(inner);
                }
              }
              if (pname) {
                row[sanitizeIdentifier(pname)] = pval;
              }
            }
          }

          ensureRelTable(tableName, Object.keys(row));
          if (!relBuffers.has(tableName)) relBuffers.set(tableName, []);
          relBuffers.get(tableName)!.push(row);

          if (relBuffers.get(tableName)!.length >= 2500) {
            flushRelBuffer(tableName);
          }
        }
      }

      buffer = buffer.substring(lastUnparsedPos);

      const now = performance.now();
      if (now - lastReport > 150 || (compCount + relCount) % 2500 === 0) {
        const pct = Math.min(95, Math.max(5, Math.round((bytesProcessed / totalBytes) * 95)));
        self.postMessage({
          type: 'PROGRESS',
          stage: 'ingest',
          percent: pct,
          message: `Streaming & indexing: ${compCount.toLocaleString()} components, ${relCount.toLocaleString()} relationships inserted...`,
          components_ingested: compCount,
          relationships_ingested: relCount,
          bytes_processed: bytesProcessed,
          total_bytes: totalBytes,
          elapsed_seconds: Math.round((now - startTime) / 100) / 10,
        } as WorkerProgressMessage);
        lastReport = now;
      }
    }

    // Flush all remaining buffers
    for (const [tbl] of compBuffers) {
      flushCompBuffer(tbl);
    }
    for (const [tbl] of relBuffers) {
      flushRelBuffer(tbl);
    }

    // Generate Indexes
    self.postMessage({
      type: 'PROGRESS',
      stage: 'indexing',
      percent: 96,
      message: 'Generating B-Tree indexes for fast relational traversal...',
      components_ingested: compCount,
      relationships_ingested: relCount,
      bytes_processed: totalBytes,
      total_bytes: totalBytes,
    } as WorkerProgressMessage);

    for (const [tbl, cols] of tableColumns) {
      if (cols.has('comp1_alias')) {
        try {
          database.exec(`CREATE INDEX IF NOT EXISTS "idx_${tbl}_c1" ON "${tbl}" ("comp1_alias");`);
          database.exec(`CREATE INDEX IF NOT EXISTS "idx_${tbl}_c2" ON "${tbl}" ("comp2_alias");`);
        } catch {
          // index creation error ignored
        }
      }
      if (cols.has('parent_alias')) {
        try {
          database.exec(`CREATE INDEX IF NOT EXISTS "idx_${tbl}_parent" ON "${tbl}" ("parent_alias");`);
        } catch {
          // index creation error ignored
        }
      }
    }

    const elapsed = (performance.now() - startTime) / 1000;
    const payloadId = filename.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    currentPayloadInfo = {
      id: payloadId,
      filename,
      size_bytes: file.size,
      size_mb: Math.round((file.size / (1024 * 1024)) * 10) / 10,
      total_components: compCount,
      total_relationships: relCount,
      total_tables: tableColumns.size,
      last_modified: Date.now() / 1000,
      status: 'ready',
    };

    const typesData = getPayloadTypesSync(database);

    self.postMessage({
      type: 'PROGRESS',
      stage: 'complete',
      percent: 100,
      message: `Ready in ${elapsed.toFixed(1)}s (${compCount.toLocaleString()} components, ${relCount.toLocaleString()} relationships indexed)!`,
      components_ingested: compCount,
      relationships_ingested: relCount,
      bytes_processed: totalBytes,
      total_bytes: totalBytes,
      elapsed_seconds: Math.round(elapsed * 10) / 10,
    } as WorkerProgressMessage);

    self.postMessage({
      type: 'READY',
      payload_info: currentPayloadInfo,
      types_data: typesData,
    } as WorkerReadyMessage);

    return {
      payload_info: currentPayloadInfo,
      types_data: typesData,
    };
  } catch (err: any) {
    self.postMessage({
      type: 'PROGRESS',
      stage: 'error',
      percent: 0,
      message: `Ingestion failed: ${err?.message || String(err)}`,
      components_ingested: 0,
      relationships_ingested: 0,
      bytes_processed: 0,
      total_bytes: file.size || 1,
    } as WorkerProgressMessage);
    throw err;
  }
}

// =====================================================================
// Query Implementations in SQLite WASM
// =====================================================================

function getPayloadTypesSync(dbInstance: Database) {
  const compTypes: Array<{ type: string; table_name: string; count: number; columns: string[] }> = [];
  const relTypes: Array<{ type: string; table_name: string; count: number; columns: string[] }> = [];

  const tablesRes = dbInstance.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  if (tablesRes.length === 0 || !tablesRes[0].values) {
    return { component_types: [], relationship_types: [], total_components: 0, total_relationships: 0 };
  }

  let totalComp = 0;
  let totalRel = 0;

  for (const [tbl] of tablesRes[0].values) {
    const tableName = String(tbl);
    const countRes = dbInstance.exec(`SELECT count(*) FROM "${tableName}";`);
    const count = countRes.length > 0 && countRes[0].values ? Number(countRes[0].values[0][0]) : 0;

    const colRes = dbInstance.exec(`PRAGMA table_info("${tableName}");`);
    const cols = colRes.length > 0 && colRes[0].values ? colRes[0].values.map((r) => String(r[1])) : [];

    const isRel = cols.includes('comp1_alias') && cols.includes('comp2_alias');
    const cleanType = tableName.replace(/_/g, ' ');

    if (isRel) {
      totalRel += count;
      relTypes.push({
        type: cleanType,
        table_name: tableName,
        count,
        columns: cols,
      });
    } else {
      totalComp += count;
      compTypes.push({
        type: cleanType,
        table_name: tableName,
        count,
        columns: cols,
      });
    }
  }

  compTypes.sort((a, b) => b.count - a.count);
  relTypes.sort((a, b) => b.count - a.count);

  return {
    component_types: compTypes,
    relationship_types: relTypes,
    total_components: totalComp,
    total_relationships: totalRel,
  };
}

function getTableDataSync(
  dbInstance: Database,
  tableName: string,
  page: number = 1,
  pageSize: number = 50,
  search: string = '',
  sortBy?: string,
  sortOrder: string = 'ASC'
) {
  if (!tableName) {
    return {
      table_name: '',
      is_relationship: false,
      page: 1,
      page_size: pageSize,
      total_rows: 0,
      total_pages: 1,
      columns: [],
      sort_by: '',
      sort_order: 'ASC' as const,
      data: [],
    };
  }

  const colRes = dbInstance.exec(`PRAGMA table_info("${tableName}");`);
  const cols = colRes.length > 0 && colRes[0].values ? colRes[0].values.map((r) => String(r[1])) : [];
  if (cols.length === 0) {
    return {
      table_name: tableName,
      is_relationship: false,
      page: 1,
      page_size: pageSize,
      total_rows: 0,
      total_pages: 1,
      columns: [],
      sort_by: '',
      sort_order: 'ASC' as const,
      data: [],
    };
  }

  const isRel = cols.includes('comp1_alias') && cols.includes('comp2_alias');

  // Search Filter
  let whereSql = '';
  const params: any[] = [];
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    const searchClauses = cols.map((c) => `"${c}" LIKE ?`);
    whereSql = `WHERE (${searchClauses.join(' OR ')})`;
    for (let i = 0; i < cols.length; i++) params.push(term);
  }

  // Count
  const countSql = `SELECT count(*) FROM "${tableName}" ${whereSql};`;
  const countStmt = dbInstance.prepare(countSql);
  if (params.length > 0) countStmt.bind(params);
  let totalMatching = 0;
  if (countStmt.step()) {
    totalMatching = Number(countStmt.get()[0]);
  }
  countStmt.free();

  // Sort
  let validSortCol = '';
  if (sortBy && ['_rowid', 'rowid', 'id', '#'].includes(sortBy)) {
    validSortCol = isRel ? 'id' : 'rowid';
  } else if (isRel) {
    const nonIdCols = cols.filter((c) => c !== 'id');
    const defaultSort = nonIdCols.includes('type') ? 'type' : (nonIdCols[0] || cols[0]);
    validSortCol = sortBy && cols.includes(sortBy) ? sortBy : defaultSort;
  } else {
    validSortCol = sortBy && cols.includes(sortBy) ? sortBy : (cols.includes('name') ? 'name' : cols[0]);
  }

  const validOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  const offset = (page - 1) * pageSize;

  let dataSql = '';
  if (validSortCol === 'rowid' || validSortCol === 'id') {
    dataSql = `SELECT rowid AS _rowid, * FROM "${tableName}" ${whereSql} ORDER BY "${validSortCol}" ${validOrder} LIMIT ? OFFSET ?;`;
  } else {
    dataSql = `
      SELECT rowid AS _rowid, * FROM "${tableName}" ${whereSql} 
      ORDER BY 
        CASE WHEN "${validSortCol}" IS NULL OR "${validSortCol}" = '' THEN 1 ELSE 0 END ASC,
        "${validSortCol}" COLLATE NOCASE ${validOrder}
      LIMIT ? OFFSET ?;
    `;
  }

  const queryParams = [...params, pageSize, offset];
  const stmt = dbInstance.prepare(dataSql);
  stmt.bind(queryParams);

  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();

  const totalPages = pageSize > 0 ? Math.ceil(totalMatching / pageSize) : 1;

  return {
    table_name: tableName,
    is_relationship: isRel,
    page,
    page_size: pageSize,
    total_rows: totalMatching,
    total_pages: totalPages,
    columns: cols,
    sort_by: validSortCol,
    sort_order: validOrder,
    data: rows,
  };
}

function getEntityDetailSync(dbInstance: Database, alias: string) {
  const tablesRes = dbInstance.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  if (tablesRes.length === 0 || !tablesRes[0].values) {
    throw new Error('Database is empty');
  }

  const compTables: string[] = [];
  const relTables: string[] = [];

  for (const [tbl] of tablesRes[0].values) {
    const tableName = String(tbl);
    const colRes = dbInstance.exec(`PRAGMA table_info("${tableName}");`);
    const cols = colRes.length > 0 && colRes[0].values ? colRes[0].values.map((r) => String(r[1])) : [];
    if (cols.includes('comp1_alias') && cols.includes('comp2_alias')) {
      relTables.push(tableName);
    } else {
      compTables.push(tableName);
    }
  }

  // 1. Find the entity
  let entity: any = null;
  let entityTable = '';

  for (const cTbl of compTables) {
    const stmt = dbInstance.prepare(`SELECT * FROM "${cTbl}" WHERE "alias" = ? LIMIT 1;`);
    stmt.bind([alias]);
    if (stmt.step()) {
      entity = stmt.getAsObject();
      entityTable = cTbl;
      stmt.free();
      break;
    }
    stmt.free();
  }

  if (!entity) {
    throw new Error(`Entity with alias '${alias}' not found.`);
  }

  const aliasCache = new Map<string, { alias: string; name: string; type: string; table: string }>();
  const resolveAlias = (targetAlias: string) => {
    if (!targetAlias) return { alias: '', name: 'Unknown', type: 'Unknown', table: '' };
    if (aliasCache.has(targetAlias)) return aliasCache.get(targetAlias)!;

    for (const cTbl of compTables) {
      const stmt = dbInstance.prepare(`SELECT alias, name, type FROM "${cTbl}" WHERE alias = ? LIMIT 1;`);
      stmt.bind([targetAlias]);
      if (stmt.step()) {
        const obj = stmt.getAsObject();
        const res = { alias: String(obj.alias), name: String(obj.name), type: String(obj.type), table: cTbl };
        aliasCache.set(targetAlias, res);
        stmt.free();
        return res;
      }
      stmt.free();
    }

    const fallback = { alias: targetAlias, name: targetAlias, type: 'Component', table: '' };
    aliasCache.set(targetAlias, fallback);
    return fallback;
  };

  const relationships: any[] = [];
  for (const rTbl of relTables) {
    const stmt = dbInstance.prepare(`SELECT * FROM "${rTbl}" WHERE comp1_alias = ? OR comp2_alias = ? LIMIT 100;`);
    stmt.bind([alias, alias]);
    while (stmt.step()) {
      const rDict = stmt.getAsObject();
      const c1Alias = String(rDict['comp1_alias'] || '');
      const c2Alias = String(rDict['comp2_alias'] || '');
      const isSource = c1Alias === alias;
      const targetAlias = isSource ? c2Alias : c1Alias;
      const direction = isSource ? 'outbound' : 'inbound';
      const counterpart = resolveAlias(targetAlias);

      const props: Record<string, any> = {};
      for (const [k, v] of Object.entries(rDict)) {
        if (!['id', 'comp1_alias', 'comp2_alias', 'type', 'alias', 'action'].includes(k)) {
          props[k] = v;
        }
      }

      relationships.push({
        relationship_type: rTbl.replace(/_/g, ' '),
        relationship_table: rTbl,
        direction,
        is_source: isSource,
        comp1_alias: c1Alias,
        comp2_alias: c2Alias,
        counterpart,
        properties: props,
      });
    }
    stmt.free();
  }

  return {
    entity,
    table_name: entityTable,
    type: entity.type || entityTable.replace(/_/g, ' '),
    alias,
    name: entity.name || alias,
    total_relationships: relationships.length,
    relationships,
  };
}

function getMetamodelGraphSync(dbInstance: Database) {
  const tablesRes = dbInstance.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  if (tablesRes.length === 0 || !tablesRes[0].values) {
    return { nodes: [], edges: [] };
  }

  const compTables: string[] = [];
  const relTables: string[] = [];

  for (const [tbl] of tablesRes[0].values) {
    const tableName = String(tbl);
    const colRes = dbInstance.exec(`PRAGMA table_info("${tableName}");`);
    const cols = colRes.length > 0 && colRes[0].values ? colRes[0].values.map((r) => String(r[1])) : [];
    if (cols.includes('comp1_alias') && cols.includes('comp2_alias')) {
      relTables.push(tableName);
    } else {
      compTables.push(tableName);
    }
  }

  const nodes: any[] = [];
  for (const cTbl of compTables) {
    const countRes = dbInstance.exec(`SELECT count(*) FROM "${cTbl}";`);
    const cnt = countRes.length > 0 && countRes[0].values ? Number(countRes[0].values[0][0]) : 0;

    const colRes = dbInstance.exec(`PRAGMA table_info("${cTbl}");`);
    const rawCols = colRes.length > 0 && colRes[0].values ? colRes[0].values.map((r) => String(r[1])) : [];
    const props = rawCols.filter((c) => !['alias', 'type', 'action'].includes(c));

    const umlProps = ['+ alias: ID [1] {PK}', '+ name: String [1]', '+ type: String [1]'];
    for (const p of props) {
      umlProps.push(`+ ${p.replace(/_/g, ' ')}: String [0..1]`);
    }

    nodes.push({
      id: cTbl,
      label: cTbl.replace(/_/g, ' '),
      stereotype: '«Component»',
      count: cnt,
      properties: props,
      uml_properties: umlProps,
      uml_attributes: umlProps,
    });
  }

  const edges: any[] = [];
  for (const rTbl of relTables) {
    const countRes = dbInstance.exec(`SELECT count(*) FROM "${rTbl}";`);
    const relCnt = countRes.length > 0 && countRes[0].values ? Number(countRes[0].values[0][0]) : 0;

    const sampleRes = dbInstance.exec(`SELECT comp1_alias, comp2_alias FROM "${rTbl}" LIMIT 50;`);
    const sampleRows = sampleRes.length > 0 && sampleRes[0].values ? sampleRes[0].values : [];

    let sourceTbl: string | null = null;
    let targetTbl: string | null = null;

    for (const r of sampleRows) {
      const c1 = String(r[0] || '');
      const c2 = String(r[1] || '');

      if (!sourceTbl && c1) {
        for (const cTbl of compTables) {
          const check = dbInstance.exec(`SELECT 1 FROM "${cTbl}" WHERE alias = '${c1.replace(/'/g, "''")}' LIMIT 1;`);
          if (check.length > 0 && check[0].values && check[0].values.length > 0) {
            sourceTbl = cTbl;
            break;
          }
        }
      }

      if (!targetTbl && c2) {
        for (const cTbl of compTables) {
          const check = dbInstance.exec(`SELECT 1 FROM "${cTbl}" WHERE alias = '${c2.replace(/'/g, "''")}' LIMIT 1;`);
          if (check.length > 0 && check[0].values && check[0].values.length > 0) {
            targetTbl = cTbl;
            break;
          }
        }
      }

      if (sourceTbl && targetTbl) break;
    }

    if (sourceTbl && targetTbl) {
      const statsRes = dbInstance.exec(
        `SELECT COUNT(DISTINCT comp1_alias), COUNT(DISTINCT comp2_alias), COUNT(*) FROM "${rTbl}";`
      );
      let distC1 = 0, distC2 = 0, totalR = 0;
      if (statsRes.length > 0 && statsRes[0].values && statsRes[0].values.length > 0) {
        distC1 = Number(statsRes[0].values[0][0]);
        distC2 = Number(statsRes[0].values[0][1]);
        totalR = Number(statsRes[0].values[0][2]);
      }

      const targetMult = distC1 === totalR && totalR > 0 ? '1' : '*';
      const sourceMult = distC2 === totalR && totalR > 0 ? '1' : distC2 * 1.1 >= totalR && totalR > 0 ? '0..1' : '*';

      const rClean = rTbl.replace(/_/g, ' ');
      const umlName = `${rClean} ►`;
      const sourceRole = sourceTbl === targetTbl ? `+${sourceTbl.toLowerCase()} (source)` : `+${sourceTbl.toLowerCase()}`;
      const targetRole = sourceTbl === targetTbl ? `+${targetTbl.toLowerCase()} (target)` : `+${targetTbl.toLowerCase()}`;

      edges.push({
        id: rTbl,
        source: sourceTbl,
        target: targetTbl,
        label: rClean,
        uml_name: umlName,
        stereotype: '«Relationship»',
        source_multiplicity: sourceMult,
        target_multiplicity: targetMult,
        source_role: sourceRole,
        target_role: targetRole,
        count: relCnt,
      });
    }
  }

  return { nodes, edges };
}

function getNeighborhoodGraphSync(dbInstance: Database, alias: string, depth: number = 1) {
  const tablesRes = dbInstance.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  if (tablesRes.length === 0 || !tablesRes[0].values) return { nodes: [], edges: [] };

  const compTables: string[] = [];
  const relTables: string[] = [];

  for (const [tbl] of tablesRes[0].values) {
    const tableName = String(tbl);
    const colRes = dbInstance.exec(`PRAGMA table_info("${tableName}");`);
    const cols = colRes.length > 0 && colRes[0].values ? colRes[0].values.map((r) => String(r[1])) : [];
    if (cols.includes('comp1_alias') && cols.includes('comp2_alias')) {
      relTables.push(tableName);
    } else {
      compTables.push(tableName);
    }
  }

  const visitedAliases = new Set<string>([alias]);
  let frontier = new Set<string>([alias]);
  const edgesFound: any[] = [];

  for (let currentDepth = 0; currentDepth < depth; currentDepth++) {
    const nextFrontier = new Set<string>();
    for (const fAlias of frontier) {
      for (const rTbl of relTables) {
        const stmt = dbInstance.prepare(`SELECT comp1_alias, comp2_alias, type FROM "${rTbl}" WHERE comp1_alias = ? OR comp2_alias = ? LIMIT 25;`);
        stmt.bind([fAlias, fAlias]);
        while (stmt.step()) {
          const row = stmt.getAsObject();
          const c1 = String(row.comp1_alias);
          const c2 = String(row.comp2_alias);
          const rType = String(row.type || rTbl.replace(/_/g, ' '));
          const target = c1 === fAlias ? c2 : c1;

          edgesFound.push({
            id: `${c1}->${c2}:${rTbl}`,
            source: c1,
            target: c2,
            label: rType,
          });

          if (!visitedAliases.has(target)) {
            visitedAliases.add(target);
            nextFrontier.add(target);
          }
        }
        stmt.free();
      }
    }
    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  const nodes: any[] = [];
  for (const nAlias of visitedAliases) {
    const nodeInfo: any = { id: nAlias, name: nAlias, type: 'Component', is_root: nAlias === alias };
    for (const cTbl of compTables) {
      const stmt = dbInstance.prepare(`SELECT alias, name, type FROM "${cTbl}" WHERE alias = ? LIMIT 1;`);
      stmt.bind([nAlias]);
      if (stmt.step()) {
        const obj = stmt.getAsObject();
        nodeInfo.name = obj.name;
        nodeInfo.type = obj.type;
        stmt.free();
        break;
      }
      stmt.free();
    }
    nodes.push(nodeInfo);
  }

  return { nodes, edges: edgesFound };
}

async function exportCsvZipSync(dbInstance: Database): Promise<Blob> {
  const zip = new JSZip();
  const tablesRes = dbInstance.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  if (tablesRes.length > 0 && tablesRes[0].values) {
    for (const [tbl] of tablesRes[0].values) {
      const tableName = String(tbl);
      const res = dbInstance.exec(`SELECT * FROM "${tableName}";`);
      if (res.length > 0) {
        const cols = res[0].columns;
        const csvLines: string[] = [];
        csvLines.push(cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(','));
        for (const row of res[0].values) {
          csvLines.push(row.map((val) => (val !== null && val !== undefined ? `"${String(val).replace(/"/g, '""')}"` : '""')).join(','));
        }
        zip.file(`${tableName}.csv`, csvLines.join('\n'));
      }
    }
  }
  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// =====================================================================
// Worker Message Handler (RPC)
// =====================================================================

self.onmessage = async (e: MessageEvent) => {
  const { id, action, payload } = e.data;

  try {
    switch (action) {
      case 'INGEST_FILE': {
        const { file, filename } = payload;
        const result = await ingestTuxFile(file, filename);
        if (id !== undefined) {
          self.postMessage({ id, success: true, data: result });
        }
        break;
      }

      case 'GET_PAYLOADS': {
        const payloads = currentPayloadInfo ? [currentPayloadInfo] : [];
        self.postMessage({ id, success: true, data: { payloads } });
        break;
      }

      case 'GET_PAYLOAD_TYPES': {
        const database = await getOrInitDb();
        const data = getPayloadTypesSync(database);
        self.postMessage({ id, success: true, data });
        break;
      }

      case 'GET_TABLE_DATA': {
        const database = await getOrInitDb();
        const { tableName, page, pageSize, search, sortBy, sortOrder } = payload;
        const data = getTableDataSync(database, tableName, page, pageSize, search, sortBy, sortOrder);
        self.postMessage({ id, success: true, data });
        break;
      }

      case 'GET_ENTITY_DETAIL': {
        const database = await getOrInitDb();
        const { alias } = payload;
        const data = getEntityDetailSync(database, alias);
        self.postMessage({ id, success: true, data });
        break;
      }

      case 'GET_METAMODEL_GRAPH': {
        const database = await getOrInitDb();
        const data = getMetamodelGraphSync(database);
        self.postMessage({ id, success: true, data });
        break;
      }

      case 'GET_NEIGHBORHOOD_GRAPH': {
        const database = await getOrInitDb();
        const { alias, depth } = payload;
        const data = getNeighborhoodGraphSync(database, alias, depth);
        self.postMessage({ id, success: true, data });
        break;
      }

      case 'EXPORT_SQLITE': {
        const database = await getOrInitDb();
        const binary = database.export();
        self.postMessage({ id, success: true, data: binary });
        break;
      }

      case 'EXPORT_CSV_ZIP': {
        const database = await getOrInitDb();
        const blob = await exportCsvZipSync(database);
        self.postMessage({ id, success: true, data: blob });
        break;
      }

      default:
        throw new Error(`Unknown worker action: ${action}`);
    }
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err?.message || String(err) });
  }
};
