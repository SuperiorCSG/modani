import { notFound } from "next/navigation";
import { env } from "@/lib/env";

const mockTasks = [
  { time: "08:00 AM", task: "Medication reminder", status: "checked" },
  { time: "10:30 AM", task: "Meal preparation", status: "checked" },
  { time: "02:00 PM", task: "Light housekeeping", status: "checked" }
];

export default function MockPreviewPage() {
  if (!env.ENABLE_MOCK_PREVIEW) {
    notFound();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <h2>Care Log Admin</h2>
        <p className="muted">preview.admin@example.com</p>
        <nav>
          <a>Dashboard</a>
          <a>Settings</a>
          <a>Runs</a>
          <a>Schedules</a>
          <a>Review</a>
        </nav>
      </aside>
      <main>
        <div className="card" style={{ borderColor: "#f59e0b", background: "#fffbeb" }}>
          <strong>Mock preview only.</strong> This page uses sample data, does not connect to ClearCare, and is disabled
          unless <code>ENABLE_MOCK_PREVIEW=true</code>.
        </div>

        <h1>Admin Automation Dashboard Preview</h1>
        <div className="grid two">
          <section className="card">
            <h2>Ready for review</h2>
            <p style={{ fontSize: 40, margin: 0 }}>3</p>
          </section>
          <section className="card">
            <h2>Enabled schedules</h2>
            <p style={{ fontSize: 40, margin: 0 }}>1</p>
          </section>
        </div>

        <section className="card">
          <h2>Run history</h2>
          <table>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Trigger</th>
                <th>Status</th>
                <th>Date range</th>
                <th>Rows</th>
                <th>Skipped</th>
                <th>Ready</th>
                <th>Failed</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>run_preview_001</td>
                <td>manual</td>
                <td><span className="pill">completed</span></td>
                <td>06/30/2026 - 06/30/2026</td>
                <td>12</td>
                <td>9</td>
                <td>3</td>
                <td>0</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="card">
          <h2>Review item</h2>
          <p><strong>Client:</strong> Sample Client</p>
          <p><strong>Care log date:</strong> 06/30/2026</p>
          <p><strong>Client signed:</strong> Yes</p>
          <p><strong>Caregiver signed:</strong> Yes</p>
          <p><strong>All tasks checked:</strong> Yes</p>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Task</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mockTasks.map((task) => (
                <tr key={task.task}>
                  <td>{task.time}</td>
                  <td>{task.task}</td>
                  <td>{task.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button type="button">Approve and sign</button>
            <button className="danger" type="button">Reject / skip</button>
          </div>
        </section>
      </main>
    </div>
  );
}
