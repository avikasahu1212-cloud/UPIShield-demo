import React from 'react';
import { ChevronLeft, ChevronRight, Presentation, RotateCcw, X } from 'lucide-react';

export interface ExecutiveDemoStep {
  step: number;
  title: string;
  explanation: string;
  targetLabel: string;
}

export const EXECUTIVE_DEMO_STEPS: ExecutiveDemoStep[] = [
  {
    step: 1,
    title: 'Normal Infrastructure Health Baseline',
    explanation:
      'All 12 monitored UPI and core banking services operate in nominal GREEN state with baseline latency, SLA compliance, and zero active disruptions.',
    targetLabel: 'Command Center',
  },
  {
    step: 2,
    title: 'Recurring October Risk Discovery',
    explanation:
      '2022–2026 statistical analysis identifies October as a recurring seasonal anomaly driven by festive transaction surges and shared DB contention.',
    targetLabel: 'Predictive Risk',
  },
  {
    step: 3,
    title: 'Critical Dependency & SPOF Analysis',
    explanation:
      'Graph traversal pinpoints Primary Database and UPI Payment Gateway as high-centrality nodes sitting on multiple critical payment clearing paths.',
    targetLabel: 'SPOF Analysis',
  },
  {
    step: 4,
    title: 'What-If Database Outage Simulation (Dry Run)',
    explanation:
      'Non-destructive What-If modeling projects Primary Database failure exposure across Auth, Tx Processing, Fraud Detection, and Bank Core before injecting live faults.',
    targetLabel: 'What-If Lab',
  },
  {
    step: 5,
    title: 'Live Cascade Impact Injection',
    explanation:
      'Simulated Primary Database overload is injected into the sandbox, turning dependent nodes YELLOW/RED and logging incident MTTD telemetry.',
    targetLabel: 'Cascade Graph',
  },
  {
    step: 6,
    title: 'Evidence-Based Recovery Recommendation',
    explanation:
      'Recovery Advisor surfaces a dual-control action plan backed by live telemetry, historical October incident IDs, and graph blast-radius evidence.',
    targetLabel: 'Recovery Advisor',
  },
  {
    step: 7,
    title: 'Operator Approval & Simulated Recovery',
    explanation:
      'VP Infrastructure approves the recommendation; UPIShield simulates replica read-offload, verifies canary SLAs, and restores impacted nodes to GREEN.',
    targetLabel: 'Verified Recovery',
  },
  {
    step: 8,
    title: 'Final Estimated Resilience Impact Report',
    explanation:
      'Executive Resilience Report summarizes measured demo telemetry, estimated downtime avoided, SLO posture, and board-ready PDF export.',
    targetLabel: 'Executive Report',
  },
];

interface ExecutiveDemoModeBarProps {
  currentStep: number;
  busy: boolean;
  statusNote: string | null;
  onPrev: () => void;
  onNext: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export const ExecutiveDemoModeBar: React.FC<ExecutiveDemoModeBarProps> = ({
  currentStep,
  busy,
  statusNote,
  onPrev,
  onNext,
  onRestart,
  onExit,
}) => {
  const stepObj = EXECUTIVE_DEMO_STEPS[currentStep - 1] ?? EXECUTIVE_DEMO_STEPS[0];

  return (
    <div className="bg-[#0C1222] border-b border-cyan-500/40 px-4 lg:px-6 py-3 print:hidden">
      <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shrink-0 mt-0.5">
            <Presentation className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="text-cyan-400 font-semibold">
                EXECUTIVE DEMO MODE · STEP {stepObj.step} OF {EXECUTIVE_DEMO_STEPS.length}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-300">{stepObj.targetLabel}</span>
              {statusNote && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-emerald-400">{statusNote}</span>
                </>
              )}
            </div>
            <p className="text-sm font-semibold text-white mt-0.5">{stepObj.title}</p>
            <p className="text-xs text-slate-300 mt-0.5">{stepObj.explanation}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onPrev}
            disabled={busy || currentStep <= 1}
            className="h-8 px-2.5 rounded-lg bg-[#060A14] border border-slate-700 hover:border-slate-500 disabled:opacity-40 text-xs text-slate-200 flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={busy || currentStep >= EXECUTIVE_DEMO_STEPS.length}
            className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
          >
            {busy ? 'Executing...' : currentStep >= EXECUTIVE_DEMO_STEPS.length ? 'Completed' : 'Next Step'}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onRestart}
            disabled={busy}
            className="h-8 px-2.5 rounded-lg bg-[#060A14] border border-slate-700 hover:border-cyan-500/40 text-xs text-slate-300 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" /> Restart
          </button>

          <button
            type="button"
            onClick={onExit}
            disabled={busy}
            aria-label="Exit Executive Demo Mode"
            className="h-8 px-2.5 rounded-lg bg-[#060A14] border border-slate-800 hover:border-red-500/40 text-xs text-slate-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Exit
          </button>
        </div>
      </div>
    </div>
  );
};
