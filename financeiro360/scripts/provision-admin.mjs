// Run privately after the family migration is applied. Never commit environment values.
import { createClient } from "@supabase/supabase-js";
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  FIN_ADMIN_EMAIL,
  FIN_ADMIN_PASSWORD,
} = process.env;
if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !FIN_ADMIN_EMAIL ||
  !FIN_ADMIN_PASSWORD
)
  throw Error(
    "Configure URL, server service key, admin email and initial password in a private environment.",
  );
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let user;
for (let page = 1; ; page++) {
  const r = await client.auth.admin.listUsers({ page, perPage: 100 });
  if (r.error) throw Error("Cannot inspect Auth users.");
  user = r.data.users.find(
    (u) => u.email?.toLowerCase() === FIN_ADMIN_EMAIL.toLowerCase(),
  );
  if (user || r.data.users.length < 100) break;
}
if (user && process.env.FIN_USE_EXISTING_ADMIN !== "true")
  throw Error(
    "Email already belongs to an Auth account. No password was changed. Set FIN_USE_EXISTING_ADMIN=true only to reuse that account with its existing password.",
  );
if (!user) {
  const r = await client.auth.admin.createUser({
    email: FIN_ADMIN_EMAIL,
    password: FIN_ADMIN_PASSWORD,
    email_confirm: true,
  });
  if (r.error) throw Error("Cannot create the initial administrator.");
  user = r.data.user;
}
const existing = await client
  .from("fin_members")
  .select("home_id")
  .eq("user_id", user.id)
  .eq("role", "admin")
  .maybeSingle();
if (existing.error) throw Error("Family schema not ready.");
if (existing.data) {
  console.log("Administrator is already provisioned. No data changed.");
  process.exit(0);
}
const home = await client
  .from("fin_homes")
  .insert({ name: "Nossa casa", owner_id: user.id })
  .select("id")
  .single();
if (home.error) throw Error("Cannot create household.");
const member = await client
  .from("fin_members")
  .insert({
    home_id: home.data.id,
    user_id: user.id,
    display_name: "Administrador",
    role: "admin",
    password_change_required: true,
  });
if (member.error)
  throw Error(
    "Household created but membership failed. Check the home record before retrying.",
  );
console.log("Administrator ready. Change the initial password in Settings.");
