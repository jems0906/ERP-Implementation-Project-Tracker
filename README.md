# ERP Implementation Project Tracker

A lightweight browser-based project management dashboard for **SyteLine / CSI ERP implementations**.

## Included capabilities

- SyteLine implementation phases
- Manufacturing KPI dashboard (`OTIF`, inventory accuracy, schedule adherence)
- Milestone tracker with client signoff checkboxes
- Risk register with manufacturing-specific risks
- RACI matrix with 20+ ERP project roles
- SQL query library for data validation
- Executive and steering committee status report generator
- Editable project profile for client, plant, PM, go-live date, and budget health
- Workstream action tracker with owners and due dates
- Workshop agenda templates
- Change request workflow with impact analysis
- Go-live checklist and rollback plan
- Backup/export controls with backend persistence

## Run locally

### Option 1: Full backend mode

This mode enables persistent API-backed storage and export support.

```powershell
npm start
```

Then browse to `http://localhost:3000`.

### Option 1b: Windows quick start

```powershell
npm run start:local
```

### Option 2: Static-only mode

You can still open `index.html` directly, or run:

```powershell
python -m http.server 8000
```

Then browse to `http://localhost:8000`.

## Security and authentication

The tracker requires sign-in when running in backend mode and now supports **role-based access**.

### Seeded local users

| Username | Password | Role |
|---|---|---|
| `admin` | `ERPTracker!2026` | Full administration |
| `pm` | `ProjectLead!2026` | Project manager/editor |
| `exec` | `Executive!2026` | Executive viewer + report sender |
| `viewer` | `Viewer!2026` | Read-only access |

These are stored in `data/users.json` for local/demo use.

## Local demo mode

This project is now cleaned for **local demo use**. It stores data in `data/state.json` and writes simulated sent reports to `data/email-outbox`.

Generated outbox files are disposable demo artifacts and can be deleted at any time.

## Render deployment

This repo again includes a minimal `render.yaml` so it can be deployed from a **Render Blueprint**.

- Branch: `main`
- Blueprint path: `render.yaml`
- Build command: `npm install`
- Start command: `npm start`

Set `ERP_TRACKER_USERNAME` and `ERP_TRACKER_PASSWORD` in Render if you want custom login credentials.

## Files

- `index.html` — app structure
- `styles.css` — dashboard styling
- `app.js` — interactive logic, exports, authentication, and persistence handling
- `server.js` — lightweight Node backend for saved tracker data and authentication
- `data/state.json` — persisted project state
- `start-local.ps1` — Windows quick-launch script
