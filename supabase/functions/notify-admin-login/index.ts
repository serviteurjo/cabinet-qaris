import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_ALERT_EMAIL = Deno.env.get("ADMIN_ALERT_EMAIL") || "cabinetqaris@gmail.com";
const ADMIN_ALERT_FROM = Deno.env.get("ADMIN_ALERT_FROM") || "Cabinet QARIS <onboarding@resend.dev>";
const ADMIN_LOGIN_LOG_TABLE = Deno.env.get("ADMIN_LOGIN_LOG_TABLE") || "admin_login_attempts";

type LoginAttemptPayload = {
  email?: string;
  success?: boolean;
  reason?: string;
  timestamp?: string;
  userAgent?: string;
  pathname?: string;
};

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function formatDate(value: string | undefined) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function buildEmailHtml(payload: Required<Pick<LoginAttemptPayload, "email" | "success" | "reason" | "timestamp">> & Pick<LoginAttemptPayload, "userAgent" | "pathname">) {
  const statusColor = payload.success ? "#28a745" : "#dc3545";
  const statusText = payload.success ? "SUCCES" : "ECHEC";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 20px;">
      <h2 style="color: ${statusColor}; margin-bottom: 16px;">Alerte securite admin</h2>
      <div style="background:#f5f5f5; border-radius:8px; padding:16px;">
        <p><strong>Email:</strong> ${payload.email}</p>
        <p><strong>Statut:</strong> <span style="color:${statusColor}; font-weight:700;">${statusText}</span></p>
        <p><strong>Raison:</strong> ${payload.reason || "-"}</p>
        <p><strong>Date:</strong> ${payload.timestamp}</p>
        <p><strong>Page:</strong> ${payload.pathname || "-"}</p>
        <p><strong>User-Agent:</strong> ${payload.userAgent || "-"}</p>
      </div>
      <p style="font-size:12px; color:#666; margin-top:16px;">Message automatique Cabinet QARIS.</p>
    </div>
  `;
}

async function logAttempt(payload: Required<Pick<LoginAttemptPayload, "email" | "success" | "reason" | "timestamp">> & Pick<LoginAttemptPayload, "userAgent" | "pathname">) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await adminClient.from(ADMIN_LOGIN_LOG_TABLE).insert([{
    email: payload.email,
    success: payload.success,
    reason: payload.reason,
    attempted_at: payload.timestamp,
    user_agent: payload.userAgent || null,
    pathname: payload.pathname || null,
  }]);

  if (error) {
    // Best effort only
    console.warn("logAttempt failed:", error.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  if (!resend) {
    return jsonResponse({ ok: false, error: "RESEND_API_KEY manquant" }, 500);
  }

  try {
    const body = (await req.json()) as LoginAttemptPayload;

    const email = sanitizeText(body?.email);
    const success = body?.success === true;
    const reason = sanitizeText(body?.reason, success ? "login_success" : "login_failed");
    const timestamp = formatDate(body?.timestamp);
    const userAgent = sanitizeText(body?.userAgent);
    const pathname = sanitizeText(body?.pathname);

    if (!email) {
      return jsonResponse({ ok: false, error: "email requis" }, 400);
    }

    const payload = { email, success, reason, timestamp, userAgent, pathname };

    await logAttempt(payload);

    const subject = `[QARIS Admin] ${success ? "Connexion reussie" : "Tentative echouee"} - ${email}`;
    const emailResult = await resend.emails.send({
      from: ADMIN_ALERT_FROM,
      to: ADMIN_ALERT_EMAIL,
      subject,
      html: buildEmailHtml(payload),
    });

    if (emailResult.error) {
      return jsonResponse({
        ok: false,
        error: emailResult.error.message || "Envoi email impossible",
      }, 502);
    }

    return jsonResponse({
      ok: true,
      resend_id: emailResult?.data?.id || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    console.error("notify-admin-login error:", message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
