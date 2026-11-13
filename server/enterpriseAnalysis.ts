import { db } from './db.ts';
import { computePredictiveIntelligence } from './analytics.ts';
import {
  calculateCascadeImpact,
  getAllDependencies,
  getAllServices,
  getServiceConnections,
} from './topology.ts';
import type {
  CaseStudyRecord,
  IncidentRecord,
  ServiceHealthState,
  ServiceNode,
  ServiceReadinessItem,
  SloServiceStatus,
  SpofAnalysisItem,
  WhatIfScenarioResult,
} from '../src/types.ts';

export type WhatIfScenarioType =
  | 'COMPLETE_OUTAGE'
  | 'DATABASE_FAILURE'
  | 'CLOUD_OUTAGE'
  | 'API_GATEWAY_FAILURE'
  | 'INCREASED_LATENCY'
  | 'TRAFFIC_SURGE';

/**
 * 1. Critical Dependency & Single Point of Failure (SPOF) Analysis
 * Uses actual graph traversal & dependency edges without inventing relationships.
 */
export function analyzeSinglePointsOfFailure(): {
  dataNotice: string;
  totalServicesAnalyzed: number;
  spofCount: number;
  items: SpofAnalysisItem[];
} {
  const services = getAllServices();
  const edges = getAllDependencies();
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const items: SpofAnalysisItem[] = [];

  for (const svc of services) {
    // Skip passive standby node from being flagged as an active SPOF itself
    if (svc.id === 'backup-db') continue;

    const connections = getServiceConnections(svc.id);
    const cascade = calculateCascadeImpact(svc.id, 'CRITICAL');

    const downstreamNames = Array.from(
      new Set([
        ...connections.downstreamDependents.map((d) => d.service.name),
        ...cascade.directlyAffected.map((d) => d.name),
        ...cascade.indirectlyAffected.map((i) => i.name),
      ])
    );

    const affectedServicesCount = cascade.directlyAffected.length + cascade.indirectlyAffected.length;
    const criticalPathsCount = cascade.criticalPaymentPaths.length;

    // Only include services that sit on payment paths or affect downstream services
    if (affectedServicesCount === 0 && criticalPathsCount === 0) continue;

    const backupSvc = svc.backupServiceId ? serviceMap.get(svc.backupServiceId) ?? null : null;
    const hasSoftFallback = connections.upstreamDependencies.some((u) => u.edge.dependencyType === 'SOFT');

    let backupReadiness: SpofAnalysisItem['backupReadiness'] = 'NO_BACKUP_CONFIGURED';
    if (backupSvc) {
      backupReadiness = 'AUTOMATED_STANDBY';
    } else if (hasSoftFallback || svc.id === 'fraud-detection' || svc.id === 'notification-svc') {
      backupReadiness = 'PARTIAL_ROUTE';
    }

    const alternativeRoutes = backupSvc
      ? `Standby target configured: ${backupSvc.name} (${backupSvc.healthState})`
      : svc.id === 'load-balancer'
      ? 'Dual-ingress DNS weight shift possible across edge POPs (no dedicated standby node modeled)'
      : svc.id === 'api-gateway'
      ? 'No secondary API Gateway node modeled in topology; requires AZ instance scaling'
      : svc.id === 'upi-gateway'
      ? 'Traffic throttling & secondary clearing route split required under overload'
      : svc.id === 'cloud-provider'
      ? 'Cross-AZ evacuation required; multiple Tier-1/Tier-2 services share this substrate'
      : 'No automated standby node configured in current dependency graph';

    const criticalityWeight =
      svc.criticality === 'CRITICAL' ? 28 : svc.criticality === 'HIGH' ? 18 : 10;
    const noBackupPenalty =
      backupReadiness === 'NO_BACKUP_CONFIGURED' ? 24 : backupReadiness === 'PARTIAL_ROUTE' ? 10 : 0;
    const spofSeverityScore = Math.min(
      99,
      Math.round(
        criticalityWeight +
          affectedServicesCount * 5.2 +
          criticalPathsCount * 4.5 +
          noBackupPenalty +
          svc.riskScore * 0.22
      )
    );

    const hardDownstreamCount = edges.filter(
      (e) => e.targetId === svc.id && (e.dependencyType === 'HARD' || e.dependencyType === 'INFRASTRUCTURE')
    ).length;

    const riskExplanation = `${svc.name} carries ${hardDownstreamCount} hard/infrastructure inbound dependency edge(s), sits on ${criticalPathsCount} critical payment path(s), and exposes ${affectedServicesCount} connected service(s) (${cascade.blastRadiusPct}% topology blast radius). ${
      backupSvc
        ? `Standby replica (${backupSvc.name}) mitigates permanent data loss, though failover transition still impacts in-flight sockets.`
        : 'No dedicated backup service is configured in the dependency graph, creating single-point failure exposure.'
    }`;

    const recommendedPreventiveAction =
      svc.id === 'primary-db'
        ? 'Offload read-only Fraud Detection & token lookups to Backup Database replica and enforce PgBouncer connection caps.'
        : svc.id === 'cloud-provider'
        ? 'Distribute Load Balancer, API Gateway, Auth Service, and Primary DB across isolated cloud availability zones.'
        : svc.id === 'upi-gateway'
        ? 'Pre-warm secondary clearing worker pools ahead of October seasonal spikes and enforce bounded downstream retry budgets.'
        : svc.id === 'api-gateway'
        ? 'Deploy active-active secondary API Gateway cluster and enforce strict upstream keep-alive & circuit-breaker limits.'
        : svc.id === 'auth-service'
        ? 'Increase HSM token cache TTL and configure fallback verification enclave to eliminate DB lookup storms.'
        : svc.id === 'bank-core'
        ? 'Maintain queued ledger journal buffering with idempotent reconciliation checks during core maintenance windows.'
        : `Provision redundant failover peer and validate automated health-probe circuit breaking for ${svc.name}.`;

    items.push({
      serviceId: svc.id,
      serviceName: svc.name,
      tier: svc.tier,
      criticality: svc.criticality,
      riskScore: svc.riskScore,
      downstreamDependents: downstreamNames,
      affectedServicesCount,
      criticalPathsCount,
      criticalPaths: cascade.criticalPaymentPaths,
      alternativeRoutes,
      backupReadiness,
      backupServiceName: backupSvc?.name ?? null,
      spofSeverityScore,
      riskExplanation,
      recommendedPreventiveAction,
    });
  }

  items.sort((a, b) => b.spofSeverityScore - a.spofSeverityScore);

  return {
    dataNotice: 'GRAPH-DERIVED TOPOLOGY ANALYSIS · COMPUTED FROM LIVE SQLITE DEPENDENCY EDGES.',
    totalServicesAnalyzed: services.length,
    spofCount: items.filter((i) => i.spofSeverityScore >= 60 || i.backupReadiness === 'NO_BACKUP_CONFIGURED').length,
    items,
  };
}

/**
 * 2. Non-Destructive What-If Risk Scenario Lab
 * Simulates a failure without altering persistent live topology or incident state.
 */
export function runWhatIfScenario(input: {
  serviceId: string;
  scenarioType: WhatIfScenarioType;
  latencyMultiplier?: number;
  trafficMultiplier?: number;
}): WhatIfScenarioResult {
  const baselineServices = getAllServices();
  const serviceMap = new Map(baselineServices.map((s) => [s.id, s]));

  const scenarioMap: Record<
    WhatIfScenarioType,
    { label: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'; latMult: number; errAdd: number; recoveryMin: number; rpsMult: number }
  > = {
    COMPLETE_OUTAGE: {
      label: 'Complete Service Outage',
      severity: 'CRITICAL',
      latMult: 6.5,
      errAdd: 12.5,
      recoveryMin: 24,
      rpsMult: 0.25,
    },
    DATABASE_FAILURE: {
      label: 'Database Failure & Lock Contention',
      severity: 'CRITICAL',
      latMult: 5.8,
      errAdd: 9.4,
      recoveryMin: 18,
      rpsMult: 0.65,
    },
    CLOUD_OUTAGE: {
      label: 'Cloud Provider Availability Zone Outage',
      severity: 'CRITICAL',
      latMult: 6.0,
      errAdd: 11.2,
      recoveryMin: 28,
      rpsMult: 0.4,
    },
    API_GATEWAY_FAILURE: {
      label: 'API Gateway Exhaustion / 504 Cascade',
      severity: 'CRITICAL',
      latMult: 5.2,
      errAdd: 8.8,
      recoveryMin: 16,
      rpsMult: 0.5,
    },
    INCREASED_LATENCY: {
      label: 'Elevated Upstream Latency Spike',
      severity: 'HIGH',
      latMult: input.latencyMultiplier ?? 3.4,
      errAdd: 2.8,
      recoveryMin: 11,
      rpsMult: 1.0,
    },
    TRAFFIC_SURGE: {
      label: 'Sudden Seasonal Traffic Surge (1.8x)',
      severity: 'HIGH',
      latMult: 3.1,
      errAdd: 3.6,
      recoveryMin: 14,
      rpsMult: input.trafficMultiplier ?? 1.8,
    },
  };

  const cfg = scenarioMap[input.scenarioType] ?? scenarioMap.COMPLETE_OUTAGE;
  const target = serviceMap.get(input.serviceId);
  if (!target) {
    throw new Error(`Service not found: ${input.serviceId}`);
  }

  const cascade = calculateCascadeImpact(target.id, cfg.severity);
  const directMap = new Map(cascade.directlyAffected.map((d) => [d.id, d]));
  const indirectMap = new Map(cascade.indirectlyAffected.map((i) => [i.id, i]));

  const affectedServices: WhatIfScenarioResult['affectedServices'] = [];
  const simulatedServices: ServiceNode[] = baselineServices.map((s) => {
    if (s.id === target.id) {
      const state: ServiceHealthState = cfg.severity === 'CRITICAL' ? 'RED' : 'YELLOW';
      const projLat = Number((s.baseLatencyMs * cfg.latMult).toFixed(1));
      const projErr = Number(Math.min(100, s.baseErrorRate + cfg.errAdd).toFixed(2));
      affectedServices.push({
        id: s.id,
        name: s.name,
        hopDistance: 0,
        projectedState: state,
        projectedLatencyMs: projLat,
        projectedErrorRate: projErr,
      });
      return {
        ...s,
        healthState: state,
        latencyMs: projLat,
        errorRate: projErr,
        rps: Math.round(s.baseRps * cfg.rpsMult),
        riskScore: Math.min(99, Number((s.riskScore + 22).toFixed(1))),
      };
    }

    const dir = directMap.get(s.id);
    if (dir) {
      const mult = dir.projectedState === 'RED' ? 3.4 : 2.1;
      const projLat = Number((s.baseLatencyMs * mult).toFixed(1));
      const projErr = Number(Math.min(100, s.baseErrorRate + (dir.projectedState === 'RED' ? 4.4 : 1.9)).toFixed(2));
      affectedServices.push({
        id: s.id,
        name: s.name,
        hopDistance: 1,
        projectedState: dir.projectedState,
        projectedLatencyMs: projLat,
        projectedErrorRate: projErr,
      });
      return {
        ...s,
        healthState: dir.projectedState,
        latencyMs: projLat,
        errorRate: projErr,
        riskScore: Math.min(98, Number((s.riskScore + 15).toFixed(1))),
      };
    }

    const ind = indirectMap.get(s.id);
    if (ind) {
      const projLat = Number((s.baseLatencyMs * 1.65).toFixed(1));
      const projErr = Number(Math.min(100, s.baseErrorRate + 1.1).toFixed(2));
      affectedServices.push({
        id: s.id,
        name: s.name,
        hopDistance: ind.hopDistance,
        projectedState: ind.projectedState,
        projectedLatencyMs: projLat,
        projectedErrorRate: projErr,
      });
      return {
        ...s,
        healthState: ind.projectedState,
        latencyMs: projLat,
        errorRate: projErr,
        riskScore: Math.min(95, Number((s.riskScore + 9).toFixed(1))),
      };
    }

    return { ...s };
  });

  const maxHop = cascade.indirectlyAffected.reduce(
    (m, i) => Math.max(m, i.hopDistance),
    cascade.directlyAffected.length > 0 ? 1 : 0
  );

  const backupSvc = target.backupServiceId ? serviceMap.get(target.backupServiceId) : null;
  const backupAvailability = backupSvc
    ? `Standby Available: ${backupSvc.name} (${backupSvc.healthState}, ${backupSvc.latencyMs}ms)`
    : 'No Dedicated Backup Service Configured (Requires Traffic Shift / AZ Failover)';

  const recommendedRecoveryPath = backupSvc
    ? `Failover workload to ${backupSvc.name}, drain ${target.name} pools, and run canary verification.`
    : target.id === 'cloud-provider'
    ? 'Evacuate degraded Availability Zone across Load Balancer & API Gateway, then promote cross-AZ database standby.'
    : `Apply adaptive rate limiting at API Gateway, isolate degraded ${target.name} instances, and execute graceful pool recycle.`;

  const baseAvail = 99.95;
  const simPenalty =
    affectedServices.filter((a) => a.projectedState === 'RED').length * 1.85 +
    affectedServices.filter((a) => a.projectedState === 'YELLOW').length * 0.45;
  const availabilityDeltaPct = Number((-Math.min(28, simPenalty)).toFixed(2));

  return {
    scenarioLabel: `${cfg.label} on ${target.name}`,
    isSimulatedEstimate: true,
    targetServiceId: target.id,
    targetServiceName: target.name,
    baselineServices,
    simulatedServices,
    affectedServices,
    criticalPaymentPathsImpacted: cascade.criticalPaymentPaths,
    potentialCascadeDepth: maxHop,
    estimatedTransactionsExposed: cascade.estimatedTxAtRisk,
    backupAvailability,
    recommendedRecoveryPath,
    estimatedRecoveryDurationMin: backupSvc ? Math.max(6, Math.round(cfg.recoveryMin * 0.55)) : cfg.recoveryMin,
    availabilityDeltaPct,
  };
}

/**
 * 3. Recovery Readiness Assessment
 * Scores every service across 6 concrete architectural & operational dimensions (max 100).
 * Never assigns 100/100 without verifiable evidence in topology + SQLite recovery history.
 */
export function computeRecoveryReadiness(): {
  dataNotice: string;
  overallScore: number;
  readinessBand: 'STRONG' | 'MODERATE' | 'NEEDS_IMPROVEMENT';
  services: ServiceReadinessItem[];
  missingCapabilitiesSummary: Array<{ capability: string; affectedServices: string[]; count: number }>;
  highPriorityImprovements: Array<{ serviceId: string; serviceName: string; score: number; action: string }>;
  methodology: string;
} {
  const services = getAllServices();
  const edges = getAllDependencies();
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  // Pull real evidence from SQLite recovery_actions & resolved incidents
  const actionRows = db
    .prepare(
      `SELECT rr.service_id, COUNT(*) as cnt
       FROM recovery_actions ra
       JOIN recovery_recommendations rr ON rr.id = ra.recommendation_id
       WHERE ra.verification_result = 'PASSED'
       GROUP BY rr.service_id`
    )
    .all() as Array<{ service_id: string; cnt: number }>;
  const verifiedActionsMap = new Map(actionRows.map((r) => [r.service_id, r.cnt]));

  const resolvedIncRows = db
    .prepare(`SELECT service_id, COUNT(*) as cnt FROM incidents WHERE status = 'RESOLVED' GROUP BY service_id`)
    .all() as Array<{ service_id: string; cnt: number }>;
  const resolvedIncMap = new Map(resolvedIncRows.map((r) => [r.service_id, r.cnt]));

  const automatedFailoverIds = new Set(['primary-db', 'backup-db', 'load-balancer', 'ext-network']);
  const runbookReadyIds = new Set([
    'load-balancer',
    'api-gateway',
    'upi-gateway',
    'auth-service',
    'tx-processing',
    'primary-db',
    'backup-db',
    'cloud-provider',
    'ext-network',
  ]);

  const missingMap = new Map<string, string[]>();
  const addMissing = (cap: string, svcName: string) => {
    const arr = missingMap.get(cap) ?? [];
    arr.push(svcName);
    missingMap.set(cap, arr);
  };

  const items: ServiceReadinessItem[] = services.map((s) => {
    const missingCapabilities: string[] = [];

    // 1. Backup Service Availability (20)
    const backupSvc = s.backupServiceId ? serviceMap.get(s.backupServiceId) : null;
    let backupScore = 0;
    let backupEvidence = 'No backup service configured in topology';
    if (backupSvc && backupSvc.healthState === 'GREEN') {
      backupScore = 20;
      backupEvidence = `Dedicated healthy standby: ${backupSvc.name}`;
    } else if (s.id === 'backup-db') {
      backupScore = 16;
      backupEvidence = 'Functions as standby replica; no tertiary cross-region cold backup modeled';
      missingCapabilities.push('Tertiary cross-region backup target');
      addMissing('Cross-Region Tertiary Backup', s.name);
    } else if (s.id === 'notification-svc' || s.id === 'fraud-detection') {
      backupScore = 9;
      backupEvidence = 'Degrades softly without blocking core settlement, but no standby replica';
      missingCapabilities.push('Dedicated standby replica');
      addMissing('Dedicated Standby Service', s.name);
    } else {
      backupScore = 4;
      backupEvidence = 'No automated standby service mapped in dependency graph';
      missingCapabilities.push('No automated standby service');
      addMissing('Dedicated Standby Service', s.name);
    }

    // 2. Dependency Redundancy (15)
    const hardUpstream = edges.filter(
      (e) => e.sourceId === s.id && (e.dependencyType === 'HARD' || e.dependencyType === 'INFRASTRUCTURE')
    ).length;
    let redundancyScore = 15;
    let redundancyEvidence = 'Zero single-point hard upstream bottlenecks';
    if (hardUpstream >= 3) {
      redundancyScore = 6;
      redundancyEvidence = `${hardUpstream} hard/infrastructure upstream single-path dependencies`;
      missingCapabilities.push('Multi-path upstream redundancy');
      addMissing('Upstream Path Redundancy', s.name);
    } else if (hardUpstream >= 1) {
      redundancyScore = 11;
      redundancyEvidence = `${hardUpstream} hard upstream dependency edge(s); partial path exposure`;
    }

    // 3. Recovery Procedure Availability (20)
    const hasRunbook = runbookReadyIds.has(s.id);
    const procScore = hasRunbook ? 18 : 11;
    const procEvidence = hasRunbook
      ? 'Approved SRE recovery playbook & verification condition registered'
      : 'Generic instance-recycle playbook only; service-specific runbook pending';
    if (!hasRunbook) {
      missingCapabilities.push('Service-specific recovery playbook');
      addMissing('Dedicated Recovery Runbook', s.name);
    }

    // 4. Failover Configuration (15)
    let failoverScore = 6;
    let failoverEvidence = 'Manual operator approval + traffic shift required';
    if (automatedFailoverIds.has(s.id)) {
      failoverScore = 13;
      failoverEvidence = 'Automated health-probe failover & standby promotion supported (gated by approval policy)';
    } else {
      missingCapabilities.push('Automated pre-warmed failover route');
      addMissing('Automated Failover Route', s.name);
    }

    // 5. Recent Recovery Test Results (15)
    const verifiedCount = verifiedActionsMap.get(s.id) ?? 0;
    const resolvedCount = resolvedIncMap.get(s.id) ?? 0;
    let testScore = 4;
    let testEvidence = 'No verified simulated recovery drill in SQLite audit log';
    if (verifiedCount > 0) {
      testScore = 15;
      testEvidence = `${verifiedCount} passed simulated recovery verification(s) recorded`;
    } else if (resolvedCount > 0) {
      testScore = 10;
      testEvidence = `${resolvedCount} historical incident resolution(s) recorded; live drill recommended`;
      missingCapabilities.push('Recent live recovery simulation drill');
      addMissing('Live Recovery Drill Verification', s.name);
    } else {
      missingCapabilities.push('Zero recovery drill evidence');
      addMissing('Live Recovery Drill Verification', s.name);
    }

    // 6. Critical Monitoring Coverage (15)
    const monScore = s.criticality === 'CRITICAL' ? 14 : 12;
    const monEvidence = `Telemetry tracked against ${s.slaTarget}% SLA target (latency, error rate, RPS)`;

    const overallScore = backupScore + redundancyScore + procScore + failoverScore + testScore + monScore;
    const priorityImprovement =
      missingCapabilities.length > 0
        ? `Address: ${missingCapabilities[0]} (${backupSvc ? 'verify failover latency' : 'configure standby / multi-AZ peer'})`
        : 'Maintain quarterly recovery verification rehearsals.';

    return {
      serviceId: s.id,
      serviceName: s.name,
      criticality: s.criticality,
      overallScore,
      breakdown: {
        backupAvailability: { score: backupScore, max: 20, evidence: backupEvidence },
        dependencyRedundancy: { score: redundancyScore, max: 15, evidence: redundancyEvidence },
        recoveryProcedure: { score: procScore, max: 20, evidence: procEvidence },
        failoverConfiguration: { score: failoverScore, max: 15, evidence: failoverEvidence },
        recentRecoveryTest: { score: testScore, max: 15, evidence: testEvidence },
        monitoringCoverage: { score: monScore, max: 15, evidence: monEvidence },
      },
      missingCapabilities,
      priorityImprovement,
    };
  });

  items.sort((a, b) => a.overallScore - b.overallScore);

  const overallScore = Math.round(
    items.reduce((acc, i) => acc + i.overallScore, 0) / Math.max(1, items.length)
  );
  const readinessBand =
    overallScore >= 80 ? 'STRONG' : overallScore >= 65 ? 'MODERATE' : 'NEEDS_IMPROVEMENT';

  const missingCapabilitiesSummary = Array.from(missingMap.entries())
    .map(([capability, affectedServices]) => ({
      capability,
      affectedServices,
      count: affectedServices.length,
    }))
    .sort((a, b) => b.count - a.count);

  const highPriorityImprovements = items
    .filter((i) => i.criticality === 'CRITICAL' || i.overallScore < 72)
    .slice(0, 6)
    .map((i) => ({
      serviceId: i.serviceId,
      serviceName: i.serviceName,
      score: i.overallScore,
      action: i.priorityImprovement,
    }));

  return {
    dataNotice: 'EVIDENCE-BASED READINESS ASSESSMENT · SCORED FROM TOPOLOGY & SQLITE RECOVERY AUDIT TRAIL.',
    overallScore,
    readinessBand,
    services: items,
    missingCapabilitiesSummary,
    highPriorityImprovements,
    methodology:
      'Composite 100-point rubric: Backup Availability (20) + Dependency Redundancy (15) + Recovery Procedure (20) + Failover Config (15) + Verified Recovery Drills (15) + Monitoring Coverage (15). Perfect 100 requires full redundancy and verified drill evidence.',
  };
}

/**
 * 4. SLO & Error Budget Monitoring (30-day rolling window)
 * All numbers deterministically computed from SQLite metrics, service states, and configurable targets.
 */
export function computeSloStatus(): {
  dataNotice: string;
  windowDays: number;
  breachedCount: number;
  warningCount: number;
  overallSloCompliancePct: number;
  services: SloServiceStatus[];
} {
  const services = getAllServices();
  const windowMinutes = 30 * 24 * 60; // 43,200 minutes

  // Load configurable demonstration SLO targets from settings table
  const settingRows = db
    .prepare(`SELECT key, value FROM settings WHERE key LIKE 'slo_target_%'`)
    .all() as Array<{ key: string; value: string }>;
  const targetOverrides = new Map(
    settingRows.map((r) => [r.key.replace('slo_target_', ''), Number(r.value)])
  );

  // Pull latest nominal 30-day baseline (2026 month 9 prior to October spike) + recent historical trend per service
  const metricRows = db
    .prepare(
      `SELECT service_id,
              MAX(CASE WHEN month = 9 THEN availability_pct ELSE NULL END) as m9_avail,
              AVG(availability_pct) as avg_avail,
              MAX(CASE WHEN month = 9 THEN p95_latency_ms ELSE NULL END) as m9_p95,
              AVG(p95_latency_ms) as avg_p95
       FROM historical_metrics
       WHERE year = 2026
       GROUP BY service_id`
    )
    .all() as Array<{
      service_id: string;
      m9_avail: number | null;
      avg_avail: number;
      m9_p95: number | null;
      avg_p95: number;
    }>;
  const metricMap = new Map(metricRows.map((m) => [m.service_id, m]));

  // Check active or recent simulation incident downtime impact per service
  const activeIncRows = db
    .prepare(`SELECT service_id, duration_minutes, status FROM incidents WHERE origin = 'live_simulation'`)
    .all() as Array<{ service_id: string; duration_minutes: number; status: string }>;
  const simDowntimeMap = new Map<string, number>();
  for (const inc of activeIncRows) {
    const prev = simDowntimeMap.get(inc.service_id) ?? 0;
    simDowntimeMap.set(inc.service_id, prev + (inc.status !== 'RESOLVED' ? inc.duration_minutes : Math.round(inc.duration_minutes * 0.3)));
  }

  const statuses: SloServiceStatus[] = services.map((s) => {
    const defaultDemoSlo =
      s.criticality === 'CRITICAL' ? 99.95 : s.criticality === 'HIGH' ? 99.92 : 99.9;
    const targetPct = Number((targetOverrides.get(s.id) ?? defaultDemoSlo).toFixed(3));
    const metric = metricMap.get(s.id);
    const baselineAvail = metric?.m9_avail ?? metric?.avg_avail ?? s.slaTarget;

    // Live error-rate & health-state degradation penalty over 30d window
    const liveErrPenalty = Math.max(0, s.errorRate - s.baseErrorRate) * 0.06;
    const statePenalty = s.healthState === 'RED' ? 0.32 : s.healthState === 'YELLOW' ? 0.09 : 0;
    const simExtraMin = simDowntimeMap.get(s.id) ?? 0;
    const simPenaltyPct = (simExtraMin / windowMinutes) * 100;

    const actualAvailabilityPct = Number(
      Math.max(92.0, Math.min(99.999, baselineAvail - liveErrPenalty - statePenalty - simPenaltyPct)).toFixed(3)
    );

    const errorBudgetTotalMinutes = Number((((100 - targetPct) / 100) * windowMinutes).toFixed(2));
    const rawConsumedMinutes = ((100 - actualAvailabilityPct) / 100) * windowMinutes;
    const errorBudgetConsumedMinutes = Number(Math.max(0.1, rawConsumedMinutes).toFixed(2));
    const errorBudgetRemainingMinutes = Number(
      Math.max(0, errorBudgetTotalMinutes - errorBudgetConsumedMinutes).toFixed(2)
    );
    const errorBudgetRemainingPct =
      errorBudgetTotalMinutes > 0
        ? Number(Math.max(0, ((errorBudgetTotalMinutes - errorBudgetConsumedMinutes) / errorBudgetTotalMinutes) * 100).toFixed(1))
        : 0;

    const sloBreached = errorBudgetConsumedMinutes > errorBudgetTotalMinutes || actualAvailabilityPct < targetPct;
    const burnRateStatus: SloServiceStatus['burnRateStatus'] = sloBreached
      ? 'BREACHED'
      : errorBudgetRemainingPct < 45
      ? 'WARNING'
      : 'NOMINAL';

    const latScale = s.latencyMs / Math.max(1, s.baseLatencyMs);
    const p50LatencyMs = Number((s.latencyMs * 0.78).toFixed(1));
    const baseP95 = metric?.m9_p95 ?? metric?.avg_p95 ?? s.baseLatencyMs * 1.9;
    const p95LatencyMs = Number((baseP95 * Math.max(1, latScale * 0.88)).toFixed(1));
    const p99LatencyMs = Number((p95LatencyMs * 1.38).toFixed(1));

    const calculationExplanation = `30-day budget = (100% - ${targetPct}%) × 43,200 min = ${errorBudgetTotalMinutes} min. Actual availability ${actualAvailabilityPct}% reflects ${errorBudgetConsumedMinutes} min of unavailability (${simExtraMin} min simulated incident impact + ${baselineAvail.toFixed(3)}% 30d baseline).`;

    return {
      serviceId: s.id,
      serviceName: s.name,
      criticality: s.criticality,
      availabilityTargetPct: targetPct,
      actualAvailabilityPct,
      errorRatePct: s.errorRate,
      p50LatencyMs,
      p95LatencyMs,
      p99LatencyMs,
      errorBudgetTotalMinutes,
      errorBudgetConsumedMinutes,
      errorBudgetRemainingMinutes,
      errorBudgetRemainingPct,
      sloBreached,
      burnRateStatus,
      calculationExplanation,
    };
  });

  const breachedCount = statuses.filter((st) => st.sloBreached).length;
  const warningCount = statuses.filter((st) => st.burnRateStatus === 'WARNING').length;
  const overallSloCompliancePct = Number(
    (((statuses.length - breachedCount) / Math.max(1, statuses.length)) * 100).toFixed(1)
  );

  return {
    dataNotice: 'DEMO SLO TELEMETRY · CONFIGURABLE TARGETS EVALUATED AGAINST SYNTHETIC 30-DAY WINDOW.',
    windowDays: 30,
    breachedCount,
    warningCount,
    overallSloCompliancePct,
    services: statuses,
  };
}

export function updateSloTarget(serviceId: string, targetPct: number) {
  const clamped = Math.max(95.0, Math.min(99.999, Number(targetPct)));
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(
    `slo_target_${serviceId}`,
    String(clamped)
  );
  return { serviceId, targetPct: clamped };
}

/**
 * 5. Executive Resilience Report Aggregator (Printable / PDF-Ready)
 */
export function buildExecutiveReportData(
  mapIncident: (row: Record<string, unknown>, includeEvents?: boolean) => IncidentRecord
) {
  const services = getAllServices();
  const predictions = computePredictiveIntelligence();
  const spof = analyzeSinglePointsOfFailure();
  const readiness = computeRecoveryReadiness();
  const slo = computeSloStatus();

  const incRows = db
    .prepare('SELECT * FROM incidents ORDER BY started_at DESC')
    .all() as Array<Record<string, unknown>>;
  const incidents = incRows.map((r) => mapIncident(r, false));

  const caseRows = db.prepare('SELECT * FROM case_studies').all() as Array<Record<string, unknown>>;
  const caseStudies: CaseStudyRecord[] = caseRows.map((r) => ({
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

  const healthyCount = services.filter((s) => s.healthState === 'GREEN').length;
  const criticalCount = services.filter((s) => s.healthState === 'RED').length;
  const degradedCount = services.filter((s) => s.healthState === 'YELLOW').length;

  const estimatedDowntimeAvoidedMin = caseStudies.reduce((a, c) => a + c.estimatedDowntimeAvoidedMin, 0);
  const estimatedTxProtected = caseStudies.reduce((a, c) => a + c.estimatedTxProtected, 0);

  return {
    generatedAt: new Date().toISOString(),
    environmentLabel: 'UPISHIELD ENTERPRISE DEMO ENVIRONMENT · SYNTHETIC BANKING DATA',
    dataGovernanceTags: {
      telemetry: 'MEASURED DEMO TELEMETRY (LIVE STATE IN LOCAL SQLITE)',
      historical: 'SYNTHETIC HISTORICAL DATA (2022–2026 SEEDED BASELINE)',
      projections: 'ESTIMATED COUNTERFACTUAL IMPACT & SIMULATIONS',
    },
    infrastructureSummary: {
      totalServices: services.length,
      healthyCount,
      degradedCount,
      criticalCount,
      overallReadinessScore: readiness.overallScore,
      readinessBand: readiness.readinessBand,
      sloCompliancePct: slo.overallSloCompliancePct,
      breachedSlos: slo.breachedCount,
      spofExposedCount: spof.spofCount,
    },
    octoberRiskAnalysis: predictions.octoberPatternDiscovery,
    yoyTrends: predictions.yoyComparison,
    topPredictedRisks: predictions.outlook30Day.slice(0, 5),
    criticalDependencies: spof.items.slice(0, 6),
    majorIncidents: incidents.slice(0, 8),
    readinessHighPriority: readiness.highPriorityImprovements,
    sloAlerts: slo.services.filter((s) => s.burnRateStatus !== 'NOMINAL'),
    estimatedDisruptionAvoided: {
      totalDowntimeAvoidedMin: estimatedDowntimeAvoidedMin,
      totalTransactionsProtected: estimatedTxProtected,
      caseStudiesCount: caseStudies.length,
    },
    preventiveRecommendations: spof.items.slice(0, 5).map((item) => ({
      serviceName: item.serviceName,
      spofSeverityScore: item.spofSeverityScore,
      action: item.recommendedPreventiveAction,
    })),
    caseStudies,
  };
}
