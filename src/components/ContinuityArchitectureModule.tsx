import React from 'react';
import {
  Activity,
  ArrowRight,
  Cloud,
  Database,
  GitBranch,
  Layers,
  ShieldCheck,
  TerminalSquare,
  Workflow,
} from 'lucide-react';

const LIFECYCLE_STEPS = [
  {
    step: '01',
    title: 'Telemetry & Anomaly Ingestion',
    detail:
      'Collects service latency percentiles, HTTP/ISO error rates, RPS throughput, and saturation signals across UPI clearing, auth, core, and database tiers.',
    tag: 'Observability Layer',
  },
  {
    step: '02',
    title: 'Live Dependency Graph Resolution',
    detail:
      'Models HARD, SOFT, REPLICATION, and INFRASTRUCTURE edges across all banking services to map exact caller-callee exposure paths.',
    tag: 'Topology Engine',
  },
  {
    step: '03',
    title: 'Predictive Risk & Seasonality Scoring',
    detail:
      'Combines historical seasonal anomaly z-scores (such as recurring October festive peaks) with rolling latency slopes and graph centrality.',
    tag: 'Forecasting Model',
  },
  {
    step: '04',
    title: 'SPOF & What-If Pre-Impact Modeling',
    detail:
      'Runs non-destructive dry-run failure scenarios to quantify potential cascade depth, exposed payment paths, and recovery duration before incidents occur.',
    tag: 'Scenario Lab',
  },
  {
    step: '05',
    title: 'Evidence-Backed Recovery Advisory',
    detail:
      'Synthesizes specific recovery actions anchored by live telemetry, matched historical incidents, dependency blast radius, and explicit risk side-effects.',
    tag: 'Decision Support',
  },
  {
    step: '06',
    title: 'Dual-Control Human Approval Gate',
    detail:
      'Never mutates banking systems autonomously. Every failover, traffic shift, or DB offload requires explicit SRE / Payment Operations operator approval.',
    tag: 'Governance Control',
  },
  {
    step: '07',
    title: 'Transaction Safety & Idempotency Guard',
    detail:
      'Protects in-flight payments during response socket drops by holding UNKNOWN_RESPONSE_LOST states and blocking blind duplicate core debits.',
    tag: 'Payment Integrity',
  },
  {
    step: '08',
    title: 'Verification & Immutable Audit Ledger',
    detail:
      'Validates post-recovery canary conditions, calculates MTTD/MTTR, and records every operator decision in an executive-ready audit trail.',
    tag: 'Compliance & Reporting',
  },
];

const INTEGRATIONS = [
  {
    domain: 'Bank Monitoring Systems',
    icon: Activity,
    examples: 'Prometheus, OpenTelemetry, Dynatrace, Datadog, AppDynamics',
    currentMode: 'Simulated local SQLite telemetry & 2022–2026 synthetic metrics baseline',
    futureMode: 'Read-only OTLP / PromQL metric & trace ingestors polling 10s–30s intervals',
  },
  {
    domain: 'Payment Gateways',
    icon: ShieldCheck,
    examples: 'NPCI UPI Switch Connectors, ISO 8583 / XML Clearing Gateways',
    currentMode: 'Modeled UPI Payment Gateway & External Payment Network nodes + idempotency ledger',
    futureMode: 'Passive clearing queue-depth listeners & idempotency status-check webhook bridge',
  },
  {
    domain: 'Cloud Infrastructure',
    icon: Cloud,
    examples: 'Multi-AZ AWS / Azure / GCP Regions, Kubernetes Clusters, BGP / MPLS',
    currentMode: 'Tier-0 Cloud Provider substrate node modeling shared availability-zone blast radius',
    futureMode: 'Cloud provider health APIs, Kubernetes node readiness probes & DNS/GSLB weight hooks',
  },
  {
    domain: 'Databases',
    icon: Database,
    examples: 'Primary Core RDBMS, Read Replicas, PgBouncer Connection Pools',
    currentMode: 'Primary Database & Backup Database nodes with replication lag & lock simulation',
    futureMode: 'Connection-pool utilization exporters & automated read-replica routing policies',
  },
  {
    domain: 'API Gateways',
    icon: Layers,
    examples: 'Kong, Apigee, NGINX Ingress, Envoy Service Mesh',
    currentMode: 'Load Balancer & API Gateway nodes modeling 502/504 backpressure and circuit-breakers',
    futureMode: 'Control-plane traffic-split & rate-limit policy APIs gated by operator approval',
  },
  {
    domain: 'Incident Management Systems',
    icon: TerminalSquare,
    examples: 'PagerDuty, ServiceNow ITSM, Jira Ops, Opsgenie',
    currentMode: 'Local SQLite incident ledger, event timeline, operator assignment & audit log',
    futureMode: 'Bi-directional ServiceNow / PagerDuty ticket sync & CAB approval webhooks',
  },
];

export const ContinuityArchitectureModule: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header & Honest Demo Boundary Notice */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
        <span className="text-[11px] font-mono text-cyan-400 font-semibold tracking-wide">
          ENTERPRISE PRODUCT ARCHITECTURE & INTEGRATION BOUNDARY
        </span>
        <h2 className="font-display text-xl font-semibold text-white mt-1">
          How UPIShield Protects Payment Continuity
        </h2>
        <p className="text-xs text-slate-400 mt-1.5 max-w-3xl leading-relaxed">
          UPIShield operates as an intelligence and operator-governed control plane layered above existing banking infrastructure. In this demonstration environment, all telemetry, topology edges, and recovery executions run locally against a synthetic SQLite sandbox—no live bank networks are connected.
        </p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/25">
            <span className="font-mono text-[11px] font-semibold text-amber-300 block">
              CURRENT ENVIRONMENT: SIMULATED INTEGRATIONS
            </span>
            <p className="text-slate-300 mt-1 leading-relaxed">
              Service metrics, 2022–2026 October seasonal anomalies, dependency cascades, and recovery playbooks run deterministically in local Node.js + SQLite for evaluation and tabletop resilience testing.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/25">
            <span className="font-mono text-[11px] font-semibold text-cyan-300 block">
              PRODUCTION ARCHITECTURE: ADAPTER INTEGRATION MODEL
            </span>
            <p className="text-slate-300 mt-1 leading-relaxed">
              Designed to ingest read-only telemetry from existing bank APM/observability tools and trigger approved runbooks via ITSM / gateway control planes under strict human-in-the-loop governance.
            </p>
          </div>
        </div>
      </section>

      {/* 8-Step Operational Continuity Workflow */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display text-base font-semibold text-white">
            8-Stage Payment Continuity Lifecycle
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {LIFECYCLE_STEPS.map((item) => (
            <div
              key={item.step}
              className="p-4 rounded-xl bg-[#060A14] border border-slate-800/80 flex flex-col justify-between space-y-2.5"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-cyan-400 font-semibold">STEP {item.step}</span>
                  <span className="text-slate-500">{item.tag}</span>
                </div>
                <h4 className="font-display text-sm font-semibold text-slate-100 mt-1.5">
                  {item.title}
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integration Architecture Matrix */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-cyan-400" />
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                Enterprise Integration Architecture
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Clear boundary between current demonstration simulation and future production bank integrations
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {INTEGRATIONS.map((intg) => {
            const Icon = intg.icon;
            return (
              <div
                key={intg.domain}
                className="p-4 rounded-xl bg-[#060A14] border border-slate-800/80 space-y-3 text-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-semibold text-white">{intg.domain}</h4>
                      <p className="text-[11px] text-slate-500">{intg.examples}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="font-mono text-[10px] font-semibold text-amber-300 block">
                      CURRENT (DEMO SIMULATION)
                    </span>
                    <p className="text-slate-300 mt-0.5 leading-snug">{intg.currentMode}</p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] font-semibold text-cyan-400 flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" /> FUTURE PRODUCTION ADAPTER
                    </span>
                    <p className="text-slate-400 mt-0.5 leading-snug">{intg.futureMode}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
