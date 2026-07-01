import AdminShell from "@/app/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function SchedulesPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; deleted?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const schedules = await db.automationSchedule.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <AdminShell>
      <h1>Schedules</h1>
      <section className="card">
        <h2>Create schedule</h2>
        {params.saved ? <p>Schedule saved.</p> : null}
        {params.deleted ? <p>Schedule deleted.</p> : null}
        {params.error ? <p role="alert">Unable to save schedule.</p> : null}
        <form action="/api/schedules" method="post" className="grid two">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Schedule type
            <select name="kind" defaultValue="daily">
              <option value="daily">Daily recurring</option>
              <option value="one_time_single_date">One-time single date</option>
              <option value="one_time_date_range">One-time date range</option>
            </select>
          </label>
          <label>
            Timezone
            <input name="timezone" defaultValue="America/New_York" required />
          </label>
          <label>
            Daily time
            <input name="timeOfDay" type="time" />
          </label>
          <label>
            One-time run at
            <input name="runOnceAt" type="datetime-local" />
          </label>
          <label>
            Start/single date
            <input name="startDate" type="date" />
          </label>
          <label>
            End date
            <input name="endDate" type="date" />
          </label>
          <div>
            <button type="submit">Create schedule</button>
          </div>
        </form>
      </section>
      <section className="card">
        <h2>Existing schedules</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Timezone</th>
              <th>When</th>
              <th>Enabled</th>
              <th>Last queued</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => (
              <tr key={schedule.id}>
                <td>{schedule.name}</td>
                <td>{schedule.kind}</td>
                <td>{schedule.timezone}</td>
                <td>{schedule.timeOfDay ?? schedule.runOnceAt?.toLocaleString() ?? "-"}</td>
                <td>{schedule.enabled ? "yes" : "no"}</td>
                <td>{schedule.lastQueuedAt?.toLocaleString() ?? "-"}</td>
                <td>
                  <form action={`/api/schedules/${schedule.id}`} method="post" style={{ display: "inline-block", marginRight: 8 }}>
                    <input type="hidden" name="intent" value="toggle" />
                    <button className="button secondary" type="submit">{schedule.enabled ? "Disable" : "Enable"}</button>
                  </form>
                  <form action={`/api/schedules/${schedule.id}`} method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <button className="danger" type="submit">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
