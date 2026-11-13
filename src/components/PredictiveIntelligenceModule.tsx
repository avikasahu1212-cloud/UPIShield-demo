import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ExplainablePrediction, ServiceNode } from '../types.ts';

interface PredictionsResponse {
  dataNotice: string;
  methodology: {
    modelType: string;
    weights: {
      seasonality: number;
      latencyTrend: number;
      dependencyCentrality: number;
      errorDrift: number;
    };
    totalObservationsAnalyzed: number;
    yearsCovered: string;
  };
  octoberPatternDiscovery: {
    detectedPeakMonth: string;
    zScore: number;
    octoberIncidentsTotal: number;
    nonOctoberMonthlyAvg: number;
    octoberLatencyAvgMs: number;
    octoberVolumeSurgePct: number;
    summary: string;
  };
  seasonalCalendar: Array<{
    month: number;
    monthLabel: string;
    totalIncidents: number;
    avgLatencyMs: number;
    avgErrorRatePct: number;
    avgTxVolume: number;
    zScore: number;
    riskIndex: number;
    anomalyDetected: boolean;
  }>;
  heatmap: Array<{
    year: number;
    months: Array<{
      month: number;
      monthLabel: string;
      incidents: number;
      avgLatencyMs: number;
      available: boolean;
    }>;
  }>;
  yoyComparison: Array<{
    year: string;
    totalIncidents: number;
    octoberIncidents: number;
    avgLatencyMs: number;
    octoberLatencyMs: number;
  }>;
  serviceFrequency: Array<{
    serviceId: string;
    serviceName: string;
    totalIncidents: number;
    octoberIncidents: number;
    avgLatencyMs: number;
  }>;
  latencyTrend: Array<{
    period: string;
    avgLatencyMs: number;
    p95LatencyMs: number;
    errorRatePct: number;
    isOctober: boolean;
  }>;
  forecastVsActual: Array<{
    period: string;
    actualIncidents: number;
    forecastIncidents: number;
    actualLatencyMs: number;
    forecastLatencyMs: number;
  }>;
  durationBuckets: Array<{ bucket: string; count: number }>;
  outlook7Day: ExplainablePrediction[];
  outlook30Day: ExplainablePrediction[];
  predictions: ExplainablePrediction[];
}

interface PredictiveIntelligenceModuleProps {
  refreshTrigger: number;
  services: ServiceNode[];
}

export const PredictiveIntelligenceModule: React.FC<PredictiveIntelligenceModuleProps> = ({
  refreshTrigger,
  services,
}) => {
  const [data, setData] = useState<PredictionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [outlookHorizon, setOutlookHorizon] = useState<'7d' | '30d'>('30d');
  const [selectedPredId, setSelectedPredId] = useState<string>('PRED-UPI-GATEWAY');

  useEffect(() => {
    const params = new URLSearchParams();
    if (yearFilter !== 'all') params.set('year', yearFilter);
    if (serviceFilter !== 'all') params.set('serviceId', serviceFilter);
    if (severityFilter !== 'all') params.set('severity', severityFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);

    setLoading(true);
    fetch(`/api/predictions?${params.toString()}`)
      .then((r) => r.json())
      .then((d: PredictionsResponse) => {
        setData(d);
        if (d.predictions.length > 0 && !d.predictions.some((p) => p.id === selectedPredId)) {
          setSelectedPredId(d.predictions[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [yearFilter, serviceFilter, severityFilter, categoryFilter, refreshTrigger]);

  if (loading && !data) {
    return <div className="h-[640px] rounded-xl bg-[#0C1222] border border-slate-800 animate-pulse" />;
  }

  if (!data) return null;

  const activePredictions = outlookHorizon === '7d' ? data.outlook7Day : data.outlook30Day;
  const selectedPrediction =
    data.predictions.find((p) => p.id === selectedPredId) ?? data.predictions[0];

  return (
    <div className="space-y-6">
      {/* Synthetic Notice & Model Methodology */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-amber-300 font-semibold">
              {data.dataNotice}
            </p>
            <h2 className="font-display text-xl font-semibold text-white mt-1">
              Predictive Failure Intelligence & 2022–2026 Historical Analytics
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {data.methodology.modelType} · Analyzed{' '}
              <span className="font-mono text-slate-200">{data.methodology.totalObservationsAnalyzed}</span>{' '}
              monthly service observations ({data.methodology.yearsCovered}). Predictions are statistical estimates, not guarantees.
            </p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <select
              aria-label="Filter by Year"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-200"
            >
              <option value="all">All Years (2022–2026)</option>
              <option value="2022">2022</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>

            <select
              aria-label="Filter by Service"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-200"
            >
              <option value="all">All 12 Services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by Severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-200"
            >
              <option value="all">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
            </select>

            <select
              aria-label="Filter by Incident Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-200"
            >
              <option value="all">All Categories</option>
              <option value="Payment Gateway Degradation">Payment Gateway Degradation</option>
              <option value="Database Overload">Database Overload</option>
              <option value="Authentication Failure">Authentication Failure</option>
              <option value="Cloud Provider Outage">Cloud Provider Outage</option>
              <option value="API Timeout">API Timeout</option>
              <option value="Network Latency Spike">Network Latency Spike</option>
              <option value="Traffic Overload">Traffic Overload</option>
            </select>
          </div>
        </div>
      </section>

      {/* Data-Derived October Anomaly Discovery */}
      <section className="rounded-xl bg-[#0C1222] border border-amber-500/30 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-mono font-semibold text-amber-400">
              DETECTED SEASONAL ANOMALY · PEAK MONTH: {data.octoberPatternDiscovery.detectedPeakMonth.toUpperCase()} (Z-SCORE +{data.octoberPatternDiscovery.zScore})
            </span>
            <h3 className="font-display text-lg font-semibold text-white">
              Recurring {data.octoberPatternDiscovery.detectedPeakMonth} Infrastructure Stress Derived From Historical Dataset
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              {data.octoberPatternDiscovery.summary}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800 pt-3 lg:pt-0 lg:pl-6">
            <div>
              <span className="text-[11px] text-slate-500">Oct Incidents (22–26)</span>
              <p className="font-mono tabular-nums text-xl font-semibold text-amber-400 mt-0.5">
                {data.octoberPatternDiscovery.octoberIncidentsTotal}
              </p>
              <span className="text-[11px] text-slate-500">
                vs {data.octoberPatternDiscovery.nonOctoberMonthlyAvg} avg/mo
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">Volume Surge</span>
              <p className="font-mono tabular-nums text-xl font-semibold text-cyan-400 mt-0.5">
                +{data.octoberPatternDiscovery.octoberVolumeSurgePct}%
              </p>
              <span className="text-[11px] text-slate-500">Seasonal peak load</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500">Oct Mean Latency</span>
              <p className="font-mono tabular-nums text-xl font-semibold text-slate-100 mt-0.5">
                {data.octoberPatternDiscovery.octoberLatencyAvgMs}ms
              </p>
              <span className="text-[11px] text-slate-500">Across 12 services</span>
            </div>
          </div>
        </div>
      </section>

      {/* Explainable Prediction Panel + 7d / 30d Outlook */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Outlook Selector List */}
        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-display text-base font-semibold text-white">Risk Outlook</h3>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#060A14] border border-slate-800">
              <button
                type="button"
                onClick={() => setOutlookHorizon('7d')}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                  outlookHorizon === '7d' ? 'bg-blue-600/20 text-cyan-300' : 'text-slate-400'
                }`}
              >
                Next 7 Days
              </button>
              <button
                type="button"
                onClick={() => setOutlookHorizon('30d')}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                  outlookHorizon === '30d' ? 'bg-blue-600/20 text-cyan-300' : 'text-slate-400'
                }`}
              >
                Next 30 Days
              </button>
            </div>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[460px] pr-1">
            {activePredictions.map((pred) => {
              const isSelected = selectedPrediction?.id === pred.id;
              return (
                <button
                  key={pred.id}
                  type="button"
                  onClick={() => setSelectedPredId(pred.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/40'
                      : 'bg-[#060A14] border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100 truncate">
                      {pred.serviceName}
                    </span>
                    <span
                      className={`font-mono tabular-nums text-xs font-semibold ${
                        pred.riskScore >= 70
                          ? 'text-red-400'
                          : pred.riskScore >= 55
                          ? 'text-amber-400'
                          : 'text-cyan-400'
                      }`}
                    >
                      {pred.riskScore.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 font-mono">
                    <span>{pred.riskLevel}</span>
                    <span>{pred.confidencePct}% evidence confidence</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 6-Question Explainable Prediction Panel */}
        {selectedPrediction && (
          <div className="xl:col-span-2 rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
              <div>
                <span className="text-xs font-mono text-cyan-400">
                  EXPLAINABLE PREDICTION PANEL · CONFIDENCE {selectedPrediction.confidencePct}%
                </span>
                <h3 className="font-display text-xl font-semibold text-white mt-0.5">
                  {selectedPrediction.headline}
                </h3>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[11px] text-slate-400 block">Composite Risk Score</span>
                <span className="font-mono tabular-nums text-2xl font-semibold text-amber-400">
                  {selectedPrediction.riskScore.toFixed(1)} / 100
                </span>
              </div>
            </div>

            {/* Contributing Factor Weights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {selectedPrediction.contributingFactors.map((cf) => (
                <div key={cf.factor} className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{cf.factor}</span>
                    <span className="font-mono text-cyan-400">{cf.weightPct}%</span>
                  </div>
                  <p className="font-mono text-xs font-semibold text-slate-100 mt-1">
                    {cf.metricValue}
                  </p>
                </div>
              ))}
            </div>

            {/* 6 Required Answers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <h4 className="font-semibold text-slate-200">1. What could fail?</h4>
                <p className="text-slate-400 leading-relaxed">{selectedPrediction.whatCouldFail}</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-slate-200">2. When could it happen?</h4>
                <p className="text-slate-400 leading-relaxed">{selectedPrediction.whenCouldItHappen}</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-slate-200">3. Historical evidence</h4>
                <ul className="space-y-1 text-slate-400 list-disc pl-4">
                  {selectedPrediction.historicalEvidence.map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-200">4. Affected downstream & coupled services</h4>
                  <p className="font-mono text-cyan-300">
                    {selectedPrediction.affectedServices.join(' · ')}
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-slate-200">5. Estimated operational impact</h4>
                  <p className="text-amber-300">{selectedPrediction.estimatedImpact}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80">
              <h4 className="text-xs font-semibold text-slate-200 mb-2">
                6. Recommended preventive actions (pre-peak readiness)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedPrediction.preventiveActions.map((act, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 rounded-lg bg-[#060A14] border border-slate-800/80 text-xs text-slate-300"
                  >
                    {idx + 1}. {act}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Monthly Incident Heatmap (2022–2026) + Monthly Risk Calendar */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold text-white">
              Monthly Incident Heatmap (2022–2026 Synthetic Dataset)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Incident count by calendar month across years — highlights recurring seasonal clustering
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-separate border-spacing-1.5 text-xs">
              <thead>
                <tr className="text-[11px] font-mono text-slate-400">
                  <th className="text-left pr-2">Year</th>
                  {data.seasonalCalendar.map((m) => (
                    <th key={m.month} className={m.anomalyDetected ? 'text-amber-400 font-semibold' : ''}>
                      {m.monthLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.heatmap.map((row) => (
                  <tr key={row.year}>
                    <td className="text-left font-mono font-semibold text-slate-300 pr-2">{row.year}</td>
                    {row.months.map((cell) => {
                      const bg = !cell.available
                        ? 'bg-slate-900/40 text-slate-700'
                        : cell.incidents >= 7
                        ? 'bg-red-500/35 text-red-200 border border-red-500/50'
                        : cell.incidents >= 4
                        ? 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                        : cell.incidents >= 1
                        ? 'bg-blue-500/20 text-cyan-200 border border-blue-500/30'
                        : 'bg-[#060A14] text-slate-500 border border-slate-800/70';

                      return (
                        <td
                          key={cell.month}
                          title={`${row.year} ${cell.monthLabel}: ${cell.incidents} synthetic incidents, ${cell.avgLatencyMs}ms avg latency`}
                          className={`py-2 px-1 rounded font-mono tabular-nums text-[11px] ${bg}`}
                        >
                          {cell.available ? cell.incidents : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Risk Calendar */}
        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <h3 className="font-display text-base font-semibold text-white">Seasonal Risk Calendar</h3>
          <p className="text-xs text-slate-400 mt-0.5 mb-4">
            Derived seasonal risk index & z-score per month
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {data.seasonalCalendar.map((m) => (
              <div
                key={m.month}
                className={`p-2.5 rounded-lg border text-xs ${
                  m.anomalyDetected
                    ? 'bg-amber-500/10 border-amber-500/40'
                    : 'bg-[#060A14] border-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{m.monthLabel}</span>
                  <span
                    className={`font-mono tabular-nums text-[11px] font-semibold ${
                      m.anomalyDetected ? 'text-amber-400' : 'text-slate-400'
                    }`}
                  >
                    {m.riskIndex}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-slate-500 mt-1">
                  z={m.zScore >= 0 ? `+${m.zScore}` : m.zScore}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* YoY Comparison + Service Failure Frequency */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Year-over-Year Incident Comparison
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Total annual synthetic incidents vs October incidents
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.yoyComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="year" stroke="#64748B" fontSize={11} />
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
                <Bar dataKey="totalIncidents" name="Total Annual Incidents" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="octoberIncidents" name="October Incidents" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Service Failure Frequency
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Synthetic incident concentration across monitored banking services
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.serviceFrequency.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis type="number" stroke="#64748B" fontSize={11} />
                <YAxis type="category" dataKey="serviceName" width={145} stroke="#94A3B8" fontSize={10.5} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0C1222',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                />
                <Bar dataKey="totalIncidents" name="Total Incidents" fill="#06B6D4" radius={[0, 4, 4, 0]} />
                <Bar dataKey="octoberIncidents" name="October Incidents" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Latency Trend + Forecast vs Actual + Duration Distribution */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Latency Trend (2022–2026)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Monthly mean & p95 latency spikes ({serviceFilter === 'all' ? 'UPI Payment Gateway' : serviceFilter})
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.latencyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={10} minTickGap={24} />
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
                <Area type="monotone" dataKey="p95LatencyMs" name="p95 Latency (ms)" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.18} />
                <Area type="monotone" dataKey="avgLatencyMs" name="Avg Latency (ms)" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.22} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Forecast vs Actual Latency (2024–2026)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Seasonal baseline forecast compared against synthetic actuals
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.forecastVsActual}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="period" stroke="#64748B" fontSize={10} minTickGap={20} />
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
                <Bar dataKey="actualLatencyMs" name="Actual Latency (ms)" fill="#2563EB" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="forecastLatencyMs" name="Baseline Forecast (ms)" stroke="#F59E0B" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Incident Duration Distribution
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Synthetic incident resolution time buckets
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.durationBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="bucket" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0C1222',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F1F5F9',
                  }}
                />
                <Bar dataKey="count" name="Incidents" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
};
