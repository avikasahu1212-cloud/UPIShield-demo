import { db } from './db.ts';
import type {
  CascadeImpactResult,
  DependencyEdge,
  ServiceHealthState,
  ServiceNode,
} from '../src/types.ts';

interface ServiceRow {
  id: string;
  name: string;
  tier: string;
  category: string;
  criticality: ServiceNode['criticality'];
  health_state: ServiceHealthState;
  latency_ms: number;
  base_latency_ms: number;
  error_rate: number;
  base_error_rate: number;
  rps: number;
  base_rps: number;
  risk_score: number;
  backup_service_id: string | null;
  pos_x: number;
  pos_y: number;
  description: string;
  sla_target: number;
  updated_at: string;
}

interface DependencyRow {
  id: string;
  source_id: string;
  target_id: string;
  dependency_type: DependencyEdge['dependencyType'];
  weight: number;
  protocol: string;
  description: string;
}

export function mapServiceRow(r: ServiceRow): ServiceNode {
  return {
    id: r.id,
    name: r.name,
    tier: r.tier,
    category: r.category,
    criticality: r.criticality,
    healthState: r.health_state,
    latencyMs: Number(r.latency_ms.toFixed(1)),
    baseLatencyMs: Number(r.base_latency_ms.toFixed(1)),
    errorRate: Number(r.error_rate.toFixed(2)),
    baseErrorRate: Number(r.base_error_rate.toFixed(2)),
    rps: r.rps,
    baseRps: r.base_rps,
    riskScore: Number(r.risk_score.toFixed(1)),
    backupServiceId: r.backup_service_id,
    posX: r.pos_x,
    posY: r.pos_y,
    description: r.description,
    slaTarget: r.sla_target,
    updatedAt: r.updated_at,
  };
}

export function mapDependencyRow(r: DependencyRow): DependencyEdge {
  return {
    id: r.id,
    sourceId: r.source_id,
    targetId: r.target_id,
    dependencyType: r.dependency_type,
    weight: r.weight,
    protocol: r.protocol,
    description: r.description,
  };
}

export function getAllServices(): ServiceNode[] {
  const rows = db.prepare('SELECT * FROM services ORDER BY pos_x ASC, pos_y ASC').all() as unknown as ServiceRow[];
  return rows.map(mapServiceRow);
}

export function getAllDependencies(): DependencyEdge[] {
  const rows = db.prepare('SELECT * FROM dependencies').all() as unknown as DependencyRow[];
  return rows.map(mapDependencyRow);
}

/**
 * Dependency model:
 * Each edge (sourceId -> targetId) means `sourceId` depends on `targetId` (or calls `targetId` in request flow).
 * When a node FAILS:
 * 1. Upstream callers (`caller` where `caller -> failedNode`) fail/degrade due to hard dependency breakdown (502/504 backpressure).
 * 2. Downstream execution legs (`target` where `failedNode -> target` and edge is a payment flow) suffer traffic starvation / settlement drop if `failedNode` is an orchestrator like `upi-gateway` or `api-gateway`.
 * 3. Infrastructure outage (`cloud-provider`) impacts every service with `INFRASTRUCTURE` edge pointing to it, then transitively cascades to their callers.
 */
export function calculateCascadeImpact(
  originServiceId: string,
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'CRITICAL'
): CascadeImpactResult {
  const services = getAllServices();
  const edges = getAllDependencies();
  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const origin = serviceMap.get(originServiceId);

  if (!origin) {
    throw new Error(`Service not found: ${originServiceId}`);
  }

  // Build reverse dependency map: targetId -> edges where sourceId depends on targetId
  const dependentsByTarget = new Map<string, DependencyEdge[]>();
  // Build forward dependency map: sourceId -> edges where sourceId calls targetId
  const dependenciesBySource = new Map<string, DependencyEdge[]>();

  for (const edge of edges) {
    const rev = dependentsByTarget.get(edge.targetId) ?? [];
    rev.push(edge);
    dependentsByTarget.set(edge.targetId, rev);

    const fwd = dependenciesBySource.get(edge.sourceId) ?? [];
    fwd.push(edge);
    dependenciesBySource.set(edge.sourceId, fwd);
  }

  const visited = new Map<string, { hop: number; path: string[]; relation: string; weight: number }>();
  visited.set(originServiceId, {
    hop: 0,
    path: [originServiceId],
    relation: 'Originating Failure',
    weight: 1,
  });

  const queue: Array<{ id: string; hop: number; path: string[]; weight: number }> = [
    { id: originServiceId, hop: 1, path: [originServiceId], weight: 1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    // 1. Traverse dependents (services that rely on `current.id`)
    const callerEdges = dependentsByTarget.get(current.id) ?? [];
    for (const edge of callerEdges) {
      if (edge.dependencyType === 'REPLICATION') continue;
      if (!visited.has(edge.sourceId)) {
        const nextWeight = current.weight * edge.weight;
        const nextPath = [...current.path, edge.sourceId];
        visited.set(edge.sourceId, {
          hop: current.hop,
          path: nextPath,
          relation: `Depends on ${serviceMap.get(current.id)?.name ?? current.id} (${edge.dependencyType})`,
          weight: nextWeight,
        });
        if (edge.dependencyType === 'HARD' || edge.dependencyType === 'INFRASTRUCTURE') {
          queue.push({ id: edge.sourceId, hop: current.hop + 1, path: nextPath, weight: nextWeight });
        }
      }
    }

    // 2. If origin is an ingress/gateway orchestrator at hop 1, downstream payment execution legs are also disrupted
    if (current.hop === 1 && ['load-balancer', 'api-gateway', 'upi-gateway', 'tx-processing'].includes(current.id)) {
      const targetEdges = dependenciesBySource.get(current.id) ?? [];
      for (const edge of targetEdges) {
        if (edge.dependencyType === 'INFRASTRUCTURE' || edge.dependencyType === 'REPLICATION') continue;
        if (!visited.has(edge.targetId)) {
          const nextPath = [...current.path, edge.targetId];
          visited.set(edge.targetId, {
            hop: current.hop,
            path: nextPath,
            relation: `Downstream flow from ${serviceMap.get(current.id)?.name ?? current.id} (${edge.protocol})`,
            weight: edge.weight * 0.75,
          });
        }
      }
    }
  }

  const directlyAffected: CascadeImpactResult['directlyAffected'] = [];
  const indirectlyAffected: CascadeImpactResult['indirectlyAffected'] = [];

  for (const [svcId, info] of visited.entries()) {
    if (svcId === originServiceId) continue;
    const svc = serviceMap.get(svcId);
    if (!svc) continue;

    let projectedState: ServiceHealthState = 'YELLOW';
    if (severity === 'CRITICAL' && info.weight >= 0.75 && info.hop === 1) {
      projectedState = 'RED';
    } else if (severity === 'CRITICAL' || (severity === 'HIGH' && info.weight >= 0.6)) {
      projectedState = 'YELLOW';
    }

    if (info.hop === 1) {
      directlyAffected.push({
        id: svc.id,
        name: svc.name,
        relation: info.relation,
        projectedState,
      });
    } else {
      indirectlyAffected.push({
        id: svc.id,
        name: svc.name,
        hopDistance: info.hop,
        path: info.path.map((id) => serviceMap.get(id)?.name ?? id),
        projectedState,
      });
    }
  }

  // Critical payment paths containing the originating service
  const standardPaymentPaths = [
    ['load-balancer', 'api-gateway', 'upi-gateway', 'auth-service', 'primary-db'],
    ['load-balancer', 'api-gateway', 'upi-gateway', 'tx-processing', 'bank-core'],
    ['load-balancer', 'api-gateway', 'upi-gateway', 'tx-processing', 'primary-db'],
    ['load-balancer', 'api-gateway', 'upi-gateway', 'ext-network'],
    ['upi-gateway', 'fraud-detection', 'primary-db'],
  ];

  const criticalPaymentPaths = standardPaymentPaths
    .filter((p) => p.includes(originServiceId))
    .map((p) => p.map((id) => serviceMap.get(id)?.name ?? id));

  const severityMultiplier = severity === 'CRITICAL' ? 1.0 : severity === 'HIGH' ? 0.65 : severity === 'MEDIUM' ? 0.35 : 0.15;
  const affectedCount = directlyAffected.length + indirectlyAffected.length;
  const blastRadiusPct = Math.min(100, Math.round(((affectedCount + 1) / services.length) * 100));

  // Derive estimated transactions at risk directly from originating service RPS * 15-minute window * severity multiplier
  const estimatedTxAtRisk = Math.round(origin.baseRps * 60 * 12 * severityMultiplier * (1 + directlyAffected.length * 0.12));

  const dependenciesRequiringAttention = edges
    .filter((e) => e.targetId === originServiceId || (e.sourceId === originServiceId && e.dependencyType !== 'INFRASTRUCTURE'))
    .map((e) => ({
      source: serviceMap.get(e.sourceId)?.name ?? e.sourceId,
      target: serviceMap.get(e.targetId)?.name ?? e.targetId,
      dependencyType: e.dependencyType,
      reason: e.description,
    }));

  const estimatedOperationalDisruption =
    affectedCount >= 5
      ? 'Severe multi-tier payment orchestration & ledger disruption'
      : affectedCount >= 2
      ? 'Moderate payment path degradation with failover exposure'
      : 'Localized service degradation with contained blast radius';

  return {
    originServiceId,
    originServiceName: origin.name,
    directlyAffected,
    indirectlyAffected,
    criticalPaymentPaths,
    estimatedTxAtRisk,
    estimatedOperationalDisruption,
    dependenciesRequiringAttention,
    blastRadiusPct,
  };
}

export function getServiceConnections(serviceId: string) {
  const services = getAllServices();
  const edges = getAllDependencies();
  const serviceMap = new Map(services.map((s) => [s.id, s]));

  const upstreamDependencies = edges
    .filter((e) => e.sourceId === serviceId)
    .map((e) => ({
      edge: e,
      service: serviceMap.get(e.targetId)!,
    }))
    .filter((x) => Boolean(x.service));

  const downstreamDependents = edges
    .filter((e) => e.targetId === serviceId)
    .map((e) => ({
      edge: e,
      service: serviceMap.get(e.sourceId)!,
    }))
    .filter((x) => Boolean(x.service));

  return { upstreamDependencies, downstreamDependents };
}
