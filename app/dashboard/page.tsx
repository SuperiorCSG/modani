import AdminShell from "@/app/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  await requireAdmin();
  const [runs, readyCount, scheduleCount] = await Promise.all([
    db.automationRun.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.careLogItem.count({ where: { status: "ready_for_review" } }),
    db.automationSchedule.count({ where: { enabled: true } })
  ]);

  return (
    <AdminShell>
      <h1>Dashboard</h1>
      <div className="grid two">
        <section className="card">
          <h2>Ready for review</h2>
          <p style={{ fontSize: 40, margin: 0 }}>{readyCount}</p>
        </section>
        <section className="card">
          <h2>Enabled schedules</h2>
          <p style={{ fontSize: 40, margin: 0 }}>{scheduleCount}</p>
        </section>
      </div>
      <section className="card">
        <h2>Recent runs</h2>
        <table>
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Status</th>
              <th>Date range</th>
              <th>Rows</th>
              <th>Ready</th>
              <th>Failed</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{run.id}</td>
                <td><span className="pill">{run.status}</span></td>
                <td>{run.dateFrom.toLocaleDateString()} - {run.dateTo.toLocaleDateString()}</td>
                <td>{run.totalRowsFound}</td>
                <td>{run.readyForReviewCount}</td>
                <td>{run.failedCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
