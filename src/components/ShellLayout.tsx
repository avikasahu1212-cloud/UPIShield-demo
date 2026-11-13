import React, { useState } from 'react';
import {
  Activity,
  Bell,
  Bot,
  BrainCircuit,
  FileBarChart2,
  Gauge,
  History,
  Layers,
  Menu,
  Network,
  Presentation,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  User,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

export type NavSection =
  | 'overview'
  | 'topology'
  | 'predictive'
  | 'simulator'
  | 'recovery'
  | 'slo_readiness'
  | 'transactions'
  | 'incidents'
  | 'reports'
  | 'architecture'
  | 'settings';

interface ShellLayoutProps {
  activeNav: NavSection;
  onNavigate: (nav: NavSection) => void;
  activeIncidentCount: number;
  pendingRecCount: number;
  globalSearch: string;
  onGlobalSearchChange: (value: string) => void;
  onOpenCopilot: () => void;
  onRunFullDemo: () => void;
  onStartExecutiveDemo: () => void;
  executiveDemoActive: boolean;
  isDemoRunning: boolean;
  demoBanner?: React.ReactNode;
  children: React.ReactNode;
}

const NAV_GROUPS: Array<{
  group: string;
  items: Array<{ id: NavSection; label: string; icon: React.FC<{ className?: string }> }>;
}> = [
  {
    group: 'OPERATIONS',
    items: [
      { id: 'overview', label: 'Command Center', icon: Activity },
      { id: 'topology', label: 'Dependencies & SPOF', icon: Network },
      { id: 'simulator', label: 'Simulator & What-If', icon: Zap },
      { id: 'recovery', label: 'Recovery Advisor', icon: Wrench },
    ],
  },
  {
    group: 'INTELLIGENCE & SRE',
    items: [
      { id: 'predictive', label: 'Predictive Risk', icon: BrainCircuit },
      { id: 'slo_readiness', label: 'SLO & Readiness', icon: Gauge },
      { id: 'transactions', label: 'Transaction Safety', icon: ShieldCheck },
    ],
  },
  {
    group: 'GOVERNANCE & ARCHITECTURE',
    items: [
      { id: 'incidents', label: 'Incident Management', icon: History },
      { id: 'reports', label: 'Executive Reports', icon: FileBarChart2 },
      { id: 'architecture', label: 'How UPIShield Works', icon: Layers },
      { id: 'settings', label: 'Demo & Audit Control', icon: Settings },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export const ShellLayout: React.FC<ShellLayoutProps> = ({
  activeNav,
  onNavigate,
  activeIncidentCount,
  pendingRecCount,
  globalSearch,
  onGlobalSearchChange,
  onOpenCopilot,
  onRunFullDemo,
  onStartExecutiveDemo,
  executiveDemoActive,
  isDemoRunning,
  demoBanner,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const activeTitle = ALL_NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? 'Command Center';

  return (
    <div className="min-h-screen bg-[#060A14] text-slate-100 flex print:block print:bg-white">
      {/* Persistent Left Sidebar (Desktop) */}
      <aside className="hidden lg:flex lg:w-[252px] lg:flex-col lg:fixed lg:inset-y-0 bg-[#0A0F1E] border-r border-slate-800/80 z-30 print:hidden">
        <div className="h-14 px-5 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-blue-600/15 border border-blue-500/40 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="font-display text-base font-semibold tracking-tight text-white whitespace-nowrap">
              UPIShield
            </span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">v2.4 ENT</span>
        </div>

        <div className="px-4 py-2.5 border-b border-slate-800/60 bg-amber-500/5">
          <p className="text-[10px] font-mono font-semibold text-amber-300 tracking-wider">
            DEMO ENVIRONMENT
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
            Synthetic bank topology & telemetry
          </p>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto" aria-label="Primary Navigation">
          {NAV_GROUPS.map((grp) => (
            <div key={grp.group} className="space-y-0.5">
              <p className="px-3 pb-1 text-[10px] font-mono font-semibold tracking-wider text-slate-500">
                {grp.group}
              </p>
              {grp.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                const badgeCount =
                  item.id === 'incidents'
                    ? activeIncidentCount
                    : item.id === 'recovery'
                    ? pendingRecCount
                    : 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-blue-600/15 text-cyan-300 border border-blue-500/30'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badgeCount > 0 && (
                      <span className="font-mono text-[11px] font-semibold text-amber-300 ml-2 tabular-nums">
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3.5 border-t border-slate-800/80 space-y-2">
          <button
            type="button"
            onClick={onStartExecutiveDemo}
            className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold tracking-wide transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 ${
              executiveDemoActive
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-[#0C1222] border-slate-700 hover:border-cyan-500/40 text-slate-100'
            }`}
          >
            <Presentation className="w-3.5 h-3.5 text-cyan-400" />
            Executive Demo (8 Steps)
          </button>
          <button
            type="button"
            onClick={onRunFullDemo}
            disabled={isDemoRunning}
            className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer whitespace-nowrap"
          >
            {isDemoRunning ? 'SIMULATION RUNNING...' : 'Run Auto-Simulation'}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex print:hidden">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 bg-[#0A0F1E] border-r border-slate-800 flex flex-col z-10">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-800">
              <span className="font-display text-base font-semibold text-white">UPIShield</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-white"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-3 overflow-y-auto">
              {NAV_GROUPS.map((grp) => (
                <div key={grp.group} className="space-y-0.5">
                  <p className="px-3 pb-1 text-[10px] font-mono font-semibold text-slate-500">{grp.group}</p>
                  {grp.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onNavigate(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                          isActive ? 'bg-blue-600/15 text-cyan-300' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[252px] flex flex-col min-w-0 print:pl-0">
        {/* Top Status Bar */}
        <header className="sticky top-0 z-20 h-14 bg-[#060A14]/95 backdrop-blur border-b border-slate-800/80 px-4 lg:px-6 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline">UPIShield</span>
              <span className="text-slate-700 hidden sm:inline">/</span>
              <h1 className="font-display font-semibold text-slate-100 truncate">{activeTitle}</h1>
              <span className="hidden md:inline text-slate-700">·</span>
              <span className="hidden md:inline text-[11px] font-mono text-amber-300/90 whitespace-nowrap">
                DEMO ENVIRONMENT
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Global Search */}
            <div className="relative hidden md:block w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => onGlobalSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && globalSearch.trim()) {
                    onNavigate('incidents');
                  }
                }}
                placeholder="Search incidents or services..."
                aria-label="Global search"
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#0C1222] border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Executive Demo Shortcut */}
            <button
              type="button"
              onClick={onStartExecutiveDemo}
              className={`h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                executiveDemoActive
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-[#0C1222] border-slate-800 hover:border-cyan-500/40 text-slate-200'
              }`}
            >
              <Presentation className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xl:inline">Executive Demo</span>
            </button>

            {/* Incident Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  setProfileMenuOpen(false);
                }}
                aria-label="Incident notifications"
                className="relative h-8 px-2.5 rounded-lg bg-[#0C1222] border border-slate-800 hover:border-slate-700 flex items-center gap-2 text-xs text-slate-300 cursor-pointer whitespace-nowrap"
              >
                <Bell className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono tabular-nums font-medium">
                  {activeIncidentCount > 0 ? `${activeIncidentCount} Active` : 'Nominal'}
                </span>
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0C1222] border border-slate-800 shadow-2xl p-4 z-40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-200">Platform Alerts</span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      Close
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    {activeIncidentCount > 0
                      ? `${activeIncidentCount} simulated incident(s) active and ${pendingRecCount} recovery action(s) awaiting operator approval.`
                      : 'All 12 monitored infrastructure services are currently in nominal GREEN baseline.'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        onNavigate(pendingRecCount > 0 ? 'recovery' : 'incidents');
                      }}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600/20 border border-blue-500/30 text-xs font-medium text-cyan-300 hover:bg-blue-600/30 cursor-pointer"
                    >
                      {pendingRecCount > 0 ? 'Review Recovery' : 'View Incidents'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Gemini SRE Copilot Trigger */}
            <button
              type="button"
              onClick={onOpenCopilot}
              className="h-8 px-2.5 rounded-lg bg-[#0C1222] border border-slate-800 hover:border-cyan-500/40 text-xs font-medium text-cyan-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SRE Copilot</span>
            </button>

            {/* Operator Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((prev) => !prev);
                  setNotifOpen(false);
                }}
                aria-label="Operator menu"
                className="h-8 px-2.5 rounded-lg bg-[#0C1222] border border-slate-800 hover:border-slate-700 flex items-center gap-2 text-xs text-slate-300 cursor-pointer whitespace-nowrap"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden xl:inline">P. Sharma · SRE</span>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl bg-[#0C1222] border border-slate-800 shadow-2xl p-3 z-40 text-xs">
                  <p className="font-semibold text-slate-100">Priya Sharma</p>
                  <p className="text-slate-400 mt-0.5">VP Payment Infrastructure & SRE</p>
                  <div className="my-2.5 border-t border-slate-800" />
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onNavigate('settings');
                    }}
                    className="w-full text-left py-1.5 px-2 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
                  >
                    Demo Controls & Audit Log
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onNavigate('reports');
                    }}
                    className="w-full text-left py-1.5 px-2 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
                  >
                    Executive Resilience Reports
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Optional Executive Guided Walkthrough Banner */}
        {demoBanner}

        {/* Main Viewport */}
        <main className="flex-1 p-4 lg:p-5 max-w-[1440px] w-full mx-auto print:p-0 print:max-w-none">
          {children}
        </main>
      </div>
    </div>
  );
};
