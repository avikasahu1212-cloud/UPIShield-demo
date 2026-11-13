import type { IncidentSeverity, ServiceHealthState } from '../types.ts';

export function formatInrCompact(amount: number): string {
  if (amount >= 10000000) {
    return `INR ${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `INR ${(amount / 100000).toFixed(2)} L`;
  }
  return `INR ${amount.toLocaleString('en-IN')}`;
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

export function formatDurationSeconds(sec: number): string {
  if (sec <= 0) return '0s';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export const HEALTH_META: Record<
  ServiceHealthState,
  {
    label: string;
    shortLabel: string;
    stroke: string;
    fill: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  GREEN: {
    label: 'Healthy',
    shortLabel: 'HEALTHY',
    stroke: '#10B981',
    fill: 'rgba(16, 185, 129, 0.12)',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/30',
  },
  YELLOW: {
    label: 'Degraded',
    shortLabel: 'DEGRADED',
    stroke: '#F59E0B',
    fill: 'rgba(245, 158, 11, 0.14)',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/30',
  },
  RED: {
    label: 'Failed',
    shortLabel: 'FAILED',
    stroke: '#EF4444',
    fill: 'rgba(239, 68, 68, 0.16)',
    badgeBg: 'bg-red-500/10',
    badgeText: 'text-red-400',
    badgeBorder: 'border-red-500/30',
  },
  BLUE: {
    label: 'Recovering',
    shortLabel: 'RECOVERING',
    stroke: '#38BDF8',
    fill: 'rgba(56, 189, 248, 0.14)',
    badgeBg: 'bg-sky-500/10',
    badgeText: 'text-sky-400',
    badgeBorder: 'border-sky-500/30',
  },
  GREY: {
    label: 'Unknown',
    shortLabel: 'UNKNOWN',
    stroke: '#64748B',
    fill: 'rgba(100, 116, 139, 0.14)',
    badgeBg: 'bg-slate-500/10',
    badgeText: 'text-slate-400',
    badgeBorder: 'border-slate-500/30',
  },
};

export function severityClass(sev: IncidentSeverity | string): string {
  switch (sev) {
    case 'CRITICAL':
      return 'text-red-400';
    case 'HIGH':
      return 'text-amber-400';
    case 'MEDIUM':
      return 'text-sky-400';
    default:
      return 'text-slate-400';
  }
}
