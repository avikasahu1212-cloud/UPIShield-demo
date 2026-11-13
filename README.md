# UPIShield

**Predict disruptions. Prevent cascades. Protect payment continuity.**

UPIShield is an enterprise payment infrastructure resilience, dependency topology, predictive failure intelligence, cascade simulation, and recovery platform designed for banks, payment operations teams, and site reliability engineering (SRE) organizations.

> **Demonstration Disclaimer:** All metrics, historical 2022–2026 datasets, transaction samples, and counterfactual case studies shipped with UPIShield are **SYNTHETIC DEMONSTRATION DATA — NOT ACTUAL BANK INCIDENT RECORDS**.

---

## Core Modules

1. **Resilience Command Center (`/`)**: Real-time infrastructure health score, payment availability %, active incidents, MTTD/MTTR, operational trends, critical alerts, 30-day risk forecast, and chronological operational events.
2. **Live Infrastructure Dependency Graph**: Interactive zoom/pan topology across 12 banking infrastructure services and 19 directed dependencies, node inspector, upstream/downstream highlighting, animated traffic pulses, blast radius overlay, and live vs. historical incident snapshot replay.
3. **Predictive Failure Intelligence**: Transparent, explainable local statistical analytics over 2022–2026 synthetic records (seasonal monthly z-score anomaly detection, OLS latency & error-rate slopes, graph centrality scoring) with 7-day / 30-day outlooks, monthly incident heatmap, forecast-vs-actual charts, and a 6-question explainable prediction panel.
4. **Failure Detection & Cascade Simulator**: Inject simulated outages (API timeout, DB overload, cloud provider outage, gateway degradation, etc.), compute deterministic BFS cascade impact, and run the 12-step guided **"RUN FULL RESILIENCE DEMO"** sequence.
5. **AI Recovery Advisor**: Operator-in-the-loop approval workflow with risk/benefit/side-effect analysis, simulated recovery execution, verification checks, and timestamped MTTD/MTTR timelines.
6. **Transaction Safety & Resilience Analytics**: Idempotency key validation, response-loss safe hold (`UNKNOWN_RESPONSE_LOST`), duplicate debit prevention, and core-ledger status verification.
7. **Incident History, Counterfactual Case Studies & Reports**: Filterable incident ledger, synthetic prevented-disruption case studies, CSV/JSON report export, and optional Gemini SRE Copilot + executive visual generator.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Recharts, Lucide Icons
- **Backend**: Node.js 22+, Express 4, REST APIs
- **Database**: Persistent SQLite via Node 22 built-in `node:sqlite` (`./data/upishield.sqlite`)
- **Optional AI Capabilities**: `@google/genai` (server-side only, optional — all core resilience analytics, graph blast radius, and simulations run locally without external paid APIs)

---

## Prerequisites

- **Node.js**: `>= 22.18.0` (tested on `v22.23.2` with built-in `node:sqlite` and native TypeScript stripping)
- **npm**: `>= 10.x`

---

## Installation & Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment variables** (see `.env.example`):
   Copy `.env.example` to `.env` if running locally with optional Gemini Copilot features:
   ```bash
   cp .env.example .env
   ```
   - `GEMINI_API_KEY`: Optional. Only required for the optional Gemini SRE Copilot drawer and Executive Visual Generator. All core modules work locally without it.
   - `PORT`: Optional server port (defaults to `3000`).

3. **Database & Seed Data**:
   The SQLite database (`./data/upishield.sqlite`) is automatically initialized and deterministically seeded on first server boot with:
   - 12 banking infrastructure services & 19 directed dependency edges
   - 2022–2026 monthly synthetic historical metrics (including recurring October stress signals)
   - Synthetic historical incidents, counterfactual case studies, and sample transactions

   To reset live simulations back to the clean baseline at any time, click **Reset Demo State** in the UI or call:
   ```bash
   curl -X POST http://localhost:3000/api/simulator/reset
   ```

---

## Running the Application

### Development Mode (Express + Vite HMR Middleware)
```bash
npm run dev
```
Open `http://localhost:3000`.

### Production Build & Start
```bash
npm run build
NODE_ENV=production npm start
```

---

## Verification & Testing

1. **Type-checking**:
   ```bash
   npm run lint
   ```
2. **Production bundle verification**:
   ```bash
   npm run build
   ```
3. **End-to-end API smoke check**:
   - `GET /api/overview` returns Command Center KPIs and 12 services.
   - `GET /api/topology` returns structured nodes and directed edges.
   - `GET /api/predictions` detects the synthetic October anomaly (`zScore >= 1.5`) from stored records.
   - `POST /api/simulator/inject` -> `POST /api/recommendations/:id/approve` -> `POST /api/simulator/reset` verifies full incident lifecycle without duplicate records.
   - `POST /api/transactions/simulate-response-loss` -> `POST /api/transactions/:id/verify` verifies safe handling of response-loss without duplicate debits.

---

## Connecting to GitHub

This repository is initialized locally with Git. To push to your own GitHub repository:

```bash
git remote add origin https://github.com/<your-org>/upishield.git
git branch -M main
git push -u origin main
```
