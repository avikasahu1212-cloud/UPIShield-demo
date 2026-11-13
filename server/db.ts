import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = path.resolve(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'upishield.sqlite');

export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tier TEXT NOT NULL,
      category TEXT NOT NULL,
      criticality TEXT NOT NULL,
      health_state TEXT NOT NULL,
      latency_ms REAL NOT NULL,
      base_latency_ms REAL NOT NULL,
      error_rate REAL NOT NULL,
      base_error_rate REAL NOT NULL,
      rps INTEGER NOT NULL,
      base_rps INTEGER NOT NULL,
      risk_score REAL NOT NULL,
      backup_service_id TEXT,
      pos_x INTEGER NOT NULL,
      pos_y INTEGER NOT NULL,
      description TEXT NOT NULL,
      sla_target REAL NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dependencies (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      dependency_type TEXT NOT NULL,
      weight REAL NOT NULL,
      protocol TEXT NOT NULL,
      description TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES services(id),
      FOREIGN KEY (target_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS historical_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      service_id TEXT NOT NULL,
      availability_pct REAL NOT NULL,
      avg_latency_ms REAL NOT NULL,
      p95_latency_ms REAL NOT NULL,
      error_rate_pct REAL NOT NULL,
      tx_volume INTEGER NOT NULL,
      incident_count INTEGER NOT NULL,
      is_synthetic INTEGER NOT NULL DEFAULT 1,
      UNIQUE(year, month, service_id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      service_id TEXT NOT NULL,
      failure_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      origin TEXT NOT NULL,
      started_at TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      resolved_at TEXT,
      duration_minutes INTEGER NOT NULL,
      mttd_seconds INTEGER NOT NULL,
      mttr_seconds INTEGER NOT NULL,
      latency_impact_ms REAL NOT NULL,
      error_rate_impact REAL NOT NULL,
      tx_at_risk INTEGER NOT NULL,
      financial_impact_inr REAL NOT NULL,
      root_cause TEXT NOT NULL,
      affected_services_json TEXT NOT NULL,
      summary TEXT NOT NULL,
      assigned_operator TEXT NOT NULL DEFAULT 'Priya Sharma (SRE Lead)',
      resolution_notes TEXT NOT NULL DEFAULT '',
      is_synthetic INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS incident_events (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      actor TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recovery_recommendations (
      id TEXT PRIMARY KEY,
      incident_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      title TEXT NOT NULL,
      reason TEXT NOT NULL,
      expected_benefit TEXT NOT NULL,
      estimated_risk TEXT NOT NULL,
      side_effects TEXT NOT NULL,
      required_approval TEXT NOT NULL,
      verification_condition TEXT NOT NULL,
      evidence_used_json TEXT NOT NULL DEFAULT '[]',
      historical_refs_json TEXT NOT NULL DEFAULT '[]',
      dependency_evidence TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      approved_by TEXT,
      executed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS recovery_actions (
      id TEXT PRIMARY KEY,
      recommendation_id TEXT NOT NULL,
      incident_id TEXT NOT NULL,
      action_title TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      status TEXT NOT NULL,
      verification_result TEXT NOT NULL,
      pre_health_json TEXT NOT NULL,
      post_health_json TEXT NOT NULL,
      executed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT NOT NULL,
      payer_vpa TEXT NOT NULL,
      payee_vpa TEXT NOT NULL,
      amount_inr REAL NOT NULL,
      status TEXT NOT NULL,
      gateway_service_id TEXT NOT NULL,
      incident_id TEXT,
      response_lost INTEGER NOT NULL DEFAULT 0,
      verification_status TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      audit_trail_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS case_studies (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      label TEXT NOT NULL,
      root_cause TEXT NOT NULL,
      detection_method TEXT NOT NULL,
      services_affected_json TEXT NOT NULL,
      recommended_action TEXT NOT NULL,
      simulated_outcome TEXT NOT NULL,
      estimated_downtime_avoided_min INTEGER NOT NULL,
      estimated_tx_protected INTEGER NOT NULL,
      timeline_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Safe additive column migrations for pre-existing local SQLite databases
  const incCols = (db.prepare('PRAGMA table_info(incidents)').all() as Array<{ name: string }>).map((c) => c.name);
  if (!incCols.includes('assigned_operator')) {
    db.exec(`ALTER TABLE incidents ADD COLUMN assigned_operator TEXT NOT NULL DEFAULT 'Priya Sharma (SRE Lead)';`);
  }
  if (!incCols.includes('resolution_notes')) {
    db.exec(`ALTER TABLE incidents ADD COLUMN resolution_notes TEXT NOT NULL DEFAULT '';`);
  }

  const recCols = (db.prepare('PRAGMA table_info(recovery_recommendations)').all() as Array<{ name: string }>).map(
    (c) => c.name
  );
  if (!recCols.includes('evidence_used_json')) {
    db.exec(`ALTER TABLE recovery_recommendations ADD COLUMN evidence_used_json TEXT NOT NULL DEFAULT '[]';`);
  }
  if (!recCols.includes('historical_refs_json')) {
    db.exec(`ALTER TABLE recovery_recommendations ADD COLUMN historical_refs_json TEXT NOT NULL DEFAULT '[]';`);
  }
  if (!recCols.includes('dependency_evidence')) {
    db.exec(`ALTER TABLE recovery_recommendations ADD COLUMN dependency_evidence TEXT NOT NULL DEFAULT '';`);
  }
}
