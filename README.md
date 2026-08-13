# WorldNet ICT Solutions

A local web portal for WorldNet enterprise services. This project includes a homepage, service catalog, service details, portfolio, contact forms, and a lightweight backend API.

## What you need

- A laptop running Windows, macOS, or Linux
- [Node.js](https://nodejs.org/) installed (version 18 or later is recommended)
- Internet access to download project packages once

## How to run it

1. Open this repository folder in File Explorer or Finder.
2. Open a terminal or command prompt inside that folder.
   - On Windows, hold `Shift` and right-click inside the folder, then choose **Open PowerShell window here** or **Open command window here**.
3. Move into the application folder and install the required packages:

```bash
cd src
npm install
```

4. Start the project with:

```bash
npm start
```

1. Open your browser to:

```text
http://localhost:3000
```

That will display the WorldNet homepage.

## What is included

- `public/` – website pages, styles, and browser scripts
- `public/css/styles.css` – visual styling for the site
- `public/js/app.js` – front-end logic for loading services and submitting forms
- `public/js/admin.js` – admin dashboard interactions and secure actions
- `server.js` – backend server, API endpoints, and data persistence
- `tests/api.test.js` – regression tests for health checks and admin workflow updates
- `package.json` – project dependencies and commands

## Notes for non-technical users

- `npm install` downloads the tools needed by the app. Run it from `src`.
- `npm start` launches the website on your computer. Run it from `src`.
- If the browser does not open automatically, go to `http://localhost:3000` manually.
- To stop the project, press `Ctrl + C` in the terminal.

## Troubleshooting

- If the terminal says `npm` is not recognized, install Node.js from <https://nodejs.org/>
- If `http://localhost:3000` does not load, make sure the terminal is still running the site.
- If port `3000` is already in use, stop the other app using that port or restart your computer.

## Useful commands

- `npm install` – install required files
- `npm start` – run the website
- `npm test` – run the regression suite for API and admin flows

## Deployment

The app is deployment-ready for **Render** (blueprint in `render.yaml`) and
**Docker Compose** (`docker-compose.yml`). Follow the step-by-step guide in
[`deployment/README.md`](deployment/README.md) to deploy to either platform,
and configure the required environment variables before going live.

## Sprint 3 handover notes

- The admin dashboard is available at `/admin/login.html` and uses the default credentials `admin@worldnetict.com` / `admin123`.
- Admin users can create and remove services, add portfolio items, and update inquiry or consultation statuses from the dashboard.
- Form submissions and admin updates are persisted to PostgreSQL. Configure `DATABASE_URL` in `src/.env` before starting the app.
- The automated tests cover the health endpoint, appointments, consultation tracking and withdrawal, notifications, and admin workflows.

Enjoy exploring the WorldNet portal locally!


Homepage: http://localhost:3000/
Admin login: http://localhost:3000/admin/login.html
# 🌐 WorldNet Service Portal

## 📋 Project Overview & Client Context
This repository contains the semester-long software engineering project for **DCIT 208 (Software Engineering)** executed by **Team Elite**[cite: 2, 3]. 

We are engineering a useful, production-ready corporate web portal and client-acquisition interface for our real-world client, **WorldNet Technologies Ltd.**[cite: 2, 3]. The application serves as a localized functional bridge enabling general visitors and corporate clients to frictionlessly browse WorldNet's business solutions and securely submit validated lead acquisition/service inquiry web forms directly into a persistent database layer.

* **Sakai Group Submission Contact:** Nana Yaw[cite: 2, 3]
* **Official Classroom Repository URL:** https://github.com/Dept-of-Comp-Sci-University-of-Ghana/seg26-main-dcit208-client-project-2026-team-engineering-repository-seg26-dcit208-client-project-2026[cite: 2]
* **Target Initial Baseline Release:** `v0.0-baseline`[cite: 2]

---

## 👥 Team Elite Roster & Roles
* **Paapa** (`b0nsrah`) – Implementation Lead[cite: 2]
* **Samuel** (`samuelakuffo123`) – Implementation Lead / Frontend / Architecture & Context Lead[cite: 2]
* **Eric** (`IamCyrez`) – Implementation Lead / Backend[cite: 2]
* **Primus** (`Phoenicx1`) – UX & Research Lead[cite: 2]
* **Nana Yaw** (`Nana-yaw54`) – Product/Client Manager[cite: 2]
* **Ebenezer** (`Nyame-Ebenezer`) – QA/Validation Lead[cite: 2]
* **Richard Selorm** (`ARichard-001`) – Documentation / Evidence Lead[cite: 3]

---

## 🛡️ Engineering Governance & Quality Gates

To maintain strict compliance with our software engineering process requirements, Team Elite enforces the following quality filters before code changes are accepted into production[cite: 2].

### 🟢 Definition of Ready (DoR)
A backlog item or user story can only transition from the "Backlog" queue into "In Progress" if it satisfies all the following checkpoints[cite: 2]:
1. **User Focus:** The story outlines a distinct user role, an explicit functional goal, and a clear business benefit[cite: 2].
2. **Actionable Criteria:** Acceptance criteria are fully articulated, unambiguous, and written in testable formats[cite: 2].
3. **Dependency Mapping:** Preconditions and explicit cross-feature technical dependencies are completely uncovered[cite: 2].
4. **Granular Estimation:** The issue has been accurately sized using Fibonacci story points and does not exceed an estimation of 8 points[cite: 2].
5. **Predefined Verification:** The team has formally benchmarked how the feature will be manually or automatically verified[cite: 2].
6. **Prioritization Sign-off:** The Product Manager has explicitly evaluated and approved the story's priority status[cite: 2].

### 🔴 Definition of Done (DoD)
An active issue can only be closed and safely merged into the `main` branch if it meets all the following quality constraints[cite: 2]:
1. **Isolated Workflow:** Code is committed solely via an isolated feature branch (`feature/US-...`) and merged exclusively through checked Pull Requests (no direct commits to main)[cite: 2].
2. **Human Peer Review:** At least one non-author team member performs a strict technical code review and submits meaningful comments on the PR[cite: 2].
3. **Automated Validation:** The continuous integration (CI) test suite executes completely without a single breakdown or linting failure[cite: 2].
4. **Test Verification:** Targeted verification protocols (manual integration assertions or automated test files) have run successfully[cite: 2].
5. **Visual Attestation:** High-fidelity browser screenshots or layout screen recordings are attached to the PR description for visual user interface shifts[cite: 2].
6. **Clear Documentation:** Repository manuals, local configurations, and tracking files are updated to cleanly reflect codebase architectural updates[cite: 2].
7. **Ethical Compliance:** All AI tool productivity prompts are disclosed in the PR and logged chronologically within the root `AI_USAGE.md` table[cite: 2].
8. **QA Acceptance:** The QA/Validation Lead manually verifies that the feature perfectly fulfills every specified criteria[cite: 2].

---

## 🏗️ Technical Stack & Local Environment Setup
*(To be expanded during Sprint 1 execution as the development framework is initialized)*[cite: 2]

### Prerequisites
* Java Development Kit (JDK) installed
* Git CLI configured

### Installation
1. Clone the repository locally:
   ```bash
   git clone [https://classroom.github.com/a/4dDsCInL](https://classroom.github.com/a/4dDsCInL)
