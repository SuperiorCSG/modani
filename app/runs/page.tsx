import Link from "next/link";
import AdminShell from "@/app/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function RunsPage({
  searchParams
}: {
  searchParams: Promise<{ queued?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const runs = await db.automationRun.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <AdminShell>
      <h1>Automation Runs</h1>
      <section className="card">
        <h2>Start manual run</h2>
        {params.queued ? <p>Run queued.</p> : null}
        {params.error ? <p role="alert">Unable to queue run.</p> : null}
        <form action="/api/runs" method="post" className="grid two">
          <label>
            Run type
            <select name="mode" defaultValue="yesterday">
              <option value="yesterday">Yesterday</option>
              <option value="single">Single selected date</option>
              <option value="range">Selected date range</option>
            </select>
          </label>
          <label>
            Timezone
            <input name="timezone" defaultValue="America/New_York" required />
          </label>
          <label>
            Single date
            <input name="singleDate" type="date" />
          </label>
          <label>
            From date
            <input name="fromDate" type="date" />
          </label>
          <label>
            To date
            <input name="toDate" type="date" />
          </label>
          <div>
            <button type="submit">Start run</button>
          </div>
        </form>
      </section>
      <section className="card">
        <h2>Run history</h2>
        <table>
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Trigger</th>
              <th>Status</th>
              <th>Date range</th>
              <th>Started</th>
              <th>Completed</th>
              <th>Counts</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td><Link href={`/runs/${run.id}`}>{run.id}</Link></td>
                <td>{run.triggerType}</td>
                <td><span className="pill">{run.status}</span></td>
                <td>{run.dateFrom.toLocaleDateString()} - {run.dateTo.toLocaleDateString()}</td>
                <td>{run.startedAt?.toLocaleString() ?? "-"}</td>
                <td>{run.completedAt?.toLocaleString() ?? "-"}</td>
                <td>
                  rows {run.totalRowsFound}, skipped {run.skippedCount}, ready {run.readyForReviewCount},
                  signed {run.signedCount}, failed {run.failedCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
