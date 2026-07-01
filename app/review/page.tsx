import AdminShell from "@/app/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ReviewPage({
  searchParams
}: {
  searchParams: Promise<{ approved?: string; rejected?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const items = await db.careLogItem.findMany({
    where: { status: "ready_for_review" },
    orderBy: { careLogDate: "desc" },
    include: { tasks: true, run: true }
  });

  return (
    <AdminShell>
      <h1>Review and Approval</h1>
      {params.approved ? <p>Care log approved and signing started.</p> : null}
      {params.rejected ? <p>Care log skipped.</p> : null}
      {params.error ? <p role="alert">Unable to process review action.</p> : null}
      {items.map((item) => (
        <section className="card" key={item.id}>
          <h2>{item.clientName}</h2>
          <p><strong>Care log date:</strong> {item.careLogDate.toLocaleDateString()}</p>
          <p><strong>Source URL:</strong> <a href={item.sourceUrl}>{item.sourceUrl}</a></p>
          <p><strong>Client signed:</strong> {item.clientSigned ? "Yes" : "No"}</p>
          <p><strong>Caregiver signed:</strong> {item.caregiverSigned ? "Yes" : "No"}</p>
          <p><strong>All tasks checked:</strong> {item.allTasksChecked ? "Yes" : "No"}</p>
          <p><strong>Care manager:</strong> {item.careManagerName ?? "Not captured yet"}</p>
          {item.screenshotPath ? <p><strong>Screenshot:</strong> {item.screenshotPath}</p> : null}
          {item.htmlSnapshotPath ? <p><strong>HTML snapshot:</strong> {item.htmlSnapshotPath}</p> : null}
          <h3>Tasks</h3>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Task</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {item.tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.taskTime ?? "-"}</td>
                  <td>{task.taskName}</td>
                  <td>{task.isChecked ? "checked" : "incomplete"} ({task.statusLabel})</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <form action={`/api/review/${item.id}/approve`} method="post">
              <button type="submit">Approve and sign</button>
            </form>
            <form action={`/api/review/${item.id}/reject`} method="post">
              <button className="danger" type="submit">Reject / skip</button>
            </form>
          </div>
        </section>
      ))}
      {items.length === 0 ? <section className="card">No care logs are ready for review.</section> : null}
    </AdminShell>
  );
}
