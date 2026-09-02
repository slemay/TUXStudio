import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';
import type { MetamodelGraphResponse } from '../types';

interface MetamodelGraphProps {
  graphData: MetamodelGraphResponse | null;
  isLoading: boolean;
  onSelectComponentType: (tableName: string) => void;
  payloadId?: string;
}

interface NodePosition {
  x: number;
  y: number;
}

export const MetamodelGraph: React.FC<MetamodelGraphProps> = ({
  graphData,
  isLoading,
  onSelectComponentType,
  payloadId = 'default',
}) => {
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.95);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 30, y: 20 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const dragStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const storageKey = `tuxdb_metamodel_pos_${payloadId}`;

  // Initialize UML layout
  useEffect(() => {
    if (!graphData?.nodes) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (graphData.nodes.every((n) => parsed[n.id])) {
          setPositions(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }

    const newPos: Record<string, NodePosition> = {};
    const n = graphData.nodes.length;
    const centerX = 540;
    const centerY = 360;
    const radius = Math.max(260, Math.min(450, n * 50));

    if (n === 0) return;
    if (n === 1) {
      newPos[graphData.nodes[0].id] = { x: centerX, y: centerY };
    } else {
      // Calculate connection degree for each node to find the primary hub
      const degrees: Record<string, number> = {};
      graphData.nodes.forEach((node) => { degrees[node.id] = 0; });
      graphData.edges.forEach((edge) => {
        degrees[edge.source] = (degrees[edge.source] || 0) + 1;
        degrees[edge.target] = (degrees[edge.target] || 0) + 1;
      });

      const sortedNodes = [...graphData.nodes].sort(
        (a, b) => (degrees[b.id] || 0) - (degrees[a.id] || 0)
      );

      const hubNode = sortedNodes[0];
      const orbitNodes = sortedNodes.slice(1);

      newPos[hubNode.id] = { x: centerX, y: centerY };

      orbitNodes.forEach((node, i) => {
        const angle = ((2 * Math.PI) / orbitNodes.length) * i - Math.PI / 2;
        newPos[node.id] = {
          x: centerX + radius * Math.cos(angle) * 1.25,
          y: centerY + radius * Math.sin(angle) * 0.95,
        };
      });
    }
    setPositions(newPos);
  }, [graphData, storageKey]);

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggingNode(nodeId);
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;

    const nodePos = positions[nodeId] || { x: 0, y: 0 };
    setDragOffset({
      x: (e.clientX - pan.x) / scale - nodePos.x,
      y: (e.clientY - pan.y) / scale - nodePos.y,
    });
  };

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode) {
      const dist = Math.hypot(
        e.clientX - dragStartPosRef.current.x,
        e.clientY - dragStartPosRef.current.y
      );
      if (dist > 4) {
        hasDraggedRef.current = true;
      }

      const newX = (e.clientX - pan.x) / scale - dragOffset.x;
      const newY = (e.clientY - pan.y) / scale - dragOffset.y;
      setPositions((prev) => {
        const next = { ...prev, [draggingNode]: { x: newX, y: newY } };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
    setIsPanning(false);
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    onSelectComponentType(nodeId);
  };

  const handleResetLayout = () => {
    localStorage.removeItem(storageKey);
    setScale(0.95);
    setPan({ x: 30, y: 20 });

    if (!graphData?.nodes) return;
    const newPos: Record<string, NodePosition> = {};
    const n = graphData.nodes.length;
    const centerX = 540;
    const centerY = 360;
    const radius = Math.max(260, Math.min(450, n * 50));

    if (n === 0) return;
    if (n === 1) {
      newPos[graphData.nodes[0].id] = { x: centerX, y: centerY };
    } else {
      const degrees: Record<string, number> = {};
      graphData.nodes.forEach((node) => { degrees[node.id] = 0; });
      graphData.edges.forEach((edge) => {
        degrees[edge.source] = (degrees[edge.source] || 0) + 1;
        degrees[edge.target] = (degrees[edge.target] || 0) + 1;
      });

      const sortedNodes = [...graphData.nodes].sort(
        (a, b) => (degrees[b.id] || 0) - (degrees[a.id] || 0)
      );

      const hubNode = sortedNodes[0];
      const orbitNodes = sortedNodes.slice(1);

      newPos[hubNode.id] = { x: centerX, y: centerY };

      orbitNodes.forEach((node, i) => {
        const angle = ((2 * Math.PI) / orbitNodes.length) * i - Math.PI / 2;
        newPos[node.id] = {
          x: centerX + radius * Math.cos(angle) * 1.25,
          y: centerY + radius * Math.sin(angle) * 0.95,
        };
      });
    }
    setPositions(newPos);
  };

  if (isLoading || !graphData) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
        <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2" />
        Generating UML Metamodel Diagram...
      </div>
    );
  }

  const BOX_WIDTH = 250;
  const PROP_ROW_HEIGHT = 16;
  const FOOTER_HEIGHT = 24;

  const getNodeProperties = (node: any): string[] => {
    if (node.uml_properties && node.uml_properties.length > 0) {
      return node.uml_properties;
    }
    if (node.uml_attributes && node.uml_attributes.length > 0) {
      return node.uml_attributes;
    }
    return [
      '+ alias: ID [1] {PK}',
      '+ name: String [1]',
      '+ type: String [1]',
      ...(node.properties || []).map((p: string) => `+ ${p.replace(/_/g, ' ')}: String [0..1]`),
    ];
  };

  const getNodeHeight = (node: any): number => {
    const props = getNodeProperties(node);
    // Header (48px) + Property Subheader (22px) + (props.length * 16px) + Bottom Bar (24px) + margin padding (8px)
    return 70 + props.length * PROP_ROW_HEIGHT + FOOTER_HEIGHT + 8;
  };

  /**
   * Computes the exact perimeter intersection point of a rectangle centered at (cx, cy)
   * with width `w` and height `h`, along the ray directed toward (tx, ty).
   */
  const getBoxIntersection = (
    cx: number,
    cy: number,
    w: number,
    h: number,
    tx: number,
    ty: number
  ): { x: number; y: number } => {
    const dx = tx - cx;
    const dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };

    const halfW = w / 2;
    const halfH = h / 2;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    let scale = 1;
    if (absDx * halfH > absDy * halfW) {
      scale = halfW / absDx;
    } else {
      scale = halfH / absDy;
    }

    return {
      x: cx + dx * scale,
      y: cy + dy * scale,
    };
  };

  const nodeMap = new Map((graphData?.nodes || []).map((n) => [n.id, n]));

  return (
    <div
      ref={containerRef}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="flex-1 h-full min-h-0 relative overflow-hidden bg-slate-100 dark:bg-slate-950 cursor-grab active:cursor-grabbing select-none transition-colors"
    >
      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shadow-xl flex items-center gap-1 z-20 transition-colors">
        <button
          onClick={() => setScale((s) => Math.min(s + 0.15, 2.5))}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(s - 0.15, 0.4))}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetLayout}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition"
          title="Reset UML Layout"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* UML Standard Legend & Notation Guide */}
      <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xl text-xs space-y-2.5 z-20 pointer-events-none max-w-xs transition-colors">
        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-1.5">
          <Info className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          <span>UML 2.5 Metamodel Standard</span>
        </div>
        <div className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-300">
          <div className="flex items-start gap-2">
            <span className="font-mono text-indigo-600 dark:text-indigo-400 text-xs mt-0.5">«Component»</span>
            <span>UML Class box with Stereotype, Primary Key {`{PK}`}, and Properties.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">──►</span>
            <span>Directed Association with Reading Direction (<code className="text-emerald-700 dark:text-emerald-300">►</code>) & Stereotype <span className="font-mono text-emerald-600 dark:text-emerald-400">«Relationship»</span>.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono text-amber-600 dark:text-amber-400 text-xs mt-0.5">1, *</span>
            <span>UML Multiplicities (<code className="text-amber-700 dark:text-amber-300">1</code> = One, <code className="text-amber-700 dark:text-amber-300">*</code> = Many, <code className="text-amber-700 dark:text-amber-300">0..1</code> = Optional).</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono text-purple-600 dark:text-purple-400 text-xs mt-0.5">{`{instances}`}</span>
            <span>UML Tagged Values for instance counts & association weights.</span>
          </div>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <svg
        className="w-full h-full"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          {/* UML Standard Navigable Association Arrowhead */}
          <marker
            id="uml-arrow"
            viewBox="0 0 12 12"
            refX="10"
            refY="6"
            markerWidth="9"
            markerHeight="9"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 11 6 L 0 11 z" fill="#10b981" />
          </marker>
          <marker
            id="uml-arrow-self"
            viewBox="0 0 12 12"
            refX="10"
            refY="6"
            markerWidth="9"
            markerHeight="9"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 11 6 L 0 11 z" fill="#10b981" />
          </marker>
        </defs>

        {/* ============================================================= */}
        {/* LAYER 1: UML Directed Association Lines                       */}
        {/* ============================================================= */}
        <g id="uml-edge-lines">
          {graphData.edges.map((edge) => {
            const sPos = positions[edge.source] || { x: 200, y: 200 };
            const tPos = positions[edge.target] || { x: 400, y: 400 };

            const sNode = nodeMap.get(edge.source);
            const tNode = nodeMap.get(edge.target);
            const sHeight = sNode ? getNodeHeight(sNode) : 160;
            const tHeight = tNode ? getNodeHeight(tNode) : 160;

            // Self-Association (Reflexive relationship)
            if (edge.source === edge.target) {
              const loopX1 = sPos.x + BOX_WIDTH / 4;
              const loopY1 = sPos.y - sHeight / 2;
              const loopX2 = sPos.x - BOX_WIDTH / 4;
              const loopY2 = sPos.y - sHeight / 2;
              const loopPath = `M ${loopX1} ${loopY1} C ${loopX1 + 100} ${loopY1 - 150}, ${loopX2 - 100} ${loopY1 - 150}, ${loopX2} ${loopY2}`;

              return (
                <path
                  key={`line-${edge.id}`}
                  d={loopPath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  markerEnd="url(#uml-arrow-self)"
                />
              );
            }

            // Calculate precise ray-box intersection points at box boundaries
            const srcBorder = getBoxIntersection(sPos.x, sPos.y, BOX_WIDTH, sHeight, tPos.x, tPos.y);
            const tgtBorder = getBoxIntersection(tPos.x, tPos.y, BOX_WIDTH, tHeight, sPos.x, sPos.y);

            return (
              <line
                key={`line-${edge.id}`}
                x1={srcBorder.x}
                y1={srcBorder.y}
                x2={tgtBorder.x}
                y2={tgtBorder.y}
                stroke="#10b981"
                strokeWidth="2.5"
                markerEnd="url(#uml-arrow)"
              />
            );
          })}
        </g>

        {/* ============================================================= */}
        {/* LAYER 2: UML Standard Component Classifier Boxes              */}
        {/* ============================================================= */}
        <g id="uml-classifier-nodes">
          {graphData.nodes.map((node) => {
            const pos = positions[node.id] || { x: 100, y: 100 };
            const boxHeight = getNodeHeight(node);
            const halfW = BOX_WIDTH / 2;
            const halfH = boxHeight / 2;
            const umlProps = getNodeProperties(node);

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x - halfW}, ${pos.y - halfH})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={(e) => handleNodeClick(e, node.id)}
                className="cursor-move group"
              >
                {/* UML Class Outer Rectangle with dynamic vertical height */}
                <rect
                  width={BOX_WIDTH}
                  height={boxHeight}
                  rx="6"
                  fill="#0b1120"
                  stroke="#6366f1"
                  strokeWidth="2"
                  className="group-hover:stroke-indigo-400 group-hover:fill-slate-900 transition shadow-2xl"
                />

                {/* Top Header Compartment: Stereotype & Class Name */}
                <rect
                  width={BOX_WIDTH}
                  height="48"
                  rx="5"
                  fill="#1e1b4b"
                  className="pointer-events-none"
                />
                <text
                  x={halfW}
                  y="18"
                  textAnchor="middle"
                  fill="#a5b4fc"
                  fontSize="10"
                  fontStyle="italic"
                  fontWeight="600"
                  fontFamily="sans-serif"
                  className="pointer-events-none"
                >
                  «Component»
                </text>
                <text
                  x={halfW}
                  y="36"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="13"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  className="pointer-events-none"
                >
                  {node.label}
                </text>

                {/* UML Compartment Divider Line */}
                <line
                  x1="0"
                  y1="48"
                  x2={BOX_WIDTH}
                  y2="48"
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  className="pointer-events-none"
                />

                {/* Property Header & Tagged Value: Instance Multiplicity */}
                <text
                  x={10}
                  y="63"
                  fill="#818cf8"
                  fontSize="8.5"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                  className="pointer-events-none uppercase tracking-wider"
                >
                  Properties ({umlProps.length})
                </text>
                <text
                  x={BOX_WIDTH - 10}
                  y="63"
                  textAnchor="end"
                  fill="#818cf8"
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="monospace"
                  className="pointer-events-none"
                >
                  {`{count = ${node.count.toLocaleString()}}`}
                </text>

                {/* Property Subheader Divider */}
                <line
                  x1="10"
                  y1="69"
                  x2={BOX_WIDTH - 10}
                  y2="69"
                  stroke="#1e293b"
                  strokeWidth="1"
                  className="pointer-events-none"
                />

                {/* Middle Compartment: ALL UML Typed Properties */}
                <g transform="translate(10, 84)" className="pointer-events-none">
                  {umlProps.map((prop, idx) => {
                    const isPK = prop.includes('{PK}');
                    return (
                      <text
                        key={idx}
                        x="0"
                        y={idx * PROP_ROW_HEIGHT}
                        fill={isPK ? '#c7d2fe' : '#cbd5e1'}
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight={isPK ? 'bold' : 'normal'}
                      >
                        {prop}
                      </text>
                    );
                  })}
                </g>

                {/* Bottom Compartment Divider & Click-to-Explore Cue */}
                <line
                  x1="0"
                  y1={boxHeight - 22}
                  x2={BOX_WIDTH}
                  y2={boxHeight - 22}
                  stroke="#1e293b"
                  strokeWidth="1"
                  className="pointer-events-none"
                />
                <text
                  x={halfW}
                  y={boxHeight - 8}
                  textAnchor="middle"
                  fill="#818cf8"
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily="sans-serif"
                  className="pointer-events-none"
                >
                  Click to explore table ➔
                </text>
              </g>
            );
          })}
        </g>

        {/* ============================================================= */}
        {/* LAYER 3: Association Badges & Multiplicity Labels (On Top)    */}
        {/* ============================================================= */}
        <g id="uml-edge-labels">
          {graphData.edges.map((edge) => {
            const sPos = positions[edge.source] || { x: 200, y: 200 };
            const tPos = positions[edge.target] || { x: 400, y: 400 };

            const sNode = nodeMap.get(edge.source);
            const tNode = nodeMap.get(edge.target);
            const sHeight = sNode ? getNodeHeight(sNode) : 160;
            const tHeight = tNode ? getNodeHeight(tNode) : 160;

            // Self-Association (Reflexive relationship labels)
            if (edge.source === edge.target) {
              const loopX1 = sPos.x + BOX_WIDTH / 4;
              const loopY1 = sPos.y - sHeight / 2;
              const loopX2 = sPos.x - BOX_WIDTH / 4;
              const loopY2 = sPos.y - sHeight / 2;

              return (
                <g key={`label-${edge.id}`}>
                  {/* Stereotype, Association Name & Count Badge */}
                  <g
                    transform={`translate(${sPos.x}, ${sPos.y - sHeight / 2 - 125})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectComponentType(edge.id);
                    }}
                    className="cursor-pointer group/rel pointer-events-auto"
                  >
                    <rect
                      x="-110"
                      y="-24"
                      width="220"
                      height="48"
                      rx="8"
                      className="fill-white dark:fill-slate-950 stroke-emerald-500/50 dark:stroke-emerald-500/60 group-hover/rel:stroke-emerald-400 dark:group-hover/rel:stroke-emerald-400 group-hover/rel:fill-slate-50 dark:group-hover/rel:fill-slate-900 shadow-xl transition"
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y="-10"
                      textAnchor="middle"
                      className="fill-emerald-600 dark:fill-emerald-400 font-semibold italic text-[9.5px]"
                      fontFamily="sans-serif"
                    >
                      «Relationship»
                    </text>
                    <text
                      x="0"
                      y="5"
                      textAnchor="middle"
                      className="fill-slate-900 dark:fill-white font-bold text-[11px]"
                      fontFamily="sans-serif"
                    >
                      {edge.uml_name || 'supervises ►'}
                    </text>
                    <text
                      x="0"
                      y="18"
                      textAnchor="middle"
                      className="fill-indigo-600 dark:fill-indigo-400 font-mono font-bold text-[9.5px]"
                    >
                      {`{count = ${edge.count?.toLocaleString() ?? 0}}`}
                    </text>
                  </g>

                  {/* Source Multiplicity / Cardinality: 0..1 */}
                  <text
                    x={loopX1 + 18}
                    y={loopY1 - 18}
                    strokeWidth="4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    paintOrder="stroke"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="start"
                    className="select-none pointer-events-none fill-amber-600 dark:fill-amber-400 stroke-slate-100 dark:stroke-slate-950"
                  >
                    {edge.source_multiplicity || '0..1'}
                  </text>

                  {/* Target Multiplicity / Cardinality: * */}
                  <text
                    x={loopX2 - 18}
                    y={loopY2 - 18}
                    strokeWidth="4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    paintOrder="stroke"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="end"
                    className="select-none pointer-events-none fill-amber-600 dark:fill-amber-400 stroke-slate-100 dark:stroke-slate-950"
                  >
                    {edge.target_multiplicity || '*'}
                  </text>
                </g>
              );
            }

            // Directed Association between distinct Component Types
            const srcBorder = getBoxIntersection(sPos.x, sPos.y, BOX_WIDTH, sHeight, tPos.x, tPos.y);
            const tgtBorder = getBoxIntersection(tPos.x, tPos.y, BOX_WIDTH, tHeight, sPos.x, sPos.y);

            const dx = tgtBorder.x - srcBorder.x;
            const dy = tgtBorder.y - srcBorder.y;
            const dist = Math.hypot(dx, dy) || 1;
            const ux = dx / dist;
            const uy = dy / dist;
            const nx = -uy;
            const ny = ux;

            const midX = (srcBorder.x + tgtBorder.x) / 2;
            const midY = (srcBorder.y + tgtBorder.y) / 2;

            // Compute positions along connection line outside boxes with perpendicular offset
            const srcLabelX = srcBorder.x + ux * 28 + nx * 16;
            const srcLabelY = srcBorder.y + uy * 28 + ny * 16;

            const tgtLabelX = tgtBorder.x - ux * 32 + nx * 16;
            const tgtLabelY = tgtBorder.y - uy * 32 + ny * 16;

            return (
              <g key={`label-${edge.id}`}>
                {/* Association Name, Stereotype & Relationship Count Badge (Center of line) */}
                <g
                  transform={`translate(${midX}, ${midY})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectComponentType(edge.id);
                  }}
                  className="cursor-pointer group/rel pointer-events-auto"
                >
                  <rect
                    x="-110"
                    y="-24"
                    width="220"
                    height="48"
                    rx="8"
                    className="fill-white dark:fill-slate-950 stroke-slate-300 dark:stroke-slate-800 group-hover/rel:stroke-emerald-400 dark:group-hover/rel:stroke-emerald-400 group-hover/rel:fill-slate-50 dark:group-hover/rel:fill-slate-900 shadow-xl transition"
                    strokeWidth="1.5"
                  />
                  <text
                    x="0"
                    y="-10"
                    textAnchor="middle"
                    className="fill-emerald-600 dark:fill-emerald-400 font-semibold italic text-[9.5px]"
                    fontFamily="sans-serif"
                  >
                    «Relationship»
                  </text>
                  <text
                    x="0"
                    y="5"
                    textAnchor="middle"
                    className="fill-slate-900 dark:fill-white font-bold text-[11px]"
                    fontFamily="sans-serif"
                  >
                    {edge.uml_name || `${edge.label} ►`}
                  </text>
                  <text
                    x="0"
                    y="18"
                    textAnchor="middle"
                    className="fill-indigo-600 dark:fill-indigo-400 font-mono font-bold text-[9.5px]"
                  >
                    {`{count = ${edge.count?.toLocaleString() ?? 0}}`}
                  </text>
                </g>

                {/* Source Multiplicity / Cardinality */}
                <text
                  x={srcLabelX}
                  y={srcLabelY}
                  strokeWidth="4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  paintOrder="stroke"
                  fontSize="12"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="select-none pointer-events-none fill-amber-600 dark:fill-amber-400 stroke-slate-100 dark:stroke-slate-950"
                >
                  {edge.source_multiplicity || '*'}
                </text>

                {/* Target Multiplicity / Cardinality */}
                <text
                  x={tgtLabelX}
                  y={tgtLabelY}
                  strokeWidth="4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  paintOrder="stroke"
                  fontSize="12"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="select-none pointer-events-none fill-amber-600 dark:fill-amber-400 stroke-slate-100 dark:stroke-slate-950"
                >
                  {edge.target_multiplicity || '1'}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
