import { NextRequest, NextResponse } from "next/server";
const ROUTER = process.env.ALFRED_ROUTER_URL ?? "https://alfred-router-prod-production.up.railway.app";
const SECRET = process.env.ROUTER_ADMIN_SECRET ?? "";
export async function GET() {
  if (!SECRET) return NextResponse.json({ error: "sin secret" }, { status: 503 });
  try { const r = await fetch(`${ROUTER}/finance/projection`, { headers: { "x-admin-secret": SECRET }, cache: "no-store" }); return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
export async function POST(req: NextRequest) {
  if (!SECRET) return NextResponse.json({ error: "sin secret" }, { status: 503 });
  try { const b = await req.json(); const r = await fetch(`${ROUTER}/finance/projection`, { method: "POST", headers: { "x-admin-secret": SECRET, "Content-Type": "application/json" }, body: JSON.stringify(b) }); return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
