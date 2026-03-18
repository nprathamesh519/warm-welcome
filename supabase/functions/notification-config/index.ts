import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const appId = Deno.env.get("ONESIGNAL_APP_ID");

  if (!appId) {
    return new Response(JSON.stringify({ error: "ONESIGNAL_APP_ID is not configured" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  return new Response(JSON.stringify({ appId }), {
    status: 200,
    headers: corsHeaders,
  });
});
