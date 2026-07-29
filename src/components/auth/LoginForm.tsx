"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { mensajeInutil } from "./explicarError";
import { Zap } from "lucide-react";

export function LoginForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const err = mode === "login"
      ? await signIn(email, password)
      : await signUp(email, password, name, phone);

    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-40 items-center justify-center rounded-xl bg-[#0a1628] px-4 py-2">
            <img src="/alfred-logo-dark.png" alt="Alfred" className="h-10" />
          </div>
          <p className="text-sm text-slate-500">Tu agente personal de IA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0a1628] focus:outline-none focus:ring-1 focus:ring-[#0a1628]"
                  placeholder="Tu nombre"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Telefono (WhatsApp)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0a1628] focus:outline-none focus:ring-1 focus:ring-[#0a1628]"
                  placeholder="+56 9 1234 5678"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0a1628] focus:outline-none focus:ring-1 focus:ring-[#0a1628]"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0a1628] focus:outline-none focus:ring-1 focus:ring-[#0a1628]"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {/* Última malla: si alguna vez llega algo que no es un texto usable,
              se dice eso en vez de pintar "{}" —que fue exactamente lo que pasó
              el 2026-07-28 y mandó a Javier a cambiar una contraseña que estaba
              bien—. La traducción de verdad vive en explicarError.ts. */}
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {mensajeInutil(error)
                ? "No pude iniciar sesión y el servidor no explicó por qué. Suele ser que Alfred está caído, no tu contraseña."
                : error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#0a1628] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e3a5f] disabled:opacity-50 transition-colors"
          >
            {loading ? "..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          {mode === "login" ? "No tienes cuenta?" : "Ya tienes cuenta?"}{" "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
            className="font-medium text-[#0a1628] hover:underline"
          >
            {mode === "login" ? "Registrate" : "Inicia sesion"}
          </button>
        </p>
      </div>
    </div>
  );
}
