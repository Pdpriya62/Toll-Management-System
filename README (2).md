# TollEase — Mini Toll Management System (Practice Project)

A solo-buildable version of an enterprise Toll Management System, scoped down from
a real 55-page HLD (multi-plaza, MLFF-ready, HA Postgres, six-layer architecture)
to **one plaza, one lane, one machine** — while keeping the same architectural shape:
simulated hardware → API → business logic → database → role-based frontends.

The goal isn't to build the enterprise system. It's to build something small that
*teaches you* the same concepts the enterprise system uses: layered architecture,
role-based access, a transaction state machine, event-driven device simulation,
and (optionally) a real OCR pipeline for number-plate recognition.

---

## 1. Why this scope

| Enterprise HLD | This project |
|---|---|
| N plazas, HA plaza servers, DR site | 1 plaza, 1 lane, runs on your laptop |
| RFID/ANPR/AVC/weighbridge hardware via HAL | A device **simulator** script that emits the same event shapes |
| VAHAN, NETC, Kotak Bank, SMS gateways | Mocked / stubbed integrations |
| Microservices behind an API gateway | One Express monolith, split into modules (still microservice-*shaped*) |
| PostgreSQL HA cluster + read replicas | Single PostgreSQL instance |
| MLFF / gantry phase 2 | Out of scope — good "if I extend this" talking point |

Everything you keep — layers, RBAC, transaction lifecycle, audit logging, evidence
tagging — is exactly what shows up in a real systems-design interview or a resume
bullet. Everything you cut is infrastructure, not concepts.

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React + Vite + TailwindCSS** | Same stack as your MindBridge project — reinforces what you already know, fast dev loop |
| Real-time updates | **Socket.io** | Lane status and dashboard counters need to update live, not on refresh — good intro to WebSockets |
| Backend | **Node.js + Express** | REST API, consistent with your existing backend experience |
| Database | **PostgreSQL** | The HLD uses Postgres — good chance to move off MySQL and learn something new (JSONB for flexible config, window functions for reports) |
| Auth | **JWT + bcrypt** | Mirrors the HLD's RBAC model — operator vs. supervisor roles, protected routes |
| Device simulation | **Node script (or Python)** | Emits fake RFID/ANPR/barrier events over HTTP/WebSocket into your API — stands in for the Hardware Abstraction Layer |
| Charts/reports | **Recharts** | Revenue, traffic, and shift reports on the supervisor dashboard |
| Optional AI/ML module | **Python + Tesseract OCR (or a small CNN)** | Real number-plate OCR from an uploaded image — ties directly into your AI/ML coursework and gives the project an actual "AI" component instead of just CRUD |
| Containers | **Docker Compose** | Postgres + backend + frontend as three services — good practice for something you haven't done yet |

You don't need all of this on day one — see the phased plan in Section 5.

---

## 3. Architecture

Five layers, same order as the enterprise HLD, collapsed to fit one machine:

1. **Simulated device layer** — a script that fires mock RFID reads, ANPR plate
   captures, and barrier acknowledgements at your API, the same way real lane
   hardware would through a HAL.
2. **API layer** — Express REST endpoints + a Socket.io channel for live lane/dashboard
   updates.
3. **Business logic services** — fee calculation, transaction lifecycle (INITIATED →
   VALIDATED → AUTHORIZED → COMPLETED → SETTLED), auth/RBAC, shift management.
4. **Database** — PostgreSQL: plazas, lanes, users, rate cards, transactions.
5. **Frontends** — two role-based React apps (or two routes behind role guards):
   an **operator console** (single-lane, fast, real-time) and a **supervisor
   dashboard** (traffic, revenue, reports) — mirroring the two-channel split in
   the original HLD's Section 6.

```
Device simulator → Express API (+ Socket.io) → Business logic → PostgreSQL
                                                        ↑
                                    Operator console · Supervisor dashboard
```

---

## 4. Core modules (MVP)

- **Auth & roles** — login, JWT, two roles (`operator`, `supervisor`)
- **Lane simulation** — a single lane that "detects" a vehicle (mock RFID/ANPR event),
  looks up a rate, computes a fee, opens/closes a virtual barrier
- **Transaction management** — every event becomes a transaction row with a lifecycle
  state, timestamp, and (optionally) a fake evidence reference
- **Rate management** — CRUD on a simple rate table (vehicle class → fee)
- **Cash/QR toggle** — simulate two payment modes without a real payment gateway
- **Supervisor dashboard** — live lane status, today's traffic count, revenue total,
  a simple exceptions list
- **Reports** — daily transaction log, exportable as CSV

## Stretch goals (once the MVP works)

- Real ANPR: upload a photo of a number plate, run OCR, auto-fill the vehicle ID
- Blacklist/exempt vehicle check
- Shift open/close with declared-vs-system cash comparison
- Immutable audit log (append-only table, no updates/deletes)
- Docker Compose for one-command local spin-up
- Offline-mode simulation: kill the DB connection, queue transactions locally, replay on reconnect

---

## 5. Suggested build order

1. **Week 1** — Postgres schema (plazas, lanes, users, rate_cards, transactions) + Express skeleton + JWT auth
2. **Week 2** — Device simulator script + `/api/lane/event` endpoint + fee calculation logic
3. **Week 3** — Operator console (React) wired to the API + Socket.io live updates
4. **Week 4** — Supervisor dashboard + reports + rate management CRUD
5. **Week 5+** — Pick one stretch goal (OCR is the most fun given your AI/ML track)

---

## 6. Suggested folder structure

```
tollease/
├── backend/
│   ├── src/
│   │   ├── routes/          # auth, lanes, transactions, rates, reports
│   │   ├── services/        # fee calculation, transaction lifecycle
│   │   ├── models/          # Postgres queries (or an ORM like Prisma)
│   │   ├── sockets/         # Socket.io event handlers
│   │   └── middleware/      # auth guard, role guard
│   └── package.json
├── device-simulator/
│   └── simulate.js          # fires mock RFID/ANPR/barrier events
├── frontend/
│   ├── src/
│   │   ├── pages/operator/
│   │   ├── pages/supervisor/
│   │   └── components/
│   └── package.json
├── ocr-service/              # optional Python microservice
│   └── app.py
└── docker-compose.yml
```

---

## 7. Getting started (fill in as you build)

```bash
# 1. Database
docker run --name tollease-db -e POSTGRES_PASSWORD=devpass -p 5432:5432 -d postgres:16

# 2. Backend
cd backend && npm install && npm run dev

# 3. Frontend
cd frontend && npm install && npm run dev

# 4. Device simulator
cd device-simulator && node simulate.js
```

---

## 8. What this project demonstrates

- Layered / API-first architecture on a small scale
- Role-based access control
- A real transaction state machine (not just a CRUD table)
- Event-driven design (device simulator → API → live dashboard)
- PostgreSQL fundamentals
- Optionally: a genuine ML/OCR component tying back to your AI/ML specialization
