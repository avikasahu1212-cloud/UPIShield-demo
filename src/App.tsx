import { useCallback, useEffect, useRef, useState } from 'react';
import { ShellLayout, type NavSection } from './components/ShellLayout.tsx';
import { OverviewModule } from './components/OverviewModule.tsx';
import { DependencyGraphModule } from './components/DependencyGraphModule.tsx';
import { PredictiveIntelligenceModule } from './components/PredictiveIntelligenceModule.tsx';
import { FailureSimulatorModule } from './components/FailureSimulatorModule.tsx';
import { RecoveryAdvisorModule } from './components/RecoveryAdvisorModule.tsx';
import { SloReadinessModule } from './components/SloReadinessModule.tsx';
import { TransactionSafetyModule } from './components/TransactionSafetyModule.tsx';
import { IncidentHistoryModule } from './components/IncidentHistoryModule.tsx';
import { ResilienceReportsModule } from './components/ResilienceReportsModule.tsx';
import { ContinuityArchitectureModule } from './components/ContinuityArchitectureModule.tsx';
import { SettingsModule } from './components/SettingsModule.tsx';
import { GeminiCopilotDrawer } from './components/GeminiCopilotDrawer.tsx';
import { ExecutiveDemoModeBar } from './components/ExecutiveDemoModeBar.tsx';
import type { ServiceNode } from './types.ts';

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [services, setServices] = useState<ServiceNode[]>([]);
  const [activeIncidentCount, setActiveIncidentCount] = useState(0);
  const [pendingRecCount, setPendingRecCount] = useState(0);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>('upi-gateway');
  const [simTargetServiceId, setSimTargetServiceId] = useState<string | null>(null);
  const [topologySubTab, setTopologySubTab] = useState<'graph' | 'spof'>('graph');
  const [simulatorSubTab, setSimulatorSubTab] = useState<'simulator' | 'whatif'>('simulator');
  const [reportsSubTab, setReportsSubTab] = useState<'executive' | 'cases' | 'visuals'>('executive');
  const [globalSearch, setGlobalSearch] = useState('');
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [autoDemoTrigger, setAutoDemoTrigger] = useState(0);

  // Executive 8-step walkthrough state
  const [execDemoActive, setExecDemoActive] = useState(false);
  const [execDemoStep, setExecDemoStep] = useState(1);
  const [execDemoBusy, setExecDemoBusy] = useState(false);
  const [execDemoNote, setExecDemoNote] = useState<string | null>(null);
  const demoRecIdRef = useRef<string | null>(null);

  const refreshSummary = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    fetch('/api/overview')
      .then((r) => r.json())
      .then((d) => {
        setServices(d.services ?? []);
        setActiveIncidentCount(d.kpis?.activeIncidents ?? 0);
        setPendingRecCount(d.kpis?.pendingRecommendations ?? 0);
      })
      .catch(() => {});
  }, [refreshTrigger]);

  const handleRunFullDemo = () => {
    setSimulatorSubTab('simulator');
    setActiveNav('simulator');
    setAutoDemoTrigger((prev) => prev + 1);
  };

  const applyExecutiveStep = async (step: number) => {
    setExecDemoBusy(true);
    setExecDemoNote(null);
    try {
      if (step === 1) {
        await fetch('/api/simulator/reset', { method: 'POST' });
        demoRecIdRef.current = null;
        setActiveNav('overview');
        refreshSummary();
        setExecDemoNote('Baseline verified (12/12 GREEN)');
      } else if (step === 2) {
        setActiveNav('predictive');
        setExecDemoNote('October seasonal anomaly z-score loaded');
      } else if (step === 3) {
        setTopologySubTab('spof');
        setActiveNav('topology');
        setExecDemoNote('Primary DB & UPI Gateway SPOFs ranked');
      } else if (step === 4) {
        setSimTargetServiceId('primary-db');
        setSimulatorSubTab('whatif');
        setActiveNav('simulator');
        setExecDemoNote('Ready for non-destructive DB What-If dry run');
      } else if (step === 5) {
        // Ensure clean state then inject live DB overload cascade so topology & recs populate deterministically
        await fetch('/api/simulator/reset', { method: 'POST' });
        const res = await fetch('/api/simulator/inject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: 'primary-db',
            failureType: 'Database Overload',
            severity: 'CRITICAL',
            durationMinutes: 25,
            trafficIntensity: 1.75,
          }),
        });
        const json = await res.json();
        demoRecIdRef.current = json.recommendations?.[0]?.id ?? null;
        setTopologySubTab('graph');
        setSelectedServiceId('primary-db');
        setActiveNav('topology');
        refreshSummary();
        setExecDemoNote(`Injected ${json.incident?.id ?? 'SIM'} · Blast radius live`);
      } else if (step === 6) {
        setActiveNav('recovery');
        refreshSummary();
        setExecDemoNote('Evidence-backed recommendation awaiting approval');
      } else if (step === 7) {
        let targetRecId = demoRecIdRef.current;
        if (!targetRecId) {
          const recRes = await fetch('/api/recommendations');
          const recData = await recRes.json();
          const pending = (recData.recommendations ?? []).find((r: { status: string }) => r.status === 'PENDING');
          targetRecId = pending?.id ?? null;
        }
        if (targetRecId) {
          await fetch(`/api/recommendations/${encodeURIComponent(targetRecId)}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operatorName: 'Priya Sharma (Executive Demo)' }),
          });
        }
        setActiveNav('recovery');
        refreshSummary();
        setExecDemoNote('Approved & verified · Services restored to GREEN');
      } else if (step === 8) {
        setReportsSubTab('executive');
        setActiveNav('reports');
        refreshSummary();
        setExecDemoNote('Executive PDF-ready assessment loaded');
      }
      setExecDemoStep(step);
    } finally {
      setExecDemoBusy(false);
    }
  };

  const handleStartExecutiveDemo = () => {
    setExecDemoActive(true);
    applyExecutiveStep(1);
  };

  return (
    <>
      <ShellLayout
        activeNav={activeNav}
        onNavigate={(nav) => {
          if (nav === 'topology') setTopologySubTab('graph');
          if (nav === 'simulator') setSimulatorSubTab('simulator');
          if (nav === 'reports') setReportsSubTab('executive');
          setActiveNav(nav);
        }}
        activeIncidentCount={activeIncidentCount}
        pendingRecCount={pendingRecCount}
        globalSearch={globalSearch}
        onGlobalSearchChange={setGlobalSearch}
        onOpenCopilot={() => setCopilotOpen(true)}
        onRunFullDemo={handleRunFullDemo}
        onStartExecutiveDemo={handleStartExecutiveDemo}
        executiveDemoActive={execDemoActive}
        isDemoRunning={false}
        demoBanner={
          execDemoActive ? (
            <ExecutiveDemoModeBar
              currentStep={execDemoStep}
              busy={execDemoBusy}
              statusNote={execDemoNote}
              onPrev={() => applyExecutiveStep(Math.max(1, execDemoStep - 1))}
              onNext={() => applyExecutiveStep(Math.min(8, execDemoStep + 1))}
              onRestart={() => applyExecutiveStep(1)}
              onExit={() => {
                setExecDemoActive(false);
                setExecDemoNote(null);
              }}
            />
          ) : undefined
        }
      >
        {activeNav === 'overview' && (
          <OverviewModule
            refreshTrigger={refreshTrigger}
            onNavigate={setActiveNav}
            onInspectService={(svcId) => {
              setSelectedServiceId(svcId);
              setTopologySubTab('graph');
              setActiveNav('topology');
            }}
            onRunFullDemo={handleRunFullDemo}
            isDemoRunning={false}
          />
        )}

        {activeNav === 'topology' && (
          <DependencyGraphModule
            refreshTrigger={refreshTrigger}
            selectedServiceId={selectedServiceId}
            onSelectService={setSelectedServiceId}
            initialSubTab={topologySubTab}
            onNavigateToSimulator={(svcId) => {
              setSimTargetServiceId(svcId);
              setSimulatorSubTab('whatif');
              setActiveNav('simulator');
            }}
          />
        )}

        {activeNav === 'predictive' && (
          <PredictiveIntelligenceModule refreshTrigger={refreshTrigger} services={services} />
        )}

        {activeNav === 'simulator' && (
          <FailureSimulatorModule
            services={services}
            initialTargetServiceId={simTargetServiceId}
            initialSubTab={simulatorSubTab}
            onDataChanged={refreshSummary}
            onOpenTopology={() => {
              setTopologySubTab('graph');
              setActiveNav('topology');
            }}
            onOpenRecovery={() => setActiveNav('recovery')}
            autoStartFullDemoTrigger={autoDemoTrigger}
          />
        )}

        {activeNav === 'recovery' && (
          <RecoveryAdvisorModule
            refreshTrigger={refreshTrigger}
            onDataChanged={refreshSummary}
            onNavigateToSimulator={() => {
              setSimulatorSubTab('simulator');
              setActiveNav('simulator');
            }}
          />
        )}

        {activeNav === 'slo_readiness' && (
          <SloReadinessModule refreshTrigger={refreshTrigger} onDataChanged={refreshSummary} />
        )}

        {activeNav === 'transactions' && (
          <TransactionSafetyModule refreshTrigger={refreshTrigger} onDataChanged={refreshSummary} />
        )}

        {activeNav === 'incidents' && (
          <IncidentHistoryModule
            refreshTrigger={refreshTrigger}
            services={services}
            globalSearch={globalSearch}
          />
        )}

        {activeNav === 'reports' && (
          <ResilienceReportsModule refreshTrigger={refreshTrigger} initialTab={reportsSubTab} />
        )}

        {activeNav === 'architecture' && <ContinuityArchitectureModule />}

        {activeNav === 'settings' && (
          <SettingsModule
            refreshTrigger={refreshTrigger}
            services={services}
            onDataChanged={refreshSummary}
            onRunFullDemo={handleRunFullDemo}
            onOpenPredictive={() => setActiveNav('predictive')}
            onOpenIncidents={() => setActiveNav('incidents')}
          />
        )}
      </ShellLayout>

      <GeminiCopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </>
  );
}
