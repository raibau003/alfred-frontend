import { NextResponse } from "next/server";

const ROUTER = process.env.ALFRED_ROUTER_URL ?? "https://alfred-router-prod-production.up.railway.app";
const SECRET = process.env.ROUTER_ADMIN_SECRET ?? "";

// Estado del Atajo de Wallet: cuántos gastos llegaron y qué pasó con los que no entraron.
// Responde "hice un pago, ¿te llegó?" sin tener que mirar logs de Railway.
export async function GET() {
  if (!SECRET) return NextResponse.json({ error: "sin ROUTER_ADMIN_SECRET" }, { status: 503 });
  try {
    const r = await fetch(`${ROUTER}/wallet/estado`, { headers: { "x-admin-secret": SECRET }, cache: "no-store" });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
