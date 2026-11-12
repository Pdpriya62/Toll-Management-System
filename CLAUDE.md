# TollEase — Mini Toll Management System

Scaled-down build of the Enterprise TMS HLD (`../Enterprise_TMS_High_Level_Design (2).pdf`, workflow in `../TMS_Application_Workflow_v2.pdf`). Scope: one plaza, one lane, two roles (`operator`, `supervisor`).

## Layout
- `backend/` — Express + PostgreSQL + Socket.io (ES modules). Entry `src/index.js`.
  - Schema and seed: `src/models/schema.js` (single source of truth; runs on every startup).
  - Transaction state machine and fee lookup: `src/services/fee.js` (`TRANSITIONS`).
  - Audit writes: `src/services/audit.js` (`entity_type`, `entity_id`).
  - Auth: `src/middleware/auth.js` (`authMiddleware`, `roleMiddleware`).
- `frontend/` — React + Vite + Tailwind + Recharts. API client `src/services/api.js`.
- `device-simulator/simulate.js` — fires mock lane events at the API.
- `ocr-service/main.py` — FastAPI + Tesseract plate OCR on port 8001 (not wired to anything yet).
- `docker-compose.yml` — postgres, backend (3001), frontend/nginx (5173), ocr-service (8001).

## Run
First copy `.env.example` to `.env` (for compose) and `backend/.env.example` to `backend/.env` (for local backend), then fill in `JWT_SECRET` and `DB_PASSWORD`.
```bash
docker compose up --build          # everything
# or locally:
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
cd device-simulator && npm install && node simulate.js
```
Dev logins (seeded in `schema.js`): `supervisor` / `admin123`, `operator` / `op123`.

Schema uses `CREATE TABLE IF NOT EXISTS`, so column changes do NOT reach an existing DB. Reset with `docker compose down -v` until migrations exist.

## Datasets (no real cameras — recorded data stands in for them)
`datasets/` is gitignored. Rebuild with `pip install huggingface_hub pandas pyarrow && python scripts/fetch_datasets.py`.
- `datasets/plates/` — 1,709 Indian plate images + `labels.csv` (`file, plate_text, xmin, ymin, xmax, ymax`). Source: Hugging Face `zenitsu09/indian-number-plate` (no licence stated — local testing only, do not redistribute). Many images are 3 augmented copies of one plate.
- `datasets/scenes/` — 882 vehicle/road photos with plate boxes in `_annotations.coco.json`. Source: `keremberke/license-plate-object-detection` test split (Roboflow "Vehicle Registration Plates", CC BY 4.0, mostly non-Indian plates).
- Vehicle class detection needs no dataset: use a COCO-pretrained YOLOv8 (`car`, `bus`, `truck`, `motorcycle`).
- Videos: not downloaded (Pexels/Pixabay need manual download or an API key). Put clips in `datasets/videos/`.

Camera stand-ins: image folder (simulator), video file (`cv2.VideoCapture`), webcam / OBS Virtual Camera / phone-as-webcam (browser `getUserMedia`).

Privacy: real plate numbers are personal data. Keep dataset images out of git, README and screenshots; use synthetic plates for anything published.

## Conventions
- Transaction statuses, payment modes and vehicle classes are UPPERCASE (`INITIATED`, `CASH`, `CAR`).
- Status changes go through `transitionTransaction` only; every change writes an audit row.

## TODO

### P0 — broken / unsafe
- [x] Merge duplicate schema (`config/init-db.js` deleted; `models/schema.js` now has `users.full_name`, `transactions.updated_at`, `transactions.shift_id`, `shifts`, `audit_log.entity_type/entity_id`, seed users).
- [x] Lock account creation: public `/register` removed; `GET/POST /api/auth/users` supervisor-only, password min 8 chars. Tests in `backend/test/auth.test.js` (`npm test`).
- [x] `JWT_SECRET` and `DB_PASSWORD` come from `.env` only (`.env.example`, `backend/.env.example`); backend throws on startup if `JWT_SECRET` is missing; compose refuses to start without both. Old hardcoded values remain in git history but are no longer used.
- [ ] Restrict CORS (`cors()` in `index.js`, `origin: '*'` in `sockets/lane.js`, ocr-service).
- [x] Add routes the frontend called but backend lacked: `/api/auth/change-password`, `GET/POST /api/auth/users`. (No UI uses them yet — add a user-management page.)
- [ ] End-to-end smoke run: compose up, login, simulator, transaction to `SETTLED`, dashboard updates.

### P1 — half-built features
- [ ] Shift open/close endpoints (`POST /shifts/open`, `/shifts/:id/close`) with declared-vs-system cash; set `transactions.shift_id`.
- [ ] Wire OCR into the operator console (upload/capture, auto-fill `vehicle_number`).
- [ ] Fix OCR regex: `INDIAN_PLATE_PATTERN` is anchored `^…$`, so OCR noise breaks matches.
- [ ] Immutable audit log (trigger or `REVOKE UPDATE, DELETE`).
- [ ] Input validation (zod / express-validator) on lane, rate, vehicle routes.
- [ ] Plaza and lane CRUD.
- [ ] Exceptions list on supervisor dashboard (resolve / void).
- [ ] Move `PATCH /api/lanes/:id/transition` to `/api/transactions/:id/transition` (it takes a transaction id).

### P1b — camera / vision (dataset-driven)
- [x] Download test datasets (`scripts/fetch_datasets.py`).
- [ ] OpenCV plate localisation in `ocr-service` (`opencv-python-headless`): gray, bilateral, Canny, 4-corner contour, crop, Otsu; Tesseract `--psm 7`; return `bbox`.
- [ ] Save plate crop to `evidence/<uuid>.jpg`, return path as `evidence_ref`.
- [ ] Simulator mode: pick image from `datasets/plates/`, call `/ocr`, post lane event with OCR plate + evidence.
- [ ] Video source: `cv2.VideoCapture` on a file in `datasets/videos/`, sample every N frames.
- [ ] Browser camera in operator console (`getUserMedia`) + upload-photo fallback; nginx `location /ocr/` proxy to `ocr-service:8001`.
- [ ] Vehicle class from image (YOLOv8 COCO) mapped to rate classes; flag mismatch vs operator-chosen class.
- [ ] Accuracy script: run `datasets/plates` through `/ocr`, compare with `labels.csv`, report exact-match % and character accuracy.
- [ ] Synthetic Indian plate generator (PIL + blur/tilt/noise) for publishable demos and blacklist cases.
- [ ] Seed 2–3 dataset plates into blacklist/exempt for demo.

### P2 — quality
- [ ] Tests: `TRANSITIONS`, `calculateFee`, role guards (operator gets 403 on `POST /api/rates`).
- [ ] GitHub Actions CI (lint + test).
- [ ] Real migrations (node-pg-migrate) instead of startup `CREATE TABLE IF NOT EXISTS`.
- [ ] Rate limit `/api/auth/login`.
- [ ] `VITE_API_BASE` is read at build time; pass as Docker build arg, not runtime env.
- [ ] Rename `README (2).md` to `README.md`; document real run steps and logins.

### P3 — HLD stretch
- [ ] Blacklist hit flow in operator UI (alert, barrier stays closed).
- [ ] Offline queue and replay on DB reconnect.
- [ ] Monthly pass; return journey detection.
- [ ] Device health page (simulator heartbeats).
- [ ] FASTag mock wallet debit.

## History
Older attempts (`toll/` static HTML prototype, `toll.2/` admin+transporter portal with FastAPI auth) and the duplicate HLD `.docx` were moved to the Windows Recycle Bin on 2026-11-12.
