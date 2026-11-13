import React, { useEffect, useState } from 'react';
import { CheckCircle2, FlaskConical, Play, RotateCcw, Zap } from 'lucide-react';
import type {
  CascadeImpactResult,
  FailureType,
  IncidentRecord,
  IncidentSeverity,
  RecoveryRecommendation,
  ServiceNode,
  WhatIfScenarioResult,
} from '../types.ts';
import { HEALTH_META, formatDurationSeconds, formatTimestamp } from '../utils/format.ts';

const FAILURE_TYPES: FailureType[] = [
  'Payment Gateway Degradation',
  'API Timeout',
  'Database Overload',
  'Cloud Provider Outage',
  'Network Latency Spike',
  'Authentication Failure',
  'Traffic Overload',
  'Notification Service Outage',
];

const WHAT_IF_SCENARIOS = [
  { id: 'COMPLETE_OUTAGE', label: 'Complete Service Outage' },
  { id: 'DATABASE_FAILURE', label: 'Database Failure & Lock Contention' },
  { id: 'CLOUD_OUTAGE', label: 'Cloud Provider Outage' },
  { id: 'API_GATEWAY_FAILURE', label: 'API Gateway Failure' },
  { id: 'INCREASED_LATENCY', label: 'Increased Latency Spike' },
  { id: 'TRAFFIC_SURGE', label: 'Sudden Traffic Surge (1.8x)' },
] as const;

interface FailureSimulatorModuleProps {
  services: ServiceNode[];
  initialTargetServiceId?: string | null;
  initialSubTab?: 'simulator' | 'whatif';
  onDataChanged: () => void;
  onOpenTopology: () => void;
  onOpenRecovery: () => void;
  autoStartFullDemoTrigger: number;
}

export const FailureSimulatorModule: React.FC<FailureSimulatorModuleProps> = ({
  services,
  initialTargetServiceId,
  initialSubTab = 'simulator',
  onDataChanged,
  onOpenTopology,
  onOpenRecovery,
  autoStartFullDemoTrigger,
}) => {
  const [subTab, setSubTab] = useState<'simulator' | 'whatif'>(initialSubTab);

  // Live Simulator State
  const [targetServiceId, setTargetServiceId] = useState<string>(initialTargetServiceId || 'upi-gateway');
  const [failureType, setFailureType] = useState<FailureType>('Payment Gateway Degradation');
  const [severity, setSeverity] = useState<IncidentSeverity>('CRITICAL');
  const [durationMinutes, setDurationMinutes] = useState<number>(25);
  const [trafficIntensity, setTrafficIntensity] = useState<number>(1.65);

  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [lastIncident, setLastIncident] = useState<IncidentRecord | null>(null);
  const [lastCascade, setLastCascade] = useState<CascadeImpactResult | null>(null);
  const [lastRecommendations, setLastRecommendations] = useState<RecoveryRecommendation[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // What-If Scenario Lab State (Non-Destructive)
  const [whatIfServiceId, setWhatIfServiceId] = useState<string>(initialTargetServiceId || 'primary-db');
  const [whatIfScenario, setWhatIfScenario] = useState<string>('DATABASE_FAILURE');
  const [runningWhatIf, setRunningWhatIf] = useState(false);
  const [whatIfResult, setWhatIfResult] = useState<WhatIfScenarioResult | null>(null);

  // 12-Step Guided Full Resilience Demo state
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState<number>(0);
  const [demoStepsLog, setDemoStepsLog] = useState<Array<{ step: number; title: string; detail: string }>>([]);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (initialTargetServiceId) {
      setTargetServiceId(initialTargetServiceId);
      setWhatIfServiceId(initialTargetServiceId);
    }
  }, [initialTargetServiceId]);

  useEffect(() => {
    if (autoStartFullDemoTrigger > 0 && !demoRunning) {
      setSubTab('simulator');
      runFullResilienceDemo();
    }
  }, [autoStartFullDemoTrigger]);

  const handleRunWhatIf = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setRunningWhatIf(true);
      setErrorMsg(null);
      const res = await fetch('/api/analysis/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: whatIfServiceId,
          scenarioType: whatIfScenario,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'What-If simulation failed');
      setWhatIfResult(json as WhatIfScenarioResult);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'What-If scenario failed');
    } finally {
      setRunningWhatIf(false);
    }
  };

  const handleInjectFailure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await fetch('/api/simulator/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: targetServiceId,
          failureType,
          severity,
          durationMinutes,
          trafficIntensity,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Injection failed');
      setLastIncident(json.incident);
      setLastCascade(json.cascade);
      setLastRecommendations(json.recommendations ?? []);
      onDataChanged();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetDemo = async () => {
    try {
      setResetting(true);
      setErrorMsg(null);
      await fetch('/api/simulator/reset', { method: 'POST' });
      setLastIncident(null);
      setLastCascade(null);
      setLastRecommendations([]);
      setDemoStep(0);
      setDemoStepsLog([]);
      onDataChanged();
    } finally {
      setResetting(false);
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const runFullResilienceDemo = async () => {
    if (demoRunning) return;
    setDemoRunning(true);
    setErrorMsg(null);
    setDemoStepsLog([]);

    const pushStep = (step: number, title: string, detail: string) => {
      setDemoStep(step);
      setDemoStepsLog((prev) => [...prev, { step, title, detail }]);
    };

    try {
      await fetch('/api/simulator/reset', { method: 'POST' });
      onDataChanged();
      pushStep(1, 'Normal Infrastructure Baseline Verified', 'All 12 services restored to nominal GREEN baseline with zero duplicate records.');
      await sleep(500);

      const injectRes = await fetch('/api/simulator/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: 'upi-gateway',
          failureType: 'Payment Gateway Degradation',
          severity: 'CRITICAL',
          durationMinutes: 20,
          trafficIntensity: 1.75,
        }),
      });
      const injectData = await injectRes.json();
      if (!injectRes.ok) throw new Error(injectData.error || 'Demo injection failed');
      const inc: IncidentRecord = injectData.incident;
      const cascade: CascadeImpactResult = injectData.cascade;
      const recs: RecoveryRecommendation[] = injectData.recommendations;

      setLastIncident(inc);
      setLastCascade(cascade);
      setLastRecommendations(recs);
      onDataChanged();

      pushStep(2, 'Injected Simulated Primary Payment Gateway Failure', `Incident ${inc.id} injected on UPI Payment Gateway at 1.75x traffic intensity.`);
      await sleep(500);

      pushStep(3, 'Failure Detected by Telemetry Engine', `Anomaly detected in ${inc.mttdSeconds}s (+${inc.latencyImpactMs}ms latency, ${inc.errorRateImpact}% error spike).`);
      await sleep(450);

      pushStep(4, 'Highlighted Failed Node in Dependency Graph', 'UPI Payment Gateway transitioned to RED (FAILED) state in live topology.');
      await sleep(450);

      pushStep(
        5,
        'Identified Downstream & Dependent Impact',
        `${cascade.directlyAffected.length} direct (${cascade.directlyAffected.map((d) => d.name).join(', ')}) and ${cascade.indirectlyAffected.length} indirect services affected.`
      );
      await sleep(500);

      pushStep(
        6,
        'Cascade Analysis Completed',
        `Estimated ${cascade.estimatedTxAtRisk.toLocaleString()} transactions at risk across ${cascade.criticalPaymentPaths.length} critical payment paths.`
      );
      await sleep(500);

      const primaryRec = recs[0];
      pushStep(7, 'AI Recovery Advisor Generated Action Plan', `Recommendation "${primaryRec.title}" queued for banker approval.`);
      await sleep(550);

      pushStep(8, 'Operator Approval Simulated', 'Approved by Priya Sharma (VP Payment Infrastructure) under dual-control policy.');
      await sleep(500);

      const approveRes = await fetch(`/api/recommendations/${encodeURIComponent(primaryRec.id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName: 'Priya Sharma (Guided Demo)' }),
      });
      if (!approveRes.ok) throw new Error('Simulated recovery execution failed');
      pushStep(9, 'Simulated Recovery Executed', 'Backup gateway traffic split applied and stale worker pools drained.');
      await sleep(500);

      pushStep(10, 'Post-Recovery Verification Passed', `Verification condition met: ${primaryRec.verificationCondition}`);
      await sleep(450);

      onDataChanged();
      pushStep(11, 'Dependency Graph Restored to GREEN', 'All impacted nodes returned to nominal SLA envelope.');
      await sleep(400);

      const finalIncRes = await fetch(`/api/incidents/${encodeURIComponent(inc.id)}`);
      const finalIncData = await finalIncRes.json();
      if (finalIncData.incident) {
        setLastIncident(finalIncData.incident);
      }
      pushStep(12, 'Completed Incident Timeline Recorded', `Incident ${inc.id} resolved with full MTTD/MTTR audit trail.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Guided demo encountered an error');
    } finally {
      setDemoRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Mode Switch */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono text-cyan-400 font-semibold tracking-wide">
            DETERMINISTIC CASCADE ENGINE & WHAT-IF RISK LAB
          </span>
          <h2 className="font-display text-xl font-semibold text-white mt-0.5">
            Failure Simulator & Non-Destructive What-If Scenario Lab
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Inject live demo incidents into the sandbox or evaluate hypothetical outage scenarios side-by-side without altering live state.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#060A14] border border-slate-800 shrink-0 self-start">
          <button
            type="button"
            onClick={() => setSubTab('simulator')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              subTab === 'simulator' ? 'bg-blue-600/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Live Failure Simulator
          </button>
          <button
            type="button"
            onClick={() => setSubTab('whatif')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              subTab === 'whatif' ? 'bg-blue-600/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            What-If Scenario Lab
          </button>
        </div>
      </section>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {/* TAB 1: LIVE FAILURE SIMULATOR */}
      {subTab === 'simulator' && (
        <div className="space-y-5">
          <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              Live Injection mutates demo topology state & generates pending recovery recommendations. Repeated runs cleanly reset state.
            </span>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleResetDemo}
                disabled={resetting || demoRunning}
                className="h-9 px-3.5 rounded-lg bg-[#060A14] border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {resetting ? 'Resetting...' : 'Reset Demo State'}
              </button>
              <button
                type="button"
                onClick={runFullResilienceDemo}
                disabled={demoRunning}
                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                {demoRunning ? `Running Step ${demoStep}/12...` : 'Run Auto-Simulation (12 Steps)'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <form
              onSubmit={handleInjectFailure}
              className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-4"
            >
              <div>
                <h3 className="font-display text-base font-semibold text-white">Inject Simulated Failure</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure target node, failure mode, and traffic intensity
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <label className="block">
                  <span className="text-slate-300 font-medium block mb-1">Target Service</span>
                  <select
                    value={targetServiceId}
                    onChange={(e) => setTargetServiceId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-slate-100"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.criticality})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-slate-300 font-medium block mb-1">Failure Type</span>
                  <select
                    value={failureType}
                    onChange={(e) => setFailureType(e.target.value as FailureType)}
                    className="w-full h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-slate-100"
                  >
                    {FAILURE_TYPES.map((ft) => (
                      <option key={ft} value={ft}>
                        {ft}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-slate-300 font-medium block mb-1">Severity</span>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                      className="w-full h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-slate-100"
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-slate-300 font-medium block mb-1">Duration (min)</span>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-slate-100 font-mono"
                    />
                  </label>
                </div>

                <label className="block">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300 font-medium">Traffic Intensity Multiplier</span>
                    <span className="font-mono text-cyan-400">{trafficIntensity.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={2.5}
                    step={0.05}
                    value={trafficIntensity}
                    onChange={(e) => setTrafficIntensity(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting || demoRunning}
                className="w-full py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                {submitting ? 'Injecting Failure...' : 'Inject Simulated Failure'}
              </button>
            </form>

            <div className="xl:col-span-2 space-y-5">
              {demoStepsLog.length > 0 && (
                <div className="rounded-xl bg-[#0C1222] border border-cyan-500/30 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display text-base font-semibold text-white">
                      Guided Resilience Simulation ({demoStep} / 12)
                    </h3>
                    <span className="font-mono text-xs text-cyan-400">
                      {demoRunning ? 'IN PROGRESS' : 'COMPLETED'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {demoStepsLog.map((item) => (
                      <div
                        key={item.step}
                        className="p-2.5 rounded-lg bg-[#060A14] border border-slate-800/80 text-xs flex items-start gap-2.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-100">
                            {item.step}. {item.title}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lastCascade && lastIncident ? (
                <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                    <div>
                      <span className="font-mono text-xs text-red-400 font-semibold">
                        CASCADE IMPACT ANALYSIS · {lastIncident.id}
                      </span>
                      <h3 className="font-display text-lg font-semibold text-white mt-0.5">
                        Originating Failure: {lastCascade.originServiceName}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {lastCascade.estimatedOperationalDisruption}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={onOpenTopology}
                        className="px-3 py-1.5 rounded-lg bg-[#060A14] border border-slate-700 hover:border-cyan-500/40 text-xs text-cyan-300 cursor-pointer"
                      >
                        Inspect on Graph
                      </button>
                      <button
                        type="button"
                        onClick={onOpenRecovery}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
                      >
                        Review Recovery ({lastRecommendations.length})
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                      <span className="text-slate-500">Directly Affected</span>
                      <p className="font-mono tabular-nums text-xl font-semibold text-red-400 mt-0.5">
                        {lastCascade.directlyAffected.length}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                      <span className="text-slate-500">Indirectly Affected</span>
                      <p className="font-mono tabular-nums text-xl font-semibold text-amber-400 mt-0.5">
                        {lastCascade.indirectlyAffected.length}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                      <span className="text-slate-500">Est. Tx at Risk</span>
                      <p className="font-mono tabular-nums text-xl font-semibold text-slate-100 mt-0.5">
                        {lastCascade.estimatedTxAtRisk.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                      <span className="text-slate-500">Topology Exposure</span>
                      <p className="font-mono tabular-nums text-xl font-semibold text-cyan-400 mt-0.5">
                        {lastCascade.blastRadiusPct}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <h4 className="font-semibold text-slate-200 mb-2">Directly Affected Services</h4>
                      <div className="space-y-1.5">
                        {lastCascade.directlyAffected.map((d) => (
                          <div
                            key={d.id}
                            className="p-2.5 rounded-lg bg-[#060A14] border border-slate-800/80 flex items-center justify-between gap-2"
                          >
                            <div>
                              <p className="font-medium text-slate-100">{d.name}</p>
                              <p className="text-[11px] text-slate-500">{d.relation}</p>
                            </div>
                            <span className={`font-mono text-[10px] font-semibold ${HEALTH_META[d.projectedState].badgeText}`}>
                              {HEALTH_META[d.projectedState].shortLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-200 mb-2">Indirectly Affected & Payment Paths</h4>
                      <div className="space-y-1.5 mb-3">
                        {lastCascade.indirectlyAffected.length === 0 ? (
                          <p className="text-slate-500">No multi-hop transitive failures beyond direct neighbors.</p>
                        ) : (
                          lastCascade.indirectlyAffected.map((i) => (
                            <div key={i.id} className="p-2.5 rounded-lg bg-[#060A14] border border-slate-800/80">
                              <div className="flex justify-between">
                                <span className="font-medium text-slate-100">{i.name}</span>
                                <span className="font-mono text-[10px] text-amber-400">Hop {i.hopDistance}</span>
                              </div>
                              <p className="font-mono text-[10px] text-slate-400 mt-1">{i.path.join(' → ')}</p>
                            </div>
                          ))
                        )}
                      </div>

                      {lastCascade.criticalPaymentPaths.length > 0 && (
                        <div>
                          <span className="text-[11px] font-semibold text-slate-300">Critical Payment Paths Affected:</span>
                          <div className="mt-1 space-y-1">
                            {lastCascade.criticalPaymentPaths.map((p, idx) => (
                              <p key={idx} className="font-mono text-[10px] text-red-300 bg-red-500/5 px-2 py-1 rounded">
                                {p.join(' → ')}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {lastIncident.events && lastIncident.events.length > 0 && (
                    <div className="pt-4 border-t border-slate-800/80">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-slate-200">
                          Recorded Incident Timeline ({lastIncident.status})
                        </h4>
                        <span className="font-mono text-[11px] text-slate-400">
                          MTTD {formatDurationSeconds(lastIncident.mttdSeconds)} · MTTR{' '}
                          {lastIncident.mttrSeconds > 0 ? formatDurationSeconds(lastIncident.mttrSeconds) : 'Pending Recovery'}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {lastIncident.events.map((ev) => (
                          <div key={ev.id} className="flex items-start justify-between gap-3 text-xs py-1">
                            <div>
                              <span className="font-mono text-[11px] text-cyan-400 mr-2">{ev.stage}</span>
                              <span className="text-slate-300">{ev.message}</span>
                            </div>
                            <span className="font-mono text-[10px] text-slate-500 shrink-0">
                              {formatTimestamp(ev.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-8 text-center">
                  <p className="font-display text-base font-semibold text-slate-200">
                    No Active Live Simulation Selected
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto">
                    Inject a simulated failure using the controls on the left or switch to the What-If Scenario Lab for non-destructive side-by-side modeling.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WHAT-IF SCENARIO LAB (NON-DESTRUCTIVE SIDE-BY-SIDE COMPARISON) */}
      {subTab === 'whatif' && (
        <div className="space-y-5">
          {/* Scenario Configurator + Pre-Execution Current State Summary */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <form
              onSubmit={handleRunWhatIf}
              className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-4"
            >
              <div>
                <span className="font-mono text-[10px] text-cyan-400 font-semibold">
                  NON-DESTRUCTIVE DRY RUN
                </span>
                <h3 className="font-display text-base font-semibold text-white mt-0.5">
                  Configure What-If Scenario
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Models blast radius and recovery estimates without modifying live database state.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <label className="block">
                  <span className="text-slate-300 font-medium block mb-1">Target Service</span>
                  <select
                    value={whatIfServiceId}
                    onChange={(e) => setWhatIfServiceId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-slate-100"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.criticality})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-slate-300 font-medium block mb-1">Scenario Type</span>
                  <select
                    value={whatIfScenario}
                    onChange={(e) => setWhatIfScenario(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-slate-100"
                  >
                    {WHAT_IF_SCENARIOS.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="submit"
                disabled={runningWhatIf}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                {runningWhatIf ? 'Modeling Cascade...' : 'Run What-If Scenario Estimate'}
              </button>
            </form>

            {/* Current Baseline State Preview (Shown Before & Alongside Results) */}
            <div className="xl:col-span-2 rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-white">
                    Current Infrastructure Baseline State
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live pre-simulation state across monitored banking tiers
                  </p>
                </div>
                <span className="font-mono text-[11px] text-emerald-400 font-semibold">
                  {services.filter((s) => s.healthState === 'GREEN').length}/{services.length} GREEN
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 text-xs">
                {services.map((s) => (
                  <div key={s.id} className="p-2.5 rounded-lg bg-[#060A14] border border-slate-800/80">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-slate-200 truncate">{s.name}</span>
                      <span className={`font-mono text-[10px] font-semibold ${HEALTH_META[s.healthState].badgeText}`}>
                        {HEALTH_META[s.healthState].shortLabel}
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-[10px] text-slate-400 mt-1">
                      {s.latencyMs}ms · {s.errorRate.toFixed(2)}% err
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* What-If Simulated Output & Side-by-Side Comparison */}
          {whatIfResult && (
            <div className="space-y-5">
              <div className="rounded-xl bg-[#0C1222] border border-amber-500/30 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-amber-300">
                      SIMULATED ESTIMATE · NON-DESTRUCTIVE WHAT-IF ANALYSIS
                    </span>
                    <h3 className="font-display text-lg font-semibold text-white mt-0.5">
                      {whatIfResult.scenarioLabel}
                    </h3>
                  </div>
                  <span className="font-mono text-xs text-red-400 font-semibold">
                    Est. Availability Delta: {whatIfResult.availabilityDeltaPct}%
                  </span>
                </div>

                {/* Key Simulated Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                    <span className="text-slate-500 block">Affected Services (Est.)</span>
                    <span className="font-mono tabular-nums text-xl font-semibold text-red-400 mt-0.5 block">
                      {whatIfResult.affectedServices.length}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                    <span className="text-slate-500 block">Cascade Depth (Hops)</span>
                    <span className="font-mono tabular-nums text-xl font-semibold text-amber-400 mt-0.5 block">
                      {whatIfResult.potentialCascadeDepth}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                    <span className="text-slate-500 block">Critical Paths Impacted</span>
                    <span className="font-mono tabular-nums text-xl font-semibold text-slate-100 mt-0.5 block">
                      {whatIfResult.criticalPaymentPathsImpacted.length}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                    <span className="text-slate-500 block">Est. Tx Exposed (12m)</span>
                    <span className="font-mono tabular-nums text-xl font-semibold text-cyan-400 mt-0.5 block">
                      {whatIfResult.estimatedTransactionsExposed.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                    <span className="text-slate-500 block">Est. Recovery Duration</span>
                    <span className="font-mono tabular-nums text-xl font-semibold text-emerald-400 mt-0.5 block">
                      {whatIfResult.estimatedRecoveryDurationMin} min
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-lg bg-[#060A14] border border-slate-800/80 space-y-2">
                    <span className="font-semibold text-slate-200 block">Backup Availability & Recovery Path</span>
                    <p className="text-amber-300 font-mono text-[11px]">{whatIfResult.backupAvailability}</p>
                    <p className="text-slate-300 leading-relaxed">{whatIfResult.recommendedRecoveryPath}</p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#060A14] border border-slate-800/80 space-y-1.5">
                    <span className="font-semibold text-slate-200 block">
                      Critical Payment Paths Impacted (Simulated Estimate)
                    </span>
                    {whatIfResult.criticalPaymentPathsImpacted.length === 0 ? (
                      <p className="text-slate-500">No primary payment clearing paths directly interrupted.</p>
                    ) : (
                      whatIfResult.criticalPaymentPathsImpacted.map((p, idx) => (
                        <p key={idx} className="font-mono text-[10px] text-red-300">
                          {p.join(' → ')}
                        </p>
                      ))
                    )}
                  </div>
                </div>

                {/* Side-by-Side Baseline vs Simulated Failure State Table */}
                <div>
                  <h4 className="font-display text-sm font-semibold text-white mb-2">
                    Side-by-Side Comparison: Original Baseline vs. Simulated Failure State
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] text-slate-500">
                          <th className="py-2 pr-3">Service</th>
                          <th className="py-2 px-2">Original State</th>
                          <th className="py-2 px-2 text-right">Baseline Latency / Err</th>
                          <th className="py-2 px-2">Simulated State (Est.)</th>
                          <th className="py-2 pl-2 text-right">Simulated Latency / Err (Est.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {whatIfResult.baselineServices.map((base) => {
                          const sim = whatIfResult.simulatedServices.find((s) => s.id === base.id) ?? base;
                          const changed =
                            sim.healthState !== base.healthState || sim.latencyMs !== base.latencyMs;
                          return (
                            <tr key={base.id} className={changed ? 'bg-red-500/5' : ''}>
                              <td className="py-2 pr-3 font-medium text-slate-100">{base.name}</td>
                              <td className="py-2 px-2 font-mono text-[11px]">
                                <span className={HEALTH_META[base.healthState].badgeText}>
                                  {HEALTH_META[base.healthState].shortLabel}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-400">
                                {base.latencyMs}ms · {base.errorRate.toFixed(2)}%
                              </td>
                              <td className="py-2 px-2 font-mono text-[11px]">
                                <span className={`font-semibold ${HEALTH_META[sim.healthState].badgeText}`}>
                                  {HEALTH_META[sim.healthState].shortLabel}
                                </span>
                              </td>
                              <td
                                className={`py-2 pl-2 text-right font-mono tabular-nums ${
                                  changed ? 'text-amber-300 font-semibold' : 'text-slate-500'
                                }`}
                              >
                                {sim.latencyMs}ms · {sim.errorRate.toFixed(2)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
