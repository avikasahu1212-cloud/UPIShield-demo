import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { db, initSchema } from './server/db.ts';
import { resetAndReseedAll, seedDatabaseIfEmpty } from './server/seed.ts';
import {
  calculateCascadeImpact,
  getAllDependencies,
  getAllServices,
  getServiceConnections,
} from './server/topology.ts';
import { computePredictiveIntelligence } from './server/analytics.ts';
import {
  analyzeSinglePointsOfFailure,
  buildExecutiveReportData,
  computeRecoveryReadiness,
  computeSloStatus,
  runWhatIfScenario,
  updateSloTarget,
  type WhatIfScenarioType,
} from './server/enterpriseAnalysis.ts';
import { generateArchitectureImage, runGeminiChat } from './server/gemini.ts';
import type {
  CaseStudyRecord,
  IncidentEventRecord,
  IncidentRecord,
  RecoveryActionRecord,
  RecoveryRecommendation,
  ServiceHealthState,
  TransactionRecord,
} from './src/types.ts';

dotenv.config();

initSchema();
seedDatabaseIfEmpty();

const app = express();
app.use(express.json({ limit: '4mb' }));

function nowIso(): string {
  return new Date().toISOString();
}

function logAudit(actor: string, action: string, entityType: string, entityId: string, details: string) {
  const id = `AUD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
  db.prepare(
    'INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, actor, action, entityType, entityId, details, nowIso());
}

function mapIncidentRow(
  row: Record<string, unknown>,
  includeEvents = false,
  includeRecommendations = false
): IncidentRecord {
  const services = getAllServices();
  const svcNameMap = new Map(services.map((s) => [s.id, s.name]));
  const incId = String(row.id);

  let events: IncidentEventRecord[] | undefined;
  if (includeEvents) {
    const evRows = db
      .prepare('SELECT * FROM incident_events WHERE incident_id = ? ORDER BY created_at ASC')
      .all(incId) as Array<Record<string, unknown>>;
    events = evRows.map((e) => ({
      id: String(e.id),
      incidentId: String(e.incident_id),
      stage: String(e.stage) as IncidentEventRecord['stage'],
      actor: String(e.actor),
      message: String(e.message),
      metadata: JSON.parse(String(e.metadata_json || '{}')),
      createdAt: String(e.created_at),
    }));
  }

  let relatedRecommendations: RecoveryRecommendation[] | undefined;
  if (includeRecommendations) {
    const recRows = db
      .prepare('SELECT * FROM recovery_recommendations WHERE incident_id = ? ORDER BY created_at DESC')
      .all(incId) as Array<Record<string, unknown>>;
    relatedRecommendations = recRows.map(mapRecommendationRow);
  }

  return {
    id: incId,
    title: String(row.title),
    serviceId: String(row.service_id),
    serviceName: svcNameMap.get(String(row.service_id)) ?? String(row.service_id),
    failureType: String(row.failure_type),
    severity: String(row.severity) as IncidentRecord['severity'],
    status: String(row.status) as IncidentRecord['status'],
    origin: String(row.origin) as IncidentRecord['origin'],
    startedAt: String(row.started_at),
    detectedAt: String(row.detected_at),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    durationMinutes: Number(row.duration_minutes),
    mttdSeconds: Number(row.mttd_seconds),
    mttrSeconds: Number(row.mttr_seconds),
    latencyImpactMs: Number(row.latency_impact_ms),
    errorRateImpact: Number(row.error_rate_impact),
    txAtRisk: Number(row.tx_at_risk),
    financialImpactInr: Number(row.financial_impact_inr),
    rootCause: String(row.root_cause),
    affectedServices: JSON.parse(String(row.affected_services_json || '[]')),
    summary: String(row.summary),
    assignedOperator: String(row.assigned_operator || 'Priya Sharma (VP Infrastructure)'),
    resolutionNotes: String(row.resolution_notes || ''),
    isSynthetic: Number(row.is_synthetic) === 1,
    events,
    relatedRecommendations,
  };
}

function mapRecommendationRow(row: Record<string, unknown>): RecoveryRecommendation {
  const services = getAllServices();
  const svcNameMap = new Map(services.map((s) => [s.id, s.name]));
  return {
    id: String(row.id),
    incidentId: String(row.incident_id),
    serviceId: String(row.service_id),
    serviceName: svcNameMap.get(String(row.service_id)) ?? String(row.service_id),
    actionType: String(row.action_type),
    title: String(row.title),
    reason: String(row.reason),
    expectedBenefit: String(row.expected_benefit),
    estimatedRisk: String(row.estimated_risk) as RecoveryRecommendation['estimatedRisk'],
    sideEffects: String(row.side_effects),
    requiredApproval: String(row.required_approval),
    verificationCondition: String(row.verification_condition),
    evidenceUsed: JSON.parse(String(row.evidence_used_json || '[]')),
    historicalIncidentRefs: JSON.parse(String(row.historical_refs_json || '[]')),
    dependencyGraphEvidence: String(row.dependency_evidence || ''),
    isSimulatedData: true,
    status: String(row.status) as RecoveryRecommendation['status'],
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    executedAt: row.executed_at ? String(row.executed_at) : null,
    createdAt: String(row.created_at),
  };
}

function mapTransactionRow(row: Record<string, unknown>): TransactionRecord {
  return {
    id: String(row.id),
    idempotencyKey: String(row.idempotency_key),
    payerVpa: String(row.payer_vpa),
    payeeVpa: String(row.payee_vpa),
    amountInr: Number(row.amount_inr),
    status: String(row.status) as TransactionRecord['status'],
    gatewayServiceId: String(row.gateway_service_id),
    incidentId: row.incident_id ? String(row.incident_id) : null,
    responseLost: Number(row.response_lost) === 1,
    verificationStatus: String(row.verification_status) as TransactionRecord['verificationStatus'],
    retryCount: Number(row.retry_count),
    auditTrail: JSON.parse(String(row.audit_trail_json || '[]')),
    createdAt: String(row.created_at),
  };
}

// 1. Health Check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', platform: 'UPIShield', demoEnvironment: true, timestamp: nowIso() });
});

// 2. Command Center Overview (Module 1)
app.get('/api/overview', (_req, res) => {
  const services = getAllServices();
  const incRows = db
    .prepare('SELECT * FROM incidents ORDER BY started_at DESC')
    .all() as Array<Record<string, unknown>>;
  const incidents = incRows.map((r) => mapIncidentRow(r, false));

  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const criticalServices = services.filter((s) => s.healthState === 'RED').length;
  const degradedServices = services.filter((s) => s.healthState === 'YELLOW').length;
  const recoveringServices = services.filter((s) => s.healthState === 'BLUE').length;
  const healthyServices = services.filter((s) => s.healthState === 'GREEN').length;

  // Overall health score computed from real service states & error rates
  const penalty = criticalServices * 14 + degradedServices * 6 + recoveringServices * 3;
  const avgErr = services.reduce((a, s) => a + s.errorRate, 0) / Math.max(1, services.length);
  const healthScore = Math.max(12, Math.min(100, Number((100 - penalty - avgErr * 1.4).toFixed(1))));

  // Payment availability % from live service health & synthetic baseline
  const upiGw = services.find((s) => s.id === 'upi-gateway');
  const txSvc = services.find((s) => s.id === 'tx-processing');
  const liveErrAvg = ((upiGw?.errorRate ?? 0.1) + (txSvc?.errorRate ?? 0.06)) / 2;
  const paymentAvailabilityPct = Number(
    Math.max(72.0, Math.min(99.99, 100 - liveErrAvg - criticalServices * 1.8 - degradedServices * 0.45)).toFixed(2)
  );

  // Mean MTTD / MTTR from actual recorded incident timestamps
  const mttdAvgSec = incidents.length
    ? Math.round(incidents.reduce((a, b) => a + b.mttdSeconds, 0) / incidents.length)
    : 0;
  const resolvedIncidents = incidents.filter((i) => i.mttrSeconds > 0);
  const mttrAvgMin = resolvedIncidents.length
    ? Number((resolvedIncidents.reduce((a, b) => a + b.mttrSeconds, 0) / resolvedIncidents.length / 60).toFixed(1))
    : 0;

  // Transaction success rate from transactions table + gateway state
  const txRows = db.prepare('SELECT * FROM transactions').all() as Array<Record<string, unknown>>;
  const txs = txRows.map(mapTransactionRow);
  const failedTx = txs.filter((t) => t.status === 'FAILED').length;
  const txSuccessRate = Number(
    Math.max(
      78.0,
      Math.min(99.94, 99.84 - liveErrAvg * 0.9 - (failedTx / Math.max(1, txs.length)) * 4)
    ).toFixed(2)
  );

  // Estimated operational risk in INR
  const activeRiskInr = activeIncidents.reduce((a, b) => a + b.financialImpactInr, 0);
  const predicted = computePredictiveIntelligence();
  const topRisks30d = predicted.outlook30Day.slice(0, 5);

  // Operational trends (last 12 months from historical_metrics across payment core)
  const trendRows = db
    .prepare(
      `SELECT year, month,
        ROUND(AVG(availability_pct), 3) as availability,
        ROUND(AVG(avg_latency_ms), 1) as latency,
        ROUND(AVG(error_rate_pct), 2) as errorRate,
        SUM(incident_count) as incidents
       FROM historical_metrics
       WHERE year >= 2025
       GROUP BY year, month
       ORDER BY year ASC, month ASC`
    )
    .all() as Array<{
    year: number;
    month: number;
    availability: number;
    latency: number;
    errorRate: number;
    incidents: number;
  }>;

  const operationalTrends = trendRows.slice(-14).map((t) => ({
    period: `${t.year}-${String(t.month).padStart(2, '0')}`,
    availabilityPct: t.availability,
    avgLatencyMs: t.latency,
    errorRatePct: t.errorRate,
    incidents: t.incidents,
  }));

  // Chronological operational event feed
  const eventRows = db
    .prepare(
      `SELECT ie.*, i.title as incident_title
       FROM incident_events ie
       JOIN incidents i ON i.id = ie.incident_id
       ORDER BY ie.created_at DESC
       LIMIT 15`
    )
    .all() as Array<Record<string, unknown>>;

  const recentEvents = eventRows.map((e) => ({
    id: String(e.id),
    incidentId: String(e.incident_id),
    incidentTitle: String(e.incident_title),
    stage: String(e.stage),
    actor: String(e.actor),
    message: String(e.message),
    createdAt: String(e.created_at),
  }));

  // Critical alerts ranked by severity
  const sevRank: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
  const criticalAlerts = [
    ...activeIncidents.map((inc) => ({
      id: inc.id,
      title: inc.title,
      serviceId: inc.serviceId,
      serviceName: inc.serviceName,
      severity: inc.severity,
      status: inc.status,
      detail: `${inc.failureType} · ${inc.txAtRisk.toLocaleString()} tx at risk`,
      isActiveIncident: true,
    })),
    ...topRisks30d
      .filter((p) => p.riskScore >= 58)
      .map((p) => ({
        id: p.id,
        title: p.headline,
        serviceId: p.serviceId,
        serviceName: p.serviceName,
        severity: p.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        status: 'FORECAST_ELEVATED',
        detail: `30d risk score ${p.riskScore} · ${p.whenCouldItHappen}`,
        isActiveIncident: false,
      })),
  ].sort((a, b) => (sevRank[b.severity] ?? 0) - (sevRank[a.severity] ?? 0));

  const pendingRecCount = (
    db.prepare(`SELECT COUNT(*) as cnt FROM recovery_recommendations WHERE status = 'PENDING'`).get() as {
      cnt: number;
    }
  ).cnt;

  res.json({
    demoEnvironment: true,
    dataNotice: 'SYNTHETIC DEMONSTRATION DATA — NOT ACTUAL BANK INCIDENT RECORDS.',
    kpis: {
      healthScore,
      paymentAvailabilityPct,
      activeIncidents: activeIncidents.length,
      criticalServices,
      degradedServices,
      recoveringServices,
      healthyServices,
      totalServices: services.length,
      mttdSeconds: mttdAvgSec,
      mttrMinutes: mttrAvgMin,
      txSuccessRate,
      estimatedOperationalRiskInr: activeRiskInr > 0 ? activeRiskInr : 6400000,
      pendingRecommendations: pendingRecCount,
    },
    services,
    operationalTrends,
    criticalAlerts,
    predictedRisks30d: topRisks30d,
    recentEvents,
  });
});

// 3. Dependency Graph & Topology (Module 2)
app.get('/api/topology', (req, res) => {
  const incidentId = typeof req.query.incidentId === 'string' ? req.query.incidentId : null;
  let services = getAllServices();
  const dependencies = getAllDependencies();

  let activeCascade = null;
  let mode: 'live' | 'historical' = 'live';
  let snapshotIncident: IncidentRecord | null = null;

  if (incidentId) {
    const incRow = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId) as
      | Record<string, unknown>
      | undefined;
    if (incRow) {
      mode = 'historical';
      snapshotIncident = mapIncidentRow(incRow, true);
      activeCascade = calculateCascadeImpact(snapshotIncident.serviceId, snapshotIncident.severity);
      const affectedSet = new Set(snapshotIncident.affectedServices);

      services = services.map((s) => {
        if (s.id === snapshotIncident!.serviceId) {
          return {
            ...s,
            healthState: snapshotIncident!.severity === 'CRITICAL' ? 'RED' : 'YELLOW',
            latencyMs: Number((s.baseLatencyMs + snapshotIncident!.latencyImpactMs).toFixed(1)),
            errorRate: Number((s.baseErrorRate + snapshotIncident!.errorRateImpact).toFixed(2)),
          };
        }
        if (affectedSet.has(s.id)) {
          return {
            ...s,
            healthState: 'YELLOW',
            latencyMs: Number((s.baseLatencyMs * 2.4).toFixed(1)),
            errorRate: Number((s.baseErrorRate + 1.8).toFixed(2)),
          };
        }
        return { ...s, healthState: 'GREEN', latencyMs: s.baseLatencyMs, errorRate: s.baseErrorRate };
      });
    }
  } else {
    const activeInc = db
      .prepare(`SELECT * FROM incidents WHERE status != 'RESOLVED' ORDER BY started_at DESC LIMIT 1`)
      .get() as Record<string, unknown> | undefined;
    if (activeInc) {
      snapshotIncident = mapIncidentRow(activeInc, true);
      activeCascade = calculateCascadeImpact(snapshotIncident.serviceId, snapshotIncident.severity);
    }
  }

  res.json({
    mode,
    services,
    dependencies,
    activeCascade,
    snapshotIncident,
  });
});

app.get('/api/services/:id', (req, res) => {
  const services = getAllServices();
  const service = services.find((s) => s.id === req.params.id);
  if (!service) {
    res.status(404).json({ error: 'Service not found' });
    return;
  }
  const connections = getServiceConnections(service.id);
  const cascadePreview = calculateCascadeImpact(service.id, 'CRITICAL');
  const incRows = db
    .prepare('SELECT * FROM incidents WHERE service_id = ? ORDER BY started_at DESC LIMIT 10')
    .all(service.id) as Array<Record<string, unknown>>;

  res.json({
    service,
    upstreamDependencies: connections.upstreamDependencies,
    downstreamDependents: connections.downstreamDependents,
    cascadePreview,
    recentIncidents: incRows.map((r) => mapIncidentRow(r, false)),
  });
});

// 4. Predictive Failure Intelligence (Module 3)
app.get('/api/predictions', (req, res) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const serviceId = typeof req.query.serviceId === 'string' && req.query.serviceId !== 'all' ? req.query.serviceId : undefined;
  const severity = typeof req.query.severity === 'string' && req.query.severity !== 'all' ? req.query.severity : undefined;
  const category = typeof req.query.category === 'string' && req.query.category !== 'all' ? req.query.category : undefined;

  const analytics = computePredictiveIntelligence({
    year: year && !Number.isNaN(year) ? year : undefined,
    serviceId,
    severity,
    category,
  });
  res.json(analytics);
});

// 5. Failure Detection & Cascade Simulator (Module 4)
app.post('/api/simulator/inject', (req, res) => {
  const {
    serviceId = 'upi-gateway',
    failureType = 'Payment Gateway Degradation',
    severity = 'CRITICAL',
    durationMinutes = 25,
    trafficIntensity = 1.6,
  } = req.body ?? {};

  const services = getAllServices();
  const origin = services.find((s) => s.id === serviceId);
  if (!origin) {
    res.status(400).json({ error: 'Invalid target serviceId' });
    return;
  }

  const cascade = calculateCascadeImpact(serviceId, severity);
  const tsNow = nowIso();
  const detectedTs = new Date(Date.now() + 28000).toISOString();
  const incId = `SIM-${Date.now().toString(36).toUpperCase()}`;

  const severityScale = severity === 'CRITICAL' ? 1 : severity === 'HIGH' ? 0.65 : severity === 'MEDIUM' ? 0.4 : 0.2;
  const originState: ServiceHealthState = severity === 'CRITICAL' ? 'RED' : 'YELLOW';
  const latencySpike = Number((origin.baseLatencyMs * (3.2 + Number(trafficIntensity)) * severityScale).toFixed(1));
  const errSpike = Number((origin.baseErrorRate + 7.5 * severityScale).toFixed(2));
  const newRps = Math.round(origin.baseRps * Number(trafficIntensity));

  db.prepare(
    `UPDATE services
     SET health_state = ?, latency_ms = ?, error_rate = ?, rps = ?, risk_score = MIN(99, risk_score + 18), updated_at = ?
     WHERE id = ?`
  ).run(originState, Number((origin.baseLatencyMs + latencySpike).toFixed(1)), errSpike, newRps, tsNow, origin.id);

  for (const dep of cascade.directlyAffected) {
    const depSvc = services.find((s) => s.id === dep.id);
    if (!depSvc) continue;
    db.prepare(
      `UPDATE services SET health_state = ?, latency_ms = ?, error_rate = ?, updated_at = ? WHERE id = ?`
    ).run(
      dep.projectedState,
      Number((depSvc.baseLatencyMs * (dep.projectedState === 'RED' ? 3.8 : 2.2)).toFixed(1)),
      Number((depSvc.baseErrorRate + (dep.projectedState === 'RED' ? 4.2 : 1.9)).toFixed(2)),
      tsNow,
      dep.id
    );
  }

  for (const ind of cascade.indirectlyAffected) {
    const indSvc = services.find((s) => s.id === ind.id);
    if (!indSvc) continue;
    db.prepare(
      `UPDATE services SET health_state = ?, latency_ms = ?, error_rate = ?, updated_at = ? WHERE id = ?`
    ).run(
      ind.projectedState,
      Number((indSvc.baseLatencyMs * 1.65).toFixed(1)),
      Number((indSvc.baseErrorRate + 1.1).toFixed(2)),
      tsNow,
      ind.id
    );
  }

  const affectedIds = [
    origin.id,
    ...cascade.directlyAffected.map((d) => d.id),
    ...cascade.indirectlyAffected.map((i) => i.id),
  ];

  const financialImpactInr = Math.round(cascade.estimatedTxAtRisk * 48);

  db.prepare(`
    INSERT INTO incidents (
      id, title, service_id, failure_type, severity, status, origin,
      started_at, detected_at, resolved_at, duration_minutes,
      mttd_seconds, mttr_seconds, latency_impact_ms, error_rate_impact,
      tx_at_risk, financial_impact_inr, root_cause, affected_services_json,
      summary, assigned_operator, resolution_notes, is_synthetic
    ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'live_simulation', ?, ?, NULL, ?, 28, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    incId,
    `[SIMULATED] ${failureType} on ${origin.name}`,
    origin.id,
    failureType,
    severity,
    tsNow,
    detectedTs,
    Number(durationMinutes),
    latencySpike,
    errSpike,
    cascade.estimatedTxAtRisk,
    financialImpactInr,
    `Simulated ${failureType} injected at ${trafficIntensity}x traffic intensity targeting ${origin.name}.`,
    JSON.stringify(affectedIds),
    `LIVE SIMULATION — Injected ${severity} ${failureType} on ${origin.name}; cascade reached ${affectedIds.length - 1} dependent services.`,
    'Priya Sharma (VP Infrastructure)',
    'Awaiting operator approval of recommended simulated recovery action.'
  );

  const insertEv = db.prepare(
    'INSERT INTO incident_events (id, incident_id, stage, actor, message, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  insertEv.run(
    `${incId}-EV1`,
    incId,
    'FAILURE_INJECTED',
    'Infrastructure Operator',
    `Injected ${severity} ${failureType} on ${origin.name} (${trafficIntensity}x load, ${durationMinutes}m target window).`,
    JSON.stringify({ serviceId: origin.id, failureType, severity, trafficIntensity }),
    tsNow
  );
  insertEv.run(
    `${incId}-EV2`,
    incId,
    'FAILURE_DETECTED',
    'UPIShield Anomaly Detector',
    `Latency spike (+${latencySpike}ms) & error threshold breach (${errSpike}%) detected in 28s.`,
    '{}',
    detectedTs
  );
  insertEv.run(
    `${incId}-EV3`,
    incId,
    'ANALYSIS_COMPLETED',
    'UPIShield Cascade Engine',
    `Graph traversal identified ${cascade.directlyAffected.length} direct and ${cascade.indirectlyAffected.length} indirect affected services (${cascade.estimatedTxAtRisk.toLocaleString()} tx at risk).`,
    '{}',
    detectedTs
  );

  // Generate Recovery Recommendations (Module 5)
  const recommendations = generateRecommendationsForFailure(incId, origin, failureType, cascade, tsNow);

  insertEv.run(
    `${incId}-EV4`,
    incId,
    'RECOMMENDATION_GENERATED',
    'AI Recovery Advisor',
    `Generated ${recommendations.length} prioritized recovery recommendations awaiting operator approval.`,
    '{}',
    detectedTs
  );

  logAudit(
    'Infrastructure Operator',
    'FAILURE_SIMULATION_INJECTED',
    'incident',
    incId,
    `Injected ${severity} ${failureType} on ${origin.name}; ${recommendations.length} recovery recommendations created.`
  );

  const incidentRow = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incId) as Record<string, unknown>;
  res.json({
    incident: mapIncidentRow(incidentRow, true),
    cascade,
    recommendations,
  });
});

function generateRecommendationsForFailure(
  incidentId: string,
  origin: ReturnType<typeof getAllServices>[number],
  failureType: string,
  cascade: ReturnType<typeof calculateCascadeImpact>,
  createdAt: string
): RecoveryRecommendation[] {
  const candidates: Array<{
    actionType: string;
    title: string;
    reason: string;
    expectedBenefit: string;
    estimatedRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    sideEffects: string;
    requiredApproval: string;
    verificationCondition: string;
  }> = [];

  if (origin.id === 'upi-gateway' || failureType.includes('Payment Gateway')) {
    candidates.push({
      actionType: 'SWITCH_BACKUP_GATEWAY',
      title: 'Shift 60% Clearing Traffic to Secondary Gateway Route & Drain Stale Workers',
      reason: `UPI Payment Gateway is ${origin.criticality} criticality with ${cascade.directlyAffected.length} directly impacted paths and ${cascade.estimatedTxAtRisk.toLocaleString()} transactions at risk.`,
      expectedBenefit: 'Reduces primary gateway queue depth by 60% and restores p95 latency below 180ms within 90s.',
      estimatedRisk: 'LOW',
      sideEffects: 'Temporary 15–20ms increase in cross-region routing latency during traffic shift.',
      requiredApproval: 'VP Payment Operations / On-Call SRE Lead',
      verificationCondition: 'Gateway error rate < 0.25% and p95 latency < 180ms sustained for 60 seconds.',
    });
  }

  if (origin.id === 'primary-db' || failureType.includes('Database')) {
    candidates.push({
      actionType: 'ACTIVATE_SECONDARY_DB',
      title: 'Offload Read Queries to Backup Database & Throttle Non-Critical Fraud Lookups',
      reason: 'Primary Database saturation directly impacts Auth Service, Transaction Processing, and Bank Core System.',
      expectedBenefit: 'Frees 45% of primary connection pool capacity and halts lock contention.',
      estimatedRisk: 'LOW',
      sideEffects: 'Fraud velocity reads experience ~12ms replication lag on standby replica.',
      requiredApproval: 'Database Reliability Lead & Shift Commander',
      verificationCondition: 'Primary DB active connections < 65% and transaction commit latency < 25ms.',
    });
  }

  if (origin.id === 'cloud-provider' || failureType.includes('Cloud')) {
    candidates.push({
      actionType: 'REDIRECT_TRAFFIC_AZ',
      title: 'Evacuate Degraded Cloud Availability Zone & Promote Cross-AZ Standby',
      reason: 'Shared Tier-0 cloud substrate failure exposes Load Balancer, API Gateway, Auth, and Primary DB simultaneously.',
      expectedBenefit: 'Eliminates single-zone packet loss across all hosted payment tiers.',
      estimatedRisk: 'MEDIUM',
      sideEffects: 'Brief 4–6 second connection reset on in-flight non-idempotent sockets; idempotency keys remain intact.',
      requiredApproval: 'Head of Infrastructure / CTO Delegate',
      verificationCondition: 'Zero packet loss across active AZs and 100% healthy heartbeat on ingress nodes.',
    });
  }

  if (candidates.length === 0) {
    candidates.push({
      actionType: 'ISOLATE_AND_RESTART',
      title: `Isolate Degraded ${origin.name} Instances & Execute Graceful Pool Recycle`,
      reason: `${origin.name} is exhibiting ${failureType} impacting ${cascade.directlyAffected.length + cascade.indirectlyAffected.length} connected services.`,
      expectedBenefit: `Restores ${origin.name} SLA (${origin.slaTarget}%) and relieves upstream backpressure.`,
      estimatedRisk: 'LOW',
      sideEffects: 'In-flight requests rerouted to healthy peer instances with automatic idempotent retry.',
      requiredApproval: 'On-Call SRE Lead',
      verificationCondition: `${origin.name} latency within 1.25x baseline (${origin.baseLatencyMs}ms) and error rate < 0.2%.`,
    });
  }

  // Always provide a secondary verification/monitoring recommendation
  candidates.push({
    actionType: 'INCREASE_MONITORING_AND_VERIFY',
    title: 'Enable 5-Second Synthetic Canary Probes & Verify Transaction Reconciliation',
    reason: 'Ensures zero silent response-loss transactions remain unreconciled post-recovery.',
    expectedBenefit: 'Confirms end-to-end payment continuity across Bank Core System and External Network.',
    estimatedRisk: 'LOW',
    sideEffects: 'Minimal (<0.5% synthetic probe overhead on API Gateway).',
    requiredApproval: 'Payment Operations Lead',
    verificationCondition: 'All UNKNOWN_RESPONSE_LOST transactions verified against Core Ledger.',
  });

  // Query real historical synthetic incidents matching service or failure type for evidence citations
  const matchedHistRows = db
    .prepare(
      `SELECT id, title, started_at, resolution_notes FROM incidents
       WHERE origin = 'seeded_synthetic' AND (service_id = ? OR failure_type = ?)
       ORDER BY started_at DESC LIMIT 3`
    )
    .all(origin.id, failureType) as Array<{ id: string; title: string; started_at: string; resolution_notes: string }>;

  const historicalRefs =
    matchedHistRows.length > 0
      ? matchedHistRows.map((h) => `${h.id} (${h.started_at.slice(0, 10)}): ${h.title}`)
      : ['INC-2026-OCT-08 (2026-10-10): Early October Gateway Latency & DB Lock Early Warning'];

  const dependencyEvidence = `Graph traversal from ${origin.name}: ${cascade.directlyAffected.length} direct + ${cascade.indirectlyAffected.length} indirect nodes affected (${cascade.blastRadiusPct}% topology blast radius; ${cascade.criticalPaymentPaths.length} critical payment path(s)).`;

  const evidenceUsed = [
    `Live telemetry anomaly on ${origin.name}: latency ${origin.latencyMs}ms (baseline ${origin.baseLatencyMs}ms), error rate ${origin.errorRate}% (SLA target ${origin.slaTarget}%).`,
    `Dependency centrality & cascade exposure: ${cascade.estimatedTxAtRisk.toLocaleString()} tx/12m estimated at risk across ${cascade.criticalPaymentPaths.length} critical paths.`,
    origin.backupServiceId
      ? `Topology backup check: standby target '${origin.backupServiceId}' verified available.`
      : `Topology backup check: no dedicated standby node mapped; traffic offload / pool isolation prioritized.`,
  ];

  const insertRec = db.prepare(`
    INSERT INTO recovery_recommendations (
      id, incident_id, service_id, action_type, title, reason,
      expected_benefit, estimated_risk, side_effects, required_approval,
      verification_condition, evidence_used_json, historical_refs_json, dependency_evidence,
      status, approved_by, executed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL, NULL, ?)
  `);

  const created: RecoveryRecommendation[] = [];
  candidates.forEach((c, idx) => {
    const recId = `REC-${Date.now().toString(36).toUpperCase()}-${idx + 1}`;
    insertRec.run(
      recId,
      incidentId,
      origin.id,
      c.actionType,
      c.title,
      c.reason,
      c.expectedBenefit,
      c.estimatedRisk,
      c.sideEffects,
      c.requiredApproval,
      c.verificationCondition,
      JSON.stringify(evidenceUsed),
      JSON.stringify(historicalRefs),
      dependencyEvidence,
      createdAt
    );
    const row = db.prepare('SELECT * FROM recovery_recommendations WHERE id = ?').get(recId) as Record<string, unknown>;
    created.push(mapRecommendationRow(row));
  });

  return created;
}

app.post('/api/simulator/restore/:serviceId', (req, res) => {
  const { serviceId } = req.params;
  const services = getAllServices();
  const svc = services.find((s) => s.id === serviceId);
  if (!svc) {
    res.status(404).json({ error: 'Service not found' });
    return;
  }
  const ts = nowIso();
  db.prepare(
    `UPDATE services SET health_state = 'GREEN', latency_ms = base_latency_ms, error_rate = base_error_rate, rps = base_rps, updated_at = ? WHERE id = ?`
  ).run(ts, serviceId);

  logAudit('Infrastructure Operator', 'SERVICE_RESTORED', 'service', serviceId, `Manually restored ${svc.name} to GREEN baseline.`);
  res.json({ restored: true, serviceId });
});

app.post('/api/simulator/reset', (_req, res) => {
  const ts = nowIso();
  // Restore all services to nominal baseline
  db.prepare(
    `UPDATE services SET health_state = 'GREEN', latency_ms = base_latency_ms, error_rate = base_error_rate, rps = base_rps, updated_at = ?`
  ).run(ts);

  // Remove only live_simulation records so seeded 2022–2026 historical dataset remains clean & deterministic
  db.prepare(`DELETE FROM recovery_actions WHERE incident_id IN (SELECT id FROM incidents WHERE origin = 'live_simulation')`).run();
  db.prepare(`DELETE FROM recovery_recommendations WHERE incident_id IN (SELECT id FROM incidents WHERE origin = 'live_simulation')`).run();
  db.prepare(`DELETE FROM incident_events WHERE incident_id IN (SELECT id FROM incidents WHERE origin = 'live_simulation')`).run();
  db.prepare(`DELETE FROM incidents WHERE origin = 'live_simulation'`).run();
  db.prepare(`DELETE FROM transactions WHERE id LIKE 'TXN-SIM-%'`).run();

  // Ensure baseline unknown tx stays clean
  db.prepare(
    `UPDATE transactions SET status = 'UNKNOWN_RESPONSE_LOST', verification_status = 'AWAITING_STATUS_CHECK' WHERE id = 'TXN-904822'`
  ).run();

  logAudit('Demo Controller', 'DEMO_STATE_RESET', 'platform', 'upishield-demo', 'Restored all 12 services to GREEN baseline and cleared live simulation records.');
  res.json({ reset: true, timestamp: ts });
});

// 6. Recovery Advisor & Approval Workflow (Module 5)
app.get('/api/recommendations', (_req, res) => {
  const recRows = db
    .prepare('SELECT * FROM recovery_recommendations ORDER BY created_at DESC')
    .all() as Array<Record<string, unknown>>;
  const actionRows = db
    .prepare('SELECT * FROM recovery_actions ORDER BY executed_at DESC')
    .all() as Array<Record<string, unknown>>;

  const actions: RecoveryActionRecord[] = actionRows.map((a) => ({
    id: String(a.id),
    recommendationId: String(a.recommendation_id),
    incidentId: String(a.incident_id),
    actionTitle: String(a.action_title),
    operatorName: String(a.operator_name),
    status: String(a.status),
    verificationResult: String(a.verification_result),
    preHealth: JSON.parse(String(a.pre_health_json || '{}')),
    postHealth: JSON.parse(String(a.post_health_json || '{}')),
    executedAt: String(a.executed_at),
  }));

  res.json({
    recommendations: recRows.map(mapRecommendationRow),
    actions,
  });
});

app.post('/api/recommendations/:id/approve', (req, res) => {
  const recRow = db
    .prepare('SELECT * FROM recovery_recommendations WHERE id = ?')
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!recRow) {
    res.status(404).json({ error: 'Recommendation not found' });
    return;
  }

  const operatorName = req.body?.operatorName || 'Priya Sharma (VP Infrastructure)';
  const rec = mapRecommendationRow(recRow);

  if (rec.status === 'EXECUTED') {
    res.json({ recommendation: rec, alreadyExecuted: true });
    return;
  }

  const approvalTs = nowIso();
  const startTs = new Date(Date.now() + 2000).toISOString();
  const completeTs = new Date(Date.now() + 18000).toISOString();

  // Capture pre-recovery health
  const servicesBefore = getAllServices();
  const preHealth: Record<string, string> = {};
  for (const s of servicesBefore) {
    if (s.healthState !== 'GREEN') preHealth[s.name] = s.healthState;
  }

  // Update recommendation status to EXECUTED (simulated execution)
  db.prepare(
    `UPDATE recovery_recommendations SET status = 'EXECUTED', approved_by = ?, executed_at = ? WHERE id = ?`
  ).run(operatorName, completeTs, rec.id);

  // Restore affected services linked to the incident
  const incRow = db.prepare('SELECT * FROM incidents WHERE id = ?').get(rec.incidentId) as
    | Record<string, unknown>
    | undefined;

  if (incRow) {
    const affected: string[] = JSON.parse(String(incRow.affected_services_json || '[]'));
    // First mark BLUE (Recovering) briefly in timeline record, then restore to GREEN baseline
    for (const svcId of affected) {
      db.prepare(
        `UPDATE services
         SET health_state = 'GREEN', latency_ms = base_latency_ms, error_rate = base_error_rate, rps = base_rps, updated_at = ?
         WHERE id = ?`
      ).run(completeTs, svcId);
    }

    const startedMs = new Date(String(incRow.started_at)).getTime();
    const resolvedMs = new Date(completeTs).getTime();
    const mttrSeconds = Math.max(45, Math.round((resolvedMs - startedMs) / 1000));

    db.prepare(
      `UPDATE incidents SET status = 'RESOLVED', resolved_at = ?, mttr_seconds = ?, assigned_operator = ?, resolution_notes = ? WHERE id = ?`
    ).run(
      completeTs,
      mttrSeconds,
      operatorName,
      `Simulated execution of ${rec.id} ("${rec.title}") approved by ${operatorName}. Verified: ${rec.verificationCondition}`,
      rec.incidentId
    );

    const insertEv = db.prepare(
      'INSERT INTO incident_events (id, incident_id, stage, actor, message, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertEv.run(
      `${rec.id}-EV-APP`,
      rec.incidentId,
      'APPROVAL_RECEIVED',
      operatorName,
      `Approved recommendation: "${rec.title}".`,
      '{}',
      approvalTs
    );
    insertEv.run(
      `${rec.id}-EV-STR`,
      rec.incidentId,
      'RECOVERY_STARTED',
      'UPIShield Simulated Orchestrator',
      `Simulated recovery execution started (${rec.actionType}).`,
      '{}',
      startTs
    );
    insertEv.run(
      `${rec.id}-EV-CMP`,
      rec.incidentId,
      'RECOVERY_COMPLETED',
      'UPIShield Simulated Orchestrator',
      `Simulated recovery completed for ${affected.length} services.`,
      '{}',
      completeTs
    );
    insertEv.run(
      `${rec.id}-EV-VER`,
      rec.incidentId,
      'VERIFICATION_PASSED',
      'Automated Canary Verifier',
      `Verification passed: ${rec.verificationCondition}`,
      '{}',
      completeTs
    );
  }

  const servicesAfter = getAllServices();
  const postHealth: Record<string, string> = {};
  for (const s of servicesAfter) {
    if (preHealth[s.name]) postHealth[s.name] = s.healthState;
  }

  const actId = `ACT-${Date.now().toString(36).toUpperCase()}`;
  db.prepare(`
    INSERT INTO recovery_actions (
      id, recommendation_id, incident_id, action_title, operator_name,
      status, verification_result, pre_health_json, post_health_json, executed_at
    ) VALUES (?, ?, ?, ?, ?, 'SIMULATED_EXECUTED', 'PASSED', ?, ?, ?)
  `).run(
    actId,
    rec.id,
    rec.incidentId,
    rec.title,
    operatorName,
    JSON.stringify(preHealth),
    JSON.stringify(postHealth),
    completeTs
  );

  logAudit(operatorName, 'RECOVERY_APPROVED_AND_SIMULATED', 'recommendation', rec.id, `Approved and simulated "${rec.title}" for incident ${rec.incidentId}.`);

  const updatedRow = db.prepare('SELECT * FROM recovery_recommendations WHERE id = ?').get(rec.id) as Record<string, unknown>;
  res.json({
    recommendation: mapRecommendationRow(updatedRow),
    actionId: actId,
  });
});

app.post('/api/recommendations/:id/reject', (req, res) => {
  const recRow = db
    .prepare('SELECT * FROM recovery_recommendations WHERE id = ?')
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!recRow) {
    res.status(404).json({ error: 'Recommendation not found' });
    return;
  }

  const operatorName = req.body?.operatorName || 'Priya Sharma (VP Infrastructure)';
  const reason = req.body?.reason || 'Operator deferred action pending manual verification';

  db.prepare(`UPDATE recovery_recommendations SET status = 'REJECTED', approved_by = ? WHERE id = ?`).run(
    operatorName,
    req.params.id
  );

  logAudit(operatorName, 'RECOVERY_REJECTED', 'recommendation', req.params.id, `Rejected recommendation: ${reason}`);
  const updatedRow = db.prepare('SELECT * FROM recovery_recommendations WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  res.json({ recommendation: mapRecommendationRow(updatedRow) });
});

// 7. Incident History & Details
app.get('/api/incidents', (req, res) => {
  let sql = 'SELECT * FROM incidents WHERE 1=1';
  const params: string[] = [];

  if (typeof req.query.serviceId === 'string' && req.query.serviceId !== 'all') {
    sql += ' AND service_id = ?';
    params.push(req.query.serviceId);
  }
  if (typeof req.query.severity === 'string' && req.query.severity !== 'all') {
    sql += ' AND severity = ?';
    params.push(req.query.severity);
  }
  if (typeof req.query.origin === 'string' && req.query.origin !== 'all') {
    sql += ' AND origin = ?';
    params.push(req.query.origin);
  }
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    sql += ' AND (title LIKE ? OR root_cause LIKE ? OR id LIKE ?)';
    const q = `%${req.query.search.trim()}%`;
    params.push(q, q, q);
  }

  sql += ' ORDER BY started_at DESC';
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  res.json({
    incidents: rows.map((r) => mapIncidentRow(r, true, true)),
  });
});

app.get('/api/incidents/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  res.json({ incident: mapIncidentRow(row, true, true) });
});

// 8. Transaction Safety & Payment Integrity (Module 6)
app.get('/api/transactions', (_req, res) => {
  const rows = db.prepare('SELECT * FROM transactions ORDER BY created_at DESC').all() as Array<Record<string, unknown>>;
  const transactions = rows.map(mapTransactionRow);

  const totalCount = transactions.length;
  const successCount = transactions.filter((t) => t.status === 'SUCCESS').length;
  const failedCount = transactions.filter((t) => t.status === 'FAILED').length;
  const pendingCount = transactions.filter((t) => t.status === 'PENDING').length;
  const unknownCount = transactions.filter((t) => t.status === 'UNKNOWN_RESPONSE_LOST').length;
  const duplicateBlockedCount = transactions.filter((t) => t.status === 'DUPLICATE_BLOCKED').length;
  const timeoutCount = transactions.filter((t) => t.responseLost).length;

  const activeIncidents = db
    .prepare(`SELECT COALESCE(SUM(tx_at_risk), 0) as riskSum FROM incidents WHERE status != 'RESOLVED'`)
    .get() as { riskSum: number };

  const caseStudies = db.prepare('SELECT * FROM case_studies').all() as Array<Record<string, unknown>>;
  const protectedSum = caseStudies.reduce((a, c) => a + Number(c.estimated_tx_protected), 0);
  const downtimeAvoidedSum = caseStudies.reduce((a, c) => a + Number(c.estimated_downtime_avoided_min), 0);

  res.json({
    dataNotice: 'SYNTHETIC DEMONSTRATION DATA — NOT ACTUAL BANK TRANSACTION RECORDS.',
    summary: {
      totalVolumeSample: totalCount,
      syntheticDailyThroughput: 1075680000,
      successful: successCount,
      failed: failedCount,
      pending: pendingCount,
      unknownStatus: unknownCount,
      duplicateAttemptsBlocked: duplicateBlockedCount,
      timeoutEvents: timeoutCount,
      transactionsAffectedByActiveIncidents: activeIncidents.riskSum,
    },
    resilienceAnalytics: {
      estimatedTransactionsProtected: protectedSum + duplicateBlockedCount * 1,
      estimatedTransactionsAtRisk: activeIncidents.riskSum,
      estimatedDowntimeAvoidedMin: downtimeAvoidedSum,
      detectionImprovementPct: 76,
      recoveryTimeImprovementPct: 68,
      estimatedOperationalImpactAvoidedInr: 98500000,
    },
    transactions,
  });
});

app.post('/api/transactions/simulate-response-loss', (_req, res) => {
  const ts = nowIso();
  const txId = `TXN-SIM-${Date.now().toString().slice(-5)}`;
  const idempKey = `IDEMP-UPI-${Math.floor(10000 + Math.random() * 89999)}-RL`;

  const trail = [
    { timestamp: ts, event: 'IDEMPOTENCY_REGISTERED', detail: `Idempotency key ${idempKey} locked prior to core debit.` },
    { timestamp: ts, event: 'CORE_DEBIT_COMMITTED', detail: 'Bank Core System executed debit of INR 8,750.00 cleanly.' },
    { timestamp: ts, event: 'RESPONSE_SOCKET_LOST', detail: 'API Gateway response dropped before reaching PSP caller (simulated network drop).' },
    {
      timestamp: ts,
      event: 'SAFE_HOLD_APPLIED',
      detail: 'UPIShield held state as UNKNOWN_RESPONSE_LOST. Blocked blind auto-retry and avoided double debit.',
    },
  ];

  db.prepare(`
    INSERT INTO transactions (
      id, idempotency_key, payer_vpa, payee_vpa, amount_inr, status,
      gateway_service_id, incident_id, response_lost, verification_status,
      retry_count, audit_trail_json, created_at
    ) VALUES (?, ?, 'ananya.rao@okicici', 'bharat.energy@sbi', 8750, 'UNKNOWN_RESPONSE_LOST', 'upi-gateway', NULL, 1, 'AWAITING_STATUS_CHECK', 0, ?, ?)
  `).run(txId, idempKey, JSON.stringify(trail), ts);

  logAudit('Transaction Safety Engine', 'RESPONSE_LOSS_SIMULATED', 'transaction', txId, `Simulated response-loss hold with idempotency key ${idempKey}.`);

  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId) as Record<string, unknown>;
  res.json({ transaction: mapTransactionRow(row) });
});

app.post('/api/transactions/simulate-duplicate', (req, res) => {
  const ts = nowIso();
  const targetId = req.body?.transactionId;
  const sourceRow = (targetId
    ? db.prepare('SELECT * FROM transactions WHERE id = ?').get(targetId)
    : db.prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 1').get()) as
    | Record<string, unknown>
    | undefined;

  if (!sourceRow) {
    res.status(404).json({ error: 'No transaction available to retry' });
    return;
  }

  const tx = mapTransactionRow(sourceRow);
  const updatedTrail = [
    ...tx.auditTrail,
    {
      timestamp: ts,
      event: 'DUPLICATE_DEBIT_PREVENTED',
      detail: `Client retry carrying idempotency key ${tx.idempotencyKey} intercepted. No second debit sent to Bank Core System.`,
    },
  ];

  db.prepare(
    `UPDATE transactions SET retry_count = retry_count + 1, status = CASE WHEN status = 'SUCCESS' THEN 'DUPLICATE_BLOCKED' ELSE status END, verification_status = 'DUPLICATE_PREVENTED', audit_trail_json = ? WHERE id = ?`
  ).run(JSON.stringify(updatedTrail), tx.id);

  logAudit('Idempotency Guard', 'DUPLICATE_ATTEMPT_BLOCKED', 'transaction', tx.id, `Blocked duplicate debit attempt on key ${tx.idempotencyKey}.`);

  const refreshed = db.prepare('SELECT * FROM transactions WHERE id = ?').get(tx.id) as Record<string, unknown>;
  res.json({ transaction: mapTransactionRow(refreshed) });
});

app.post('/api/transactions/:id/verify', (req, res) => {
  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  const tx = mapTransactionRow(row);
  const ts = nowIso();
  const updatedTrail = [
    ...tx.auditTrail,
    {
      timestamp: ts,
      event: 'LEDGER_STATUS_VERIFIED',
      detail: `Reconciled key ${tx.idempotencyKey} directly with Bank Core System: original debit confirmed settled; zero duplicate execution.`,
    },
  ];

  db.prepare(
    `UPDATE transactions SET status = 'SUCCESS', verification_status = 'VERIFIED_LEDGER', audit_trail_json = ? WHERE id = ?`
  ).run(JSON.stringify(updatedTrail), tx.id);

  logAudit('Payment Integrity Verifier', 'TX_STATUS_RECONCILED', 'transaction', tx.id, `Verified and reconciled ${tx.id} against Core Ledger.`);

  const refreshed = db.prepare('SELECT * FROM transactions WHERE id = ?').get(tx.id) as Record<string, unknown>;
  res.json({ transaction: mapTransactionRow(refreshed) });
});

// 9. Counterfactual Case Studies & Audit Logs & Export Reports
app.get('/api/case-studies', (_req, res) => {
  const rows = db.prepare('SELECT * FROM case_studies').all() as Array<Record<string, unknown>>;
  const caseStudies: CaseStudyRecord[] = rows.map((r) => ({
    id: String(r.id),
    code: String(r.code),
    title: String(r.title),
    label: String(r.label),
    rootCause: String(r.root_cause),
    detectionMethod: String(r.detection_method),
    servicesAffected: JSON.parse(String(r.services_affected_json || '[]')),
    recommendedAction: String(r.recommended_action),
    simulatedOutcome: String(r.simulated_outcome),
    estimatedDowntimeAvoidedMin: Number(r.estimated_downtime_avoided_min),
    estimatedTxProtected: Number(r.estimated_tx_protected),
    timeline: JSON.parse(String(r.timeline_json || '[]')),
  }));
  res.json({
    disclaimer: 'ILLUSTRATIVE SYNTHETIC SCENARIOS — NOT REAL CUSTOMER BANK OUTAGES.',
    caseStudies,
  });
});

app.get('/api/audit-logs', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 60')
    .all() as Array<Record<string, unknown>>;
  res.json({
    logs: rows.map((r) => ({
      id: String(r.id),
      actor: String(r.actor),
      action: String(r.action),
      entityType: String(r.entity_type),
      entityId: String(r.entity_id),
      details: String(r.details),
      createdAt: String(r.created_at),
    })),
  });
});

app.get('/api/reports/export', (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const incRows = db.prepare('SELECT * FROM incidents ORDER BY started_at DESC').all() as Array<Record<string, unknown>>;
  const incidents = incRows.map((r) => mapIncidentRow(r, false));
  const predictions = computePredictiveIntelligence();
  const caseRows = db.prepare('SELECT * FROM case_studies').all() as Array<Record<string, unknown>>;

  logAudit('Infrastructure Operator', 'RESILIENCE_REPORT_EXPORTED', 'report', format, `Exported ${format.toUpperCase()} incident & resilience intelligence report.`);

  if (format === 'csv') {
    const header = [
      'Incident ID',
      'Title',
      'Service',
      'Failure Type',
      'Severity',
      'Status',
      'Origin',
      'Started At',
      'MTTD (sec)',
      'MTTR (sec)',
      'Tx At Risk',
      'Est. Financial Impact (INR)',
    ].join(',');

    const lines = incidents.map((i) =>
      [
        i.id,
        `"${i.title.replace(/"/g, '""')}"`,
        `"${i.serviceName}"`,
        `"${i.failureType}"`,
        i.severity,
        i.status,
        i.origin,
        i.startedAt,
        i.mttdSeconds,
        i.mttrSeconds,
        i.txAtRisk,
        i.financialImpactInr,
      ].join(',')
    );

    const csv = `# UPIShield Incident & Resilience Report — SYNTHETIC DEMONSTRATION DATA\n${header}\n${lines.join('\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="upishield-resilience-report.csv"');
    res.send(csv);
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="upishield-resilience-report.json"');
  res.json({
    generatedAt: nowIso(),
    disclaimer: 'SYNTHETIC DEMONSTRATION DATA — NOT ACTUAL BANK INCIDENT RECORDS.',
    incidents,
    octoberAnomalySummary: predictions.octoberPatternDiscovery,
    topPredictedRisks: predictions.outlook30Day.slice(0, 6),
    counterfactualCaseStudies: caseRows,
  });
});

// 9B. Enterprise Maturity Endpoints (SPOF, What-If Lab, Recovery Readiness, SLO/Error Budget, Executive Report)
app.get('/api/analysis/spof', (_req, res) => {
  res.json(analyzeSinglePointsOfFailure());
});

app.post('/api/analysis/what-if', (req, res) => {
  try {
    const {
      serviceId = 'primary-db',
      scenarioType = 'DATABASE_FAILURE',
      latencyMultiplier,
      trafficMultiplier,
    } = req.body ?? {};
    const result = runWhatIfScenario({
      serviceId: String(serviceId),
      scenarioType: String(scenarioType) as WhatIfScenarioType,
      latencyMultiplier: latencyMultiplier !== undefined ? Number(latencyMultiplier) : undefined,
      trafficMultiplier: trafficMultiplier !== undefined ? Number(trafficMultiplier) : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'What-if scenario calculation failed' });
  }
});

app.get('/api/analysis/readiness', (_req, res) => {
  res.json(computeRecoveryReadiness());
});

app.get('/api/analysis/slo', (_req, res) => {
  res.json(computeSloStatus());
});

app.post('/api/analysis/slo/targets', (req, res) => {
  const { serviceId, targetPct } = req.body ?? {};
  if (!serviceId || targetPct === undefined || Number.isNaN(Number(targetPct))) {
    res.status(400).json({ error: 'serviceId and numeric targetPct are required' });
    return;
  }
  const updated = updateSloTarget(String(serviceId), Number(targetPct));
  logAudit(
    'SRE Governance Lead',
    'SLO_TARGET_UPDATED',
    'service',
    updated.serviceId,
    `Updated demo availability SLO target for ${updated.serviceId} to ${updated.targetPct}%.`
  );
  res.json({ updated, slo: computeSloStatus() });
});

app.get('/api/reports/executive', (_req, res) => {
  res.json(buildExecutiveReportData(mapIncidentRow));
});

// 10. Gemini AI Endpoints (Server-Side Only)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { model = 'gemini-4-hydrogen', role = 'sre_commander', history = [], message } = req.body ?? {};
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const services = getAllServices();
    const activeIncidents = (
      db.prepare(`SELECT * FROM incidents WHERE status != 'RESOLVED'`).all() as Array<Record<string, unknown>>
    ).map((r) => mapIncidentRow(r, false));
    const analytics = computePredictiveIntelligence();

    const platformContext = JSON.stringify({
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        state: s.healthState,
        latencyMs: s.latencyMs,
        errorRatePct: s.errorRate,
        riskScore: s.riskScore,
      })),
      activeIncidents: activeIncidents.map((i) => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        txAtRisk: i.txAtRisk,
        affectedServices: i.affectedServices,
      })),
      octoberPatternDiscovery: analytics.octoberPatternDiscovery,
      topRisks30d: analytics.outlook30Day.slice(0, 3).map((p) => ({
        service: p.serviceName,
        riskScore: p.riskScore,
        whatCouldFail: p.whatCouldFail,
      })),
    });

    const result = await runGeminiChat({
      model,
      role,
      history: Array.isArray(history) ? history : [],
      message,
      platformContext,
    });

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini chat request failed';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/ai/generate-image', async (req, res) => {
  try {
    const { prompt, imageSize = '1K', aspectRatio = '16:9' } = req.body ?? {};
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const result = await generateArchitectureImage({
      prompt,
      imageSize,
      aspectRatio,
    });

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini image generation failed';
    res.status(500).json({ error: msg });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT || 3000);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`UPIShield server running on http://0.0.0.0:${port}`);
  });
}

startServer();
