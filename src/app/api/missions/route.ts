import { NextRequest, NextResponse } from "next/server";

// Proxy server-side: mantiene ROUTER_ADMIN_SECRET fuera del cliente y evita exponer
// transcripts de misiones (conversaciones con terceros) por una URL pública.
const ROUTER = process.env.ALFRED_ROUTER_URL ?? "https://alfred-router-prod-production.up.railway.app";
const SECRET = process.env.ROUTER_ADMIN_SECRET ?? "";

export async function GET() {
  if (!SECRET) return NextResponse.json({ error: "sin ROUTER_ADMIN_SECRET" }, { status: 503 });
  try {
    const r = await fetch(`${ROUTER}/missions`, { headers: { "x-admin-secret": SECRET }, cache: "no-store" });
    const j = await r.json();
    return NextResponse.json(j, { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

// POST { id }  → frena una misión
export async function POST(req: NextRequest) {
  if (!SECRET) return NextResponse.json({ error: "sin ROUTER_ADMIN_SECRET" }, { status: 503 });
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });
    const r = await fetch(`${ROUTER}/missions/${encodeURIComponent(id)}/stop`, { method: "POST", headers: { "x-admin-secret": SECRET } });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
