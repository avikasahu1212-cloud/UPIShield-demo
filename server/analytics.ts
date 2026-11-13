import { db } from './db.ts';
import { getAllDependencies, getAllServices } from './topology.ts';
import type { ExplainablePrediction, HistoricalMetricRow } from '../src/types.ts';

interface MetricDbRow {
  id: number;
  year: number;
  month: number;
  service_id: string;
  availability_pct: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  error_rate_pct: number;
  tx_volume: number;
  incident_count: number;
  is_synthetic: number;
}

export function getHistoricalMetrics(filters?: {
  year?: number;
  serviceId?: string;
}): HistoricalMetricRow[] {
  let sql = 'SELECT * FROM historical_metrics WHERE 1=1';
  const params: Array<string | number> = [];

  if (filters?.year) {
    sql += ' AND year = ?';
    params.push(filters.year);
  }
  if (filters?.serviceId) {
    sql += ' AND service_id = ?';
    params.push(filters.serviceId);
  }
  sql += ' ORDER BY year ASC, month ASC, service_id ASC';

  const rows = db.prepare(sql).all(...params) as unknown as MetricDbRow[];
  return rows.map((r) => ({
    id: r.id,
    year: r.year,
    month: r.month,
    serviceId: r.service_id,
    availabilityPct: r.availability_pct,
    avgLatencyMs: r.avg_latency_ms,
    p95LatencyMs: r.p95_latency_ms,
    errorRatePct: r.error_rate_pct,
    txVolume: r.tx_volume,
    incidentCount: r.incident_count,
    isSynthetic: r.is_synthetic === 1,
  }));
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

export function computePredictiveIntelligence(filters?: {
  year?: number;
  serviceId?: string;
  severity?: string;
  category?: string;
}) {
  const services = getAllServices();
  const edges = getAllDependencies();
  const allMetrics = getHistoricalMetrics();
  const filteredMetrics = getHistoricalMetrics({
    year: filters?.year,
    serviceId: filters?.serviceId,
  });

  const serviceMap = new Map(services.map((s) => [s.id, s]));

  // 1. Compute monthly seasonality across 2022–2026 from actual stored records
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyStats = Array.from({ length: 12 }, (_, idx) => {
    const m = idx + 1;
    const rows = allMetrics.filter((r) => r.month === m && (!filters?.serviceId || r.serviceId === filters.serviceId));
    const totalIncidents = rows.reduce((acc, r) => acc + r.incidentCount, 0);
    const avgLatency = rows.length ? rows.reduce((acc, r) => acc + r.avgLatencyMs, 0) / rows.length : 0;
    const avgError = rows.length ? rows.reduce((acc, r) => acc + r.errorRatePct, 0) / rows.length : 0;
    const avgVolume = rows.length ? rows.reduce((acc, r) => acc + r.txVolume, 0) / rows.length : 0;
    return {
      month: m,
      monthLabel: monthNames[idx],
      totalIncidents,
      avgLatencyMs: Number(avgLatency.toFixed(1)),
      avgErrorRatePct: Number(avgError.toFixed(2)),
      avgTxVolume: Math.round(avgVolume),
    };
  });

  // Compute mean & std-dev of monthly incident totals to detect seasonal anomaly objectively
  const incCounts = monthlyStats.map((m) => m.totalIncidents);
  const meanInc = incCounts.reduce((a, b) => a + b, 0) / incCounts.length;
  const varianceInc = incCounts.reduce((a, b) => a + Math.pow(b - meanInc, 2), 0) / incCounts.length;
  const stdInc = Math.sqrt(varianceInc) || 1;

  const seasonalCalendar = monthlyStats.map((m) => {
    const zScore = (m.totalIncidents - meanInc) / stdInc;
    const riskIndex = Math.min(98, Math.max(12, Math.round(45 + zScore * 22)));
    return {
      ...m,
      zScore: Number(zScore.toFixed(2)),
      riskIndex,
      anomalyDetected: zScore >= 1.5,
    };
  });

  const peakSeasonalMonth = [...seasonalCalendar].sort((a, b) => b.zScore - a.zScore)[0];

  // 2. Heatmap: Year x Month incident & risk matrix
  const years = [2022, 2023, 2024, 2025, 2026];
  const heatmap = years.map((yr) => {
    const months = Array.from({ length: 12 }, (_, idx) => {
      const m = idx + 1;
      const rows = allMetrics.filter(
        (r) => r.year === yr && r.month === m && (!filters?.serviceId || r.serviceId === filters.serviceId)
      );
      const incidents = rows.reduce((acc, r) => acc + r.incidentCount, 0);
      const avgLat = rows.length ? rows.reduce((acc, r) => acc + r.avgLatencyMs, 0) / rows.length : 0;
      return {
        month: m,
        monthLabel: monthNames[idx],
        incidents,
        avgLatencyMs: Number(avgLat.toFixed(1)),
        available: rows.length > 0,
      };
    });
    return { year: yr, months };
  });

  // 3. Year-over-Year comparison (Incidents & Avg Latency by year)
  const yoyComparison = years.map((yr) => {
    const rows = allMetrics.filter((r) => r.year === yr && (!filters?.serviceId || r.serviceId === filters.serviceId));
    const octRows = rows.filter((r) => r.month === 10);
    return {
      year: String(yr),
      totalIncidents: rows.reduce((a, b) => a + b.incidentCount, 0),
      octoberIncidents: octRows.reduce((a, b) => a + b.incidentCount, 0),
      avgLatencyMs: rows.length ? Number((rows.reduce((a, b) => a + b.avgLatencyMs, 0) / rows.length).toFixed(1)) : 0,
      octoberLatencyMs: octRows.length ? Number((octRows.reduce((a, b) => a + b.avgLatencyMs, 0) / octRows.length).toFixed(1)) : 0,
    };
  });

  // 4. Service failure frequency & latency trend
  const serviceFrequency = services.map((s) => {
    const rows = filteredMetrics.filter((r) => r.serviceId === s.id);
    const totalInc = rows.reduce((a, b) => a + b.incidentCount, 0);
    const octInc = rows.filter((r) => r.month === 10).reduce((a, b) => a + b.incidentCount, 0);
    return {
      serviceId: s.id,
      serviceName: s.name,
      totalIncidents: totalInc,
      octoberIncidents: octInc,
      avgLatencyMs: rows.length ? Number((rows.reduce((a, b) => a + b.avgLatencyMs, 0) / rows.length).toFixed(1)) : s.latencyMs,
    };
  }).sort((a, b) => b.totalIncidents - a.totalIncidents);

  // Latency trend across 2022–2026 for top high-risk services
  const latencyTrend = allMetrics
    .filter((r) => r.serviceId === (filters?.serviceId || 'upi-gateway'))
    .map((r) => ({
      period: `${r.year}-${String(r.month).padStart(2, '0')}`,
      avgLatencyMs: r.avgLatencyMs,
      p95LatencyMs: r.p95LatencyMs,
      errorRatePct: r.errorRatePct,
      isOctober: r.month === 10,
    }));

  // 5. Forecast vs Actual (2024–2026) using seasonal baseline model
  const forecastVsActual = allMetrics
    .filter((r) => r.year >= 2024 && r.serviceId === (filters?.serviceId || 'upi-gateway'))
    .map((r) => {
      const priorYearsSameMonth = allMetrics.filter(
        (p) => p.serviceId === r.serviceId && p.month === r.month && p.year < r.year
      );
      const predictedIncidents = priorYearsSameMonth.length
        ? Number((priorYearsSameMonth.reduce((a, b) => a + b.incidentCount, 0) / priorYearsSameMonth.length).toFixed(2))
        : 0.3;
      const predictedLatency = priorYearsSameMonth.length
        ? Number((priorYearsSameMonth.reduce((a, b) => a + b.avgLatencyMs, 0) / priorYearsSameMonth.length * 1.12).toFixed(1))
        : r.avgLatencyMs;
      return {
        period: `${r.year}-${String(r.month).padStart(2, '0')}`,
        actualIncidents: r.incidentCount,
        forecastIncidents: predictedIncidents,
        actualLatencyMs: r.avgLatencyMs,
        forecastLatencyMs: predictedLatency,
      };
    });

  // 6. Incident duration distribution & category filter from incidents table
  let incSql = 'SELECT * FROM incidents WHERE 1=1';
  const incParams: string[] = [];
  if (filters?.serviceId) {
    incSql += ' AND service_id = ?';
    incParams.push(filters.serviceId);
  }
  if (filters?.severity) {
    incSql += ' AND severity = ?';
    incParams.push(filters.severity);
  }
  if (filters?.category) {
    incSql += ' AND failure_type = ?';
    incParams.push(filters.category);
  }
  const incRows = db.prepare(incSql).all(...incParams) as unknown as Array<{
    id: string;
    service_id: string;
    severity: string;
    failure_type: string;
    duration_minutes: number;
    started_at: string;
  }>;

  const durationBuckets = [
    { bucket: '0–15m', count: 0 },
    { bucket: '16–30m', count: 0 },
    { bucket: '31–45m', count: 0 },
    { bucket: '46m+', count: 0 },
  ];
  for (const inc of incRows) {
    if (inc.duration_minutes <= 15) durationBuckets[0].count++;
    else if (inc.duration_minutes <= 30) durationBuckets[1].count++;
    else if (inc.duration_minutes <= 45) durationBuckets[2].count++;
    else durationBuckets[3].count++;
  }

  // 7. Compute Transparent, Explainable Risk Scores per Service
  // Weights derived from settings table or defaults
  const wSeason = 0.32;
  const wLatency = 0.28;
  const wCentrality = 0.22;
  const wError = 0.18;

  const maxDegree = Math.max(
    1,
    ...services.map((s) => edges.filter((e) => e.sourceId === s.id || e.targetId === s.id).length)
  );

  const predictions: ExplainablePrediction[] = services.map((s) => {
    const svcRows = allMetrics.filter((r) => r.serviceId === s.id);
    const octRows = svcRows.filter((r) => r.month === 10);
    const nonOctRows = svcRows.filter((r) => r.month !== 10);

    const octIncAvg = octRows.length ? octRows.reduce((a, b) => a + b.incidentCount, 0) / octRows.length : 0;
    const nonOctIncAvg = nonOctRows.length ? nonOctRows.reduce((a, b) => a + b.incidentCount, 0) / nonOctRows.length : 0.1;
    const octMultiplier = octIncAvg / Math.max(0.08, nonOctIncAvg);
    const seasonalScore = Math.min(100, octMultiplier * 16 + octIncAvg * 18);

    const recentRows = svcRows.slice(-8);
    const latSlope = linearSlope(recentRows.map((r) => r.avgLatencyMs));
    const latTrendScore = Math.min(100, Math.max(10, (s.latencyMs / Math.max(1, s.baseLatencyMs)) * 30 + Math.max(0, latSlope) * 6.5));

    const degree = edges.filter((e) => e.sourceId === s.id || e.targetId === s.id).length;
    const centralityScore = (degree / maxDegree) * 100;

    const errSlope = linearSlope(recentRows.map((r) => r.errorRatePct));
    const errScore = Math.min(100, Math.max(8, (s.errorRate / Math.max(0.01, s.baseErrorRate)) * 24 + Math.max(0, errSlope) * 85));

    const compositeRisk = Number(
      Math.min(
        96,
        Math.max(12, seasonalScore * wSeason + latTrendScore * wLatency + centralityScore * wCentrality + errScore * wError)
      ).toFixed(1)
    );

    const riskLevel: ExplainablePrediction['riskLevel'] =
      compositeRisk >= 75
        ? 'CRITICAL'
        : compositeRisk >= 60
        ? 'HIGH'
        : compositeRisk >= 42
        ? 'ELEVATED'
        : compositeRisk >= 26
        ? 'MODERATE'
        : 'LOW';

    const directDependents = edges
      .filter((e) => e.targetId === s.id)
      .map((e) => serviceMap.get(e.sourceId)?.name ?? e.sourceId);
    const upstreamTargets = edges
      .filter((e) => e.sourceId === s.id)
      .map((e) => serviceMap.get(e.targetId)?.name ?? e.targetId);

    const affected = Array.from(new Set([...directDependents, ...upstreamTargets])).slice(0, 5);
    const octTotalInc = octRows.reduce((a, b) => a + b.incidentCount, 0);

    const evidence: string[] = [
      `Recorded ${octTotalInc} synthetic October incidents across 2022–2026 (${octMultiplier.toFixed(1)}x non-October monthly rate).`,
      `Recent 8-month latency slope is ${latSlope >= 0 ? '+' : ''}${latSlope.toFixed(2)} ms/month (current ${s.latencyMs}ms vs ${s.baseLatencyMs}ms baseline).`,
      `Graph dependency centrality: ${degree} direct architectural connections (${s.criticality} criticality).`,
      `Error rate trend over recent window: ${errSlope >= 0 ? '+' : ''}${errSlope.toFixed(3)}%/month.`,
    ];

    const preventiveActions =
      s.id === 'upi-gateway'
        ? [
            'Validate backup payment gateway capacity and pre-warm worker pools.',
            'Review Primary Database connection limits and idempotency lock timeouts.',
            'Run a controlled failover rehearsal prior to peak settlement hours.',
            'Increase p95 latency & socket queue monitoring frequency to 10s intervals.',
          ]
        : s.id === 'primary-db'
        ? [
            'Route read-heavy Fraud Detection queries to Backup Database replica.',
            'Enforce connection pool bounds (PgBouncer) ahead of peak volume.',
            'Verify synchronous WAL replication lag remains under 15ms.',
          ]
        : s.id === 'auth-service'
        ? [
            'Increase PIN verification & device token cache warm capacity by 40%.',
            'Configure bounded retry budgets on UPI Payment Gateway calls.',
            'Audit HSM enclave throughput headroom under 1.7x traffic load.',
          ]
        : [
            `Verify redundancy and automated circuit-breaker thresholds for ${s.name}.`,
            'Run synthetic load test at 1.6x seasonal multiplier.',
            'Confirm alert thresholds for latency and error-rate drift.',
          ];

    return {
      id: `PRED-${s.id.toUpperCase()}`,
      serviceId: s.id,
      serviceName: s.name,
      riskScore: compositeRisk,
      riskLevel,
      confidencePct: Math.min(94, Math.round(62 + svcRows.length * 0.45)),
      horizonDays: (compositeRisk >= 55 ? 7 : 30) as 7 | 30,
      headline: `${s.name} — ${riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'Elevated October Risk' : 'Seasonal Watch'}`,
      whatCouldFail:
        s.id === 'upi-gateway'
          ? 'Worker pool saturation and callback timeouts under peak UPI settlement load.'
          : s.id === 'primary-db'
          ? 'Connection pool exhaustion and idempotency journal lock contention.'
          : s.id === 'auth-service'
          ? 'HSM session contention and cache-miss database lookup amplification.'
          : `${s.category} throughput degradation or upstream dependency stall.`,
      whenCouldItHappen:
        compositeRisk >= 60
          ? 'Next 7–14 days (peak October evening clearing windows 18:00–21:30 IST)'
          : 'Next 30 days during elevated seasonal transaction windows',
      historicalEvidence: evidence,
      affectedServices: affected.length > 0 ? affected : [s.name],
      estimatedImpact: `Up to ${Math.round(s.baseRps * 60 * 10).toLocaleString()} transactions exposed per 10-min disruption window`,
      preventiveActions,
      contributingFactors: [
        { factor: 'October Seasonal Baseline', weightPct: 32, metricValue: `${octTotalInc} Oct incidents (${octMultiplier.toFixed(1)}x)` },
        { factor: 'Latency Trend Slope', weightPct: 28, metricValue: `${latSlope >= 0 ? '+' : ''}${latSlope.toFixed(2)} ms/mo` },
        { factor: 'Dependency Centrality', weightPct: 22, metricValue: `${degree} graph edges` },
        { factor: 'Upstream Error Drift', weightPct: 18, metricValue: `${errSlope >= 0 ? '+' : ''}${errSlope.toFixed(3)} %/mo` },
      ],
    };
  }).sort((a, b) => b.riskScore - a.riskScore);

  const outlook7Day = predictions.slice(0, 4);
  const outlook30Day = predictions;

  return {
    dataNotice: 'SYNTHETIC DEMONSTRATION DATA — NOT ACTUAL BANK INCIDENT RECORDS.',
    methodology: {
      modelType: 'Explainable Seasonal Baseline + OLS Trend + Graph Centrality Scoring',
      weights: {
        seasonality: wSeason,
        latencyTrend: wLatency,
        dependencyCentrality: wCentrality,
        errorDrift: wError,
      },
      totalObservationsAnalyzed: allMetrics.length,
      yearsCovered: '2022–2026',
    },
    octoberPatternDiscovery: {
      detectedPeakMonth: peakSeasonalMonth.monthLabel,
      zScore: peakSeasonalMonth.zScore,
      octoberIncidentsTotal: peakSeasonalMonth.totalIncidents,
      nonOctoberMonthlyAvg: Number(
        (
          seasonalCalendar.filter((m) => m.month !== 10).reduce((a, b) => a + b.totalIncidents, 0) /
          11
        ).toFixed(1)
      ),
      octoberLatencyAvgMs: peakSeasonalMonth.avgLatencyMs,
      octoberVolumeSurgePct: Math.round(
        ((peakSeasonalMonth.avgTxVolume /
          Math.max(
            1,
            seasonalCalendar.filter((m) => m.month !== 10).reduce((a, b) => a + b.avgTxVolume, 0) / 11
          )) -
          1) *
          100
      ),
      summary: `Statistical analysis across ${allMetrics.length} synthetic observations (2022–2026) identifies ${peakSeasonalMonth.monthLabel} as a recurring anomaly (z = +${peakSeasonalMonth.zScore}), driven by +${Math.round(
        ((peakSeasonalMonth.avgTxVolume /
          Math.max(
            1,
            seasonalCalendar.filter((m) => m.month !== 10).reduce((a, b) => a + b.avgTxVolume, 0) / 11
          )) -
          1) *
          100
      )}% transaction volume surge and shared Primary DB / UPI Gateway dependency contention.`,
    },
    seasonalCalendar,
    heatmap,
    yoyComparison,
    serviceFrequency,
    latencyTrend,
    forecastVsActual,
    durationBuckets,
    outlook7Day,
    outlook30Day,
    predictions,
  };
}
