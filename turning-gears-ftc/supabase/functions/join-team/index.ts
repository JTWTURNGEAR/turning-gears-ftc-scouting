import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sign in session missing.");
    const body = await req.json();
    const accessCode = String(body.accessCode || "");
    const coordinatorCode = String(body.coordinatorCode || "");

    const expectedAccess = Deno.env.get("TEAM_ACCESS_CODE") || "";
    const expectedCoordinator = Deno.env.get("COORDINATOR_ACCESS_CODE") || "";
    if (!expectedAccess || accessCode !== expectedAccess) {
      return new Response(JSON.stringify({ error: "Incorrect team access code." }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Could not verify your session.");

    const { data: team, error: teamError } = await admin.from("teams").select("id").eq("name", "TURNING GEARS").limit(1).single();
    if (teamError || !team) throw new Error("Team row not found. Run schema.sql first.");

    const role = expectedCoordinator && coordinatorCode === expectedCoordinator ? "coordinator" : "scout";
    const { error: memberError } = await admin.from("team_members").upsert({
      user_id: userData.user.id, team_id: team.id, role
    }, { onConflict: "user_id,team_id" });
    if (memberError) throw memberError;

    return new Response(JSON.stringify({ success: true, role }), {
      headers: { ...cors, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});