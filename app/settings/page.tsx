import AdminShell from "@/app/AdminShell";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const credential = await db.targetSiteCredential.findFirst({ orderBy: { updatedAt: "desc" } });

  return (
    <AdminShell>
      <h1>Target Website Settings</h1>
      <section className="card">
        <p className="muted">
          The password is encrypted before storage and is never shown back in this UI.
        </p>
        {params.saved ? <p>Settings saved.</p> : null}
        {params.error ? <p role="alert">Unable to save settings.</p> : null}
        <form action="/api/settings" method="post">
          <label>
            Target URL
            <input name="targetUrl" type="url" defaultValue={credential?.targetUrl ?? env.TARGET_SITE_URL} required />
          </label>
          <label>
            Username
            <input
              name="username"
              type="email"
              autoComplete="off"
              defaultValue={credential?.username ?? env.TARGET_SITE_USERNAME ?? ""}
              required
            />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="new-password" placeholder="Leave blank to keep current password" />
          </label>
          <label>
            Signature template
            <input name="signatureTemplate" defaultValue={credential?.signatureTemplate ?? env.SIGNATURE_TEMPLATE} required />
          </label>
          <label>
            <span>
              <input
                name="captureSnapshots"
                type="checkbox"
                defaultChecked={credential?.captureSnapshots ?? env.AUTOMATION_CAPTURE_SNAPSHOTS}
              />{" "}
              Capture screenshots and HTML snapshots for review
            </span>
          </label>
          <button type="submit">Save settings</button>
        </form>
      </section>
    </AdminShell>
  );
}
