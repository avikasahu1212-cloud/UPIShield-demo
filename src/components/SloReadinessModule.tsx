import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Gauge, Save, ShieldCheck } from 'lucide-react';
import type { ServiceReadinessItem, SloServiceStatus } from '../types.ts';

interface ReadinessResponse {
  dataNotice: string;
  overallScore: number;
  readinessBand: 'STRONG' | 'MODERATE' | 'NEEDS_IMPROVEMENT';
  services: ServiceReadinessItem[];
  missingCapabilitiesSummary: Array<{ capability: string; affectedServices: string[]; count: number }>;
  highPriorityImprovements: Array<{ serviceId: string; serviceName: string; score: number; action: string }>;
  methodology: string;
}

interface SloResponse {
  dataNotice: string;
  windowDays: number;
  breachedCount: number;
  warningCount: number;
  overallSloCompliancePct: number;
  services: SloServiceStatus[];
}

export const SloReadinessModule: React.FC<{
  refreshTrigger: number;
  onDataChanged: () => void;
}> = ({ refreshTrigger, onDataChanged }) => {
  const [activeTab, setActiveTab] = useState<'slo' | 'readiness'>('slo');
  const [sloData, setSloData] = useState<SloResponse | null>(null);
  const [readinessData, setReadinessData] = useState<ReadinessResponse | null>(null);
  const [selectedReadinessSvc, setSelectedReadinessSvc] = useState<ServiceReadinessItem | null>(null);
  const [selectedSloSvc, setSelectedSloSvc] = useState<SloServiceStatus | null>(null);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState<string>('99.95');
  const [savingTarget, setSavingTarget] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [sloRes, readyRes] = await Promise.all([
        fetch('/api/analysis/slo'),
        fetch('/api/analysis/readiness'),
      ]);
      const sloJson = (await sloRes.json()) as SloResponse;
      const readyJson = (await readyRes.json()) as ReadinessResponse;
      setSloData(sloJson);
      setReadinessData(readyJson);
      if (readyJson.services.length > 0 && !selectedReadinessSvc) {
        setSelectedReadinessSvc(readyJson.services[0]);
      } else if (selectedReadinessSvc) {
        const refreshed = readyJson.services.find((s) => s.serviceId === selectedReadinessSvc.serviceId);
        if (refreshed) setSelectedReadinessSvc(refreshed);
      }
      if (sloJson.services.length > 0 && !selectedSloSvc) {
        setSelectedSloSvc(sloJson.services[0]);
      } else if (selectedSloSvc) {
        const refreshed = sloJson.services.find((s) => s.serviceId === selectedSloSvc.serviceId);
        if (refreshed) setSelectedSloSvc(refreshed);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [refreshTrigger]);

  const handleSaveTarget = async (serviceId: string) => {
    const num = Number(targetInput);
    if (Number.isNaN(num) || num < 95 || num > 99.999) {
      setFeedback('Target availability must be between 95.000% and 99.999%.');
      return;
    }
    try {
      setSavingTarget(true);
      const res = await fetch('/api/analysis/slo/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, targetPct: num }),
      });
      if (!res.ok) throw new Error('Failed to save SLO target');
      const json = await res.json();
      setSloData(json.slo);
      const refreshed = (json.slo as SloResponse).services.find((s) => s.serviceId === serviceId);
      if (refreshed) setSelectedSloSvc(refreshed);
      setEditingTargetId(null);
      setFeedback(`Updated demonstration SLO target for ${refreshed?.serviceName ?? serviceId} to ${num}%.`);
      onDataChanged();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to update target');
    } finally {
      setSavingTarget(false);
    }
  };

  if (loading && (!sloData || !readinessData)) {
    return <div className="h-[520px] rounded-xl bg-[#0C1222] border border-slate-800 animate-pulse" />;
  }

  return (
    <div className="space-y-5">
      {/* Header & Mode Switch */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono text-cyan-400 font-semibold tracking-wide">
            SITE RELIABILITY ENGINEERING & GOVERNANCE
          </span>
          <h2 className="font-display text-xl font-semibold text-white mt-0.5">
            SLO Error Budgets & Recovery Readiness Assessment
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic 30-day error-budget burn tracking and evidence-backed recovery readiness scoring across all 12 infrastructure services.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#060A14] border border-slate-800 shrink-0 self-start">
          <button
            type="button"
            onClick={() => setActiveTab('slo')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'slo' ? 'bg-blue-600/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            SLO & Error Budgets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('readiness')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'readiness' ? 'bg-blue-600/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Recovery Readiness ({readinessData?.overallScore ?? 0}/100)
          </button>
        </div>
      </section>

      {feedback && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
          {feedback}
        </div>
      )}

      {/* TAB 1: SLO & ERROR BUDGET MONITORING */}
      {activeTab === 'slo' && sloData && (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-4">
              <span className="text-xs text-slate-400">Overall SLO Compliance</span>
              <p className="font-mono tabular-nums text-2xl font-semibold text-emerald-400 mt-1.5">
                {sloData.overallSloCompliancePct}%
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {sloData.services.length - sloData.breachedCount}/{sloData.services.length} services within budget
              </p>
            </div>
            <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-4">
              <span className="text-xs text-slate-400">SLO Breaches</span>
              <p
                className={`font-mono tabular-nums text-2xl font-semibold mt-1.5 ${
                  sloData.breachedCount > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {sloData.breachedCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Error budget exhausted (30d window)</p>
            </div>
            <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-4">
              <span className="text-xs text-slate-400">High Burn Rate Warnings</span>
              <p
                className={`font-mono tabular-nums text-2xl font-semibold mt-1.5 ${
                  sloData.warningCount > 0 ? 'text-amber-400' : 'text-slate-100'
                }`}
              >
                {sloData.warningCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">&lt;35% remaining error budget</p>
            </div>
            <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-4">
              <span className="text-xs text-slate-400">Evaluation Window</span>
              <p className="font-mono tabular-nums text-2xl font-semibold text-cyan-400 mt-1.5">
                {sloData.windowDays} Days
              </p>
              <p className="text-[11px] text-slate-500 mt-1">43,200 rolling minutes · Demo targets configurable</p>
            </div>
          </section>

          {/* SLO Breach Alerts if any */}
          {sloData.services.some((s) => s.burnRateStatus !== 'NOMINAL') && (
            <section className="rounded-xl bg-amber-500/5 border border-amber-500/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Active SLO Burn & Breach Advisories</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                {sloData.services
                  .filter((s) => s.burnRateStatus !== 'NOMINAL')
                  .map((s) => (
                    <div
                      key={s.serviceId}
                      className="p-2.5 rounded-lg bg-[#060A14] border border-slate-800/80 flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-semibold text-slate-100">{s.serviceName}</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Actual {s.actualAvailabilityPct}% vs Target {s.availabilityTargetPct}% ·{' '}
                          {s.errorBudgetRemainingMinutes}m budget remaining
                        </p>
                      </div>
                      <span
                        className={`font-mono text-[10px] font-semibold shrink-0 ${
                          s.burnRateStatus === 'BREACHED' ? 'text-red-400' : 'text-amber-400'
                        }`}
                      >
                        {s.burnRateStatus}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* SLO Table + Calculation Detail Inspector */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-white">
                    Service-Level Objectives & Error Budget Ledger
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{sloData.dataNotice}</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-500">
                      <th className="py-2 pr-3">Service</th>
                      <th className="py-2 px-2 text-right">Target %</th>
                      <th className="py-2 px-2 text-right">Actual %</th>
                      <th className="py-2 px-2 text-right">Err %</th>
                      <th className="py-2 px-2 text-right">p50 / p95 / p99</th>
                      <th className="py-2 px-2 text-right">Budget Left</th>
                      <th className="py-2 pl-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sloData.services.map((svc) => {
                      const isSel = selectedSloSvc?.serviceId === svc.serviceId;
                      return (
                        <tr
                          key={svc.serviceId}
                          onClick={() => setSelectedSloSvc(svc)}
                          className={`cursor-pointer transition-colors ${
                            isSel ? 'bg-blue-600/10' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 pr-3">
                            <div className="font-medium text-slate-100">{svc.serviceName}</div>
                            <div className="text-[10px] font-mono text-slate-500">{svc.criticality}</div>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-300">
                            {svc.availabilityTargetPct.toFixed(2)}%
                          </td>
                          <td
                            className={`py-2.5 px-2 text-right font-mono tabular-nums font-semibold ${
                              svc.sloBreached ? 'text-red-400' : 'text-emerald-400'
                            }`}
                          >
                            {svc.actualAvailabilityPct.toFixed(3)}%
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-300">
                            {svc.errorRatePct.toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                            {svc.p50LatencyMs} / {svc.p95LatencyMs} / {svc.p99LatencyMs}ms
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                            <span
                              className={
                                svc.errorBudgetRemainingPct <= 10
                                  ? 'text-red-400 font-semibold'
                                  : svc.errorBudgetRemainingPct < 35
                                  ? 'text-amber-400'
                                  : 'text-cyan-300'
                              }
                            >
                              {svc.errorBudgetRemainingPct}% ({svc.errorBudgetRemainingMinutes}m)
                            </span>
                          </td>
                          <td className="py-2.5 pl-2 text-right font-mono text-[11px] font-semibold">
                            <span
                              className={
                                svc.burnRateStatus === 'BREACHED'
                                  ? 'text-red-400'
                                  : svc.burnRateStatus === 'WARNING'
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }
                            >
                              {svc.burnRateStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected Service Error Budget Breakdown & Target Configurator */}
            <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-4">
              {selectedSloSvc ? (
                <>
                  <div className="pb-3 border-b border-slate-800/80">
                    <span className="font-mono text-[11px] text-cyan-400">SLO BUDGET INSPECTOR</span>
                    <h4 className="font-display text-base font-semibold text-white mt-0.5">
                      {selectedSloSvc.serviceName}
                    </h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">30-Day Error Budget Total</span>
                      <span className="font-mono tabular-nums text-slate-100">
                        {selectedSloSvc.errorBudgetTotalMinutes} min
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Budget Consumed</span>
                      <span className="font-mono tabular-nums text-amber-300">
                        {selectedSloSvc.errorBudgetConsumedMinutes} min
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Budget Remaining</span>
                      <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                        {selectedSloSvc.errorBudgetRemainingMinutes} min ({selectedSloSvc.errorBudgetRemainingPct}%)
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full ${
                          selectedSloSvc.burnRateStatus === 'BREACHED'
                            ? 'bg-red-500'
                            : selectedSloSvc.burnRateStatus === 'WARNING'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, selectedSloSvc.errorBudgetRemainingPct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80 text-xs space-y-1.5">
                    <span className="font-semibold text-slate-200 block">How Error Budget Is Calculated</span>
                    <p className="text-slate-400 leading-relaxed text-[11px]">
                      {selectedSloSvc.calculationExplanation}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                    <span className="font-semibold text-slate-200 block">
                      Configure Demo Availability Target (%)
                    </span>
                    {editingTargetId === selectedSloSvc.serviceId ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="95"
                          max="99.999"
                          value={targetInput}
                          onChange={(e) => setTargetInput(e.target.value)}
                          className="flex-1 h-8 px-2.5 rounded-lg bg-[#060A14] border border-slate-700 font-mono text-xs text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveTarget(selectedSloSvc.serviceId)}
                          disabled={savingTarget}
                          className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
                        >
                          <Save className="w-3 h-3" /> Save
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTargetId(selectedSloSvc.serviceId);
                          setTargetInput(String(selectedSloSvc.availabilityTargetPct));
                        }}
                        className="w-full h-8 px-3 rounded-lg bg-[#060A14] border border-slate-700 hover:border-cyan-500/40 text-xs text-cyan-300 cursor-pointer"
                      >
                        Adjust Target (Current: {selectedSloSvc.availabilityTargetPct}%)
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECOVERY READINESS ASSESSMENT */}
      {activeTab === 'readiness' && readinessData && (
        <div className="space-y-5">
          {/* Overall Readiness Banner & High-Priority Improvements */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[11px] text-cyan-400">OVERALL RECOVERY READINESS</span>
                <div className="flex items-baseline gap-3 mt-2">
                  <span className="font-mono tabular-nums text-4xl font-semibold text-white">
                    {readinessData.overallScore}
                  </span>
                  <span className="text-sm text-slate-400 font-mono">/ 100</span>
                  <span
                    className={`font-mono text-xs font-semibold ml-auto ${
                      readinessData.readinessBand === 'STRONG'
                        ? 'text-emerald-400'
                        : readinessData.readinessBand === 'MODERATE'
                        ? 'text-amber-400'
                        : 'text-red-400'
                    }`}
                  >
                    {readinessData.readinessBand}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">{readinessData.methodology}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  Missing Recovery Capabilities Across Estate
                </span>
                {readinessData.missingCapabilitiesSummary.slice(0, 4).map((m) => (
                  <div key={m.capability} className="flex justify-between text-xs">
                    <span className="text-slate-400">{m.capability}</span>
                    <span className="font-mono text-amber-300">{m.count} services</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="xl:col-span-2 rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
              <h3 className="font-display text-base font-semibold text-white mb-1">
                High-Priority Readiness Improvements
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                Ordered by architectural criticality and verified capability gaps (no service receives 100 without drill evidence)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {readinessData.highPriorityImprovements.map((imp) => (
                  <div
                    key={imp.serviceId}
                    onClick={() => {
                      const found = readinessData.services.find((s) => s.serviceId === imp.serviceId);
                      if (found) setSelectedReadinessSvc(found);
                    }}
                    className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80 hover:border-blue-500/40 cursor-pointer text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">{imp.serviceName}</span>
                      <span className="font-mono tabular-nums text-amber-400 font-semibold">
                        {imp.score}/100
                      </span>
                    </div>
                    <p className="text-slate-400 mt-1 leading-snug">{imp.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Service Matrix + 6-Factor Breakdown Inspector */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <div className="xl:col-span-2 rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
              <h3 className="font-display text-base font-semibold text-white mb-3">
                Individual Service Readiness Matrix
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-500">
                      <th className="py-2 pr-3">Service</th>
                      <th className="py-2 px-2 text-right">Backup (20)</th>
                      <th className="py-2 px-2 text-right">Redund. (15)</th>
                      <th className="py-2 px-2 text-right">Runbook (20)</th>
                      <th className="py-2 px-2 text-right">Failover (15)</th>
                      <th className="py-2 px-2 text-right">Drill (15)</th>
                      <th className="py-2 px-2 text-right">Mon. (15)</th>
                      <th className="py-2 pl-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {readinessData.services.map((svc) => {
                      const isSel = selectedReadinessSvc?.serviceId === svc.serviceId;
                      return (
                        <tr
                          key={svc.serviceId}
                          onClick={() => setSelectedReadinessSvc(svc)}
                          className={`cursor-pointer transition-colors ${
                            isSel ? 'bg-blue-600/10' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 pr-3">
                            <div className="font-medium text-slate-100">{svc.serviceName}</div>
                            <div className="text-[10px] font-mono text-slate-500">{svc.criticality}</div>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-300">
                            {svc.breakdown.backupAvailability.score}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-300">
                            {svc.breakdown.dependencyRedundancy.score}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-300">
                            {svc.breakdown.recoveryProcedure.score}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-300">
                            {svc.breakdown.failoverConfiguration.score}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-300">
                            {svc.breakdown.recentRecoveryTest.score}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-300">
                            {svc.breakdown.monitoringCoverage.score}
                          </td>
                          <td className="py-2.5 pl-2 text-right font-mono tabular-nums font-semibold">
                            <span
                              className={
                                svc.overallScore >= 80
                                  ? 'text-emerald-400'
                                  : svc.overallScore >= 65
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                              }
                            >
                              {svc.overallScore}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected Service Evidence Panel */}
            <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-3">
              {selectedReadinessSvc && (
                <>
                  <div className="pb-3 border-b border-slate-800/80 flex items-start justify-between">
                    <div>
                      <span className="font-mono text-[11px] text-cyan-400">READINESS EVIDENCE</span>
                      <h4 className="font-display text-base font-semibold text-white mt-0.5">
                        {selectedReadinessSvc.serviceName}
                      </h4>
                    </div>
                    <span className="font-mono tabular-nums text-lg font-semibold text-amber-400">
                      {selectedReadinessSvc.overallScore}/100
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {[
                      { label: 'Backup Availability', item: selectedReadinessSvc.breakdown.backupAvailability },
                      { label: 'Dependency Redundancy', item: selectedReadinessSvc.breakdown.dependencyRedundancy },
                      { label: 'Recovery Procedure', item: selectedReadinessSvc.breakdown.recoveryProcedure },
                      { label: 'Failover Configuration', item: selectedReadinessSvc.breakdown.failoverConfiguration },
                      { label: 'Recent Recovery Drill', item: selectedReadinessSvc.breakdown.recentRecoveryTest },
                      { label: 'Monitoring Coverage', item: selectedReadinessSvc.breakdown.monitoringCoverage },
                    ].map((row) => (
                      <div key={row.label} className="p-2.5 rounded-lg bg-[#060A14] border border-slate-800/80">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-200">{row.label}</span>
                          <span className="font-mono tabular-nums text-cyan-400">
                            {row.item.score} / {row.item.max}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{row.item.evidence}</p>
                      </div>
                    ))}
                  </div>

                  {selectedReadinessSvc.missingCapabilities.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 text-xs">
                      <span className="font-semibold text-amber-300 block mb-1">Missing Capabilities</span>
                      <ul className="space-y-1 text-[11px] text-slate-400">
                        {selectedReadinessSvc.missingCapabilities.map((mc) => (
                          <li key={mc} className="flex items-center gap-1.5">
                            <span className="text-amber-400">•</span> {mc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-emerald-300 block">Recommended Next Step</span>
                      <p className="text-slate-300 text-[11px] mt-0.5">{selectedReadinessSvc.priorityImprovement}</p>
                    </div>
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
