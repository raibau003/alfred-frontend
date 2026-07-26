import { NextRequest, NextResponse } from "next/server";

const ROUTER = process.env.ALFRED_ROUTER_URL ?? "https://alfred-router-prod-production.up.railway.app";
const SECRET = process.env.ROUTER_ADMIN_SECRET ?? "";

// Dispara que Alfred abra el login del banco en la Mac, o que sincronice (scrape).
// action: "connect" | "sync". El login lo hace el usuario; Alfred nunca ve la clave.
export async function POST(req: NextRequest) {
  if (!SECRET) return NextResponse.json({ error: "sin ROUTER_ADMIN_SECRET" }, { status: 503 });
  try {
    const { action } = await req.json();
    const path = action === "sync" ? "/bank/sync" : "/bank/connect";
    const r = await fetch(`${ROUTER}${path}`, { method: "POST", headers: { "x-admin-secret": SECRET, "Content-Type": "application/json" }, body: "{}" });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
