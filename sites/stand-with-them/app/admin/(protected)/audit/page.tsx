import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase";
import { firstRelated } from "@/lib/relations";

export const metadata = { title: "Audit History" };

export default async function AuditPage() {
  await requireAdmin("manage_settings");
  const { data: logs, error } = await createServiceClient().from("audit_logs").select("id,action,entity_type,entity_id,metadata,created_at,admin_profiles(display_name,role)").order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return <><header className="admin-page-head"><div><h1>Audit history</h1><p>Important administrative actions and state transitions are retained for accountability.</p></div></header><section className="admin-panel">{!logs?.length ? <div className="empty-state"><h3>No audited actions yet</h3></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>When</th><th>Administrator</th><th>Action</th><th>Entity</th><th>Metadata</th></tr></thead><tbody>{logs.map((log) => { const actor = firstRelated(log.admin_profiles); return <tr key={log.id}><td>{new Date(log.created_at).toLocaleString()}</td><td>{actor?.display_name || "System"}<br /><small>{actor?.role?.replaceAll("_", " ")}</small></td><td><strong>{log.action}</strong></td><td>{log.entity_type}<br /><small>{log.entity_id}</small></td><td><code>{JSON.stringify(log.metadata)}</code></td></tr>; })}</tbody></table></div>}</section></>;
}
