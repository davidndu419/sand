import { createClient } from "@supabase/supabase-js";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const email = args.get("--email")?.trim().toLowerCase();
const displayName = args.get("--name")?.trim();
const role = args.get("--role") ?? "super_administrator";
const roles = new Set(["super_administrator", "payment_reviewer", "fulfilment_manager"]);

if (!email || !displayName || !roles.has(role)) {
  console.error("Usage: npm run admin:provision -- --email admin@example.org --name \"Admin Name\" --role super_administrator");
  process.exit(64);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(78);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let user = null;
for (let page = 1; page <= 10 && !user; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw error;
  user = data.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
  if (data.users.length < 100) break;
}

if (!user) {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName },
  });
  if (error) throw error;
  user = data.user;
}

const { error } = await supabase.from("admin_profiles").upsert({
  id: user.id,
  role,
  display_name: displayName,
  active: true,
});
if (error) throw error;

console.log(JSON.stringify({ id: user.id, email, role, invited: !user.last_sign_in_at }, null, 2));
