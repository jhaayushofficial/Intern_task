# Relationship Visualizer

Visualize relationships between users and transactions using Neo4j (backend) and a React frontend.

## Quick start (Docker)

```powershell
# from repo root
docker compose up -d --build
```

Open:

- Frontend: http://localhost:5173/
- API health: http://localhost:3000/health
- Neo4j Browser: http://localhost:7474/ (neo4j / Str0ngPass!)

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

## License

ISC
