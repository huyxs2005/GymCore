# GymCore

GymCore is a full-stack gym management project:
- Backend: Spring Boot
- Frontend: React (Vite)
- Database: Microsoft SQL Server

## Folder Layout
- `backend/backend`: Spring Boot app
- `frontend`: React app
- `docs/GymCore.txt`: database schema script
- `docs/InsertValues.txt`: sample data script
- `start-dev.ps1`: script to start backend + frontend together

## Prerequisites
1. Install Java 25.
2. Install Node.js (includes npm).
3. Install Microsoft SQL Server.
4. Install SQL Server Management Studio (SSMS).

## First-Time Setup (Step By Step)
1. Open SSMS.
2. Connect to your SQL Server instance using:
- Login: `sa`
- Password: `1`
3. Execute both queries `GymCore` and `InsertValues` from the `docs` folder and in MS SQL 
4. Open the project root folder (`GymCore`) in VS Code.
5. In VS Code, open Terminal (`Terminal` > `New Terminal`).
6. Run:
```bash
cd frontend
npm install
```
7. After install finishes, go back to project root:
```bash
cd ..
```

## Run Project (Daily Use)
1. In VS Code Explorer, open `start-dev.ps1`.
2. Right-click inside the file and choose `Run PowerShell File in Terminal` (or click the run button for PowerShell).
3. Two terminals/windows will start:
- Backend on `http://localhost:8080`
- Frontend on `http://localhost:5173`
4. Open browser at `http://localhost:5173`.

## Stop Project
1. Go to running terminals/windows.
2. Press `Ctrl + C` to stop both backend and frontend.

## For Teammates
1. After cloning, run `npm install` in `frontend` once.
2. Run `npm install` again only when `package.json` or `package-lock.json` changes.
3. Do not commit `node_modules/`.
