export type ServiceHealthState = 'GREEN' | 'YELLOW' | 'RED' | 'BLUE' | 'GREY';

export type ServiceCriticality = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type IncidentStatus = 'ACTIVE' | 'RECOVERING' | 'RESOLVED';

export type IncidentOrigin = 'seeded_synthetic' | 'live_simulation';

export type FailureType =
  | 'API Timeout'
  | 'Database Overload'
  | 'Cloud Provider Outage'
  | 'Network Latency Spike'
  | 'Authentication Failure'
  | 'Payment Gateway Degradation'
  | 'Traffic Overload'
  | 'Notification Service Outage';

export interface ServiceNode {
  id: string;
  name: string;
  tier: string;
  category: string;
  criticality: ServiceCriticality;
  healthState: ServiceHealthState;
  latencyMs: number;
  baseLatencyMs: number;
  errorRate: number;
  baseErrorRate: number;
  rps: number;
  baseRps: number;
  riskScore: number;
  backupServiceId: string | null;
  posX: number;
  posY: number;
  description: string;
  slaTarget: number;
  updatedAt: string;
}

export interface DependencyEdge {
  id: string;
  sourceId: string;
  targetId: string;
  dependencyType: 'HARD' | 'SOFT' | 'REPLICATION' | 'INFRASTRUCTURE';
  weight: number;
  protocol: string;
  description: string;
}

export interface IncidentEventRecord {
  id: string;
  incidentId: string;
  stage:
    | 'FAILURE_INJECTED'
    | 'FAILURE_DETECTED'
    | 'ANALYSIS_COMPLETED'
    | 'RECOMMENDATION_GENERATED'
    | 'APPROVAL_RECEIVED'
    | 'RECOVERY_STARTED'
    | 'RECOVERY_COMPLETED'
    | 'VERIFICATION_PASSED';
  actor: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface IncidentRecord {
  id: string;
  title: string;
  serviceId: string;
  serviceName?: string;
  failureType: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  origin: IncidentOrigin;
  startedAt: string;
  detectedAt: string;
  resolvedAt: string | null;
  durationMinutes: number;
  mttdSeconds: number;
  mttrSeconds: number;
  latencyImpactMs: number;
  errorRateImpact: number;
  txAtRisk: number;
  financialImpactInr: number;
  rootCause: string;
  affectedServices: string[];
  summary: string;
  assignedOperator: string;
  resolutionNotes: string;
  isSynthetic: boolean;
  events?: IncidentEventRecord[];
  relatedRecommendations?: RecoveryRecommendation[];
}

export interface RecoveryRecommendation {
  id: string;
  incidentId: string;
  serviceId: string;
  serviceName?: string;
  actionType: string;
  title: string;
  reason: string;
  expectedBenefit: string;
  estimatedRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  sideEffects: string;
  requiredApproval: string;
  verificationCondition: string;
  evidenceUsed?: string[];
  historicalIncidentRefs?: string[];
  dependencyGraphEvidence?: string;
  isSimulatedData?: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
  approvedBy: string | null;
  executedAt: string | null;
  createdAt: string;
}

export interface RecoveryActionRecord {
  id: string;
  recommendationId: string;
  incidentId: string;
  actionTitle: string;
  operatorName: string;
  status: string;
  verificationResult: string;
  preHealth: Record<string, string>;
  postHealth: Record<string, string>;
  executedAt: string;
}

export interface TransactionRecord {
  id: string;
  idempotencyKey: string;
  payerVpa: string;
  payeeVpa: string;
  amountInr: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNKNOWN_RESPONSE_LOST' | 'DUPLICATE_BLOCKED';
  gatewayServiceId: string;
  incidentId: string | null;
  responseLost: boolean;
  verificationStatus: 'VERIFIED_LEDGER' | 'AWAITING_STATUS_CHECK' | 'DUPLICATE_PREVENTED' | 'FAILED_SAFE';
  retryCount: number;
  auditTrail: Array<{ timestamp: string; event: string; detail: string }>;
  createdAt: string;
}

export interface HistoricalMetricRow {
  id: number;
  year: number;
  month: number;
  serviceId: string;
  availabilityPct: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRatePct: number;
  txVolume: number;
  incidentCount: number;
  isSynthetic: boolean;
}

export interface ExplainablePrediction {
  id: string;
  serviceId: string;
  serviceName: string;
  riskScore: number;
  riskLevel: 'ELEVATED' | 'HIGH' | 'CRITICAL' | 'MODERATE' | 'LOW';
  confidencePct: number;
  horizonDays: 7 | 30;
  headline: string;
  whatCouldFail: string;
  whenCouldItHappen: string;
  historicalEvidence: string[];
  affectedServices: string[];
  estimatedImpact: string;
  preventiveActions: string[];
  contributingFactors: Array<{
    factor: string;
    weightPct: number;
    metricValue: string;
  }>;
}

export interface CaseStudyRecord {
  id: string;
  code: string;
  title: string;
  label: string;
  rootCause: string;
  detectionMethod: string;
  servicesAffected: string[];
  recommendedAction: string;
  simulatedOutcome: string;
  estimatedDowntimeAvoidedMin: number;
  estimatedTxProtected: number;
  timeline: Array<{ offset: string; event: string }>;
}

export interface AuditLogRecord {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export interface CascadeImpactResult {
  originServiceId: string;
  originServiceName: string;
  directlyAffected: Array<{ id: string; name: string; relation: string; projectedState: ServiceHealthState }>;
  indirectlyAffected: Array<{ id: string; name: string; hopDistance: number; path: string[]; projectedState: ServiceHealthState }>;
  criticalPaymentPaths: string[][];
  estimatedTxAtRisk: number;
  estimatedOperationalDisruption: string;
  dependenciesRequiringAttention: Array<{ source: string; target: string; dependencyType: string; reason: string }>;
  blastRadiusPct: number;
}

export interface SpofAnalysisItem {
  serviceId: string;
  serviceName: string;
  tier: string;
  criticality: ServiceCriticality;
  riskScore: number;
  downstreamDependents: string[];
  affectedServicesCount: number;
  criticalPathsCount: number;
  criticalPaths: string[][];
  alternativeRoutes: string;
  backupReadiness: 'AUTOMATED_STANDBY' | 'PARTIAL_ROUTE' | 'NO_BACKUP_CONFIGURED';
  backupServiceName: string | null;
  spofSeverityScore: number;
  riskExplanation: string;
  recommendedPreventiveAction: string;
}

export interface WhatIfScenarioResult {
  scenarioLabel: string;
  isSimulatedEstimate: true;
  targetServiceId: string;
  targetServiceName: string;
  baselineServices: ServiceNode[];
  simulatedServices: ServiceNode[];
  affectedServices: Array<{ id: string; name: string; hopDistance: number; projectedState: ServiceHealthState; projectedLatencyMs: number; projectedErrorRate: number }>;
  criticalPaymentPathsImpacted: string[][];
  potentialCascadeDepth: number;
  estimatedTransactionsExposed: number;
  backupAvailability: string;
  recommendedRecoveryPath: string;
  estimatedRecoveryDurationMin: number;
  availabilityDeltaPct: number;
}

export interface ServiceReadinessItem {
  serviceId: string;
  serviceName: string;
  criticality: ServiceCriticality;
  overallScore: number;
  breakdown: {
    backupAvailability: { score: number; max: 20; evidence: string };
    dependencyRedundancy: { score: number; max: 15; evidence: string };
    recoveryProcedure: { score: number; max: 20; evidence: string };
    failoverConfiguration: { score: number; max: 15; evidence: string };
    recentRecoveryTest: { score: number; max: 15; evidence: string };
    monitoringCoverage: { score: number; max: 15; evidence: string };
  };
  missingCapabilities: string[];
  priorityImprovement: string;
}

export interface SloServiceStatus {
  serviceId: string;
  serviceName: string;
  criticality: ServiceCriticality;
  availabilityTargetPct: number;
  actualAvailabilityPct: number;
  errorRatePct: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorBudgetTotalMinutes: number;
  errorBudgetConsumedMinutes: number;
  errorBudgetRemainingMinutes: number;
  errorBudgetRemainingPct: number;
  sloBreached: boolean;
  burnRateStatus: 'NOMINAL' | 'WARNING' | 'BREACHED';
  calculationExplanation: string;
}
