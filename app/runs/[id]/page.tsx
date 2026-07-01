import AdminShell from "@/app/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const run = await db.automationRun.findUnique({
    where: { id },
    include: {
      careLogs: {
        orderBy: { createdAt: "desc" },
        include: { tasks: true }
      }
    }
  });

  return (
    <AdminShell>
      {!run ? (
        <section className="card">Run not found.</section>
      ) : (
        <>
          <h1>Run {run.id}</h1>
          <section className="card">
            <p><strong>Status:</strong> {run.status}</p>
            <p><strong>Trigger:</strong> {run.triggerType}</p>
            <p><strong>Date range:</strong> {run.dateFrom.toLocaleString()} - {run.dateTo.toLocaleString()}</p>
            <p><strong>Counts:</strong> rows {run.totalRowsFound}, skipped {run.skippedCount}, ready {run.readyForReviewCount}, signed {run.signedCount}, failed {run.failedCount}</p>
            {run.errorMessage ? <p role="alert"><strong>Error:</strong> {run.errorMessage}</p> : null}
          </section>
          <section className="card">
            <h2>Care logs</h2>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Signatures</th>
                  <th>Tasks</th>
                  <th>Error / skip reason</th>
                </tr>
              </thead>
              <tbody>
                {run.careLogs.map((item) => (
                  <tr key={item.id}>
                    <td>{item.clientName}</td>
                    <td>{item.careLogDate.toLocaleDateString()}</td>
                    <td>{item.status}</td>
                    <td>Client {item.clientSigned ? "yes" : "no"} / Caregiver {item.caregiverSigned ? "yes" : "no"}</td>
                    <td>
                      <ul>
                        {item.tasks.map((task) => (
                          <li key={task.id}>{task.taskTime ? `${task.taskTime} - ` : ""}{task.taskName}: {task.isChecked ? "checked" : "incomplete"}</li>
                        ))}
                      </ul>
                    </td>
                    <td>{item.skipReason ?? item.errorMessage ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </AdminShell>
  );
}
