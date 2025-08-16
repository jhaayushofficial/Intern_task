# Relationship Visualizer

Visualize relationships between users and transactions using Neo4j (backend) and a React frontend.

## Tech Stack

- ⚡ Neo4j (Graph Database)
- 🔧 Express.js (Backend API)
- 🖥️ React + MUI + Cytoscape.js (Frontend Visualization)
- 🐳 Docker & Docker Compose (Deployment)

## Features

- Create and view users & transactions
- Auto-link users via shared email/phone/address/device
- Auto-link transactions via sender/receiver IP or sender/receiver Device ID
- Visualize graph relationships in real time
- REST APIs for all entities

## Getting started

1. Clone the repo

```powershell
git clone https://github.com/jhaayushofficial/Intern_task.git
cd Intern_task
```

2. Run with Docker (recommended)

```powershell
docker compose up -d --build
```

Open:

- Frontend: http://localhost:5173/
- API health: http://localhost:3000/health
- Neo4j Browser: http://localhost:7474/ (neo4j / Str0ngPass!)

Optional: auto-seed on start (dev)

Edit `docker-compose.yml` under backend.environment:

```yaml
AUTO_GENERATE_DATA: "true"
GENERATE_MODE: "demo"
```

Then restart backend:

```powershell
docker compose up -d --build backend
```

3. Or run locally (without Docker)

Backend

```powershell
cd .\backend
npm install
"NEO4J_URI=bolt://localhost:7687`nNEO4J_USERNAME=neo4j`nNEO4J_PASSWORD=Str0ngPass!`nPORT=3000" | Out-File -Encoding utf8 .env
npm start
```

Frontend

```powershell
cd ..\frontend
npm install
npm run dev
```

## Data generation

Populate or re-populate the graph any time:

- Auto on backend startup (dev): set in `docker-compose.yml` (backend.environment)

  ```yaml
  AUTO_GENERATE_DATA: "true"
  GENERATE_MODE: "demo"
  ```

  Then restart the backend container.

- API trigger (when API is running):

  ```powershell
  Invoke-RestMethod -Method Post -Uri http://localhost:3000/admin/generate-data -Body (@{ mode = 'demo' } | ConvertTo-Json) -ContentType 'application/json'
  ```

- Script (inside container or locally):
  ```powershell
  # container
  docker compose exec backend node scripts/generateData.js demo
  # local
  cd .\backend; node scripts/generateData.js demo
  ```

## Useful endpoints

- GET /health — API + DB connectivity
- GET /users — List users
- GET /transactions — List transactions
- POST /admin/generate-data — Run constraints + demo seed + relationships (body: { mode: "demo" })

## Local development (optional)

Backend

```powershell
cd .\backend
npm install
# create .env with your Neo4j creds, e.g.:
# NEO4J_URI=bolt://localhost:7687
# NEO4J_USERNAME=neo4j
# NEO4J_PASSWORD=Str0ngPass!
# PORT=3000
npm start
```

Frontend

```powershell
cd .\frontend
npm install
npm run dev
```

## Troubleshooting (brief)

- Neo4j unhealthy on first boot: wait 60–120s and `docker compose logs -f neo4j`.
- Passwords: default is Str0ngPass! (compose sets NEO4J_AUTH and backend env accordingly).
- Validate compose: `docker compose config`.
- Reset all (wipes data):
  ```powershell
  docker compose down -v; docker compose up -d --build
  ```
