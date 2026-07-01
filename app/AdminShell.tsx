import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <h2>Care Log Admin</h2>
        <p className="muted">{admin.email}</p>
        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/settings">Settings</Link>
          <Link href="/runs">Runs</Link>
          <Link href="/schedules">Schedules</Link>
          <Link href="/review">Review</Link>
        </nav>
        <form action="/api/auth/logout" method="post">
          <button type="submit">Log out</button>
        </form>
      </aside>
      <main>{children}</main>
    </div>
  );
}
