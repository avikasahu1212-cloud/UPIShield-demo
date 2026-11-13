import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight, Play, RefreshCw } from 'lucide-react';
import type { ExplainablePrediction, ServiceNode } from '../types.ts';
import type { NavSection } from './ShellLayout.tsx';
import { HEALTH_META, formatDurationSeconds, formatInrCompact, formatTimestamp, severityClass } from '../utils/format.ts';

interface OverviewData {
  demoEnvironment: boolean;
  dataNotice: string;
  kpis: {
    healthScore: number;
    paymentAvailabilityPct: number;
    activeIncidents: number;
    criticalServices: number;
    degradedServices: number;
    recoveringServices: number;
    healthyServices: number;
    totalServices: number;
    mttdSeconds: number;
    mttrMinutes: number;
    txSuccessRate: number;
    estimatedOperationalRiskInr: number;
    pendingRecommendations: number;
  };
  services: ServiceNode[];
  operationalTrends: Array<{
    period: string;
    availabilityPct: number;
    avgLatencyMs: number;
    errorRatePct: number;
    incidents: number;
  }>;
  criticalAlerts: Array<{
    id: string;
    title: string;
    serviceId: string;
    serviceName: string;
    severity: string;
    status: string;
    detail: string;
    isActiveIncident: boolean;
  }>;
  predictedRisks30d: ExplainablePrediction[];
  recentEvents: Array<{
    id: string;
    incidentId: string;
    incidentTitle: string;
    stage: string;
    actor: string;
    message: string;
    createdAt: string;
  }>;
}

interface OverviewModuleProps {
  refreshTrigger: number;
  onNavigate: (nav: NavSection) => void;
  onInspectService: (serviceId: string) => void;
  onRunFullDemo: () => void;
  isDemoRunning: boolean;
}

export const OverviewModule: React.FC<OverviewModuleProps> = ({
  refreshTrigger,
  onNavigate,
  onInspectService,
  onRunFullDemo,
  isDemoRunning,
}) => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState<'availability' | 'latency' | 'errors'>('availability');

  const loadOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/overview');
      if (!res.ok) throw new Error('Failed to load Command Center metrics');
      const json = (await res.json()) as OverviewData;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load command center');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [refreshTrigger]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-xl bg-[#0C1222] border border-slate-800/80" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-28 rounded-xl bg-[#0C1222] border border-slate-800/80" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-[#0C1222] border border-slate-800/80" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-xl bg-[#0C1222] border border-red-500/30 text-sm text-red-300 flex items-center justify-between">
        <span>{error ?? 'Command Center unavailable.'}</span>
        <button
          type="button"
          onClick={loadOverview}
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-100 hover:bg-slate-700 cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const { kpis } = data;

  const kpiCards: Array<{
    label: string;
    value: string;
    subtext: string;
    accent?: string;
    target: NavSection;
  }> = [
    {
      label: 'Infrastructure Health Score',
      value: `${kpis.healthScore} / 100`,
      subtext: `${kpis.healthyServices}/${kpis.totalServices} services nominal`,
      accent: kpis.healthScore >= 90 ? 'text-emerald-400' : kpis.healthScore >= 70 ? 'text-amber-400' : 'text-red-400',
      target: 'topology',
    },
    {
      label: 'Payment Availability',
      value: `${kpis.paymentAvailabilityPct}%`,
      subtext: `SLA target 99.99% · Tx success ${kpis.txSuccessRate}%`,
      accent: kpis.paymentAvailabilityPct >= 99.9 ? 'text-cyan-400' : 'text-amber-400',
      target: 'transactions',
    },
    {
      label: 'Active Incidents',
      value: String(kpis.activeIncidents),
      subtext: `${kpis.criticalServices} critical · ${kpis.degradedServices} degraded`,
      accent: kpis.activeIncidents > 0 ? 'text-red-400' : 'text-emerald-400',
      target: 'incidents',
    },
    {
      label: 'Detection / Recovery',
      value: `${formatDurationSeconds(kpis.mttdSeconds)} / ${kpis.mttrMinutes}m`,
      subtext: `Mean MTTD · Mean MTTR (${kpis.pendingRecommendations} pending actions)`,
      accent: 'text-slate-100',
      target: 'recovery',
    },
    {
      label: 'Estimated Operational Risk',
      value: formatInrCompact(kpis.estimatedOperationalRiskInr),
      subtext: `${data.predictedRisks30d.filter((r) => r.riskScore >= 58).length} elevated 30-day forecasts`,
      accent: 'text-amber-400',
      target: 'predictive',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono text-cyan-400 tracking-wide">
            {data.dataNotice}
          </p>
          <h2 className="font-display text-xl font-semibold text-white mt-1 tracking-tight text-balance">
            Payment Infrastructure Continuity & Operational Risk Posture
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Continuous topological observability across UPI clearing, core banking ledgers, error budgets, and predictive seasonal failure baselines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('slo_readiness')}
            className="px-3 py-2 rounded-lg bg-[#060A14] border border-slate-700/80 hover:border-cyan-500/40 text-xs font-medium text-cyan-300 cursor-pointer whitespace-nowrap"
          >
            SLO & Readiness
          </button>
          <button
            type="button"
            onClick={loadOverview}
            className="px-3 py-2 rounded-lg bg-[#111A2E] border border-slate-700/80 hover:border-slate-600 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={onRunFullDemo}
            disabled={isDemoRunning}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            {isDemoRunning ? 'Simulation Active' : 'Run Auto-Simulation'}
          </button>
        </div>
      </section>

      {/* Primary KPI Strip (Every KPI clickable to detailed view) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4" aria-label="Key Resilience Metrics">
        {kpiCards.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => onNavigate(kpi.target)}
            className="text-left rounded-xl bg-[#0C1222] border border-slate-800/80 hover:border-blue-500/40 p-4 transition-colors group cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-400">{kpi.label}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 transition-colors shrink-0" />
            </div>
            <div className={`font-mono tabular-nums text-2xl font-semibold mt-2 ${kpi.accent ?? 'text-white'}`}>
              {kpi.value}
            </div>
            <p className="text-xs text-slate-500 mt-1.5 truncate">{kpi.subtext}</p>
          </button>
        ))}
      </section>

      {/* Infrastructure Health Overview + Critical Alerts */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Monitored Services Grid */}
        <div className="xl:col-span-2 rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                Infrastructure Health Overview
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any monitored node to inspect dependencies and blast radius in Topology Graph
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('topology')}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer whitespace-nowrap"
            >
              Open Live Graph
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-500">
                  <th className="py-2.5 pr-3">Service</th>
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3 text-right">Latency</th>
                  <th className="py-2.5 px-3 text-right">Error Rate</th>
                  <th className="py-2.5 px-3 text-right">Volume</th>
                  <th className="py-2.5 pl-3 text-right">Risk Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {data.services.map((svc) => {
                  const meta = HEALTH_META[svc.healthState];
                  return (
                    <tr
                      key={svc.id}
                      onClick={() => onInspectService(svc.id)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-100">{svc.name}</div>
                        <div className="text-[11px] text-slate-500">{svc.tier} · {svc.criticality}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`font-mono text-[11px] font-semibold ${meta.badgeText}`}>
                          {meta.shortLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">
                        {svc.latencyMs} ms
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200">
                        {svc.errorRate.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                        {svc.rps.toLocaleString()} rps
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums">
                        <span className={svc.riskScore >= 65 ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
                          {svc.riskScore.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Critical Alerts Ranked by Severity */}
        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-white">Critical Alerts</h3>
              <p className="text-xs text-slate-400 mt-0.5">Active disruptions & elevated forecast risks</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('simulator')}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer whitespace-nowrap"
            >
              Simulate
            </button>
          </div>

          {data.criticalAlerts.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center py-8 text-xs text-slate-500">
              <p>No active incidents or critical forecast alerts.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {data.criticalAlerts.slice(0, 6).map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => onNavigate(alert.isActiveIncident ? 'recovery' : 'predictive')}
                  className="w-full text-left py-3 first:pt-0 last:pb-0 hover:bg-slate-800/30 transition-colors rounded px-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className={`font-semibold ${severityClass(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className="text-slate-500">
                      {alert.isActiveIncident ? 'ACTIVE INCIDENT' : '30-DAY FORECAST'}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-100 mt-1">{alert.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{alert.detail}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Operational Trends + 30-Day Risk Forecast */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                Operational Trends (2025–2026 Synthetic Baseline)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Historical availability, latency, error rate, and monthly incident cadence
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#060A14] border border-slate-800 self-start">
              {(
                [
                  { id: 'availability', label: 'Availability %' },
                  { id: 'latency', label: 'Latency (ms)' },
                  { id: 'errors', label: 'Error Rate & Incidents' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTrendMetric(tab.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    trendMetric === tab.id
                      ? 'bg-blue-600/20 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {trendMetric === 'errors' ? (
                <BarChart data={data.operationalTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0C1222',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#F1F5F9',
                    }}
                  />
                  <Bar dataKey="incidents" name="Synthetic Incidents" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="errorRatePct" name="Avg Error Rate %" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={data.operationalTrends}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="period" stroke="#64748B" fontSize={11} />
                  <YAxis
                    stroke="#64748B"
                    fontSize={11}
                    domain={trendMetric === 'availability' ? [99.2, 100] : ['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0C1222',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#F1F5F9',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={trendMetric === 'availability' ? 'availabilityPct' : 'avgLatencyMs'}
                    name={trendMetric === 'availability' ? 'Availability %' : 'Avg Latency (ms)'}
                    stroke="#06B6D4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#trendGrad)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Next 30 Days Risk Forecast */}
        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-white">30-Day Risk Forecast</h3>
              <p className="text-xs text-slate-400 mt-0.5">Seasonal & trend-derived probability estimates</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('predictive')}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer whitespace-nowrap"
            >
              Full Model
            </button>
          </div>

          <div className="space-y-3.5 flex-1">
            {data.predictedRisks30d.map((risk) => (
              <div key={risk.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200 truncate">{risk.serviceName}</span>
                  <span className="font-mono tabular-nums font-semibold text-amber-400 shrink-0">
                    {risk.riskScore.toFixed(1)} / 100
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      risk.riskScore >= 70 ? 'bg-red-500' : risk.riskScore >= 55 ? 'bg-amber-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${Math.min(100, risk.riskScore)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 truncate">{risk.whatCouldFail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chronological Operational Event Feed */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-base font-semibold text-white">Recent Operational Events</h3>
            <p className="text-xs text-slate-400 mt-0.5">Chronological telemetry, detection, and recovery log</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('incidents')}
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer whitespace-nowrap"
          >
            Incident Ledger
          </button>
        </div>

        <div className="divide-y divide-slate-800/60">
          {data.recentEvents.slice(0, 8).map((ev) => (
            <div key={ev.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                  <span className="text-cyan-400">{ev.stage}</span>
                  <span>·</span>
                  <span>{ev.incidentId}</span>
                  <span>·</span>
                  <span>{ev.actor}</span>
                </div>
                <p className="text-slate-200 mt-0.5">{ev.message}</p>
              </div>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                {formatTimestamp(ev.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
