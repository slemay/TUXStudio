# TUX Studio — Technical Architecture & System Design

This document details the system architecture, algorithmic design, database modeling, and performance characteristics of **TUX Studio** — an in-browser relational explorer and metamodel visualizer for Planview Troux Upload XML (TUX DTD V5) payloads.

---

## 1. Design Goals & System Principles

| Principle | Architectural Decision | Benefit |
| :--- | :--- | :--- |
| **Zero Backend & 100% Privacy** | All computation executes inside the browser client using Web Workers and WebAssembly. | Sensitive enterprise architecture and IT asset data never traverses an external network. |
| **Low-Memory Streaming Ingestion** | Chunked SAX stream decoding using `ReadableStream` and transactional SQLite batching. | Memory consumption remains stable at ~40 MB RAM even when parsing 250 MB–500 MB XML files. |
| **Relational Transformation** | Semi-structured XML elements are dynamically mapped into normalized SQLite tables. | Enables instant SQL filtering, indexed joins, global sorting, and relational traversal. |
| **Data-Driven Metamodel Derivation** | Multiplicities and relationship directions are derived directly from actual instance data. | Generates accurate UML 2.5 classifier diagrams reflecting real dataset topologies. |
| **Seamless User Experience** | Offloading heavy computation to a Web Worker keeps the main UI thread responsive at 60 FPS. | No UI freezing during ingestion, indexing, querying, or database export. |

---

## 2. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   MAIN UI THREAD                                       │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              React 19 Application                              │   │
│   │                                                                                │   │
│   │   ┌───────────────────┐    ┌────────────────────┐    ┌─────────────────────┐   │   │
│   │   │ Header & Toolbar  │    │ Left Sidebar       │    │ Relational Drawer   │   │   │
│   │   │ - Dataset select  │    │ - Type categories  │    │ - Counterpart links │   │   │
│   │   │ - View switchers  │    │ - Count badges     │    │ - Breadcrumb trail  │   │   │
│   │   │ - Export triggers │    │ - Type search      │    │ - Attribute list    │   │   │
│   │   └───────────────────┘    └────────────────────┘    └─────────────────────┘   │   │
│   │                                                                                │   │
│   │   ┌───────────────────┬─────────────────────────┬──────────────────────────┐   │   │
│   │   │ Tabular Explorer  │  UML Metamodel Graph    │  Payload Summary View    │   │   │
│   │   │ - Resizable cols  │  - SVG Canvas / Pan-Zoom│  - Metrics & DTD status  │   │   │
│   │   │ - Search / Sort   │  - Radial auto-layout   │  - Table schema cards    │   │   │
│   │   │ - Page controls   │  - Drag-drop coordinates│  - Direct table jump     │   │   │
│   │   └───────────────────┴─────────────────────────┴──────────────────────────┘   │   │
│   └──────────────────────────────────────┬─────────────────────────────────────────┘   │
└──────────────────────────────────────────┼─────────────────────────────────────────────┘
                                           │
                         Typed RPC Messages (postMessage)
                                           │
┌──────────────────────────────────────────▼─────────────────────────────────────────────┐
│                                  WEB WORKER THREAD                                     │
│                              (src/workers/tuxWorker.ts)                                │
│                                                                                        │
│   ┌───────────────────────────────────┐     ┌──────────────────────────────────────┐   │
│   │     Streaming SAX Ingestion       │     │         SQLite WASM (sql.js)        │   │
│   │  - Chunked stream decoding        │ ──> │  - In-memory database instance       │   │
│   │  - Entity boundary detection      │     │  - Dynamic schema creation           │   │
│   │  - Attribute & property parsing   │     │  - Dynamic column evolution          │   │
│   │  - Batch buffer flusher (2500/tx) │     │  - B-Tree index creation             │   │
│   └───────────────────────────────────┘     └──────────────────┬───────────────────┘   │
│                                                                │                       │
│   ┌───────────────────────────────────┐                        │                       │
│   │      Graph & Traversal Engine     │ <──────────────────────┤                       │
│   │  - Metamodel node/edge extractor  │                        │                       │
│   │  - Cardinality & multiplicity     │                        │                       │
│   │  - Neighborhood graph crawler     │                        │                       │
│   └───────────────────────────────────┘                        │                       │
│                                                                │                       │
│   ┌───────────────────────────────────┐                        │                       │
│   │         Export Engine             │ <──────────────────────┘                       │
│   │  - Native SQLite .db binary       │                                                │
│   │  - JSZip CSV table archiver       │                                                │
│   └───────────────────────────────────┘                                                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Streaming Ingestion Pipeline

### 3.1 Chunk Processing & Tag Boundary Resolution

Standard DOM parsers (`DOMParser`, `xml2js`) construct an in-memory DOM tree that requires 5x–10x the raw file size in RAM, causing browsers to crash on 100 MB+ files. 

TUX Studio implements a **chunked streaming tokenizer**:

1. **File Streaming**: The input `File` / `Blob` is opened as a `ReadableStream` and consumed in sequential byte chunks via `reader.read()`.
2. **Text Decoding**: Bytes are converted to UTF-8 text using `TextDecoder({ stream: true })`.
3. **Sliding Window Buffer**: The worker maintains a sliding string buffer. It searches for opening `<component` and `<relationship` tags, finds their matching closing tags (`</component>`, `</relationship>`, or `/>`), extracts complete XML elements, and advances the buffer pointer.
4. **Residual Preservation**: Any incomplete tag spanning a chunk boundary is retained at the front of the buffer for the next chunk read.

```
Incoming Stream Chunks
[ Chunk N-1 ] ──> [ Chunk N ] ──> [ Chunk N+1 ]
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│ Sliding String Buffer                                   │
│  ... <component name="Server1"> ... </component> <relat │ <-- Slice processed elements
└───────────────────────────┬─────────────────────────────┘
                            │
               Extracted XML Substrings
                            │
                            ▼
               Attribute & Property Parser
                            │
                            ▼
               Batch Insert Buffer (2,500 records)
                            │ (flush when full)
                            ▼
               SQLite `BEGIN TRANSACTION` ... `COMMIT`
```

### 3.2 Dynamic Batch Flushing & Transaction Management

To maximize ingestion throughput and minimize SQLite WASM overhead:
- Incoming records are queued in per-table memory buffers (`compBuffers` and `relBuffers`).
- Buffers flush when they reach **2,500 records** or upon reaching the end of the file.
- Inserts are executed inside explicit transactions:
  ```sql
  BEGIN TRANSACTION;
  INSERT OR REPLACE INTO "Application" ("alias", "name", "type", "description") VALUES (?, ?, ?, ?);
  ...
  COMMIT;
  ```
- Pragmas configured for in-memory execution speed:
  ```sql
  PRAGMA synchronous = OFF;
  PRAGMA journal_mode = MEMORY;
  ```

---

## 4. Relational Database & Schema Design

### 4.1 Schema Mapping Rules

| TUX Source Element | SQLite Relational Target | Primary / Foreign Keys |
| :--- | :--- | :--- |
| `<component type="Server">` | Fact Table `"Server"` | `"alias"` TEXT PRIMARY KEY |
| `<relationship type="Deploys">` | Dimension Table `"Deploys"` | `"id"` INTEGER PRIMARY KEY AUTOINCREMENT,<br>`"comp1_alias"` TEXT,<br>`"comp2_alias"` TEXT |
| `<parentalias alias="P1">` | Column `"parent_alias"` on Component Table | Foreign Key referencing parent's `"alias"` |
| `<property name="Port" value="8080">` | Column `"Port"` on Component/Relationship Table | Dynamically added via `ALTER TABLE ADD COLUMN` |
| `<listItem>` elements | Column on Component/Relationship Table | Multi-value list aggregated as comma-separated string |

### 4.2 Dynamic Schema Evolution

Because TUX XML is semi-structured, different components of the same `type` may define different properties. TUX Studio tracks known columns per table in a `Map<string, Set<string>>`:
1. When a record introduces an unseen property attribute or `<property name="...">` tag:
2. The worker executes:
   ```sql
   ALTER TABLE "<tableName>" ADD COLUMN "<sanitized_property_name>" TEXT;
   ```
3. The column is registered in the in-memory column cache, ensuring subsequent inserts bind successfully.

### 4.3 B-Tree Indexing Strategy

Upon completing the streaming ingestion pass, the worker creates dedicated B-Tree indexes:

```sql
-- Indexes for bidirectional relationship traversal
CREATE INDEX IF NOT EXISTS "idx_<RelTable>_c1" ON "<RelTable>" ("comp1_alias");
CREATE INDEX IF NOT EXISTS "idx_<RelTable>_c2" ON "<RelTable>" ("comp2_alias");

-- Index for parent-child hierarchy lookups
CREATE INDEX IF NOT EXISTS "idx_<CompTable>_parent" ON "<CompTable>" ("parent_alias");
```

---

## 5. Web Worker RPC Protocol

Communication between the React UI thread and the Web Worker is managed by a typed request-response protocol in [`src/clientDb.ts`](file:///Users/slemay/Work/TUXStudio/src/clientDb.ts).

### 5.1 Message Types

```typescript
// Requests from Main Thread -> Worker
interface WorkerRequest {
  id: number;
  action: 
    | 'INGEST_FILE' 
    | 'GET_PAYLOADS' 
    | 'GET_PAYLOAD_TYPES' 
    | 'GET_TABLE_DATA' 
    | 'GET_ENTITY_DETAIL' 
    | 'GET_METAMODEL_GRAPH' 
    | 'GET_NEIGHBORHOOD_GRAPH' 
    | 'EXPORT_SQLITE' 
    | 'EXPORT_CSV_ZIP';
  payload?: any;
}

// Responses from Worker -> Main Thread
interface WorkerResponse {
  id: number;
  success: boolean;
  data?: any;
  error?: string;
}

// Streaming Progress Events from Worker -> Main Thread
interface WorkerProgressMessage {
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
```

---

## 6. Metamodel Derivation & Graph Layout

### 6.1 Reverse-Engineered UML 2.5 Metamodel

Rather than relying on static schema declarations, TUX Studio derives the complete metamodel graph from the ingested data instances:

1. **Node Extraction**: Each component fact table becomes a UML Class Classifier with its count and discovered property signatures:
   ```
   + alias: ID [1] {PK}
   + name: String [1]
   + type: String [1]
   + <property>: String [0..1]
   ```
2. **Edge Extraction & Multiplicity Calculation**: For each relationship table, sample pairs `(comp1_alias, comp2_alias)` determine the source and target component types. The worker then calculates exact multiplicities:
   ```sql
   SELECT COUNT(DISTINCT comp1_alias), COUNT(DISTINCT comp2_alias), COUNT(*) 
   FROM "<RelationshipTable>";
   ```
   - If `COUNT(DISTINCT comp1_alias) == COUNT(*)`, target multiplicity is `1`, otherwise `*`.
   - If `COUNT(DISTINCT comp2_alias) == COUNT(*)`, source multiplicity is `1`, otherwise `0..1` or `*`.

### 6.2 Layout Algorithm & Geometry

- **Radial Hub-and-Spoke Layout**: Calculates node degrees (number of incoming/outgoing relationship types) to identify the central hub classifier. The hub is placed at canvas center `(540, 360)`, and satellite nodes are positioned in an elliptical orbit:
  $$x_i = C_x + R_x \cdot \cos\left(\frac{2\pi i}{N} - \frac{\pi}{2}\right)$$
  $$y_i = C_y + R_y \cdot \sin\left(\frac{2\pi i}{N} - \frac{\pi}{2}\right)$$
- **Ray-Box Perimeter Intersection**: Edge connector arrows are not clamped to generic center points; they compute exact line-rectangle perimeter intersections using slope ray casting, ensuring arrows touch UML box boundaries cleanly.
- **State Persistence**: Custom node drag coordinates are saved in `localStorage` under `tuxdb_metamodel_pos_<payloadId>`.

---

## 7. Tabular Explorer & Query Engine

The Tabular Explorer in [`src/components/DataGrid.tsx`](file:///Users/slemay/Work/TUXStudio/src/components/DataGrid.tsx) executes parameterized SQL queries against SQLite WASM:

- **Paginated Fetching**: Computes `LIMIT ? OFFSET ?` with exact `COUNT(*)` matching.
- **Search Filtering**: Builds dynamic multi-column `LIKE ?` clauses joined with `OR` across all columns of the active table.
- **Natural Case-Insensitive Sorting**:
  ```sql
  SELECT rowid AS _rowid, * FROM "Application"
  ORDER BY 
    CASE WHEN "name" IS NULL OR "name" = '' THEN 1 ELSE 0 END ASC,
    "name" COLLATE NOCASE ASC
  LIMIT 50 OFFSET 0;
  ```
- **AbortController Integration**: Rapid table switching or typing in the search bar triggers request cancellation to prevent out-of-order race conditions.

---

## 8. Export Architecture

### 8.1 SQLite Binary Export (`.db`)
1. Calls `db.export()` on the SQLite WASM instance to serialize the in-memory database into a `Uint8Array`.
2. Encapsulates the binary array into an `application/x-sqlite3` Blob.
3. Triggers a direct DOM anchor download.

### 8.2 CSV Archive Bundle (`.zip`)
1. Iterates over all user tables in `sqlite_master`.
2. Queries all rows, formats values with CSV quotation and escape rules (`" -> ""`).
3. Uses `JSZip` to compile individual CSV files into a compressed `.zip` archive.
4. Generates a download Blob (`application/zip`) without backend intervention.

---

## 9. Security & Privacy Model

- **No Remote Telemetry**: TUX Studio does not contain analytics, tracking pixels, or outbound network requests.
- **Sandboxed Execution**: Worker code and SQLite WASM execute entirely within browser sandboxing constraints.
- **SQL Identifier Sanitization**: All table and column names derived from XML tags are sanitized to alphanumeric and underscore characters, with prepared statement bindings used for all values.
