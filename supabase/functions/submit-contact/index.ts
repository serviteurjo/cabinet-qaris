import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { data } = await req.json();

    if (!data) {
      return new Response(
        JSON.stringify({ ok: false, error: "Données manquantes" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Récupérer Supabase URL et Service Role Key depuis les variables d'environnement
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Configuration serveur incomplète. SUPABASE_URL ou SERVICE_ROLE_KEY manquant",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Insérer le message de contact dans la table contact_messages
    const insertUrl = `${supabaseUrl}/rest/v1/contact_messages`;
    const insertResponse = await fetch(insertUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(data),
    });

    if (!insertResponse.ok) {
      const errorBody = await insertResponse.text();
      console.error("Supabase insert failed:", errorBody);
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Erreur lors de l'enregistrement: ${insertResponse.status}`,
        }),
        {
          status: insertResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true, message: "Message enregistré" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
