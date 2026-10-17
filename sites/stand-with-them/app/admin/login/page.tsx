import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/login-form";
import { getCurrentAdmin } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administrator Sign In" };

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");
  return <main id="main-content" className="admin-login">{isSupabaseConfigured() ? <AdminLoginForm /> : <div className="admin-login-card"><h1>Administrator setup required</h1><p>Connect Supabase and configure the required server environment variables before administrator sign-in can be used.</p><div className="form-info">No default administrator credentials are embedded in the application.</div></div>}</main>;
}
