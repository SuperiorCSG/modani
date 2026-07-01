# Care Log Automation Admin

Admin-only web tool for running a configurable care-log signing automation.

## Features

- First-run admin password setup, or seed the admin with `ADMIN_PASSWORD`.
- Secure admin session cookie.
- Encrypted storage for the target website password.
- Manual runs for yesterday or a custom date range.
- Daily recurring schedules and one-time scheduled runs.
- Run history with progress logs and signing summary.
- Playwright-based automation runner with editable selectors for the target website.

## Run locally

```sh
npm install
npm start
```

Open `http://localhost:3000`.

Useful environment variables:

- `ADMIN_PASSWORD`: creates the initial admin password on first startup.
- `SESSION_SECRET`: signs the admin session cookie.
- `APP_ENCRYPTION_KEY`: encrypts the saved target-site password.
- `DATA_FILE`: custom JSON persistence file path. Defaults to `data/db.json`.
- `PORT`: web server port. Defaults to `3000`.

## Browser setup

The automation uses Playwright. If the runtime image does not already include browser binaries, install Chromium with:

```sh
npx playwright install chromium
```

## Automation setup

The admin settings page includes a selector JSON editor. Replace the defaults with selectors from the actual website before running the automation. The runner performs these steps:

1. Log in to the configured website.
2. Open the Reports tab.
3. Run the `Unsigned Care Logs` report for yesterday or the selected date range.
4. Group by `State Client` and select all clients.
5. Open eligible `Not Signed` care logs.
6. Skip care logs with any incomplete task.
7. Sign completed care logs as care manager using the manager name shown in the signing dialog.
