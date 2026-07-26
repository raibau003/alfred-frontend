import { NextRequest, NextResponse } from "next/server";

const ROUTER = process.env.ALFRED_ROUTER_URL ?? "https://alfred-router-prod-production.up.railway.app";
const SECRET = process.env.ROUTER_ADMIN_SECRET ?? "";

// Resumen financiero (presupuesto, tendencia 12m, categorías, suscripciones, cuotas, anomalías).
export async function GET() {
  if (!SECRET) return NextResponse.json({ error: "sin ROUTER_ADMIN_SECRET" }, { status: 503 });
  try {
    const r = await fetch(`${ROUTER}/finance/summary`, { headers: { "x-admin-secret": SECRET }, cache: "no-store" });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

// Actualiza el presupuesto de la tarjeta de crédito.
export async function POST(req: NextRequest) {
  if (!SECRET) return NextResponse.json({ error: "sin ROUTER_ADMIN_SECRET" }, { status: 503 });
  try {
    const body = await req.json();
    const r = await fetch(`${ROUTER}/finance/config`, { method: "POST", headers: { "x-admin-secret": SECRET, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
