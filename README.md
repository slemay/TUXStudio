# TUX Studio — Planview Troux Upload XML (TUX) Explorer

<p align="center">
  <img src="public/favicon.svg" alt="TUX Studio Logo" width="80" height="80" />
</p>

<p align="center">
  <strong>100% Client-Side Relational Explorer, Tabular Browser & Metamodel Visualizer for Troux Upload XML (TUX DTD V5) Payloads.</strong><br>
  <em>Powered by React 19, Tailwind CSS v4, and SQLite WebAssembly (WASM). Zero backend infrastructure required.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.2-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4.3-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/SQLite-WASM_(sql.js)-003B57?logo=sqlite&logoColor=white" alt="SQLite WASM" />
  <img src="https://img.shields.io/badge/Privacy-100%25_Offline-10B981" alt="100% Offline" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" />
</p>

---

## 📖 Overview

**TUX Studio** transforms complex, nested **Troux Upload XML (TUX DTD V5)** payloads into high-performance, queryable relational SQLite databases directly in your browser.

Enterprise Architecture and CMDB integration payloads (from ServiceNow, Workday, SAP, AWS, or custom extractors) often exceed hundreds of megabytes with deeply interconnected entity graphs. Traditional XML viewers choke on large files and cannot represent relational structures effectively. TUX Studio solves this with a **chunked streaming SAX parser** running in a dedicated Web Worker that streams and indexes XML directly into **WebAssembly SQLite**, keeping browser memory consumption under **~40 MB RAM** even on 250 MB+ payloads.

---

## ✨ Key Features

- ⚡ **High-Speed Streaming XML Ingestion**: Reads XML files in continuous chunks using `ReadableStream` and `TextDecoder` in a Web Worker. Uses memoized identifier sanitizers, fast-path entity decoders, and unified batch transactions (15,000 records/tx) to ingest **275,000+ records in seconds** without UI stutter.
- 💾 **Persistent IndexedDB Storage**: Ingested datasets are automatically serialized and preserved in browser `IndexedDB`. Data remains **100% persistent across page refreshes, tab closures, and browser restarts** with instantaneous rehydration.
- 🗄️ **Dynamic In-Memory SQLite Engine**: Dynamically creates Fact tables for `<component>` types and Dimension tables for `<relationship>` types. Evolves schema on-the-fly (`ALTER TABLE ADD COLUMN`) as properties are discovered.
- ⚡ **Instant B-Tree Indexing**: Generates B-Tree indexes on foreign keys (`comp1_alias`, `comp2_alias`, `parent_alias`) to deliver sub-millisecond query and graph traversal performance.
- 📊 **High-Performance Tabular Explorer**: 
  - Server-side styled pagination with configurable page sizes (25, 50, 100, 250).
  - Multi-column substring filtering and global SQL column sorting (`ASC`/`DESC`).
  - Per-table custom resizable column widths and column visibility picker.
  - Persistent record counters and row identifiers (`#` / `rowid`).
- 🕸️ **UML 2.5 Metamodel Diagram**:
  - Interactive canvas rendering entity classes, attributes, stereotypes, and reading-direction arrows (`►`).
  - Automatic data-driven multiplicity derivation (`1`, `*`, `0..1`) calculated from live dataset foreign key distributions.
  - Interactive pan, zoom, auto-radial layout, and drag-and-drop node positioning with `localStorage` persistence.
- 🔍 **Bidirectional Relational Inspector**:
  - Slide-over drawer with 1-click graph traversal to connected counterparts.
  - Interactive breadcrumb trail for retracing complex relationship paths.
  - Searchable attribute inspector with 1-click clipboard copy.
- 💾 **Browser-Native Export Engine**:
  - **SQLite Binary (`.db`)**: Export native SQLite database files directly from browser memory.
  - **CSV Archive (`.zip`)**: Export all discovered tables as individual UTF-8 CSVs packed into a `.zip` archive via `JSZip`.
- 🔒 **100% Private & Offline**: Zero telemetry and zero cloud dependencies. Sensitive enterprise architecture, infrastructure, and HR data never leaves your machine.
- 🌓 **Dark & Light Mode**: Complete responsive theme support with instantaneous persistence.

---

## 🏛️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BROWSER UI THREAD                             │
│                                                                         │
│   ┌───────────────┐     ┌───────────────┐     ┌─────────────────────┐   │
│   │    Header     │     │    Sidebar    │     │  Relational Drawer  │   │
│   │ (Dataset/View)│     │ (Type Nav)    │     │ (Entity Inspector)  │   │
│   └───────┬───────┘     └───────┬───────┘     └──────────┬──────────┘   │
│           │                     │                        │              │
│   ┌───────┴─────────────────────┴────────────────────────┴──────────┐   │
│   │                        App Workspace Container                  │   │
│   │  ┌───────────────────┬─────────────────────┬──────────────────┐ │   │
│   │  │ Tabular Explorer  │ UML Metamodel Graph │ Payload Summary  │ │   │
│   │  │    (DataGrid)     │  (MetamodelGraph)   │ (PayloadSummary) │ │   │
│   │  └───────────────────┴─────────────────────┴──────────────────┘ │   │
│   └──────────────────────────────────┬──────────────────────────────┘   │
└──────────────────────────────────────┼──────────────────────────────────┘
                                       │ RPC Messages (postMessage)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          WEB WORKER THREAD                              │
│                    (src/workers/tuxWorker.ts)                           │
│                                                                         │
│   ┌───────────────────────────┐         ┌───────────────────────────┐   │
│   │  Fast Streaming SAX Parser│ ──────> │  SQLite WASM (sql.js)     │   │
│   │ (15k Multi-Table Batches) │         │  - Fact / Dimension Tables│   │
│   └─────────────┬─────────────┘         │  - B-Tree Indexes         │   │
│                 │                       └─────────────┬─────────────┘   │
│                 │                                     │                 │
│                 ▼                                     ▼                 │
│   ┌───────────────────────────┐         ┌───────────────────────────┐   │
│   │  IndexedDB Persistence    │ <────── │   Export Generators       │   │
│   │ (Zero Data Loss on Reload)│         │  - SQLite Binary (.db)    │   │
│   └───────────────────────────┘         │  - CSV Bundle (.zip)      │   │
│                                         └───────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

For detailed technical design specifications, see [DESIGN.md](DESIGN.md).

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+ or 20+
- npm 9+ or pnpm / yarn

### 1. Clone the Repository
```bash
git clone https://github.com/slemay/TUXStudio.git
cd TUXStudio
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
```
The optimized static build will be placed in the `dist/` folder.

### 5. Preview Production Build
```bash
npm run preview
```

---

## 🌐 Deployment (GitHub Pages)

TUX Studio contains an automated GitHub Actions deployment workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

1. Push this repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: release TUX Studio"
   git push origin main
   ```
2. Navigate to your repository on GitHub: **Settings** → **Pages**.
3. Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. The deployment pipeline will automatically build and publish your instance to:
   ```
   https://slemay.github.io/TUXStudio/
   ```

---

## 📋 Troux Upload XML (TUX DTD V5) Format Reference

TUX Studio natively parses all elements and attributes defined in the official Planview Troux Upload XML DTD Version 5 specification:

| Element | Supported Attributes / Tags | Relational Mapping |
| :--- | :--- | :--- |
| `<trouxupload>` | `defaultaction`, `version` | Global payload metadata and action scoping. |
| `<component>` | `type`, `name`, `alias`, `action`, `description` | Mapped to a dedicated **Fact Table** named after sanitized `type`. `alias` acts as the Primary Key. |
| `<parentalias>` | `alias` (IDREF) | Added as `parent_alias` column with B-Tree index for hierarchical aggregation. |
| `<property>` | `name`, `value`, `action`, `<listItem>`, `<linkURL>` | Added as columns with dynamic schema evolution (`ALTER TABLE`). List items are aggregated as comma-separated values. |
| `<relationship>` | `type`, `action`, `comp1alias`, `comp2alias` | Mapped to a **Dimension/Link Table** named after sanitized `type`. `comp1_alias` and `comp2_alias` form indexed foreign keys. |
| `<locator>` | `class`, `<parameter name="..." value="..."/>` | Captured into `locator_class` and locator parameter columns for record reconciliation inspection. |

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **UI Framework** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **Build & Bundling** | [Vite 8](https://vitejs.dev/) |
| **Styling & Icons** | [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) |
| **Relational Database** | [SQLite WebAssembly](https://sqlite.org/) via [`sql.js`](https://github.com/sql-js/sql.js) |
| **Archive Generator** | [`JSZip`](https://stuk.github.io/jszip/) |
| **Linting & Code Quality** | [`oxlint`](https://oxc.rs/) |
| **CI/CD & Hosting** | GitHub Actions & GitHub Pages |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
