import { NextRequest, NextResponse } from "next/server";

const ROUTER = process.env.ALFRED_ROUTER_URL ?? "https://alfred-router-prod-production.up.railway.app";
const SECRET = process.env.ROUTER_ADMIN_SECRET ?? "";
const H = { "x-admin-secret": SECRET, "Content-Type": "application/json" };

export async function GET() {
  if (!SECRET) return NextResponse.json({ error: "sin ROUTER_ADMIN_SECRET" }, { status: 503 });
  try {
    const r = await fetch(`${ROUTER}/missions`, { headers: { "x-admin-secret": SECRET }, cache: "no-store" });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

// action: stop | create | edit | estado | suggest
export async function POST(req: NextRequest) {
  if (!SECRET) return NextResponse.json({ error: "sin ROUTER_ADMIN_SECRET" }, { status: 503 });
  try {
    const b = await req.json();
    const a = b.action || (b.id ? "stop" : "");
    let url = "", method = "POST", body: string | undefined = JSON.stringify(b);
    if (a === "stop") url = `/missions/${encodeURIComponent(b.id)}/stop`;
    else if (a === "estado") url = `/missions/${encodeURIComponent(b.id)}/estado`;
    else if (a === "edit") { url = `/missions/${encodeURIComponent(b.id)}`; method = "PATCH"; }
    else if (a === "create") url = `/missions/create`;
    else if (a === "suggest") url = `/missions/suggest`;
    else return NextResponse.json({ error: "acción inválida" }, { status: 400 });
    const r = await fetch(`${ROUTER}${url}`, { method, headers: H, body });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
