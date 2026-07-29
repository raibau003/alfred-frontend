// ═══════════════════════════════════════════════════════════════════════════
// EL ERROR DE LOGIN, EN CASTELLANO Y CON LA CAUSA REAL.
//
// El 2026-07-28 la pantalla de login mostraba, debajo de los campos, esto:
//
//     {}
//
// No era un bug de renderizado: `{}` ERA el mensaje. `supabase-js` arma el texto
// del error leyendo el JSON del cuerpo de la respuesta, y ese día el gateway
// devolvía 503 con texto plano ("upstream connect error or disconnect/reset
// before headers…") porque la base no aceptaba conexiones. Sin JSON del que
// sacar un `msg`, el mensaje quedaba en un objeto vacío, y el formulario lo
// pintaba tal cual.
//
// El costo de eso no es estético. Javier pasó una hora creyendo que el problema
// era su contraseña —me pidió que se la cambiara— cuando lo que estaba pasando
// era que un agente había llenado la base y Postgres no arrancaba. Un error que
// no dice qué pasó manda a la persona a arreglar lo que no está roto.
//
// La regla: si el mensaje del proveedor no sirve, no se muestra igual. Se mira
// el código HTTP, que sí dice algo, y se traduce a una frase que separe las dos
// preguntas que importan: **¿me equivoqué yo, o está caído?**
// ═══════════════════════════════════════════════════════════════════════════

export interface ErrorDeAuth {
  message?: string;
  status?: number;
  name?: string;
}

/** Códigos donde el problema es del servidor, no de quien escribe la clave. */
const CAIDO = [500, 502, 503, 504, 520, 521, 522, 523, 524];

/**
 * ¿El mensaje del proveedor sirve para algo?
 *
 * `{}`, `[object Object]`, vacío, o cualquier cosa que empiece con `{` o `[` es
 * un cuerpo que no se pudo interpretar, no una explicación.
 */
export function mensajeInutil(mensaje: string | undefined | null): boolean {
  const m = String(mensaje ?? "").trim();
  if (!m) return true;
  if (m === "{}" || m === "[]" || m === "[object Object]" || m === "null" || m === "undefined") return true;
  return /^[{[]/.test(m);
}

/**
 * Traduce el error de Supabase a algo accionable.
 *
 * Nunca devuelve una cadena vacía: una pantalla que falla en silencio es peor
 * que una que muestra `{}` — al menos `{}` se ve.
 */
export function explicarErrorDeLogin(error: ErrorDeAuth | null | undefined): string | null {
  if (!error) return null;

  const mensaje = String(error.message ?? "").trim();
  const status = Number(error.status) || 0;

  // El servidor está caído. Esto va PRIMERO: cuando el backend no responde, el
  // texto que venga (o que no venga) no importa.
  if (CAIDO.includes(status)) {
    return "El servidor de Alfred no está respondiendo. No es tu contraseña — probá de nuevo en unos minutos.";
  }

  if (mensajeInutil(mensaje)) {
    // Sin mensaje y sin status: ni siquiera hubo respuesta (red caída, DNS,
    // CORS, servicio que no acepta conexiones).
    if (status === 0) {
      return "No pude contactar al servidor de Alfred. Revisá tu conexión; si tenés internet, el servicio está caído.";
    }
    return `El servidor respondió ${status} sin explicación. No es tu contraseña.`;
  }

  // Estos sí son del usuario, y conviene decirlos claro y sin rodeos.
  if (/invalid login credentials|invalid_grant/i.test(mensaje)) {
    return "Email o contraseña incorrectos.";
  }
  if (/email not confirmed/i.test(mensaje)) {
    return "Falta confirmar el email de esta cuenta.";
  }
  if (/user not found/i.test(mensaje)) {
    return "No hay ninguna cuenta con ese email.";
  }
  if (/rate limit|too many requests/i.test(mensaje)) {
    return "Demasiados intentos seguidos. Esperá un minuto y volvé a probar.";
  }
  if (/password should be at least/i.test(mensaje)) {
    return "La contraseña es muy corta.";
  }

  // Algo que no está en la lista: se muestra el mensaje del proveedor, que al
  // menos es texto de verdad. Traducir a ciegas sería inventar.
  return mensaje;
}
