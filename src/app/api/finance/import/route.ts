import { NextResponse } from "next/server";

const ROUTER = process.env.ALFRED_ROUTER_URL ?? "https://alfred-router-prod-production.up.railway.app";
const SECRET = process.env.ROUTER_ADMIN_SECRET ?? "";

// Dispara que Alfred importe la cartola (Gmail/Outlook → desencripta → parsea → Supabase).
export async function POST() {
  if (!SECRET) return NextResponse.json({ error: "sin ROUTER_ADMIN_SECRET" }, { status: 503 });
  try {
    const r = await fetch(`${ROUTER}/finance/import`, { method: "POST", headers: { "x-admin-secret": SECRET, "Content-Type": "application/json" }, body: "{}" });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
