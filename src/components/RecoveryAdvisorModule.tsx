import React, { useEffect, useState } from 'react';
import { Check, FileSearch, GitBranch, History, X } from 'lucide-react';
import type { IncidentRecord, RecoveryActionRecord, RecoveryRecommendation } from '../types.ts';
import { formatDurationSeconds, formatTimestamp } from '../utils/format.ts';

interface RecoveryAdvisorModuleProps {
  refreshTrigger: number;
  onDataChanged: () => void;
  onNavigateToSimulator: () => void;
}

export const RecoveryAdvisorModule: React.FC<RecoveryAdvisorModuleProps> = ({
  refreshTrigger,
  onDataChanged,
  onNavigateToSimulator,
}) => {
  const [recommendations, setRecommendations] = useState<RecoveryRecommendation[]>([]);
  const [actions, setActions] = useState<RecoveryActionRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recRes, incRes] = await Promise.all([
        fetch('/api/recommendations'),
        fetch('/api/incidents'),
      ]);
      const recJson = await recRes.json();
      const incJson = await incRes.json();
      setRecommendations(recJson.recommendations ?? []);
      setActions(recJson.actions ?? []);
      setIncidents(incJson.incidents ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleApprove = async (recId: string) => {
    try {
      setBusyId(recId);
      setStatusMessage(null);
      const res = await fetch(`/api/recommendations/${encodeURIComponent(recId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorName: 'Priya Sharma (VP Infrastructure)' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Approval failed');
      setStatusMessage(
        `Simulated recovery executed and verified for ${json.recommendation?.serviceName ?? 'service'}. Topology and incident timeline updated.`
      );
      await loadData();
      onDataChanged();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Approval error');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (recId: string) => {
    try {
      setBusyId(recId);
      setStatusMessage(null);
      const res = await fetch(`/api/recommendations/${encodeURIComponent(recId)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorName: 'Priya Sharma (VP Infrastructure)',
          reason: 'Deferred by operator during review',
        }),
      });
      if (!res.ok) throw new Error('Reject failed');
      setStatusMessage('Recommendation marked as REJECTED in audit trail.');
      await loadData();
      onDataChanged();
    } finally {
      setBusyId(null);
    }
  };

  const pendingRecs = recommendations.filter((r) => r.status === 'PENDING');
  const historicalRecs = recommendations.filter((r) => r.status !== 'PENDING');
  const latestSimIncident = incidents.find((i) => i.origin === 'live_simulation') ?? incidents[0];

  if (loading && recommendations.length === 0) {
    return <div className="h-[520px] rounded-xl bg-[#0C1222] border border-slate-800 animate-pulse" />;
  }

  return (
    <div className="space-y-5">
      {/* Header & Governance Notice */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono text-cyan-400 font-semibold">
            EVIDENCE-BASED RECOVERY ADVISOR · HUMAN-IN-THE-LOOP APPROVAL GATE
          </span>
          <h2 className="font-display text-xl font-semibold text-white mt-0.5">
            Recovery Recommendations, Evidence Citations & Simulated Execution
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Every recommendation cites live telemetry, dependency graph traversal, and historical incident evidence. Actions execute strictly in the demo simulation sandbox after operator approval.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToSimulator}
          className="h-9 px-4 rounded-lg bg-[#060A14] border border-slate-700 hover:border-blue-500/40 text-xs font-medium text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
        >
          Open Failure Simulator
        </button>
      </section>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
          {statusMessage}
        </div>
      )}

      {/* Pending Recommendations Queue */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Pending Operator Approvals ({pendingRecs.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Auditable decision packages derived from active failure telemetry, dependency paths, and historical incidents
            </p>
          </div>
          <span className="font-mono text-[10px] text-amber-300">
            SIMULATED RECOVERY SANDBOX
          </span>
        </div>

        {pendingRecs.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-800 rounded-xl">
            <p className="text-sm font-medium text-slate-300">No Pending Recovery Recommendations</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Inject a simulated failure in the Failure Simulator to generate evidence-backed recovery recommendations for operator approval.
            </p>
            <button
              type="button"
              onClick={onNavigateToSimulator}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
            >
              Go to Failure Simulator
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRecs.map((rec) => (
              <div
                key={rec.id}
                className="p-4 rounded-xl bg-[#060A14] border border-amber-500/30 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                      <span className="text-amber-400 font-semibold">REC ID: {rec.id}</span>
                      <span>·</span>
                      <span className="text-cyan-400">INCIDENT: {rec.incidentId}</span>
                      <span>·</span>
                      <span>SERVICE: {rec.serviceName}</span>
                      <span>·</span>
                      <span className="text-slate-300">EST. RISK: {rec.estimatedRisk}</span>
                      <span>·</span>
                      <span className="text-amber-300">SIMULATED DATA</span>
                    </div>
                    <h4 className="font-display text-base font-semibold text-white mt-1">
                      {rec.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReject(rec.id)}
                      disabled={busyId === rec.id}
                      className="h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 hover:border-red-500/50 text-xs font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(rec.id)}
                      disabled={busyId === rec.id}
                      className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {busyId === rec.id ? 'Executing Simulation...' : 'Approve & Simulate Recovery'}
                    </button>
                  </div>
                </div>

                {/* Operational & Governance Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-500 block">Operational Reason</span>
                    <p className="text-slate-300 mt-0.5">{rec.reason}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Expected Benefit (Simulated Estimate)</span>
                    <p className="text-emerald-300 mt-0.5">{rec.expectedBenefit}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Risk & Potential Side Effects</span>
                    <p className="text-amber-200/90 mt-0.5">
                      [{rec.estimatedRisk} Risk] {rec.sideEffects}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Required Approval</span>
                    <p className="text-slate-200 mt-0.5">{rec.requiredApproval}</p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-500 block">Verification Criteria</span>
                    <p className="font-mono text-cyan-300 mt-0.5">{rec.verificationCondition}</p>
                  </div>
                </div>

                {/* Evidence Citations Block */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                  <div className="p-3 rounded-lg bg-[#0C1222] border border-slate-800/80">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1.5">
                      <FileSearch className="w-3.5 h-3.5 text-cyan-400" />
                      Evidence Used
                    </span>
                    {rec.evidenceUsed && rec.evidenceUsed.length > 0 ? (
                      <ul className="space-y-1 text-[11px] text-slate-400">
                        {rec.evidenceUsed.map((ev, i) => (
                          <li key={i}>• {ev}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-slate-400">{rec.reason}</p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-[#0C1222] border border-slate-800/80">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1.5">
                      <History className="w-3.5 h-3.5 text-amber-400" />
                      Historical Incident References
                    </span>
                    {rec.historicalIncidentRefs && rec.historicalIncidentRefs.length > 0 ? (
                      <ul className="space-y-1 text-[11px] text-slate-400 font-mono">
                        {rec.historicalIncidentRefs.map((href, i) => (
                          <li key={i}>• {href}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-slate-500">No prior matching synthetic incidents.</p>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-[#0C1222] border border-slate-800/80">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5 mb-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                      Dependency Graph Evidence
                    </span>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {rec.dependencyGraphEvidence ||
                        `Evaluated against topology edges for ${rec.serviceName}.`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recovery Timeline & Action History */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                Incident Recovery Timeline
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {latestSimIncident ? `${latestSimIncident.id} · ${latestSimIncident.title}` : 'No recorded incidents'}
              </p>
            </div>
            {latestSimIncident && (
              <div className="text-right font-mono text-[11px] text-slate-300">
                <div>MTTD: {formatDurationSeconds(latestSimIncident.mttdSeconds)}</div>
                <div>
                  MTTR:{' '}
                  {latestSimIncident.mttrSeconds > 0
                    ? formatDurationSeconds(latestSimIncident.mttrSeconds)
                    : 'Active'}
                </div>
              </div>
            )}
          </div>

          {latestSimIncident?.events && latestSimIncident.events.length > 0 ? (
            <div className="space-y-2.5">
              {latestSimIncident.events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80 text-xs flex items-start justify-between gap-3"
                >
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-cyan-400">
                      {ev.stage}
                    </span>
                    <p className="text-slate-200 mt-0.5">{ev.message}</p>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">Actor: {ev.actor}</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-500 shrink-0">
                    {formatTimestamp(ev.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6">No recovery events recorded yet.</p>
          )}
        </div>

        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Approved & Executed Action History
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Simulated recovery actions & canary verification outcomes
          </p>

          {actions.length === 0 && historicalRecs.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              No recovery actions have been approved or rejected in this session yet.
            </p>
          ) : (
            <div className="space-y-3">
              {actions.map((act) => (
                <div key={act.id} className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-emerald-400 font-semibold">
                      {act.status} · VERIFICATION {act.verificationResult}
                    </span>
                    <span className="text-slate-500">{formatTimestamp(act.executedAt)}</span>
                  </div>
                  <p className="font-medium text-slate-100 mt-1">{act.actionTitle}</p>
                  <p className="text-slate-400 mt-0.5">
                    Approved by {act.operatorName} · Incident {act.incidentId}
                  </p>
                </div>
              ))}

              {historicalRecs
                .filter((r) => r.status === 'REJECTED')
                .map((rej) => (
                  <div key={rej.id} className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-slate-400 font-semibold">REJECTED</span>
                      <span className="text-slate-500">{rej.incidentId}</span>
                    </div>
                    <p className="font-medium text-slate-300 mt-1">{rej.title}</p>
                    <p className="text-slate-500 mt-0.5">Reviewed by {rej.approvedBy}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
