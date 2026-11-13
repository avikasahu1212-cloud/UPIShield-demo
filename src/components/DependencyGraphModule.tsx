import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Maximize2, Network, RotateCcw, ShieldAlert, ZoomIn, ZoomOut } from 'lucide-react';
import type {
  CascadeImpactResult,
  DependencyEdge,
  IncidentRecord,
  ServiceNode,
  SpofAnalysisItem,
} from '../types.ts';
import { HEALTH_META, formatTimestamp } from '../utils/format.ts';

interface TopologyResponse {
  mode: 'live' | 'historical';
  services: ServiceNode[];
  dependencies: DependencyEdge[];
  activeCascade: CascadeImpactResult | null;
  snapshotIncident: IncidentRecord | null;
}

interface ServiceDetailResponse {
  service: ServiceNode;
  upstreamDependencies: Array<{ edge: DependencyEdge; service: ServiceNode }>;
  downstreamDependents: Array<{ edge: DependencyEdge; service: ServiceNode }>;
  cascadePreview: CascadeImpactResult;
  recentIncidents: IncidentRecord[];
}

interface SpofResponse {
  dataNotice: string;
  totalServicesAnalyzed: number;
  spofCount: number;
  items: SpofAnalysisItem[];
}

interface DependencyGraphModuleProps {
  refreshTrigger: number;
  selectedServiceId: string | null;
  onSelectService: (id: string | null) => void;
  onNavigateToSimulator: (serviceId: string) => void;
  initialSubTab?: 'graph' | 'spof';
}

export const DependencyGraphModule: React.FC<DependencyGraphModuleProps> = ({
  refreshTrigger,
  selectedServiceId,
  onSelectService,
  onNavigateToSimulator,
  initialSubTab = 'graph',
}) => {
  const [subTab, setSubTab] = useState<'graph' | 'spof'>(initialSubTab);
  const [topology, setTopology] = useState<TopologyResponse | null>(null);
  const [serviceDetail, setServiceDetail] = useState<ServiceDetailResponse | null>(null);
  const [spofData, setSpofData] = useState<SpofResponse | null>(null);
  const [selectedSpof, setSelectedSpof] = useState<SpofAnalysisItem | null>(null);
  const [incidentsList, setIncidentsList] = useState<IncidentRecord[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('live');
  const [showTrafficAnim, setShowTrafficAnim] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const loadTopology = async (incId: string) => {
    try {
      setLoading(true);
      const url = incId === 'live' ? '/api/topology' : `/api/topology?incidentId=${encodeURIComponent(incId)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = (await res.json()) as TopologyResponse;
        setTopology(json);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/incidents')
      .then((r) => r.json())
      .then((d) => setIncidentsList(d.incidents ?? []))
      .catch(() => {});

    fetch('/api/analysis/spof')
      .then((r) => r.json())
      .then((d: SpofResponse) => {
        setSpofData(d);
        if (d.items?.length > 0) {
          setSelectedSpof((prev) =>
            prev ? d.items.find((i) => i.serviceId === prev.serviceId) ?? d.items[0] : d.items[0]
          );
        }
      })
      .catch(() => {});
  }, [refreshTrigger]);

  useEffect(() => {
    loadTopology(selectedIncidentId);
  }, [selectedIncidentId, refreshTrigger]);

  useEffect(() => {
    if (!selectedServiceId) {
      setServiceDetail(null);
      return;
    }
    fetch(`/api/services/${encodeURIComponent(selectedServiceId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setServiceDetail(d))
      .catch(() => setServiceDetail(null));
  }, [selectedServiceId, refreshTrigger]);

  const highlightedSets = useMemo(() => {
    const directUpstream = new Set<string>();
    const directDownstream = new Set<string>();
    const blastSet = new Set<string>();
    const activeEdges = new Set<string>();
    const cascadeEdges = new Set<string>();

    if (!topology) {
      return { directUpstream, directDownstream, blastSet, activeEdges, cascadeEdges };
    }

    if (selectedServiceId) {
      for (const edge of topology.dependencies) {
        if (edge.sourceId === selectedServiceId) {
          directUpstream.add(edge.targetId);
          activeEdges.add(edge.id);
        }
        if (edge.targetId === selectedServiceId) {
          directDownstream.add(edge.sourceId);
          activeEdges.add(edge.id);
        }
      }
    }

    if (topology.activeCascade) {
      blastSet.add(topology.activeCascade.originServiceId);
      for (const d of topology.activeCascade.directlyAffected) blastSet.add(d.id);
      for (const i of topology.activeCascade.indirectlyAffected) blastSet.add(i.id);

      for (const edge of topology.dependencies) {
        if (blastSet.has(edge.sourceId) && blastSet.has(edge.targetId)) {
          cascadeEdges.add(edge.id);
        }
      }
    }

    return { directUpstream, directDownstream, blastSet, activeEdges, cascadeEdges };
  }, [topology, selectedServiceId]);

  const serviceMap = useMemo(() => {
    return new Map((topology?.services ?? []).map((s) => [s.id, s]));
  }, [topology]);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).closest('[data-node-card]')) return;
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy });
  };

  const handleMouseUp = () => {
    setDragging(false);
    dragStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((z) => Math.min(1.65, Math.max(0.65, Number((z + delta).toFixed(2)))));
  };

  if (loading && !topology) {
    return <div className="h-[580px] rounded-xl bg-[#0C1222] border border-slate-800 animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      {/* Header & Mode Tabs */}
      <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">
            Infrastructure Dependency Graph & SPOF Analysis
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Live service topology map and graph-traversal Single Point of Failure identification
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#060A14] border border-slate-800">
            <button
              type="button"
              onClick={() => setSubTab('graph')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                subTab === 'graph' ? 'bg-blue-600/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              Live Topology Graph
            </button>
            <button
              type="button"
              onClick={() => setSubTab('spof')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                subTab === 'spof' ? 'bg-blue-600/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Critical Dependency & SPOF ({spofData?.spofCount ?? 0})
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: LIVE TOPOLOGY GRAPH */}
      {subTab === 'graph' && (
        <>
          {/* Graph Controls Bar */}
          <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <span>View Mode:</span>
              <select
                value={selectedIncidentId}
                onChange={(e) => setSelectedIncidentId(e.target.value)}
                className="h-8 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="live">Live Topology (Current State)</option>
                {incidentsList.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    Historical: {inc.id} · {inc.serviceName}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowTrafficAnim((prev) => !prev)}
                className={`h-8 px-3 rounded-lg border text-xs font-medium cursor-pointer whitespace-nowrap ${
                  showTrafficAnim
                    ? 'bg-blue-600/15 border-blue-500/40 text-cyan-300'
                    : 'bg-[#060A14] border-slate-800 text-slate-400'
                }`}
              >
                {showTrafficAnim ? 'Traffic Flow: On' : 'Traffic Flow: Off'}
              </button>

              <div className="flex items-center gap-1 bg-[#060A14] border border-slate-800 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.1).toFixed(2))))}
                  aria-label="Zoom out"
                  className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-xs text-slate-300 px-1.5 tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.65, Number((z + 0.1).toFixed(2))))}
                  aria-label="Zoom in"
                  className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  aria-label="Reset zoom and pan"
                  className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Historical / Active Cascade Banner */}
          {topology?.activeCascade && topology.snapshotIncident && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-mono font-semibold text-red-400">
                  {topology.mode === 'historical' ? 'HISTORICAL SNAPSHOT' : 'ACTIVE BLAST RADIUS'}:
                </span>{' '}
                <span className="text-slate-100 font-medium">{topology.snapshotIncident.title}</span>{' '}
                <span className="text-slate-400">
                  · {topology.activeCascade.directlyAffected.length} direct +{' '}
                  {topology.activeCascade.indirectlyAffected.length} indirect services affected (
                  {topology.activeCascade.blastRadiusPct}% topology exposure)
                </span>
              </div>
              {topology.mode === 'historical' && (
                <button
                  type="button"
                  onClick={() => setSelectedIncidentId('live')}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
                >
                  Return to Live Topology
                </button>
              )}
            </div>
          )}

          {/* Main Split: Interactive SVG Graph + Inspector Panel */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-xl bg-[#0A0F1E] border border-slate-800/80 overflow-hidden relative">
              <div className="px-4 py-2.5 border-b border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 bg-[#0C1222]">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-mono text-emerald-400">GREEN: Healthy</span>
                  <span className="font-mono text-amber-400">YELLOW: Degraded</span>
                  <span className="font-mono text-red-400">RED: Failed</span>
                  <span className="font-mono text-sky-400">BLUE: Recovering</span>
                  <span className="font-mono text-slate-400">GREY: Unknown</span>
                </div>
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Maximize2 className="w-3 h-3" /> Drag canvas to pan · Scroll to zoom
                </span>
              </div>

              <svg
                viewBox="0 0 1100 520"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                className={`w-full h-[520px] select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                role="img"
                aria-label="Interactive UPIShield Banking Service Dependency Graph"
              >
                <defs>
                  <pattern id="gridDots" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="1" fill="#1E293B" />
                  </pattern>
                  <marker id="arrow-normal" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
                  </marker>
                  <marker id="arrow-highlight" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#22D3EE" />
                  </marker>
                  <marker id="arrow-cascade" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
                  </marker>
                </defs>

                <rect width="1100" height="520" fill="url(#gridDots)" />

                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {topology?.dependencies.map((edge) => {
                    const src = serviceMap.get(edge.sourceId);
                    const tgt = serviceMap.get(edge.targetId);
                    if (!src || !tgt) return null;

                    const isCascade = highlightedSets.cascadeEdges.has(edge.id);
                    const isSelectedPath = highlightedSets.activeEdges.has(edge.id);
                    const dimmed = selectedServiceId && !isSelectedPath && !isCascade ? 0.2 : 1;

                    const x1 = src.posX;
                    const y1 = src.posY;
                    const x2 = tgt.posX;
                    const y2 = tgt.posY;
                    const mx = (x1 + x2) / 2;
                    const my = (y1 + y2) / 2 - (Math.abs(x1 - x2) > 250 ? 34 : 18);

                    const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
                    const strokeColor = isCascade
                      ? '#EF4444'
                      : isSelectedPath
                      ? '#22D3EE'
                      : edge.dependencyType === 'INFRASTRUCTURE'
                      ? '#334155'
                      : '#475569';

                    const markerId = isCascade
                      ? 'url(#arrow-cascade)'
                      : isSelectedPath
                      ? 'url(#arrow-highlight)'
                      : 'url(#arrow-normal)';

                    return (
                      <g key={edge.id} style={{ opacity: dimmed }}>
                        <path
                          d={d}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={isCascade ? 2.4 : isSelectedPath ? 2.2 : 1.3}
                          strokeDasharray={edge.dependencyType === 'SOFT' || edge.dependencyType === 'REPLICATION' ? '4 4' : undefined}
                          markerEnd={markerId}
                        />
                        {showTrafficAnim && (
                          <path
                            d={d}
                            fill="none"
                            stroke={isCascade ? '#FCA5A5' : isSelectedPath ? '#67E8F9' : '#38BDF8'}
                            strokeWidth={isCascade ? 2.2 : 1.5}
                            className={isCascade ? 'animate-edge-cascade' : 'animate-edge-flow'}
                            opacity={isCascade ? 0.95 : isSelectedPath ? 0.9 : 0.4}
                          />
                        )}
                      </g>
                    );
                  })}

                  {topology?.services.map((svc) => {
                    const meta = HEALTH_META[svc.healthState];
                    const isSelected = selectedServiceId === svc.id;
                    const isUpstream = highlightedSets.directUpstream.has(svc.id);
                    const isDownstream = highlightedSets.directDownstream.has(svc.id);
                    const inBlast = highlightedSets.blastSet.has(svc.id);

                    const w = 172;
                    const h = 76;
                    const x = svc.posX - w / 2;
                    const y = svc.posY - h / 2;

                    return (
                      <g
                        key={svc.id}
                        data-node-card="true"
                        onClick={() => onSelectService(svc.id)}
                        className="cursor-pointer"
                      >
                        {inBlast && (
                          <rect
                            x={x - 5}
                            y={y - 5}
                            width={w + 10}
                            height={h + 10}
                            rx={13}
                            fill="none"
                            stroke={svc.healthState === 'RED' ? '#EF4444' : '#F59E0B'}
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            opacity={0.8}
                          />
                        )}

                        <rect
                          x={x}
                          y={y}
                          width={w}
                          height={h}
                          rx={10}
                          fill="#0C1222"
                          stroke={
                            isSelected
                              ? '#22D3EE'
                              : isUpstream || isDownstream
                              ? '#3B82F6'
                              : meta.stroke
                          }
                          strokeWidth={isSelected ? 2.2 : 1.4}
                        />

                        <rect x={x + 1} y={y + 1} width={w - 2} height={20} rx={9} fill={meta.fill} />

                        <text
                          x={x + 10}
                          y={y + 14}
                          fill={meta.stroke}
                          fontSize="9.5"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="600"
                        >
                          {meta.shortLabel}
                        </text>

                        <text
                          x={x + w - 10}
                          y={y + 14}
                          textAnchor="end"
                          fill="#94A3B8"
                          fontSize="9"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {svc.criticality}
                        </text>

                        <text
                          x={x + 10}
                          y={y + 36}
                          fill="#F1F5F9"
                          fontSize="11.5"
                          fontFamily="Plus Jakarta Sans, sans-serif"
                          fontWeight="600"
                        >
                          {svc.name.length > 22 ? `${svc.name.slice(0, 21)}…` : svc.name}
                        </text>

                        <text
                          x={x + 10}
                          y={y + 53}
                          fill="#94A3B8"
                          fontSize="9.5"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {svc.latencyMs}ms · {svc.errorRate.toFixed(2)}% err
                        </text>

                        <text
                          x={x + 10}
                          y={y + 67}
                          fill="#64748B"
                          fontSize="9"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {svc.rps.toLocaleString()} rps · Risk {svc.riskScore.toFixed(0)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>

            {/* Detailed Service Inspector Panel */}
            <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col">
              {!serviceDetail ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center py-12 px-4">
                  <p className="font-display text-sm font-semibold text-slate-200">Select a Service Node</p>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Click any node in the dependency graph to inspect live telemetry, direct upstream dependencies, downstream dependents, and calculated failure blast radius.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto max-h-[520px] pr-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`font-mono text-[11px] font-semibold ${HEALTH_META[serviceDetail.service.healthState].badgeText}`}>
                        {HEALTH_META[serviceDetail.service.healthState].shortLabel} · {serviceDetail.service.criticality}
                      </span>
                      <h3 className="font-display text-lg font-semibold text-white mt-0.5">
                        {serviceDetail.service.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">{serviceDetail.service.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectService(null)}
                      className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                    <div>
                      <span className="text-slate-500">Latency</span>
                      <p className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                        {serviceDetail.service.latencyMs} ms (base {serviceDetail.service.baseLatencyMs})
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Error Rate</span>
                      <p className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                        {serviceDetail.service.errorRate.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Request Volume</span>
                      <p className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                        {serviceDetail.service.rps.toLocaleString()} rps
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Failure Risk Score</span>
                      <p className="font-mono tabular-nums text-amber-400 font-semibold mt-0.5">
                        {serviceDetail.service.riskScore.toFixed(1)} / 100
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80">
                    <h4 className="text-xs font-semibold text-slate-200 mb-2">
                      Depends On ({serviceDetail.upstreamDependencies.length})
                    </h4>
                    {serviceDetail.upstreamDependencies.length === 0 ? (
                      <p className="text-xs text-slate-500">Tier-0 foundational node (no upstream dependencies).</p>
                    ) : (
                      <div className="space-y-1.5">
                        {serviceDetail.upstreamDependencies.map(({ edge, service }) => (
                          <button
                            key={edge.id}
                            type="button"
                            onClick={() => onSelectService(service.id)}
                            className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#060A14] border border-slate-800/80 hover:border-blue-500/40 text-xs cursor-pointer"
                          >
                            <span className="text-slate-200 font-medium">{service.name}</span>
                            <span className="font-mono text-[10px] text-cyan-400">
                              {edge.dependencyType} · {edge.protocol}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80">
                    <h4 className="text-xs font-semibold text-slate-200 mb-2">
                      Impacted Downstream Dependents ({serviceDetail.downstreamDependents.length})
                    </h4>
                    {serviceDetail.downstreamDependents.length === 0 ? (
                      <p className="text-xs text-slate-500">Leaf node (no other services call this service directly).</p>
                    ) : (
                      <div className="space-y-1.5">
                        {serviceDetail.downstreamDependents.map(({ edge, service }) => (
                          <button
                            key={edge.id}
                            type="button"
                            onClick={() => onSelectService(service.id)}
                            className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#060A14] border border-slate-800/80 hover:border-blue-500/40 text-xs cursor-pointer"
                          >
                            <span className="text-slate-200 font-medium">{service.name}</span>
                            <span className="font-mono text-[10px] text-amber-400">
                              {edge.dependencyType} · {edge.protocol}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80">
                    <h4 className="text-xs font-semibold text-slate-200 mb-1">Calculated Failure Blast Radius</h4>
                    <p className="text-xs text-slate-400">
                      Failure here affects{' '}
                      <span className="font-mono text-amber-300 font-semibold">
                        {serviceDetail.cascadePreview.directlyAffected.length} direct
                      </span>{' '}
                      and{' '}
                      <span className="font-mono text-amber-300 font-semibold">
                        {serviceDetail.cascadePreview.indirectlyAffected.length} indirect
                      </span>{' '}
                      services ({serviceDetail.cascadePreview.estimatedTxAtRisk.toLocaleString()} tx/12m at risk).
                    </p>

                    {serviceDetail.cascadePreview.criticalPaymentPaths.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <span className="text-[11px] text-slate-500">Critical Paths Exposed:</span>
                        {serviceDetail.cascadePreview.criticalPaymentPaths.slice(0, 2).map((pathArr, idx) => (
                          <p key={idx} className="text-[11px] font-mono text-slate-300 leading-snug">
                            {pathArr.join(' → ')}
                          </p>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onNavigateToSimulator(serviceDetail.service.id)}
                      className="mt-3 w-full py-2 px-3 rounded-lg bg-red-600/20 border border-red-500/40 hover:bg-red-600/30 text-xs font-semibold text-red-300 cursor-pointer"
                    >
                      Simulate Failure on {serviceDetail.service.name}
                    </button>
                  </div>

                  {serviceDetail.recentIncidents.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/80">
                      <h4 className="text-xs font-semibold text-slate-200 mb-2">Recent Service Incidents</h4>
                      <div className="space-y-2">
                        {serviceDetail.recentIncidents.slice(0, 3).map((inc) => (
                          <div key={inc.id} className="text-xs">
                            <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                              <span>{inc.id}</span>
                              <span>{formatTimestamp(inc.startedAt).slice(0, 10)}</span>
                            </div>
                            <p className="text-slate-300 font-medium mt-0.5">{inc.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* TAB 2: CRITICAL DEPENDENCY & SINGLE POINT OF FAILURE (SPOF) ANALYSIS */}
      {subTab === 'spof' && spofData && (
        <div className="space-y-5">
          {/* Summary Strip */}
          <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <p className="font-semibold text-slate-100">
                  Critical Dependency & Single Point of Failure Analysis
                </p>
                <p className="text-[11px] text-slate-400">{spofData.dataNotice}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">SERVICES ANALYZED</span>
                <span className="text-sm font-semibold text-slate-100">{spofData.totalServicesAnalyzed}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">HIGH-EXPOSURE SPOFS</span>
                <span className="text-sm font-semibold text-amber-400">{spofData.spofCount}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* SPOF Ranked Table */}
            <div className="xl:col-span-2 rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
              <h3 className="font-display text-base font-semibold text-white mb-3">
                Graph-Derived Single Point of Failure Exposure Ranking
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-500">
                      <th className="py-2 pr-3">Service</th>
                      <th className="py-2 px-2">Criticality</th>
                      <th className="py-2 px-2 text-right">Affected Svcs</th>
                      <th className="py-2 px-2 text-right">Crit. Paths</th>
                      <th className="py-2 px-2">Backup Readiness</th>
                      <th className="py-2 pl-2 text-right">SPOF Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {spofData.items.map((item) => {
                      const isSel = selectedSpof?.serviceId === item.serviceId;
                      return (
                        <tr
                          key={item.serviceId}
                          onClick={() => setSelectedSpof(item)}
                          className={`cursor-pointer transition-colors ${
                            isSel ? 'bg-blue-600/10' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 pr-3">
                            <div className="font-medium text-slate-100">{item.serviceName}</div>
                            <div className="text-[10px] text-slate-500">{item.tier}</div>
                          </td>
                          <td className="py-2.5 px-2 font-mono text-[11px]">
                            <span
                              className={
                                item.criticality === 'CRITICAL'
                                  ? 'text-red-400 font-semibold'
                                  : item.criticality === 'HIGH'
                                  ? 'text-amber-400'
                                  : 'text-slate-300'
                              }
                            >
                              {item.criticality}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-200">
                            {item.affectedServicesCount}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-200">
                            {item.criticalPathsCount}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-[10px]">
                            <span
                              className={
                                item.backupReadiness === 'AUTOMATED_STANDBY'
                                  ? 'text-emerald-400'
                                  : item.backupReadiness === 'PARTIAL_ROUTE'
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                              }
                            >
                              {item.backupReadiness.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 pl-2 text-right font-mono tabular-nums font-semibold">
                            <span
                              className={
                                item.spofSeverityScore >= 75
                                  ? 'text-red-400'
                                  : item.spofSeverityScore >= 60
                                  ? 'text-amber-400'
                                  : 'text-cyan-300'
                              }
                            >
                              {item.spofSeverityScore}/100
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected SPOF Deep Dive */}
            <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-4">
              {selectedSpof && (
                <>
                  <div className="pb-3 border-b border-slate-800/80 flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[11px] text-amber-400 font-semibold">
                        SPOF EXPOSURE BRIEF · {selectedSpof.criticality}
                      </span>
                      <h4 className="font-display text-lg font-semibold text-white mt-0.5">
                        {selectedSpof.serviceName}
                      </h4>
                    </div>
                    <span className="font-mono tabular-nums text-lg font-semibold text-red-400">
                      {selectedSpof.spofSeverityScore}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-slate-500 block font-medium">Risk Explanation (Graph-Verified)</span>
                      <p className="text-slate-300 mt-1 leading-relaxed">{selectedSpof.riskExplanation}</p>
                    </div>

                    <div>
                      <span className="text-slate-500 block font-medium">
                        Affected Downstream Services ({selectedSpof.downstreamDependents.length})
                      </span>
                      <p className="font-mono text-[11px] text-cyan-300 mt-1 leading-relaxed">
                        {selectedSpof.downstreamDependents.join(' · ')}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500 block font-medium">Alternative Routes & Backup Readiness</span>
                      <p className="text-slate-300 mt-1">{selectedSpof.alternativeRoutes}</p>
                    </div>

                    {selectedSpof.criticalPaths.length > 0 && (
                      <div>
                        <span className="text-slate-500 block font-medium mb-1">
                          Critical Payment Paths Exposed ({selectedSpof.criticalPathsCount})
                        </span>
                        <div className="space-y-1">
                          {selectedSpof.criticalPaths.slice(0, 3).map((p, idx) => (
                            <p
                              key={idx}
                              className="font-mono text-[10px] text-red-300 bg-red-500/5 px-2 py-1 rounded"
                            >
                              {p.join(' → ')}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <span className="font-semibold text-emerald-300 block">Recommended Preventive Action</span>
                      <p className="text-slate-300 mt-1 leading-relaxed">
                        {selectedSpof.recommendedPreventiveAction}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigateToSimulator(selectedSpof.serviceId)}
                      className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
                    >
                      Test Failure / What-If on {selectedSpof.serviceName}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
