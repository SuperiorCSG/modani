const authCard = document.querySelector("#auth-card");
const authTitle = document.querySelector("#auth-title");
const authHelp = document.querySelector("#auth-help");
const authForm = document.querySelector("#auth-form");
const authPassword = document.querySelector("#auth-password");
const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

let state = null;
let pollTimer = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(body.error || "Request failed.");
  }
  return body;
}

function notify(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function scheduleDescription(schedule) {
  if (schedule.type === "daily") {
    return `Daily at ${schedule.time}, range: ${schedule.dateMode || "yesterday"}`;
  }
  return `Once at ${formatDate(schedule.runAt)}, ${schedule.fromDate} to ${schedule.toDate}`;
}

function renderSchedules() {
  const container = document.querySelector("#schedules");
  container.innerHTML = "";

  if (state.schedules.length === 0) {
    container.innerHTML = '<p class="muted">No schedules yet.</p>';
    return;
  }

  for (const schedule of state.schedules) {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div>
        <strong>${schedule.name}</strong>
        <p class="muted">${scheduleDescription(schedule)}</p>
        <p class="muted">Last run: ${formatDate(schedule.lastRunAt)}</p>
      </div>
      <button class="danger" data-delete-schedule="${schedule.id}">Delete</button>
    `;
    container.append(row);
  }
}

function renderRuns() {
  const container = document.querySelector("#runs");
  container.innerHTML = "";

  if (state.runs.length === 0) {
    container.innerHTML = '<p class="muted">No runs yet.</p>';
    return;
  }

  for (const run of state.runs) {
    const row = document.createElement("div");
    row.className = "list-row";
    const summary = run.summary
      ? `Scanned ${run.summary.scannedReports}, opened ${run.summary.openedCareLogs}, ready ${run.summary.readyToSignCareLogs || 0}, signed ${run.summary.signedCareLogs}, skipped ${run.summary.skippedIncompleteTasks}${run.summary.dryRun ? " (dry run)" : ""}.`
      : run.error || "Waiting for result.";
    const logs = run.logs?.map((entry) => `${formatDate(entry.at)} - ${entry.message}`).join("\n") || "";
    row.innerHTML = `
      <div>
        <span class="status ${run.status}">${run.status}</span>
        <strong>${run.source} run</strong>
        <p class="muted">${run.requestedRange.fromDate} to ${run.requestedRange.toDate}</p>
        <p>${summary}</p>
        <div class="logs">${logs}</div>
      </div>
    `;
    container.append(row);
  }
}

function renderSettings() {
  const settings = state.settings;
  document.querySelector("#target-url").value = settings.targetUrl || "";
  document.querySelector("#target-username").value = settings.username || "";
  document.querySelector("#headless").checked = settings.headless !== false;
  document.querySelector("#dry-run").checked = settings.dryRun !== false;
  document.querySelector("#timeout-ms").value = settings.timeoutMs || 30000;
  document.querySelector("#selectors").value = JSON.stringify(settings.selectors, null, 2);
}

function renderState() {
  authCard.classList.add("hidden");
  app.classList.remove("hidden");
  renderSettings();
  renderSchedules();
  renderRuns();
}

async function loadState() {
  state = await api("/api/state");
  renderState();
}

async function init() {
  const session = await api("/api/session");
  if (session.authenticated) {
    await loadState();
    return;
  }

  authTitle.textContent = session.adminConfigured ? "Admin login" : "Create admin password";
  authHelp.textContent = session.adminConfigured
    ? "Enter the admin password to continue."
    : "This first password becomes the only admin login.";
  authCard.dataset.mode = session.adminConfigured ? "login" : "setup";
  authCard.classList.remove("hidden");
  app.classList.add("hidden");
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const mode = authCard.dataset.mode;
  try {
    await api(mode === "setup" ? "/api/setup" : "/api/login", {
      method: "POST",
      body: JSON.stringify({ password: authPassword.value })
    });
    authPassword.value = "";
    await loadState();
  } catch (error) {
    notify(error.message);
  }
});

document.querySelector("#logout").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  window.location.reload();
});

document.querySelector("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const selectors = JSON.parse(document.querySelector("#selectors").value);
    await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        targetUrl: document.querySelector("#target-url").value,
        username: document.querySelector("#target-username").value,
        password: document.querySelector("#target-password").value,
        headless: document.querySelector("#headless").checked,
        dryRun: document.querySelector("#dry-run").checked,
        timeoutMs: document.querySelector("#timeout-ms").value,
        selectors
      })
    });
    document.querySelector("#target-password").value = "";
    notify("Settings saved.");
    await loadState();
  } catch (error) {
    notify(error.message);
  }
});

document.querySelector("#run-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const dateMode = document.querySelector("input[name='date-mode']:checked").value;
  const payload = {
    dateMode,
    fromDate: document.querySelector("#run-from").value,
    toDate: document.querySelector("#run-to").value
  };
  try {
    await api("/api/runs", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    notify("Automation run started.");
    await loadState();
    startPolling();
  } catch (error) {
    notify(error.message);
  }
});

document.querySelector("#schedule-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const type = document.querySelector("#schedule-type").value;
  const payload = {
    name: document.querySelector("#schedule-name").value,
    type,
    time: document.querySelector("#schedule-time").value,
    runAt: document.querySelector("#schedule-run-at").value,
    dateMode: type === "daily" ? "yesterday" : "custom",
    fromDate: document.querySelector("#schedule-from").value,
    toDate: document.querySelector("#schedule-to").value
  };

  try {
    await api("/api/schedules", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    notify("Schedule created.");
    event.target.reset();
    document.querySelector("#schedule-time").value = "00:00";
    await loadState();
  } catch (error) {
    notify(error.message);
  }
});

document.addEventListener("click", async (event) => {
  const id = event.target.dataset.deleteSchedule;
  if (!id) {
    return;
  }

  await api(`/api/schedules/${id}`, { method: "DELETE" });
  notify("Schedule deleted.");
  await loadState();
});

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    await loadState();
    if (!state.runs.some((run) => ["queued", "running"].includes(run.status))) {
      clearInterval(pollTimer);
    }
  }, 2500);
}

init().catch((error) => notify(error.message));
