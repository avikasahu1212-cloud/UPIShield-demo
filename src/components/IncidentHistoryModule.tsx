import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Search, UserCheck } from 'lucide-react';
import type { IncidentRecord, ServiceNode } from '../types.ts';
import { formatDurationSeconds, formatInrCompact, formatTimestamp, severityClass } from '../utils/format.ts';

interface IncidentHistoryModuleProps {
  refreshTrigger: number;
  services: ServiceNode[];
  globalSearch: string;
}

export const IncidentHistoryModule: React.FC<IncidentHistoryModuleProps> = ({
  refreshTrigger,
  services,
  globalSearch,
}) => {
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(globalSearch);
  const [serviceFilter, setServiceFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [fullDetailsOpen, setFullDetailsOpen] = useState(false);

  useEffect(() => {
    setSearch(globalSearch);
  }, [globalSearch]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (serviceFilter !== 'all') params.set('serviceId', serviceFilter);
    if (severityFilter !== 'all') params.set('severity', severityFilter);
    if (originFilter !== 'all') params.set('origin', originFilter);
    if (search.trim()) params.set('search', search.trim());

    setLoading(true);
    fetch(`/api/incidents?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        const list: IncidentRecord[] = d.incidents ?? [];
        setIncidents(list);
        if (list.length > 0) {
          setSelectedIncident((prev) => {
            if (prev) {
              return list.find((i) => i.id === prev.id) ?? list[0];
            }
            return list[0];
          });
        } else {
          setSelectedIncident(null);
          setFullDetailsOpen(false);
        }
      })
      .finally(() => setLoading(false));
  }, [serviceFilter, severityFilter, originFilter, search, refreshTrigger]);

  return (
    <div className="space-y-5">
      {/* Filter Header */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono text-cyan-400 font-semibold">
            ENTERPRISE INCIDENT MANAGEMENT LEDGER
          </span>
          <h2 className="font-display text-xl font-semibold text-white mt-0.5">
            Incident History, Assigned Operators & Audit Timelines
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Separates 2022–2026 seeded synthetic demonstration records from live operator simulation injections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter incidents..."
              className="h-9 pl-8 pr-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-200 w-48"
            />
          </div>

          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-200"
          >
            <option value="all">All Origins</option>
            <option value="live_simulation">Live Simulation</option>
            <option value="seeded_synthetic">Seeded Historical (2022–2026)</option>
          </select>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-200"
          >
            <option value="all">All Services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-200"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
          </select>
        </div>
      </section>

      {/* DEDICATED FULL INCIDENT DETAILS VIEW */}
      {fullDetailsOpen && selectedIncident ? (
        <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div>
              <button
                type="button"
                onClick={() => setFullDetailsOpen(false)}
                className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 mb-2 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Incident Ledger
              </button>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className="text-cyan-400 font-semibold">{selectedIncident.id}</span>
                <span className="text-slate-600">·</span>
                <span className={`font-semibold ${severityClass(selectedIncident.severity)}`}>
                  {selectedIncident.severity}
                </span>
                <span className="text-slate-600">·</span>
                <span className={selectedIncident.status === 'RESOLVED' ? 'text-emerald-400' : 'text-red-400'}>
                  {selectedIncident.status}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-amber-300">
                  {selectedIncident.origin === 'live_simulation' ? 'LIVE SIMULATION' : 'SYNTHETIC HISTORICAL'}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold text-white mt-1">
                {selectedIncident.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1">{selectedIncident.summary}</p>
            </div>

            <div className="text-right text-xs font-mono space-y-1">
              <div className="text-slate-400">
                Assigned Operator:{' '}
                <span className="text-slate-100 font-sans font-medium">{selectedIncident.assignedOperator}</span>
              </div>
              <div className="text-slate-400">
                Primary Service:{' '}
                <span className="text-cyan-300">{selectedIncident.serviceName}</span>
              </div>
            </div>
          </div>

          {/* Structured Timestamp & Operational Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
              <span className="text-slate-500 block">Created / Started</span>
              <span className="font-mono text-slate-200 mt-0.5 block">
                {formatTimestamp(selectedIncident.startedAt)}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
              <span className="text-slate-500 block">Detection Time (MTTD)</span>
              <span className="font-mono text-cyan-300 mt-0.5 block">
                {formatTimestamp(selectedIncident.detectedAt)} ({formatDurationSeconds(selectedIncident.mttdSeconds)})
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
              <span className="text-slate-500 block">Recovery Time (MTTR)</span>
              <span className="font-mono text-emerald-400 mt-0.5 block">
                {selectedIncident.resolvedAt
                  ? `${formatTimestamp(selectedIncident.resolvedAt)} (${formatDurationSeconds(selectedIncident.mttrSeconds)})`
                  : 'Pending Recovery'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
              <span className="text-slate-500 block">Tx Exposed / Est. Risk</span>
              <span className="font-mono text-amber-300 mt-0.5 block">
                {selectedIncident.txAtRisk.toLocaleString()} tx · {formatInrCompact(selectedIncident.financialImpactInr)}
              </span>
            </div>
          </div>

          {/* Root Cause, Affected Blast Services, Resolution Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#060A14] border border-slate-800/80">
              <span className="font-semibold text-slate-200 block mb-1.5">Root / Suspected Cause</span>
              <p className="text-slate-300 leading-relaxed">{selectedIncident.rootCause}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#060A14] border border-slate-800/80">
              <span className="font-semibold text-slate-200 block mb-1.5">
                Affected Services ({selectedIncident.affectedServices.length})
              </span>
              <p className="font-mono text-[11px] text-amber-300 leading-relaxed">
                {selectedIncident.affectedServices.join(' · ')}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[#060A14] border border-slate-800/80">
              <span className="font-semibold text-slate-200 block mb-1.5">Resolution Notes</span>
              <p className="text-emerald-300 leading-relaxed">
                {selectedIncident.resolutionNotes || 'Awaiting recovery completion.'}
              </p>
            </div>
          </div>

          {/* Related Recommendations */}
          {selectedIncident.relatedRecommendations && selectedIncident.relatedRecommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-200">
                Related Recovery Recommendations ({selectedIncident.relatedRecommendations.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {selectedIncident.relatedRecommendations.map((rec) => (
                  <div key={rec.id} className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="text-cyan-400">{rec.id}</span>
                      <span
                        className={
                          rec.status === 'EXECUTED'
                            ? 'text-emerald-400'
                            : rec.status === 'PENDING'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }
                      >
                        {rec.status}
                      </span>
                    </div>
                    <p className="font-medium text-slate-100 mt-1">{rec.title}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {rec.approvedBy ? `Approved by ${rec.approvedBy}` : `Requires: ${rec.requiredApproval}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Chronological Timeline */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-200">
              Chronological Event Timeline ({selectedIncident.events?.length ?? 0})
            </h4>
            <div className="space-y-2">
              {selectedIncident.events?.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-cyan-400 font-semibold">{ev.stage}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">{ev.actor}</span>
                    </div>
                    <p className="text-slate-200 mt-0.5">{ev.message}</p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 shrink-0">
                    {formatTimestamp(ev.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Incident Table */}
          <div className="xl:col-span-2 rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
            {loading ? (
              <div className="h-64 animate-pulse bg-slate-900/50 rounded-lg" />
            ) : incidents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No incidents match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-500">
                      <th className="py-2 pr-3">Incident</th>
                      <th className="py-2 px-2">Service</th>
                      <th className="py-2 px-2">Assigned Operator</th>
                      <th className="py-2 px-2">Severity / Status</th>
                      <th className="py-2 pl-2 text-right">MTTD / MTTR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {incidents.map((inc) => {
                      const isSel = selectedIncident?.id === inc.id;
                      return (
                        <tr
                          key={inc.id}
                          onClick={() => setSelectedIncident(inc)}
                          className={`cursor-pointer transition-colors ${
                            isSel ? 'bg-blue-600/10' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <span className="text-cyan-400">{inc.id}</span>
                              <span className="text-[10px] text-slate-500">
                                {inc.origin === 'live_simulation' ? 'LIVE SIM' : 'HISTORICAL'}
                              </span>
                            </div>
                            <div className="font-medium text-slate-100 mt-0.5">{inc.title}</div>
                          </td>
                          <td className="py-2.5 px-2 text-slate-300">{inc.serviceName}</td>
                          <td className="py-2.5 px-2 text-slate-400 text-[11px]">{inc.assignedOperator}</td>
                          <td className="py-2.5 px-2 font-mono text-[11px] whitespace-nowrap">
                            <span className={`font-semibold ${severityClass(inc.severity)}`}>{inc.severity}</span>
                            <span className="text-slate-600 mx-1">·</span>
                            <span className={inc.status === 'RESOLVED' ? 'text-emerald-400' : 'text-red-400'}>
                              {inc.status}
                            </span>
                          </td>
                          <td className="py-2.5 pl-2 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                            {formatDurationSeconds(inc.mttdSeconds)} /{' '}
                            {inc.mttrSeconds > 0 ? formatDurationSeconds(inc.mttrSeconds) : 'Active'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detail Inspector Panel */}
          <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
            {!selectedIncident ? (
              <p className="text-xs text-slate-500 text-center py-12">Select an incident to inspect timeline.</p>
            ) : (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-800/80 flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs text-cyan-400">{selectedIncident.id}</span>
                    <h3 className="font-display text-base font-semibold text-white mt-0.5">
                      {selectedIncident.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">{selectedIncident.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFullDetailsOpen(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#060A14] border border-slate-700 hover:border-cyan-500/40 text-[11px] font-medium text-cyan-300 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" /> Full View
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Assigned Operator
                    </span>
                    <p className="text-slate-200 font-medium mt-0.5">{selectedIncident.assignedOperator}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Tx at Risk / Exposure</span>
                    <p className="font-mono tabular-nums font-semibold text-amber-400 mt-0.5">
                      {selectedIncident.txAtRisk.toLocaleString()} ({formatInrCompact(selectedIncident.financialImpactInr)})
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Detected</span>
                    <p className="font-mono text-[11px] text-slate-300 mt-0.5">
                      {formatTimestamp(selectedIncident.detectedAt)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Recovered</span>
                    <p className="font-mono text-[11px] text-slate-300 mt-0.5">
                      {selectedIncident.resolvedAt ? formatTimestamp(selectedIncident.resolvedAt) : 'Active'}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 text-xs space-y-2">
                  <div>
                    <span className="font-semibold text-slate-200 block mb-0.5">Root / Suspected Cause</span>
                    <p className="text-slate-400 leading-relaxed">{selectedIncident.rootCause}</p>
                  </div>
                  {selectedIncident.resolutionNotes && (
                    <div>
                      <span className="font-semibold text-slate-200 block mb-0.5">Resolution Notes</span>
                      <p className="text-emerald-300/90 leading-relaxed">{selectedIncident.resolutionNotes}</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  <span className="text-xs font-semibold text-slate-200 block mb-2">
                    Chronological Timeline ({selectedIncident.events?.length ?? 0})
                  </span>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedIncident.events?.map((ev) => (
                      <div key={ev.id} className="p-2.5 rounded-lg bg-[#060A14] border border-slate-800/80 text-xs">
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-cyan-400 font-semibold">{ev.stage}</span>
                          <span className="text-slate-500">{formatTimestamp(ev.createdAt).slice(11, 19)}</span>
                        </div>
                        <p className="text-slate-300 mt-1">{ev.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
