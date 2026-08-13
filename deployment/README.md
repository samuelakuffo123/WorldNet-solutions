# Deployment

WorldNet can be deployed as a Node.js web service backed by PostgreSQL on **Render**
(blueprint) or **Docker Compose**. No secrets are committed to the repository; all
environment variables are configured at deploy time.

## Environment variables

| Variable       | Purpose                                              | Required |
|----------------|------------------------------------------------------|----------|
| `DATABASE_URL` | PostgreSQL connection string                         | Yes      |
| `DATABASE_SSL` | Set `true` for managed cloud Postgres (Render)       | No (default `false`) |
| `JWT_SECRET`   | Long random secret used to sign admin sessions       | Yes      |
| `SMTP_HOST`    | SMTP server for form-submission emails               | No       |
| `SMTP_PORT`    | SMTP port (default `587`)                            | No       |
| `SMTP_USER`    | SMTP username                                        | No       |
| `SMTP_PASS`    | SMTP password                                        | No       |
| `SMTP_FROM`    | Sender address (default `no-reply@worldnetict.com`)  | No       |

The application creates and seeds its PostgreSQL tables automatically on first
startup. Only create the database itself before deploying.

## Option A — Render (blueprint)

`render.yaml` at the repository root defines a free web service and a free
PostgreSQL database, wired together automatically.

1. Push this repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com), choose
   **New > Blueprint** and connect the repository.
3. Render provisions the Postgres database, wires `DATABASE_URL`, generates a
   `JWT_SECRET`, and prompts for SMTP values (optional — leave blank to disable email).
4. Deploy finishes when the build (`npm ci`) and start (`npm start`) complete.
   The app serves on the port Render injects via `PORT`.

Health check endpoint: `/api/health`.

## Option B — Docker Compose (self-hosted)

```bash
# from the repository root
docker compose up --build -d
```

- Starts PostgreSQL (`db`) with health checks and the app (`web`).
- The web service is exposed at `http://localhost:3000`.
- Set `JWT_SECRET` and real SMTP values in `docker-compose.yml` before going live.
- Data persists in the `worldnet_db` volume.

## Post-deploy verification

- Health: `GET /api/health` returns `{ "ok": true, ... }`.
- Homepage loads: `http://localhost:3000/`.
- Admin login: `http://localhost:3000/admin/login.html`
  (default seeded credentials `admin@worldnetict.com` / `admin123` — change after first login).
- Persistence: submit an inquiry or consultation, restart the service, and confirm the record remains.

## Rollback

- **Render:** redeploy the previous good commit, or flip the service back to the
  last known-good Git tag.
- **Docker:** rebuild from an earlier image tag, or restore the `worldnet_db`
  volume from a backup.