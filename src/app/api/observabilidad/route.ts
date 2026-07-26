import { NextResponse } from "next/server";

const ROUTER = process.env.ALFRED_ROUTER_URL ?? "https://alfred-router-prod-production.up.railway.app";
const SECRET = process.env.ROUTER_ADMIN_SECRET ?? "";

// Proxy de /observability/summary. La página lo llamaba directo desde el navegador, así que
// con ROUTER_PROTECT=true se quedaba afuera (401) — y no puede mandar el secreto de
// servidor sin exponerlo. Las trazas incluyen fragmentos de los mensajes de Javier, así
// que el endpoint tiene que seguir protegido: el que pone la credencial es el servidor.
export async function GET() {
  if (!SECRET) return NextResponse.json({ error: "sin ROUTER_ADMIN_SECRET" }, { status: 503 });
  try {
    const r = await fetch(`${ROUTER}/observability/summary`, {
      headers: { "x-admin-secret": SECRET },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    return NextResponse.json(await r.json(), { status: r.ok ? 200 : r.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
