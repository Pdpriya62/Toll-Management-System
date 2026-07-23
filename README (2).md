# TollEase — Mini Toll Management System (Practice Project)

A solo-buildable Toll Management System scoped to **one plaza, one lane, one machine** — while keeping a clean layered architecture: simulated hardware → API → business logic → database → role-based frontends.

The goal is to build something small that teaches layered architecture, role-based access, a transaction state machine, event-driven device simulation, and (optionally) a real OCR pipeline for number-plate recognition.

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React + Vite + TailwindCSS** | Fast dev loop, modern stack |
| Real-time updates | **Socket.io** | Lane status and dashboard counters update live — good intro to WebSockets |
| Backend | **Node.js + Express** | REST API, consistent with common backend experience |
| Database | **PostgreSQL** | Learn JSONB for flexible config, window functions for reports |
| Auth | **JWT + bcrypt** | Role-based access (operator vs. supervisor) |
| Device simulation | **Node script (or Python)** | Emits fake RFID/ANPR/barrier events over HTTP/WebSocket |
| Charts/reports | **Recharts** | Revenue, traffic, and shift reports on supervisor dashboard |
| Optional AI/ML module | **Python + Tesseract OCR (or a small CNN)** | Real number-plate OCR — gives the project an actual AI component |
| Containers | **Docker Compose** | Postgres + backend + frontend as three services |

You don't need all of this on day one — see the phased plan in Section 5.

---

## 2. Architecture

Five layers, collapsed to fit one machine:

1. **Simulated device layer** — a script that fires mock RFID reads, ANPR plate captures, and barrier acknowledgements at your API.
2. **API layer** — Express REST endpoints + a Socket.io channel for live lane/dashboard updates.
3. **Business logic services** — fee calculation, transaction lifecycle (INITIATED → VALIDATED → AUTHORIZED → COMPLETED → SETTLED), auth/RBAC, shift management.
4. **Database** — PostgreSQL: plazas, lanes, users, rate cards, transactions.
5. **Frontends** — two role-based React apps (or two routes behind role guards): an **operator console** (single-lane, fast, real-time) and a **supervisor dashboard** (traffic, revenue, reports).

```
Device simulator → Express API (+ Socket.io) → Business logic → PostgreSQL
                                                         ↑
                                     Operator console · Supervisor dashboard
```

---

## 3. Core Modules (MVP)

- **Auth & roles** — login, JWT, two roles (`operator`, `supervisor`)
- **Lane simulation** — a single lane that "detects" a vehicle (mock RFID/ANPR event), looks up a rate, computes a fee, opens/closes a virtual barrier
- **Transaction management** — every event becomes a transaction row with a lifecycle state, timestamp, and (optionally) a fake evidence reference
- **Rate management** — CRUD on a simple rate table (vehicle class → fee)
- **Cash/QR toggle** — simulate two payment modes without a real payment gateway
- **Supervisor dashboard** — live lane status, today's traffic count, revenue total, a simple exceptions list
- **Reports** — daily transaction log, exportable as CSV

## Stretch Goals (once the MVP works)

- Real ANPR: upload a photo of a number plate, run OCR, auto-fill the vehicle ID
- Blacklist/exempt vehicle check
- Shift open/close with declared-vs-system cash comparison
- Immutable audit log (append-only table, no updates/deletes)
- Docker Compose for one-command local spin-up
- Offline-mode simulation: kill the DB connection, queue transactions locally, replay on reconnect

---

## 4. Suggested Build Order

1. **Week 1** — Postgres schema (plazas, lanes, users, rate_cards, transactions) + Express skeleton + JWT auth
2. **Week 2** — Device simulator script + `/api/lane/event` endpoint + fee calculation logic
3. **Week 3** — Operator console (React) wired to the API + Socket.io live updates
4. **Week 4** — Supervisor dashboard + reports + rate management CRUD
5. **Week 5+** — Pick one stretch goal (OCR is the most fun given AI/ML coursework)

---

## 5. Suggested Folder Structure

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

## 6. Getting Started (fill in as you build)

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

## 7. What This Project Demonstrates

- Layered / API-first architecture on a small scale
- Role-based access control
- A real transaction state machine (not just a CRUD table)
- Event-driven design (device simulator → API → live dashboard)
- PostgreSQL fundamentals
- Optionally: a genuine ML/OCR component tying back to AI/ML specialization