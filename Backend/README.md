# TALVORA FastAPI backend

This is the real API for the Employer, Employee, Admin and shared chat surfaces.

## Run locally

```powershell
cd Backend
C:/Python315/python.exe -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app:app --reload --port 8000
```

Open `/docs` for the interactive API contract. The SQLite file is created on first start and contains no demo records. Employer and Employee registration create only the account and the company/invitation records submitted by a real user.

## Frontend connection

Set `Auth/app-config.js` to `frontendOnly: false` and `apiOrigin: "http://localhost:8000"` for local development. In production, set `apiOrigin` to the deployed API URL and configure `FRONTEND_ORIGINS` to the deployed frontend origins.

The API implements:

- unified Employer and Employee registration/login;
- company creation and organization selection;
- employee invitations;
- authenticated dashboard summaries;
- persistent Admin and Employer/Employee chat threads;
- read-only Admin chat oversight;
- optional SMTP email delivery for invitations and notifications.
