import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (admin) {
    redirect("/dashboard");
  }
  const params = await searchParams;

  return (
    <main style={{ maxWidth: 460, margin: "60px auto" }}>
      <div className="card">
        <h1>Admin Login</h1>
        <p className="muted">Authorized admins only. There is no public signup.</p>
        {params.error ? <p role="alert">Invalid email or password.</p> : null}
        <form action="/api/auth/login" method="post">
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button type="submit">Log in</button>
        </form>
      </div>
    </main>
  );
}
