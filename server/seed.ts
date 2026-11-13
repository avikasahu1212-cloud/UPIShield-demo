import { db } from './db.ts';

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function seedDatabaseIfEmpty(): void {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM services').get() as { cnt: number };
  if (countRow.cnt > 0) {
    return;
  }
  resetAndReseedAll();
}

export function resetAndReseedAll(): void {
  db.exec('DELETE FROM incident_events;');
  db.exec('DELETE FROM recovery_actions;');
  db.exec('DELETE FROM recovery_recommendations;');
  db.exec('DELETE FROM incidents;');
  db.exec('DELETE FROM transactions;');
  db.exec('DELETE FROM historical_metrics;');
  db.exec('DELETE FROM dependencies;');
  db.exec('DELETE FROM services;');
  db.exec('DELETE FROM case_studies;');
  db.exec('DELETE FROM audit_logs;');

  const now = '2026-10-18T09:30:00.000Z';

  const servicesSeed = [
    {
      id: 'cloud-provider',
      name: 'Cloud Provider',
      tier: 'Tier 0 · Infrastructure',
      category: 'Cloud Substrate',
      criticality: 'CRITICAL',
      health_state: 'GREEN',
      latency_ms: 4.2,
      base_latency_ms: 4.2,
      error_rate: 0.01,
      base_error_rate: 0.01,
      rps: 24500,
      base_rps: 24500,
      risk_score: 48.0,
      backup_service_id: 'backup-db',
      pos_x: 550,
      pos_y: 68,
      description: 'Multi-zone compute, VPC networking, and managed Kubernetes control plane hosting core payment clusters.',
      sla_target: 99.99,
    },
    {
      id: 'load-balancer',
      name: 'Load Balancer',
      tier: 'Tier 1 · Edge Ingress',
      category: 'Traffic Routing',
      criticality: 'CRITICAL',
      health_state: 'GREEN',
      latency_ms: 6.8,
      base_latency_ms: 6.8,
      error_rate: 0.02,
      base_error_rate: 0.02,
      rps: 18400,
      base_rps: 18400,
      risk_score: 26.5,
      backup_service_id: null,
      pos_x: 110,
      pos_y: 195,
      description: 'L7 TLS-terminating ingress balancer distributing incoming UPI switch & merchant API payloads.',
      sla_target: 99.99,
    },
    {
      id: 'ext-network',
      name: 'External Payment Network',
      tier: 'Tier 4 · Clearing Rail',
      category: 'NPCI / Clearing',
      criticality: 'CRITICAL',
      health_state: 'GREEN',
      latency_ms: 68.5,
      base_latency_ms: 68.5,
      error_rate: 0.09,
      base_error_rate: 0.09,
      rps: 9800,
      base_rps: 9800,
      risk_score: 38.2,
      backup_service_id: null,
      pos_x: 110,
      pos_y: 410,
      description: 'National clearing switch & interbank settlement network interface for real-time UPI rails.',
      sla_target: 99.95,
    },
    {
      id: 'api-gateway',
      name: 'API Gateway',
      tier: 'Tier 2 · Ingress Proxy',
      category: 'API Management',
      criticality: 'CRITICAL',
      health_state: 'GREEN',
      latency_ms: 14.5,
      base_latency_ms: 14.5,
      error_rate: 0.05,
      base_error_rate: 0.05,
      rps: 16900,
      base_rps: 16900,
      risk_score: 41.0,
      backup_service_id: null,
      pos_x: 325,
      pos_y: 195,
      description: 'Rate limiting, mTLS validation, schema enforcement, and request routing for PSP & mobile endpoints.',
      sla_target: 99.99,
    },
    {
      id: 'auth-service',
      name: 'Authentication Service',
      tier: 'Tier 2 · Identity & HSM',
      category: 'Security',
      criticality: 'CRITICAL',
      health_state: 'GREEN',
      latency_ms: 21.4,
      base_latency_ms: 21.4,
      error_rate: 0.07,
      base_error_rate: 0.07,
      rps: 11200,
      base_rps: 11200,
      risk_score: 62.5,
      backup_service_id: null,
      pos_x: 325,
      pos_y: 410,
      description: 'UPI PIN cryptographic verification, OAuth token minting, device binding, and HSM key exchange.',
      sla_target: 99.98,
    },
    {
      id: 'upi-gateway',
      name: 'UPI Payment Gateway',
      tier: 'Tier 3 · Payment Orchestrator',
      category: 'Payment Core',
      criticality: 'CRITICAL',
      health_state: 'GREEN',
      latency_ms: 46.2,
      base_latency_ms: 46.2,
      error_rate: 0.11,
      base_error_rate: 0.11,
      rps: 12450,
      base_rps: 12450,
      risk_score: 79.4,
      backup_service_id: 'ext-network',
      pos_x: 550,
      pos_y: 255,
      description: 'Primary ISO-8583 / XML UPI transaction orchestrator managing collect, pay, mandate, and status flows.',
      sla_target: 99.99,
    },
    {
      id: 'fraud-detection',
      name: 'Fraud Detection Service',
      tier: 'Tier 3 · Risk Scoring',
      category: 'Risk Engine',
      criticality: 'HIGH',
      health_state: 'GREEN',
      latency_ms: 28.0,
      base_latency_ms: 28.0,
      error_rate: 0.04,
      base_error_rate: 0.04,
      rps: 12100,
      base_rps: 12100,
      risk_score: 34.0,
      backup_service_id: null,
      pos_x: 550,
      pos_y: 430,
      description: 'Real-time velocity screening, device anomaly checks, and mule-account scoring engine.',
      sla_target: 99.95,
    },
    {
      id: 'tx-processing',
      name: 'Transaction Processing Service',
      tier: 'Tier 4 · Clearing Engine',
      category: 'Payment Core',
      criticality: 'CRITICAL',
      health_state: 'GREEN',
      latency_ms: 34.8,
      base_latency_ms: 34.8,
      error_rate: 0.06,
      base_error_rate: 0.06,
      rps: 11800,
      base_rps: 11800,
      risk_score: 58.6,
      backup_service_id: null,
      pos_x: 770,
      pos_y: 255,
      description: 'Idempotent debit/credit orchestration, two-phase ledger reservations, and reconciliation state machine.',
      sla_target: 99.99,
    },
    {
      id: 'notification-svc',
      name: 'Notification Service',
      tier: 'Tier 4 · Async Dispatch',
      category: 'Messaging',
      criticality: 'MEDIUM',
      health_state: 'GREEN',
      latency_ms: 19.2,
      base_latency_ms: 19.2,
      error_rate: 0.08,
      base_error_rate: 0.08,
      rps: 8900,
      base_rps: 8900,
      risk_score: 19.8,
      backup_service_id: null,
      pos_x: 770,
      pos_y: 430,
      description: 'Webhook callbacks, SMS/push alerts, and merchant settlement confirmation dispatcher.',
      sla_target: 99.9,
    },
    {
      id: 'bank-core',
      name: 'Bank Core System',
      tier: 'Tier 5 · CBS Ledger',
      category: 'Core Banking',
      criticality: 'CRITICAL',
      health_state: 'GREEN',
      latency_ms: 42.1,
      base_latency_ms: 42.1,
      error_rate: 0.03,
      base_error_rate: 0.03,
      rps: 8200,
      base_rps: 8200,
      risk_score: 46.2,
      backup_service_id: 'backup-db',
      pos_x: 970,
      pos_y: 130,
      description: 'Authoritative customer account ledger, balance locking, and general ledger posting engine.',
      sla_target: 99.99,
    },
    {
      id: 'primary-db',
      name: 'Primary Database',
      tier: 'Tier 5 · Data Tier',
      category: 'Database Cluster',
      criticality: 'CRITICAL',
      health_state: 'GREEN',
      latency_ms: 11.6,
      base_latency_ms: 11.6,
      error_rate: 0.04,
      base_error_rate: 0.04,
      rps: 21300,
      base_rps: 21300,
      risk_score: 69.5,
      backup_service_id: 'backup-db',
      pos_x: 970,
      pos_y: 280,
      description: 'Primary transactional PostgreSQL/distributed cluster storing idempotency keys, sessions, and TX journals.',
      sla_target: 99.99,
    },
    {
      id: 'backup-db',
      name: 'Backup Database',
      tier: 'Tier 5 · Standby Replica',
      category: 'Database Cluster',
      criticality: 'HIGH',
      health_state: 'GREEN',
      latency_ms: 15.0,
      base_latency_ms: 15.0,
      error_rate: 0.02,
      base_error_rate: 0.02,
      rps: 4200,
      base_rps: 4200,
      risk_score: 21.0,
      backup_service_id: null,
      pos_x: 970,
      pos_y: 430,
      description: 'Cross-AZ synchronous standby replica ready for automated promotion and read-replica offload.',
      sla_target: 99.98,
    },
  ];

  const insertSvc = db.prepare(`
    INSERT INTO services (
      id, name, tier, category, criticality, health_state,
      latency_ms, base_latency_ms, error_rate, base_error_rate,
      rps, base_rps, risk_score, backup_service_id, pos_x, pos_y,
      description, sla_target, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of servicesSeed) {
    insertSvc.run(
      s.id, s.name, s.tier, s.category, s.criticality, s.health_state,
      s.latency_ms, s.base_latency_ms, s.error_rate, s.base_error_rate,
      s.rps, s.base_rps, s.risk_score, s.backup_service_id, s.pos_x, s.pos_y,
      s.description, s.sla_target, now
    );
  }

  const dependenciesSeed = [
    ['dep-01', 'load-balancer', 'cloud-provider', 'INFRASTRUCTURE', 0.95, 'VPC/ALB', 'Load Balancer runs on Cloud Provider edge zones'],
    ['dep-02', 'load-balancer', 'api-gateway', 'HARD', 0.95, 'HTTPS/mTLS', 'Load Balancer routes ingress traffic into API Gateway'],
    ['dep-03', 'api-gateway', 'cloud-provider', 'INFRASTRUCTURE', 0.9, 'EKS/K8s', 'API Gateway pods hosted on Cloud Provider'],
    ['dep-04', 'api-gateway', 'upi-gateway', 'HARD', 0.95, 'gRPC/mTLS', 'API Gateway routes UPI payloads to UPI Payment Gateway'],
    ['dep-05', 'upi-gateway', 'auth-service', 'HARD', 0.95, 'gRPC/HSM', 'Every UPI debit requires PIN & token verification from Auth Service'],
    ['dep-06', 'upi-gateway', 'fraud-detection', 'SOFT', 0.65, 'gRPC', 'UPI Gateway scores risk via Fraud Detection (fail-open threshold supported)'],
    ['dep-07', 'upi-gateway', 'tx-processing', 'HARD', 0.98, 'gRPC/XA', 'UPI Gateway commits financial legs to Transaction Processing Service'],
    ['dep-08', 'upi-gateway', 'ext-network', 'HARD', 0.92, 'ISO-8583/TLS', 'UPI Gateway exchanges clearing frames with External Payment Network'],
    ['dep-09', 'auth-service', 'primary-db', 'HARD', 0.9, 'TCP/5432', 'Authentication Service validates device bindings & tokens in Primary DB'],
    ['dep-10', 'auth-service', 'cloud-provider', 'INFRASTRUCTURE', 0.85, 'KMS/HSM', 'Auth Service relies on Cloud Provider KMS & enclave compute'],
    ['dep-11', 'fraud-detection', 'primary-db', 'HARD', 0.85, 'TCP/5432', 'Fraud Detection queries velocity windows from Primary DB'],
    ['dep-12', 'tx-processing', 'primary-db', 'HARD', 0.98, 'TCP/5432', 'Transaction Processing writes idempotency & journal state to Primary DB'],
    ['dep-13', 'tx-processing', 'bank-core', 'HARD', 0.98, 'MQ/ISO', 'Transaction Processing posts account debits/credits to Bank Core System'],
    ['dep-14', 'tx-processing', 'notification-svc', 'SOFT', 0.45, 'Kafka', 'Transaction Processing emits settlement events to Notification Service'],
    ['dep-15', 'primary-db', 'cloud-provider', 'INFRASTRUCTURE', 0.95, 'EBS/NVMe', 'Primary Database storage & compute hosted on Cloud Provider'],
    ['dep-16', 'primary-db', 'backup-db', 'REPLICATION', 0.8, 'WAL-Sync', 'Primary Database streams synchronous WAL to Backup Database'],
    ['dep-17', 'bank-core', 'primary-db', 'HARD', 0.88, 'JDBC/XA', 'Bank Core System syncs UPI settlement journals with Primary Database'],
    ['dep-18', 'notification-svc', 'api-gateway', 'SOFT', 0.4, 'HTTPS', 'Notification Service delivers merchant webhooks via API Gateway egress'],
    ['dep-19', 'ext-network', 'upi-gateway', 'HARD', 0.85, 'Dedicated-MPLS', 'External Payment Network sends clearing callbacks to UPI Payment Gateway'],
  ];

  const insertDep = db.prepare(`
    INSERT INTO dependencies (id, source_id, target_id, dependency_type, weight, protocol, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const d of dependenciesSeed) {
    insertDep.run(...d);
  }

  // Deterministic 2022–2026 monthly synthetic historical dataset
  // Note: October (month === 10) naturally displays elevated festive transaction volume,
  // increasing latency year-over-year, and recurring anomalies on key payment services.
  const rand = seededRand(20261018);
  const insertMetric = db.prepare(`
    INSERT INTO historical_metrics (
      year, month, service_id, availability_pct, avg_latency_ms,
      p95_latency_ms, error_rate_pct, tx_volume, incident_count, is_synthetic
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  for (let year = 2022; year <= 2026; year++) {
    const maxMonth = year === 2026 ? 10 : 12;
    const yearGrowth = 1 + (year - 2022) * 0.16;
    for (let month = 1; month <= maxMonth; month++) {
      const isOctober = month === 10;
      const isNovPeak = month === 11;
      const seasonalLoad = isOctober ? 1.58 : isNovPeak ? 1.24 : month === 3 ? 1.15 : 1.0 + Math.sin((month / 12) * Math.PI) * 0.08;

      for (const s of servicesSeed) {
        const noise = (rand() - 0.5) * 0.14;
        const drift = (year - 2022) * 0.07;

        let octoberStress = 1.0;
        let incidentCount = rand() < 0.07 ? 1 : 0;

        if (isOctober) {
          if (s.id === 'upi-gateway') {
            octoberStress = 1.65 + (year - 2022) * 0.14;
            incidentCount = year >= 2022 ? (year === 2025 || year === 2022 ? 3 : 2) : 1;
          } else if (s.id === 'primary-db') {
            octoberStress = 1.52 + (year - 2022) * 0.12;
            incidentCount = year >= 2023 ? 2 : 1;
          } else if (s.id === 'auth-service') {
            octoberStress = 1.44 + (year - 2022) * 0.09;
            incidentCount = year === 2023 || year === 2025 ? 2 : 1;
          } else if (s.id === 'cloud-provider') {
            octoberStress = year === 2024 || year === 2026 ? 1.48 : 1.25;
            incidentCount = year === 2024 ? 2 : year === 2026 ? 1 : 0;
          } else if (s.id === 'tx-processing') {
            octoberStress = 1.38 + (year - 2022) * 0.08;
            incidentCount = year === 2025 || year === 2026 ? 2 : 1;
          } else {
            octoberStress = 1.22;
          }
        }

        const avgLatency = Number((s.base_latency_ms * (1 + drift + noise) * octoberStress).toFixed(1));
        const p95Latency = Number((avgLatency * (isOctober ? 2.35 : 1.75) + rand() * 8).toFixed(1));
        const errRate = Number(
          Math.max(
            0.01,
            s.base_error_rate * (isOctober ? octoberStress * 2.1 : 1 + noise) + incidentCount * 0.18
          ).toFixed(2)
        );
        const avail = Number(
          Math.max(
            97.2,
            Math.min(99.999, 99.98 - incidentCount * (isOctober ? 0.28 : 0.11) - errRate * 0.12)
          ).toFixed(3)
        );
        const txVol = Math.round(s.base_rps * 3600 * 24 * 30 * 0.12 * yearGrowth * seasonalLoad * (1 + noise * 0.4));

        insertMetric.run(year, month, s.id, avail, avgLatency, p95Latency, errRate, txVol, incidentCount);
      }
    }
  }

  // Seed historical synthetic incidents (2022–2026) including recurring October pattern
  const historicalIncidents = [
    {
      id: 'INC-2022-OCT-01',
      title: 'Festive Surge UPI Gateway Thread Pool Exhaustion',
      service_id: 'upi-gateway',
      failure_type: 'Payment Gateway Degradation',
      severity: 'CRITICAL',
      status: 'RESOLVED',
      origin: 'seeded_synthetic',
      started_at: '2022-10-21T18:10:00Z',
      detected_at: '2022-10-21T18:14:20Z',
      resolved_at: '2022-10-21T18:52:00Z',
      duration_minutes: 42,
      mttd_seconds: 260,
      mttr_seconds: 2260,
      latency_impact_ms: 485,
      error_rate_impact: 6.8,
      tx_at_risk: 412000,
      financial_impact_inr: 18400000,
      root_cause: 'Peak October festive volume (1.62x baseline) saturated synchronous worker pools waiting on NPCI callbacks.',
      affected_services_json: JSON.stringify(['upi-gateway', 'api-gateway', 'tx-processing', 'ext-network']),
      summary: 'SYNTHETIC DEMONSTRATION DATA — October 2022 gateway latency spike during festive settlement rush.',
      assigned_operator: 'Rohan Deshmukh (Principal SRE)',
      resolution_notes: 'Shifted 35% clearing volume to secondary gateway route and expanded synchronous worker pool bounds.',
    },
    {
      id: 'INC-2023-APR-02',
      title: 'Notification Webhook Egress Queue Backlog',
      service_id: 'notification-svc',
      failure_type: 'Notification Service Outage',
      severity: 'MEDIUM',
      status: 'RESOLVED',
      origin: 'seeded_synthetic',
      started_at: '2023-04-12T11:20:00Z',
      detected_at: '2023-04-12T11:23:10Z',
      resolved_at: '2023-04-12T11:41:00Z',
      duration_minutes: 21,
      mttd_seconds: 190,
      mttr_seconds: 1070,
      latency_impact_ms: 190,
      error_rate_impact: 2.1,
      tx_at_risk: 38000,
      financial_impact_inr: 450000,
      root_cause: 'Merchant endpoint TLS handshake stalls exhausted async dispatch consumers.',
      affected_services_json: JSON.stringify(['notification-svc']),
      summary: 'SYNTHETIC DEMONSTRATION DATA — Isolated async callback delay with zero ledger impact.',
      assigned_operator: 'Ananya Krishnan (Messaging SRE)',
      resolution_notes: 'Isolated slow merchant webhook domain into dead-letter circuit breaker and flushed Kafka consumer lag.',
    },
    {
      id: 'INC-2023-OCT-03',
      title: 'Authentication Service HSM Session Contention',
      service_id: 'auth-service',
      failure_type: 'Authentication Failure',
      severity: 'CRITICAL',
      status: 'RESOLVED',
      origin: 'seeded_synthetic',
      started_at: '2023-10-24T19:05:00Z',
      detected_at: '2023-10-24T19:07:30Z',
      resolved_at: '2023-10-24T19:39:00Z',
      duration_minutes: 34,
      mttd_seconds: 150,
      mttr_seconds: 1890,
      latency_impact_ms: 390,
      error_rate_impact: 5.4,
      tx_at_risk: 528000,
      financial_impact_inr: 24200000,
      root_cause: 'October transaction spike overwhelmed PIN verification cache TTL, causing DB lookup storm.',
      affected_services_json: JSON.stringify(['auth-service', 'upi-gateway', 'api-gateway']),
      summary: 'SYNTHETIC DEMONSTRATION DATA — October 2023 authentication latency cascade impacting UPI Gateway.',
      assigned_operator: 'Priya Sharma (VP Infrastructure)',
      resolution_notes: 'Extended device token cache TTL, recycled stalled HSM sessions, and bounded gateway retry budget.',
    },
    {
      id: 'INC-2024-FEB-04',
      title: 'API Gateway Connection Keep-Alive Exhaustion',
      service_id: 'api-gateway',
      failure_type: 'API Timeout',
      severity: 'HIGH',
      status: 'RESOLVED',
      origin: 'seeded_synthetic',
      started_at: '2024-02-08T14:15:00Z',
      detected_at: '2024-02-08T14:17:00Z',
      resolved_at: '2024-02-08T14:36:00Z',
      duration_minutes: 21,
      mttd_seconds: 120,
      mttr_seconds: 1140,
      latency_impact_ms: 260,
      error_rate_impact: 3.2,
      tx_at_risk: 194000,
      financial_impact_inr: 7600000,
      root_cause: 'Unbounded idle upstream keep-alive sockets after rolling certificate rotation.',
      affected_services_json: JSON.stringify(['api-gateway', 'load-balancer', 'upi-gateway']),
      summary: 'SYNTHETIC DEMONSTRATION DATA — Ingress timeout spike resolved via socket pool drain.',
      assigned_operator: 'Vikram Nair (Edge Platform Lead)',
      resolution_notes: 'Drained stale TLS keep-alive descriptors and enforced 45s upstream idle timeout policy.',
    },
    {
      id: 'INC-2024-OCT-05',
      title: 'Cloud Provider Availability Zone Packet Loss',
      service_id: 'cloud-provider',
      failure_type: 'Cloud Provider Outage',
      severity: 'CRITICAL',
      status: 'RESOLVED',
      origin: 'seeded_synthetic',
      started_at: '2024-10-19T20:00:00Z',
      detected_at: '2024-10-19T20:01:45Z',
      resolved_at: '2024-10-19T20:29:00Z',
      duration_minutes: 29,
      mttd_seconds: 105,
      mttr_seconds: 1635,
      latency_impact_ms: 520,
      error_rate_impact: 7.9,
      tx_at_risk: 740000,
      financial_impact_inr: 31500000,
      root_cause: 'Regional cloud AZ spine congestion during peak October evening settlement window.',
      affected_services_json: JSON.stringify(['cloud-provider', 'load-balancer', 'api-gateway', 'auth-service', 'primary-db', 'upi-gateway']),
      summary: 'SYNTHETIC DEMONSTRATION DATA — October 2024 shared cloud substrate disruption.',
      assigned_operator: 'Priya Sharma (VP Infrastructure)',
      resolution_notes: 'Evacuated ingress targets from degraded availability zone and promoted standby cross-AZ database.',
    },
    {
      id: 'INC-2025-JUN-06',
      title: 'External Payment Network Settlement Frame Latency',
      service_id: 'ext-network',
      failure_type: 'Network Latency Spike',
      severity: 'HIGH',
      status: 'RESOLVED',
      origin: 'seeded_synthetic',
      started_at: '2025-06-15T16:40:00Z',
      detected_at: '2025-06-15T16:41:30Z',
      resolved_at: '2025-06-15T16:59:00Z',
      duration_minutes: 19,
      mttd_seconds: 90,
      mttr_seconds: 1050,
      latency_impact_ms: 340,
      error_rate_impact: 2.9,
      tx_at_risk: 215000,
      financial_impact_inr: 9200000,
      root_cause: 'BGP flap on primary clearing carrier link elevated RTT from 68ms to 410ms.',
      affected_services_json: JSON.stringify(['ext-network', 'upi-gateway']),
      summary: 'SYNTHETIC DEMONSTRATION DATA — Clearing rail latency resolved by secondary MPLS failover.',
      assigned_operator: 'Rohan Deshmukh (Principal SRE)',
      resolution_notes: 'Switched clearing rail egress to redundant MPLS carrier circuit; RTT stabilized at 69ms.',
    },
    {
      id: 'INC-2025-OCT-07',
      title: 'Primary Database Connection Saturation During Festive Peak',
      service_id: 'primary-db',
      failure_type: 'Database Overload',
      severity: 'CRITICAL',
      status: 'RESOLVED',
      origin: 'seeded_synthetic',
      started_at: '2025-10-22T18:30:00Z',
      detected_at: '2025-10-22T18:31:10Z',
      resolved_at: '2025-10-22T18:54:00Z',
      duration_minutes: 24,
      mttd_seconds: 70,
      mttr_seconds: 1370,
      latency_impact_ms: 610,
      error_rate_impact: 8.4,
      tx_at_risk: 865000,
      financial_impact_inr: 41000000,
      root_cause: 'Idempotency table lock contention under 1.72x October transaction surge.',
      affected_services_json: JSON.stringify(['primary-db', 'tx-processing', 'auth-service', 'fraud-detection', 'bank-core', 'upi-gateway']),
      summary: 'SYNTHETIC DEMONSTRATION DATA — October 2025 database saturation across Core & Payment layers.',
      assigned_operator: 'Priya Sharma (VP Infrastructure)',
      resolution_notes: 'Offloaded Fraud Detection velocity reads to Backup Database replica and tuned PgBouncer pool limits.',
    },
    {
      id: 'INC-2026-OCT-08',
      title: 'October 2026 Pre-Peak Gateway Latency & DB Lock Early Warning',
      service_id: 'upi-gateway',
      failure_type: 'Traffic Overload',
      severity: 'HIGH',
      status: 'RESOLVED',
      origin: 'seeded_synthetic',
      started_at: '2026-10-10T17:45:00Z',
      detected_at: '2026-10-10T17:45:42Z',
      resolved_at: '2026-10-10T17:58:00Z',
      duration_minutes: 13,
      mttd_seconds: 42,
      mttr_seconds: 738,
      latency_impact_ms: 215,
      error_rate_impact: 1.9,
      tx_at_risk: 162000,
      financial_impact_inr: 6400000,
      root_cause: 'Early October traffic ramp triggered p95 queue depth elevation on UPI Gateway & Primary DB.',
      affected_services_json: JSON.stringify(['upi-gateway', 'primary-db', 'tx-processing']),
      summary: 'SYNTHETIC DEMONSTRATION DATA — October 2026 recurring seasonal stress signal.',
      assigned_operator: 'Rohan Deshmukh (Principal SRE)',
      resolution_notes: 'Pre-warmed backup gateway workers and increased synthetic canary probe cadence.',
    },
  ];

  const insertIncident = db.prepare(`
    INSERT INTO incidents (
      id, title, service_id, failure_type, severity, status, origin,
      started_at, detected_at, resolved_at, duration_minutes,
      mttd_seconds, mttr_seconds, latency_impact_ms, error_rate_impact,
      tx_at_risk, financial_impact_inr, root_cause, affected_services_json,
      summary, assigned_operator, resolution_notes, is_synthetic
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO incident_events (id, incident_id, stage, actor, message, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const inc of historicalIncidents) {
    insertIncident.run(
      inc.id, inc.title, inc.service_id, inc.failure_type, inc.severity, inc.status, inc.origin,
      inc.started_at, inc.detected_at, inc.resolved_at, inc.duration_minutes,
      inc.mttd_seconds, inc.mttr_seconds, inc.latency_impact_ms, inc.error_rate_impact,
      inc.tx_at_risk, inc.financial_impact_inr, inc.root_cause, inc.affected_services_json,
      inc.summary, inc.assigned_operator, inc.resolution_notes
    );

    insertEvent.run(`${inc.id}-EV1`, inc.id, 'FAILURE_INJECTED', 'Synthetic Historical Replay', `Anomaly began on ${inc.service_id}: ${inc.failure_type}`, '{}', inc.started_at);
    insertEvent.run(`${inc.id}-EV2`, inc.id, 'FAILURE_DETECTED', 'UPIShield Telemetry Engine', `Threshold breach detected in ${inc.mttd_seconds}s`, '{}', inc.detected_at);
    insertEvent.run(`${inc.id}-EV3`, inc.id, 'ANALYSIS_COMPLETED', 'Cascade Graph Analyzer', `Mapped blast radius across ${JSON.parse(inc.affected_services_json).length} services`, '{}', inc.detected_at);
    if (inc.resolved_at) {
      insertEvent.run(`${inc.id}-EV4`, inc.id, 'RECOVERY_COMPLETED', inc.assigned_operator, `Restored nominal SLA in ${Math.round(inc.mttr_seconds / 60)}m (${inc.resolution_notes})`, '{}', inc.resolved_at);
      insertEvent.run(`${inc.id}-EV5`, inc.id, 'VERIFICATION_PASSED', 'Synthetic Verifier', 'Error rate and p95 latency returned within SLA envelope', '{}', inc.resolved_at);
    }
  }

  // Seed baseline synthetic transactions
  const txSeed = [
    {
      id: 'TXN-904821',
      idempotency_key: 'IDEMP-UPI-88412-A',
      payer_vpa: 'arjun.mehta@okaxis',
      payee_vpa: 'meridian.retail@hdfcbank',
      amount_inr: 14500,
      status: 'SUCCESS',
      gateway_service_id: 'upi-gateway',
      incident_id: null,
      response_lost: 0,
      verification_status: 'VERIFIED_LEDGER',
      retry_count: 0,
      audit_trail_json: JSON.stringify([
        { timestamp: '2026-10-18T09:12:04Z', event: 'IDEMPOTENCY_REGISTERED', detail: 'Key IDEMP-UPI-88412-A locked in Primary DB' },
        { timestamp: '2026-10-18T09:12:04Z', event: 'DEBIT_COMMITTED', detail: 'Bank Core System posted INR 14,500.00' },
        { timestamp: '2026-10-18T09:12:05Z', event: 'RESPONSE_ACKED', detail: 'PSP client confirmed receipt (HTTP 200)' },
      ]),
      created_at: '2026-10-18T09:12:04Z',
    },
    {
      id: 'TXN-904822',
      idempotency_key: 'IDEMP-UPI-88419-B',
      payer_vpa: 'kavita.iyer@icici',
      payee_vpa: 'apollo.pharmacy@sbi',
      amount_inr: 3280,
      status: 'UNKNOWN_RESPONSE_LOST',
      gateway_service_id: 'upi-gateway',
      incident_id: 'INC-2026-OCT-08',
      response_lost: 1,
      verification_status: 'AWAITING_STATUS_CHECK',
      retry_count: 1,
      audit_trail_json: JSON.stringify([
        { timestamp: '2026-10-18T09:18:10Z', event: 'IDEMPOTENCY_REGISTERED', detail: 'Key IDEMP-UPI-88419-B acquired' },
        { timestamp: '2026-10-18T09:18:11Z', event: 'LEDGER_DEBIT_EXECUTED', detail: 'Bank Core System committed debit; response socket timed out at API Gateway' },
        { timestamp: '2026-10-18T09:18:14Z', event: 'SAFE_HOLD_TRIGGERED', detail: 'UPIShield held state as UNKNOWN_RESPONSE_LOST — prevented blind retry debit' },
      ]),
      created_at: '2026-10-18T09:18:10Z',
    },
    {
      id: 'TXN-904823',
      idempotency_key: 'IDEMP-UPI-88424-C',
      payer_vpa: 'rohan.kapoor@ybl',
      payee_vpa: 'metro.transit@paytm',
      amount_inr: 920,
      status: 'DUPLICATE_BLOCKED',
      gateway_service_id: 'upi-gateway',
      incident_id: null,
      response_lost: 0,
      verification_status: 'DUPLICATE_PREVENTED',
      retry_count: 2,
      audit_trail_json: JSON.stringify([
        { timestamp: '2026-10-18T09:21:02Z', event: 'ORIGINAL_TX_SETTLED', detail: 'Original payment INR 920.00 settled via Tx Processing' },
        { timestamp: '2026-10-18T09:21:06Z', event: 'DUPLICATE_INTERCEPTED', detail: 'Retry with identical idempotency key IDEMP-UPI-88424-C blocked; cached receipt returned' },
      ]),
      created_at: '2026-10-18T09:21:02Z',
    },
    {
      id: 'TXN-904824',
      idempotency_key: 'IDEMP-UPI-88430-D',
      payer_vpa: 'sneha.nair@okhdfcbank',
      payee_vpa: 'cloudstore.in@axisbank',
      amount_inr: 28900,
      status: 'SUCCESS',
      gateway_service_id: 'upi-gateway',
      incident_id: null,
      response_lost: 0,
      verification_status: 'VERIFIED_LEDGER',
      retry_count: 0,
      audit_trail_json: JSON.stringify([
        { timestamp: '2026-10-18T09:24:19Z', event: 'IDEMPOTENCY_REGISTERED', detail: 'Key IDEMP-UPI-88430-D validated' },
        { timestamp: '2026-10-18T09:24:20Z', event: 'LEDGER_COMMITTED', detail: 'Settled across Bank Core System in 39ms' },
      ]),
      created_at: '2026-10-18T09:24:19Z',
    },
    {
      id: 'TXN-904825',
      idempotency_key: 'IDEMP-UPI-88435-E',
      payer_vpa: 'vikram.das@sbi',
      payee_vpa: 'utility.grid@icici',
      amount_inr: 6450,
      status: 'PENDING',
      gateway_service_id: 'tx-processing',
      incident_id: null,
      response_lost: 0,
      verification_status: 'AWAITING_STATUS_CHECK',
      retry_count: 0,
      audit_trail_json: JSON.stringify([
        { timestamp: '2026-10-18T09:27:40Z', event: 'QUEUED_FOR_CLEARING', detail: 'Awaiting NPCI settlement confirmation frame' },
      ]),
      created_at: '2026-10-18T09:27:40Z',
    },
  ];

  const insertTx = db.prepare(`
    INSERT INTO transactions (
      id, idempotency_key, payer_vpa, payee_vpa, amount_inr, status,
      gateway_service_id, incident_id, response_lost, verification_status,
      retry_count, audit_trail_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const t of txSeed) {
    insertTx.run(
      t.id, t.idempotency_key, t.payer_vpa, t.payee_vpa, t.amount_inr, t.status,
      t.gateway_service_id, t.incident_id, t.response_lost, t.verification_status,
      t.retry_count, t.audit_trail_json, t.created_at
    );
  }

  // Counterfactual Resilience Impact Case Studies (Strictly synthetic)
  const caseStudiesSeed = [
    {
      id: 'CASE-01',
      code: 'CASE 1',
      title: 'October Payment Gateway Degradation',
      label: 'SYNTHETIC HISTORICAL CASE STUDY · COUNTERFACTUAL SCENARIO',
      root_cause: 'Recurring October festive traffic surge (1.6x baseline) causing synchronous worker pool saturation and NPCI callback queue buildup.',
      detection_method: 'Seasonal baseline deviation + 4-week rolling OLS latency slope alert on UPI Payment Gateway.',
      services_affected_json: JSON.stringify(['UPI Payment Gateway', 'API Gateway', 'Transaction Processing Service', 'External Payment Network']),
      recommended_action: 'Pre-warm secondary clearing route, enforce adaptive circuit breaker at API Gateway, and shift 25% traffic to backup gateway.',
      simulated_outcome: 'Simulated failover contained p95 latency below 180ms and prevented cascading 504 timeouts across merchant APIs.',
      estimated_downtime_avoided_min: 38,
      estimated_tx_protected: 392000,
      timeline_json: JSON.stringify([
        { offset: 'T-14d', event: 'Predictive model flagged Elevated October Risk (score 79.4) from 2022–2025 seasonal records.' },
        { offset: 'T-00m', event: 'Simulated gateway p95 latency crossed 140ms early-warning threshold.' },
        { offset: 'T+02m', event: 'Operator approved recommended backup gateway traffic split (25% offload).' },
        { offset: 'T+06m', event: 'Worker queue stabilized; zero cascading payment failures recorded in simulation.' },
      ]),
    },
    {
      id: 'CASE-02',
      code: 'CASE 2',
      title: 'Database Overload',
      label: 'SYNTHETIC HISTORICAL CASE STUDY · COUNTERFACTUAL SCENARIO',
      root_cause: 'Idempotency journal write lock contention on Primary Database under elevated October settlement concurrency.',
      detection_method: 'Connection pool saturation (>88%) correlated with downstream Transaction Processing & Auth Service latency climb.',
      services_affected_json: JSON.stringify(['Primary Database', 'Transaction Processing Service', 'Authentication Service', 'Fraud Detection Service', 'Bank Core System']),
      recommended_action: 'Offload read-only fraud velocity queries to Backup Database replica and apply connection pool rate-cap.',
      simulated_outcome: 'Estimated impact avoided: prevented Tier-5 database lockup from cascading into Bank Core ledger timeouts.',
      estimated_downtime_avoided_min: 22,
      estimated_tx_protected: 645000,
      timeline_json: JSON.stringify([
        { offset: 'T-00m', event: 'Primary DB active connections reached 91% ceiling during peak settlement.' },
        { offset: 'T+01m', event: 'Dependency graph highlighted 5 downstream services exposed to single-point DB contention.' },
        { offset: 'T+03m', event: 'Read-replica routing activated for Fraud Detection & Auth token reads.' },
        { offset: 'T+05m', event: 'Write lock queue cleared; Transaction Processing error rate returned to 0.06%.' },
      ]),
    },
    {
      id: 'CASE-03',
      code: 'CASE 3',
      title: 'Cloud Provider Disruption',
      label: 'SYNTHETIC HISTORICAL CASE STUDY · COUNTERFACTUAL SCENARIO',
      root_cause: 'Shared cloud availability zone packet loss degrading multiple co-located ingress and database services simultaneously.',
      detection_method: 'Multi-node correlation across Cloud Provider infrastructure edges showing shared single-zone blast radius.',
      services_affected_json: JSON.stringify(['Cloud Provider', 'Load Balancer', 'API Gateway', 'Authentication Service', 'Primary Database']),
      recommended_action: 'Evacuate ingress routing from degraded AZ and promote cross-AZ Backup Database standby.',
      simulated_outcome: 'Simulated multi-AZ failover reduced projected disruption window from 29 minutes to under 6 minutes.',
      estimated_downtime_avoided_min: 23,
      estimated_tx_protected: 580000,
      timeline_json: JSON.stringify([
        { offset: 'T-00m', event: 'Packet loss detected across 4 services sharing Tier-0 Cloud Provider substrate.' },
        { offset: 'T+01m', event: 'UPIShield topology isolated common upstream root node (Cloud Provider).' },
        { offset: 'T+04m', event: 'Cross-AZ routing & standby DB promotion approved and simulated.' },
        { offset: 'T+06m', event: 'Full payment continuity verified across healthy availability zones.' },
      ]),
    },
    {
      id: 'CASE-04',
      code: 'CASE 4',
      title: 'Authentication Service Cascade',
      label: 'SYNTHETIC HISTORICAL CASE STUDY · COUNTERFACTUAL SCENARIO',
      root_cause: 'HSM PIN-verification cache miss storm forcing uncached database lookups on every UPI Collect/Pay request.',
      detection_method: 'Error-rate inflection on Authentication Service paired with upstream retry amplification from UPI Payment Gateway.',
      services_affected_json: JSON.stringify(['Authentication Service', 'UPI Payment Gateway', 'API Gateway', 'Primary Database']),
      recommended_action: 'Enable bounded retry budget on UPI Gateway, isolate stale HSM pool, and warm token verification cache.',
      simulated_outcome: 'Simulated retry-dampening eliminated retry storm and preserved 99.6% payment completion rate.',
      estimated_downtime_avoided_min: 28,
      estimated_tx_protected: 440000,
      timeline_json: JSON.stringify([
        { offset: 'T-00m', event: 'Authentication latency spiked from 21ms to 390ms on HSM verification calls.' },
        { offset: 'T+02m', event: 'UPIShield prioritized Auth Service recovery due to critical centrality in payment path.' },
        { offset: 'T+05m', event: 'Retry circuit-breaker engaged; HSM worker pool recycled cleanly.' },
        { offset: 'T+07m', event: 'Authentication SLA restored without downstream database exhaustion.' },
      ]),
    },
  ];

  const insertCase = db.prepare(`
    INSERT INTO case_studies (
      id, code, title, label, root_cause, detection_method,
      services_affected_json, recommended_action, simulated_outcome,
      estimated_downtime_avoided_min, estimated_tx_protected, timeline_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of caseStudiesSeed) {
    insertCase.run(
      c.id, c.code, c.title, c.label, c.root_cause, c.detection_method,
      c.services_affected_json, c.recommended_action, c.simulated_outcome,
      c.estimated_downtime_avoided_min, c.estimated_tx_protected, c.timeline_json
    );
  }

  db.prepare(`
    INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'AUD-SEED-001',
    'System Initializer',
    'DEMO_DATASET_SEEDED',
    'platform',
    'upishield-demo',
    'Seeded 12 banking infrastructure services, 19 dependency edges, and 2022–2026 synthetic historical metrics.',
    now
  );

  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('demo_mode', 'true')`).run();
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('october_seasonality_weight', '0.32')`).run();
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('latency_slope_weight', '0.28')`).run();
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('centrality_weight', '0.22')`).run();
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('error_trend_weight', '0.18')`).run();
}
