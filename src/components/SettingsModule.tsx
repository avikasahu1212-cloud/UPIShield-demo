import React, { useEffect, useState } from 'react';
import { Database, Play, RefreshCw, RotateCcw } from 'lucide-react';
import type { AuditLogRecord, ServiceNode } from '../types.ts';
import { HEALTH_META, formatTimestamp } from '../utils/format.ts';

interface SettingsModuleProps {
  refreshTrigger: number;
  services: ServiceNode[];
  onDataChanged: () => void;
  onRunFullDemo: () => void;
  onOpenPredictive: () => void;
  onOpenIncidents: () => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  refreshTrigger,
  services,
  onDataChanged,
  onRunFullDemo,
  onOpenPredictive,
  onOpenIncidents,
}) => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadLogs = () => {
    fetch('/api/audit-logs')
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    loadLogs();
  }, [refreshTrigger]);

  const handleResetDemo = async () => {
    setBusy('reset');
    await fetch('/api/simulator/reset', { method: 'POST' });
    setNotice('Demo state reset: all 12 services restored to GREEN baseline and temporary simulations cleared.');
    loadLogs();
    onDataChanged();
    setBusy(null);
  };

  const handleRestoreService = async (serviceId: string, name: string) => {
    setBusy(serviceId);
    await fetch(`/api/simulator/restore/${encodeURIComponent(serviceId)}`, { method: 'POST' });
    setNotice(`Restored ${name} to GREEN nominal baseline.`);
    loadLogs();
    onDataChanged();
    setBusy(null);
  };

  return (
    <div className="space-y-6">
      {/* Demo Control Panel */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-4">
        <div>
          <span className="text-xs font-mono text-amber-300 font-semibold">
            DEMO CONTROL PANEL · DETERMINISTIC SQLITE PERSISTENCE
          </span>
          <h2 className="font-display text-xl font-semibold text-white mt-1">
            Platform Configuration, Demo Controls & Audit Governance
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Control synthetic demonstration state, restore degraded nodes, inspect predictive weights, and audit platform actions.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleResetDemo}
            disabled={busy === 'reset'}
            className="h-9 px-4 rounded-lg bg-[#060A14] border border-slate-700 hover:border-cyan-500/40 text-xs font-medium text-slate-200 flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            {busy === 'reset' ? 'Resetting...' : 'Reset Demo State'}
          </button>

          <button
            type="button"
            onClick={onRunFullDemo}
            className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Run Full Resilience Demo
          </button>

          <button
            type="button"
            onClick={onOpenPredictive}
            className="h-9 px-4 rounded-lg bg-[#060A14] border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Generate Predictive Analysis
          </button>

          <button
            type="button"
            onClick={onOpenIncidents}
            className="h-9 px-4 rounded-lg bg-[#060A14] border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 flex items-center gap-2 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            View Historical Incidents (2022–2026)
          </button>
        </div>

        {notice && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
            {notice}
          </div>
        )}
      </section>

      {/* Per-Service Quick Restore & Predictive Weights */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Individual Service Restoration
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Restore any service immediately to its deterministic baseline metrics
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {services.map((svc) => {
              const meta = HEALTH_META[svc.healthState];
              return (
                <div
                  key={svc.id}
                  className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100 truncate">{svc.name}</p>
                    <span className={`font-mono text-[10px] font-semibold ${meta.badgeText}`}>
                      {meta.shortLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestoreService(svc.id, svc.name)}
                    disabled={svc.healthState === 'GREEN' || busy === svc.id}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px] text-slate-200 cursor-pointer shrink-0"
                  >
                    Restore
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-3 text-xs">
          <h3 className="font-display text-base font-semibold text-white">
            Explainable Risk Model Weights
          </h3>
          <p className="text-slate-400">
            Transparent local statistical scoring applied across 2022–2026 synthetic records:
          </p>
          <div className="space-y-2 pt-2">
            {[
              { name: 'Seasonal Monthly Baseline (Oct Z-Score)', weight: '32%' },
              { name: 'Recent 8-Month Latency OLS Slope', weight: '28%' },
              { name: 'Dependency Graph Centrality', weight: '22%' },
              { name: 'Upstream Error-Rate Drift', weight: '18%' },
            ].map((w) => (
              <div key={w.name} className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-300">{w.name}</span>
                <span className="font-mono font-semibold text-cyan-400">{w.weight}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 pt-2">
            Core analytics, graph blast radius, and recovery workflows run 100% locally on Node.js + SQLite without external dependencies.
          </p>
        </div>
      </section>

      {/* Persistent Audit Logs */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
        <h3 className="font-display text-base font-semibold text-white mb-1">Platform Audit Trail</h3>
        <p className="text-xs text-slate-400 mb-4">
          Chronological record of simulations, operator approvals, verifications, and report exports
        </p>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-500">
                <th className="py-2 pr-3">Timestamp</th>
                <th className="py-2 px-3">Actor</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 pl-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 pr-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {formatTimestamp(log.createdAt)}
                  </td>
                  <td className="py-2 px-3 text-slate-300 whitespace-nowrap">{log.actor}</td>
                  <td className="py-2 px-3 font-mono text-[11px] text-cyan-400 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-2 pl-3 text-slate-400">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
