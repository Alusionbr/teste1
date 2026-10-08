import { createClient } from "npm:@supabase/supabase-js@2.117.2";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return respond({ error: "Método inválido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!,
      key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = (req.headers.get("authorization") || "").replace(
      /^Bearer /i,
      "",
    );
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);
    if (authError || !user)
      return respond({ error: "Entre na sua conta" }, 401);
    const input = await req.json();
    const home_id = input.home_id;
    const member = await admin
      .from("fin_members")
      .select("*")
      .eq("home_id", home_id)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (member.error || !member.data)
      return respond({ error: "Acesso indisponível" }, 403);
    if (input.action === "password_changed") {
      const update = await admin
        .from("fin_members")
        .update({ password_change_required: false })
        .eq("home_id", home_id)
        .eq("user_id", user.id);
      if (update.error) throw update.error;
      return respond({ ok: true });
    }
    if (member.data.role !== "admin")
      return respond(
        { error: "Somente o administrador pode gerenciar usuários" },
        403,
      );
    const keys = [
      "entries",
      "cards",
      "payments",
      "documents",
      "pantry",
      "shopping",
    ];
    if (input.user_id) {
      const target = await admin
        .from("fin_members")
        .select("*")
        .eq("home_id", home_id)
        .eq("user_id", input.user_id)
        .maybeSingle();
      if (!target.data || target.data.role === "admin")
        return respond(
          { error: "Administrador não pode ser modificado aqui" },
          400,
        );
      const patch: Record<string, unknown> = {};
      if (typeof input.active === "boolean") patch.active = input.active;
      if (input.permissions) {
        if (keys.some((k) => typeof input.permissions[k] !== "boolean"))
          return respond({ error: "Permissões inválidas" }, 400);
        patch.permissions = Object.fromEntries(
          keys.map((k) => [k, input.permissions[k]]),
        );
      }
      const result = await admin
        .from("fin_members")
        .update(patch)
        .eq("home_id", home_id)
        .eq("user_id", input.user_id);
      if (result.error) throw result.error;
      await admin
        .from("fin_audit")
        .insert({
          home_id,
          actor_id: user.id,
          action: "MEMBER_UPDATED",
          table_name: "fin_members",
          record_id: input.user_id,
        });
      return respond({ ok: true });
    }
    const email = String(input.email || "").trim(),
      password = String(input.password || ""),
      name = String(input.name || "").trim();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 ||
      !name ||
      name.length > 80
    )
      return respond(
        { error: "Confira nome, e-mail e senha de ao menos 8 caracteres" },
        400,
      );
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error)
      return respond(
        {
          error:
            "Não foi possível criar a conta. O e-mail pode já estar cadastrado.",
        },
        400,
      );
    const { error: insertError } = await admin
      .from("fin_members")
      .insert({
        home_id,
        user_id: data.user.id,
        display_name: name,
        role: "member",
        password_change_required: true,
      });
    if (insertError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw insertError;
    }
    await admin
      .from("fin_audit")
      .insert({
        home_id,
        actor_id: user.id,
        action: "MEMBER_CREATED",
        table_name: "fin_members",
        record_id: data.user.id,
      });
    return respond({ ok: true });
  } catch {
    return respond({ error: "Não foi possível concluir a operação" }, 400);
  }
});
