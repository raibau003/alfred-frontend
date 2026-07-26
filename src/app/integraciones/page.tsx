import { redirect } from "next/navigation";

// Movido al hub unificado de Integraciones (/connectors).
export default function IntegracionesRedirect() {
  redirect("/connectors");
}
