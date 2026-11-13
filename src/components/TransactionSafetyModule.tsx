import React, { useEffect, useState } from 'react';
import { CheckCircle2, CopyCheck, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { TransactionRecord } from '../types.ts';
import { formatInrCompact, formatTimestamp } from '../utils/format.ts';

interface TransactionsResponse {
  dataNotice: string;
  summary: {
    totalVolumeSample: number;
    syntheticDailyThroughput: number;
    successful: number;
    failed: number;
    pending: number;
    unknownStatus: number;
    duplicateAttemptsBlocked: number;
    timeoutEvents: number;
    transactionsAffectedByActiveIncidents: number;
  };
  resilienceAnalytics: {
    estimatedTransactionsProtected: number;
    estimatedTransactionsAtRisk: number;
    estimatedDowntimeAvoidedMin: number;
    detectionImprovementPct: number;
    recoveryTimeImprovementPct: number;
    estimatedOperationalImpactAvoidedInr: number;
  };
  transactions: TransactionRecord[];
}

interface TransactionSafetyModuleProps {
  refreshTrigger: number;
  onDataChanged: () => void;
}

export const TransactionSafetyModule: React.FC<TransactionSafetyModuleProps> = ({
  refreshTrigger,
  onDataChanged,
}) => {
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadTx = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/transactions');
      const json = (await res.json()) as TransactionsResponse;
      setData(json);
      if (!selectedTxId && json.transactions.length > 0) {
        const unknown = json.transactions.find((t) => t.status === 'UNKNOWN_RESPONSE_LOST');
        setSelectedTxId((unknown ?? json.transactions[0]).id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTx();
  }, [refreshTrigger]);

  const handleSimulateResponseLoss = async () => {
    try {
      setActionBusy('response_loss');
      const res = await fetch('/api/transactions/simulate-response-loss', { method: 'POST' });
      const json = await res.json();
      if (json.transaction) {
        setSelectedTxId(json.transaction.id);
        setFeedback(
          `Response-loss scenario triggered (${json.transaction.id}). Core debit succeeded, response dropped — safely held as UNKNOWN_RESPONSE_LOST with idempotency key ${json.transaction.idempotencyKey}.`
        );
      }
      await loadTx();
      onDataChanged();
    } finally {
      setActionBusy(null);
    }
  };

  const handleSimulateDuplicate = async () => {
    try {
      setActionBusy('duplicate');
      const res = await fetch('/api/transactions/simulate-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: selectedTxId }),
      });
      const json = await res.json();
      if (json.transaction) {
        setSelectedTxId(json.transaction.id);
        setFeedback(
          `Duplicate payment retry intercepted on key ${json.transaction.idempotencyKey}. Zero second debit issued.`
        );
      }
      await loadTx();
      onDataChanged();
    } finally {
      setActionBusy(null);
    }
  };

  const handleVerifyStatus = async (txId: string) => {
    try {
      setActionBusy(txId);
      const res = await fetch(`/api/transactions/${encodeURIComponent(txId)}/verify`, { method: 'POST' });
      const json = await res.json();
      if (json.transaction) {
        setFeedback(
          `Verified ${json.transaction.id} directly against Core Ledger: confirmed settled once, status reconciled to SUCCESS.`
        );
      }
      await loadTx();
      onDataChanged();
    } finally {
      setActionBusy(null);
    }
  };

  if (loading && !data) {
    return <div className="h-[520px] rounded-xl bg-[#0C1222] border border-slate-800 animate-pulse" />;
  }

  if (!data) return null;

  const selectedTx = data.transactions.find((t) => t.id === selectedTxId) ?? data.transactions[0];

  return (
    <div className="space-y-6">
      {/* Header & Interactive Controls */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-amber-300 font-semibold">{data.dataNotice}</p>
          <h2 className="font-display text-xl font-semibold text-white mt-1">
            Transaction Safety, Idempotency Guard & Response-Loss Protection
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Prevents double debits during network drops or gateway failovers using mandatory idempotency keys and core-ledger status verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSimulateResponseLoss}
            disabled={actionBusy !== null}
            className="h-9 px-3.5 rounded-lg bg-amber-600/20 border border-amber-500/40 hover:bg-amber-600/30 text-xs font-semibold text-amber-300 flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Simulate Response-Loss Scenario
          </button>
          <button
            type="button"
            onClick={handleSimulateDuplicate}
            disabled={actionBusy !== null}
            className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <CopyCheck className="w-3.5 h-3.5" />
            Test Duplicate Retry Guard
          </button>
        </div>
      </section>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200">
          {feedback}
        </div>
      )}

      {/* Transaction Monitoring Metrics + Resilience Analytics */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { label: 'Synthetic Sample', val: String(data.summary.totalVolumeSample), tone: 'text-slate-100' },
          { label: 'Successful', val: String(data.summary.successful), tone: 'text-emerald-400' },
          { label: 'Failed', val: String(data.summary.failed), tone: 'text-red-400' },
          { label: 'Pending', val: String(data.summary.pending), tone: 'text-sky-400' },
          { label: 'Unknown (Resp Lost)', val: String(data.summary.unknownStatus), tone: 'text-amber-400' },
          { label: 'Duplicates Blocked', val: String(data.summary.duplicateAttemptsBlocked), tone: 'text-cyan-400' },
          { label: 'Timeout Events', val: String(data.summary.timeoutEvents), tone: 'text-amber-300' },
          {
            label: 'Affected by Incidents',
            val: data.summary.transactionsAffectedByActiveIncidents.toLocaleString(),
            tone: 'text-red-300',
          },
        ].map((item) => (
          <div key={item.label} className="p-3.5 rounded-xl bg-[#0C1222] border border-slate-800/80">
            <span className="text-[11px] text-slate-400 block truncate">{item.label}</span>
            <p className={`font-mono tabular-nums text-lg font-semibold mt-1 ${item.tone}`}>{item.val}</p>
          </div>
        ))}
      </section>

      {/* Resilience Impact Strip (Synthetic Demonstration Metrics) */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold text-white">
            Synthetic Resilience Impact Analytics
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            SYNTHETIC DEMONSTRATION METRICS
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 text-xs">
          <div>
            <span className="text-slate-500">Est. Tx Protected</span>
            <p className="font-mono tabular-nums text-base font-semibold text-emerald-400 mt-0.5">
              {data.resilienceAnalytics.estimatedTransactionsProtected.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Est. Tx Currently At Risk</span>
            <p className="font-mono tabular-nums text-base font-semibold text-amber-400 mt-0.5">
              {data.resilienceAnalytics.estimatedTransactionsAtRisk.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Est. Downtime Avoided</span>
            <p className="font-mono tabular-nums text-base font-semibold text-cyan-400 mt-0.5">
              {data.resilienceAnalytics.estimatedDowntimeAvoidedMin} min
            </p>
          </div>
          <div>
            <span className="text-slate-500">Detection Improvement</span>
            <p className="font-mono tabular-nums text-base font-semibold text-slate-100 mt-0.5">
              +{data.resilienceAnalytics.detectionImprovementPct}% faster MTTD
            </p>
          </div>
          <div>
            <span className="text-slate-500">Recovery Improvement</span>
            <p className="font-mono tabular-nums text-base font-semibold text-slate-100 mt-0.5">
              +{data.resilienceAnalytics.recoveryTimeImprovementPct}% faster MTTR
            </p>
          </div>
          <div>
            <span className="text-slate-500">Operational Impact Avoided</span>
            <p className="font-mono tabular-nums text-base font-semibold text-emerald-400 mt-0.5">
              {formatInrCompact(data.resilienceAnalytics.estimatedOperationalImpactAvoidedInr)}
            </p>
          </div>
        </div>
      </section>

      {/* Transaction Ledger + Idempotency & Audit Trail Inspector */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-xl bg-[#0C1222] border border-slate-800/80 p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Transaction Integrity Monitor
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Select any transaction to inspect idempotency validation and response-loss audit trail
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-500">
                  <th className="py-2 pr-3">Tx ID / Idempotency Key</th>
                  <th className="py-2 px-3">Payment Path</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                  <th className="py-2 px-3">State</th>
                  <th className="py-2 pl-3 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.transactions.map((tx) => {
                  const isSel = selectedTx?.id === tx.id;
                  const stateTone =
                    tx.status === 'SUCCESS'
                      ? 'text-emerald-400'
                      : tx.status === 'UNKNOWN_RESPONSE_LOST'
                      ? 'text-amber-400'
                      : tx.status === 'DUPLICATE_BLOCKED'
                      ? 'text-cyan-400'
                      : tx.status === 'FAILED'
                      ? 'text-red-400'
                      : 'text-sky-400';

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTxId(tx.id)}
                      className={`cursor-pointer transition-colors ${
                        isSel ? 'bg-blue-600/10' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2.5 pr-3">
                        <div className="font-mono font-semibold text-slate-100">{tx.id}</div>
                        <div className="font-mono text-[10px] text-slate-500">{tx.idempotencyKey}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {tx.payerVpa} → {tx.payeeVpa}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-100">
                        INR {tx.amountInr.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`font-mono text-[11px] font-semibold ${stateTone}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {tx.status === 'UNKNOWN_RESPONSE_LOST' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVerifyStatus(tx.id);
                            }}
                            disabled={actionBusy === tx.id}
                            className="px-2.5 py-1 rounded bg-cyan-600/20 border border-cyan-500/40 hover:bg-cyan-600/30 text-[11px] font-semibold text-cyan-300 cursor-pointer"
                          >
                            {actionBusy === tx.id ? 'Verifying...' : 'Verify Core Status'}
                          </button>
                        ) : (
                          <span className="font-mono text-[10px] text-slate-400">
                            {tx.verificationStatus}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Transaction Audit Trail */}
        <div className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col">
          {selectedTx ? (
            <>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div>
                  <span className="font-mono text-xs text-cyan-400">{selectedTx.id}</span>
                  <h4 className="font-display text-base font-semibold text-white mt-0.5">
                    Safety & Audit Trail
                  </h4>
                  <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                    Key: {selectedTx.idempotencyKey} · Retries: {selectedTx.retryCount}
                  </p>
                </div>
                <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
              </div>

              <div className="space-y-2.5 mt-4 flex-1">
                {selectedTx.auditTrail.map((step, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-[#060A14] border border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-emerald-400 font-semibold">{step.event}</span>
                      <span className="text-slate-500">{formatTimestamp(step.timestamp).slice(11, 19)}</span>
                    </div>
                    <p className="text-slate-300 mt-1 leading-relaxed">{step.detail}</p>
                  </div>
                ))}
              </div>

              {selectedTx.status === 'UNKNOWN_RESPONSE_LOST' && (
                <button
                  type="button"
                  onClick={() => handleVerifyStatus(selectedTx.id)}
                  disabled={actionBusy === selectedTx.id}
                  className="mt-4 w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Run Core Ledger Status Verification
                </button>
              )}
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
};
