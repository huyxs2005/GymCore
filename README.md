# GymCore

GymCore is a full-stack gym management system with:
- Backend: Spring Boot 4
- Frontend: React 19 + Vite + Tailwind
- Database: Microsoft SQL Server
- E2E: Playwright

## Project Structure
- `backend` - Spring Boot API
- `frontend` - React app
- `docs/GymCore.txt` - fresh SQL schema
- `docs/alter.txt` - idempotent alter script
- `docs/InsertValues.txt` - baseline seed data
- `docs/InsertTestingValues.txt` - extra local demo/test data
- `seed-db.ps1` - PowerShell helper to drop and reseed the database
- `verify-local.ps1` - PowerShell helper to run local verification

## Prerequisites
1. Java 21
2. Node.js 20+ with npm
3. Microsoft SQL Server
4. `sqlcmd` available in `PATH`
5. Playwright browsers installed

## Local Setup
1. Install root Playwright dependencies:
```powershell
cd D:\project
npm install
```
2. Install frontend dependencies:
```powershell
cd D:\project\frontend
npm install
```
3. Seed the database from scratch:
```powershell
cd D:\project
.\seed-db.ps1
```
4. Optional: create local env files from the examples:
- `backend/.env.example` -> `backend/.env.local`
- `frontend/.env.example` -> `frontend/.env.local`

## Default Local SQL Settings
- Server: `tcp:localhost,1433`
- Database: `GymCore`
- Username: `sa`
- Password: `5`

The backend now supports overriding DB settings with environment variables:
- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`

## Run The App
Use the helper script:
```powershell
cd D:\project
.\start-dev.ps1
```

This starts:
- Backend: `http://localhost:8080`
- Frontend: `http://127.0.0.1:5173`

## Full Local Verification
Run everything in sequence:
```powershell
cd D:\project
.\verify-local.ps1
```

Manual command equivalents:
```powershell
cd D:\project\frontend
npm run lint
npm run build
npm run test:run

cd D:\project\backend
.\mvnw.cmd test

cd D:\project
npx playwright test --config playwright.config.js --workers=1
```

## Seeded Demo Accounts
- Admin: `admin@gymcore.local` / `Admin123456!`
- Receptionist: `reception@gymcore.local` / `Reception123456!`
- Coach: `coach@gymcore.local` / `Coach123456!`
- Customer: `customer@gymcore.local` / `Customer123456!`

## Important Current Business Rules
- Product reviews unlock only after pickup is confirmed.
- The PT booking AI assistant uses the same matching rules as the real PT booking flow.
- Google login is optional and appears only when `VITE_GOOGLE_CLIENT_ID` is configured.

## Optional Integrations
These are optional for local development, but needed to test the real external flows:
- Google login:
  - Frontend: `VITE_GOOGLE_CLIENT_ID`
  - Backend: `APP_AUTH_GOOGLE_CLIENT_ID`
- Email:
  - `MAIL_HOST`
  - `MAIL_PORT`
  - `MAIL_USERNAME`
  - `MAIL_PASSWORD`
  - `MAIL_FROM`
- PayOS:
  - `PAYOS_CLIENT_ID`
  - `PAYOS_API_KEY`
  - `PAYOS_CHECKSUM_KEY`
  - `PAYOS_BASE_URL`
  - `PAYOS_RETURN_URL`
  - `PAYOS_CANCEL_URL`

## Additional Handoff Notes
- `docs/LOCAL_SETUP_AND_VERIFY.txt`
- `docs/CODING_AGENT_PROMPT.txt`
- `docs/DEMO_SCRIPT_15_MIN.txt`
- `docs/CHANGE_SUMMARY.txt`
