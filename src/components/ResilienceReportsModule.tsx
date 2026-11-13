import React, { useEffect, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Loader2, Printer } from 'lucide-react';
import type { CaseStudyRecord, IncidentRecord, SloServiceStatus, SpofAnalysisItem } from '../types.ts';
import { formatDurationSeconds, formatInrCompact, formatTimestamp } from '../utils/format.ts';

interface ExecutiveReportPayload {
  generatedAt: string;
  environmentLabel: string;
  dataGovernanceTags: {
    telemetry: string;
    historical: string;
    projections: string;
  };
  infrastructureSummary: {
    totalServices: number;
    healthyCount: number;
    degradedCount: number;
    criticalCount: number;
    overallReadinessScore: number;
    readinessBand: string;
    sloCompliancePct: number;
    breachedSlos: number;
    spofExposedCount: number;
  };
  octoberRiskAnalysis: {
    detectedPeakMonth: string;
    zScore: number;
    octoberIncidentsTotal: number;
    nonOctoberMonthlyAvg: number;
    octoberLatencyAvgMs: number;
    octoberVolumeSurgePct: number;
    summary: string;
  };
  yoyTrends: Array<{
    year: string;
    totalIncidents: number;
    octoberIncidents: number;
    avgLatencyMs: number;
    octoberLatencyMs: number;
  }>;
  criticalDependencies: SpofAnalysisItem[];
  majorIncidents: IncidentRecord[];
  readinessHighPriority: Array<{ serviceId: string; serviceName: string; score: number; action: string }>;
  sloAlerts: SloServiceStatus[];
  estimatedDisruptionAvoided: {
    totalDowntimeAvoidedMin: number;
    totalTransactionsProtected: number;
    caseStudiesCount: number;
  };
  preventiveRecommendations: Array<{ serviceName: string; spofSeverityScore: number; action: string }>;
  caseStudies: CaseStudyRecord[];
}

export const ResilienceReportsModule: React.FC<{
  refreshTrigger: number;
  initialTab?: 'executive' | 'cases' | 'visuals';
}> = ({ refreshTrigger, initialTab = 'executive' }) => {
  const [activeTab, setActiveTab] = useState<'executive' | 'cases' | 'visuals'>(initialTab);
  const [execReport, setExecReport] = useState<ExecutiveReportPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Executive Visual Generator state (gemini-3-pro-image-preview with 1K / 2K / 4K selector)
  const [visualPrompt, setVisualPrompt] = useState(
    'Clean technical architectural diagram of a multi-region banking UPI payment gateway resilience topology on dark midnight navy background with crisp cyan failover routes and redundant database clusters, enterprise engineering precision'
  );
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | '1:1'>('16:9');
  const [generatingImg, setGeneratingImg] = useState(false);
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string | null>(null);
  const [imgCaption, setImgCaption] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setLoading(true);
    fetch('/api/reports/executive')
      .then((r) => r.json())
      .then((d: ExecutiveReportPayload) => setExecReport(d))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const handleExport = (format: 'csv' | 'json') => {
    window.location.href = `/api/reports/export?format=${format}`;
  };

  const handlePrintPdf = () => {
    setActiveTab('executive');
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const handleGenerateVisual = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGeneratingImg(true);
      setImgError(null);
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: visualPrompt,
          imageSize,
          aspectRatio,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Image generation failed');
      setGeneratedImgUrl(json.imageDataUrl);
      setImgCaption(json.caption || null);
    } catch (err) {
      setImgError(err instanceof Error ? err.message : 'Unable to generate image');
    } finally {
      setGeneratingImg(false);
    }
  };

  if (loading && !execReport) {
    return <div className="h-[520px] rounded-xl bg-[#0C1222] border border-slate-800 animate-pulse" />;
  }

  return (
    <div className="space-y-5">
      {/* Header & Exports (Hidden during PDF print) */}
      <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 print:hidden">
        <div>
          <span className="text-[11px] font-mono text-amber-300 font-semibold">
            {execReport?.environmentLabel ?? 'UPISHIELD ENTERPRISE DEMO ENVIRONMENT'}
          </span>
          <h2 className="font-display text-xl font-semibold text-white mt-0.5">
            Executive Resilience Reports & Impact Analysis
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Board-ready resilience summary, counterfactual case studies, and CSV/JSON/PDF report exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#060A14] border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('executive')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'executive' ? 'bg-blue-600/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Executive Report
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cases')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap ${
                activeTab === 'cases' ? 'bg-blue-600/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Case Studies ({execReport?.caseStudies.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('visuals')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap ${
                activeTab === 'visuals' ? 'bg-blue-600/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Visual Studio
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="h-9 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save Executive PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="h-9 px-3 rounded-lg bg-[#060A14] border border-slate-700 hover:border-cyan-500/40 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>
        </div>
      </section>

      {/* TAB 1: PRINTABLE EXECUTIVE RESILIENCE REPORT */}
      {activeTab === 'executive' && execReport && (
        <article className="print-report-sheet rounded-xl bg-[#0C1222] border border-slate-800/80 p-6 lg:p-8 space-y-6">
          {/* Formal Report Masthead */}
          <header className="pb-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-semibold text-cyan-400 tracking-wider">
                UPISHIELD EXECUTIVE RISK & RESILIENCE ASSESSMENT
              </p>
              <h3 className="font-display text-2xl font-semibold text-white mt-1">
                Payment Infrastructure Continuity Report
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Prepared for CTO, Chief Risk Officer & Infrastructure Leadership · {execReport.environmentLabel}
              </p>
            </div>
            <div className="text-left sm:text-right font-mono text-[11px] text-slate-400">
              <div>Generated: {formatTimestamp(execReport.generatedAt)}</div>
              <div>Scope: 12 Monitored Services · 2022–2026 Dataset</div>
            </div>
          </header>

          {/* Data Provenance / Governance Distinction */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
            <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
              <span className="font-mono font-semibold text-cyan-400 block">MEASURED DEMO TELEMETRY</span>
              <p className="text-slate-300 mt-0.5">{execReport.dataGovernanceTags.telemetry}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
              <span className="font-mono font-semibold text-amber-300 block">SYNTHETIC HISTORICAL DATA</span>
              <p className="text-slate-300 mt-0.5">{execReport.dataGovernanceTags.historical}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
              <span className="font-mono font-semibold text-emerald-400 block">ESTIMATED COUNTERFACTUAL IMPACT</span>
              <p className="text-slate-300 mt-0.5">{execReport.dataGovernanceTags.projections}</p>
            </div>
          </div>

          {/* 1. Infrastructure Health & Readiness Executive Summary */}
          <section className="space-y-3">
            <h4 className="font-display text-base font-semibold text-white">
              1. Infrastructure Health, SLO Compliance & Recovery Readiness Summary
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                <span className="text-slate-500 block">Service Health</span>
                <span className="font-mono tabular-nums text-lg font-semibold text-emerald-400 mt-0.5 block">
                  {execReport.infrastructureSummary.healthyCount}/{execReport.infrastructureSummary.totalServices} GREEN
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                <span className="text-slate-500 block">Recovery Readiness</span>
                <span className="font-mono tabular-nums text-lg font-semibold text-cyan-400 mt-0.5 block">
                  {execReport.infrastructureSummary.overallReadinessScore}/100 ({execReport.infrastructureSummary.readinessBand})
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                <span className="text-slate-500 block">30d SLO Compliance</span>
                <span className="font-mono tabular-nums text-lg font-semibold text-slate-100 mt-0.5 block">
                  {execReport.infrastructureSummary.sloCompliancePct}%
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                <span className="text-slate-500 block">High-Exposure SPOFs</span>
                <span className="font-mono tabular-nums text-lg font-semibold text-amber-400 mt-0.5 block">
                  {execReport.infrastructureSummary.spofExposedCount}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                <span className="text-slate-500 block">Est. Disruption Avoided</span>
                <span className="font-mono tabular-nums text-lg font-semibold text-emerald-400 mt-0.5 block">
                  {execReport.estimatedDisruptionAvoided.totalDowntimeAvoidedMin}m ·{' '}
                  {(execReport.estimatedDisruptionAvoided.totalTransactionsProtected / 1_000_000).toFixed(2)}M tx
                </span>
              </div>
            </div>
          </section>

          {/* 2. Recurring October Seasonal Risk & Historical Trends */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-4 rounded-xl bg-[#060A14] border border-slate-800/80 space-y-2 text-xs">
              <h4 className="font-display text-sm font-semibold text-white">
                2. October Recurring Risk Analysis (Synthetic Historical Data)
              </h4>
              <p className="text-slate-300 leading-relaxed">{execReport.octoberRiskAnalysis.summary}</p>
              <div className="grid grid-cols-3 gap-2 pt-2 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block">Z-SCORE</span>
                  <span className="text-amber-400 font-semibold">+{execReport.octoberRiskAnalysis.zScore}σ</span>
                </div>
                <div>
                  <span className="text-slate-500 block">OCT SURGE</span>
                  <span className="text-slate-100 font-semibold">
                    +{execReport.octoberRiskAnalysis.octoberVolumeSurgePct}% vol
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">OCT LATENCY</span>
                  <span className="text-cyan-400 font-semibold">
                    {execReport.octoberRiskAnalysis.octoberLatencyAvgMs} ms
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#060A14] border border-slate-800/80 space-y-2 text-xs">
              <h4 className="font-display text-sm font-semibold text-white">
                3. Year-over-Year Synthetic Risk Trends (2022–2026)
              </h4>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500">
                    <th className="py-1.5">Year</th>
                    <th className="py-1.5 text-right">Annual Incidents</th>
                    <th className="py-1.5 text-right">Oct Incidents</th>
                    <th className="py-1.5 text-right">Avg / Oct Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {execReport.yoyTrends.map((y) => (
                    <tr key={y.year}>
                      <td className="py-1.5 text-slate-200">{y.year}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-300">{y.totalIncidents}</td>
                      <td className="py-1.5 text-right tabular-nums text-amber-400">{y.octoberIncidents}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-300">
                        {y.avgLatencyMs}ms / {y.octoberLatencyMs}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Critical Dependency Exposure & Preventive Recommendations */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-2">
              <h4 className="font-display text-base font-semibold text-white">
                4. Critical Dependency & SPOF Exposure
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-500">
                      <th className="py-2 pr-2">Service</th>
                      <th className="py-2 px-2 text-right">Affected</th>
                      <th className="py-2 px-2">Backup Readiness</th>
                      <th className="py-2 pl-2 text-right">SPOF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {execReport.criticalDependencies.map((c) => (
                      <tr key={c.serviceId}>
                        <td className="py-2 pr-2 font-medium text-slate-100">{c.serviceName}</td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-300">
                          {c.affectedServicesCount}
                        </td>
                        <td className="py-2 px-2 font-mono text-[10px] text-slate-400">
                          {c.backupReadiness.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2 pl-2 text-right font-mono tabular-nums font-semibold text-amber-400">
                          {c.spofSeverityScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-display text-base font-semibold text-white">
                5. Priority Preventive Actions
              </h4>
              <div className="space-y-2 text-xs">
                {execReport.preventiveRecommendations.map((pr, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-[#060A14] border border-slate-800/80">
                    <div className="flex justify-between font-medium text-slate-100">
                      <span>{pr.serviceName}</span>
                      <span className="font-mono text-[11px] text-amber-400">SPOF {pr.spofSeverityScore}/100</span>
                    </div>
                    <p className="text-slate-400 mt-0.5 leading-snug">{pr.action}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. Major Incidents Summary */}
          <section className="space-y-2">
            <h4 className="font-display text-base font-semibold text-white">
              6. Major Incidents & Simulated Operations Log
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-500">
                    <th className="py-2 pr-3">ID & Title</th>
                    <th className="py-2 px-2">Service</th>
                    <th className="py-2 px-2">Severity / Origin</th>
                    <th className="py-2 px-2 text-right">MTTD / MTTR</th>
                    <th className="py-2 pl-2 text-right">Est. Tx & Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {execReport.majorIncidents.map((inc) => (
                    <tr key={inc.id}>
                      <td className="py-2 pr-3">
                        <span className="font-mono text-[10px] text-cyan-400 block">{inc.id}</span>
                        <span className="text-slate-200 font-medium">{inc.title}</span>
                      </td>
                      <td className="py-2 px-2 text-slate-300">{inc.serviceName}</td>
                      <td className="py-2 px-2 font-mono text-[10px] text-slate-400">
                        {inc.severity} · {inc.origin === 'live_simulation' ? 'LIVE SIM' : 'SYNTHETIC'}
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                        {formatDurationSeconds(inc.mttdSeconds)} /{' '}
                        {inc.mttrSeconds > 0 ? formatDurationSeconds(inc.mttrSeconds) : 'Active'}
                      </td>
                      <td className="py-2 pl-2 text-right font-mono tabular-nums text-amber-300 whitespace-nowrap">
                        {inc.txAtRisk.toLocaleString()} tx · {formatInrCompact(inc.financialImpactInr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 7. Simulated Counterfactual Case Studies Summary */}
          <section className="space-y-2 pt-2 border-t border-slate-800/80">
            <h4 className="font-display text-base font-semibold text-white">
              7. Counterfactual Simulated Case Studies (Estimated Impact Avoided)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {execReport.caseStudies.map((cs) => (
                <div key={cs.id} className="p-3 rounded-lg bg-[#060A14] border border-slate-800/80">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="text-amber-300">{cs.code} · SYNTHETIC</span>
                    <span className="text-emerald-400 font-semibold">
                      Est. {cs.estimatedDowntimeAvoidedMin}m saved · {cs.estimatedTxProtected.toLocaleString()} tx
                    </span>
                  </div>
                  <p className="font-semibold text-slate-100 mt-1">{cs.title}</p>
                  <p className="text-slate-400 mt-0.5 leading-snug">{cs.simulatedOutcome}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      )}

      {/* TAB 2: COUNTERFACTUAL CASE STUDIES */}
      {activeTab === 'cases' && execReport && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {execReport.caseStudies.map((cs) => (
            <article
              key={cs.id}
              className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-4 flex flex-col"
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div>
                  <span className="text-[11px] font-mono text-amber-300 font-semibold">
                    {cs.code} · {cs.label}
                  </span>
                  <h3 className="font-display text-lg font-semibold text-white mt-1">{cs.title}</h3>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] text-slate-500 block">Est. Impact Avoided</span>
                  <span className="font-mono text-sm font-semibold text-emerald-400">
                    {cs.estimatedDowntimeAvoidedMin}m · {cs.estimatedTxProtected.toLocaleString()} tx
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Root Cause (Simulated Incident)</span>
                  <p className="text-slate-300 mt-0.5">{cs.rootCause}</p>
                </div>
                <div>
                  <span className="text-slate-500 block">Detection Method</span>
                  <p className="text-slate-300 mt-0.5">{cs.detectionMethod}</p>
                </div>
                <div>
                  <span className="text-slate-500 block">Recommended Action</span>
                  <p className="text-cyan-300 mt-0.5">{cs.recommendedAction}</p>
                </div>
                <div>
                  <span className="text-slate-500 block">Counterfactual Simulated Outcome</span>
                  <p className="text-emerald-300 mt-0.5">{cs.simulatedOutcome}</p>
                </div>
              </div>

              <div className="text-xs">
                <span className="text-slate-500 block mb-1">Services Affected:</span>
                <p className="font-mono text-[11px] text-slate-300">{cs.servicesAffected.join(' · ')}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 space-y-1.5 mt-auto">
                <span className="text-[11px] font-semibold text-slate-400 block">Simulated Incident Timeline</span>
                {cs.timeline.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs">
                    <span className="font-mono text-[11px] text-cyan-400 w-12 shrink-0">{step.offset}</span>
                    <span className="text-slate-300">{step.event}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {/* TAB 3: EXECUTIVE VISUAL STUDIO */}
      {activeTab === 'visuals' && (
        <section className="rounded-xl bg-[#0C1222] border border-slate-800/80 p-5 space-y-4">
          <div>
            <span className="text-xs font-mono text-cyan-400 font-semibold">
              EXECUTIVE BOARDROOM VISUAL STUDIO · GEMINI-3-PRO-IMAGE-PREVIEW
            </span>
            <h3 className="font-display text-base font-semibold text-white mt-1">
              Generate High-Resolution Resilience Briefing Diagrams (1K / 2K / 4K)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Create presentation visuals illustrating failover paths or resilience posture for CTO and Risk Committee reports.
            </p>
          </div>

          <form onSubmit={handleGenerateVisual} className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
            <label className="lg:col-span-2 block text-xs">
              <span className="text-slate-300 font-medium block mb-1">Visual Prompt</span>
              <input
                type="text"
                value={visualPrompt}
                onChange={(e) => setVisualPrompt(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-100"
              />
            </label>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="block">
                <span className="text-slate-300 font-medium block mb-1">Resolution Size</span>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value as '1K' | '2K' | '4K')}
                  aria-label="Image size"
                  className="w-full h-10 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-100 font-mono"
                >
                  <option value="1K">1K (Standard)</option>
                  <option value="2K">2K (High Res)</option>
                  <option value="4K">4K (Ultra HD)</option>
                </select>
              </label>

              <label className="block">
                <span className="text-slate-300 font-medium block mb-1">Aspect Ratio</span>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as '16:9' | '4:3' | '1:1')}
                  aria-label="Aspect ratio"
                  className="w-full h-10 px-3 rounded-lg bg-[#060A14] border border-slate-800 text-xs text-slate-100 font-mono"
                >
                  <option value="16:9">16:9</option>
                  <option value="4:3">4:3</option>
                  <option value="1:1">1:1</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={generatingImg}
              className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              {generatingImg ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating {imageSize}...
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4" /> Generate {imageSize} Visual
                </>
              )}
            </button>
          </form>

          {imgError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
              {imgError}
            </div>
          )}

          {generatedImgUrl && (
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono">Generated Output ({imageSize} · {aspectRatio})</span>
                <a
                  href={generatedImgUrl}
                  download={`upishield-architecture-${imageSize.toLowerCase()}.png`}
                  className="text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  Download PNG
                </a>
              </div>
              <img
                src={generatedImgUrl}
                alt="Generated UPIShield architecture visual"
                referrerPolicy="no-referrer"
                className="w-full max-h-[420px] object-contain rounded-lg border border-slate-800 bg-[#060A14]"
              />
              {imgCaption && <p className="text-xs text-slate-400">{imgCaption}</p>}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
