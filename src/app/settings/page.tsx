"use client";

import { useEffect, useState, useCallback } from "react";
import { Copy, Check, Download, Wifi, WifiOff, QrCode, RefreshCw, MessageCircle, Send } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { ROUTER_URL } from "@/lib/alfred/client";

// WAHA public URL (for QR code)
const WAHA_PUBLIC_URL = "https://waha-production-0b9e.up.railway.app";

export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bridgeToken, setBridgeToken] = useState("");
  const [bridgeActive, setBridgeActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // WhatsApp state
  const [waStatus, setWaStatus] = useState<"connected" | "disconnected" | "qr" | "loading">("loading");
  const [waQr, setWaQr] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState<string | null>(null);

  // WhatsApp settings (persisted)
  const [waSettings, setWaSettings] = useState({
    allowOthers: true,
    groupTag: "@alfred",
    autoRespond: true,
    scheduleStart: "08:00",
    scheduleEnd: "22:00",
    readOnly: false,
    forwardUnknown: true,
    responseStyle: "normal",
    language: "es",
  });
  const [waSettingsChanged, setWaSettingsChanged] = useState(false);
  const [waSettingsSaved, setWaSettingsSaved] = useState(false);

  // Telegram state
  const [tgBotToken, setTgBotToken] = useState("");
  const [tgConnected, setTgConnected] = useState(false);
  const [tgBotName, setTgBotName] = useState<string | null>(null);
  const [tgConnecting, setTgConnecting] = useState(false);
  const [tgError, setTgError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setName(data.name || "");
        setPhone(data.phone || "");
      }
    });
    setBridgeToken(`bridge_${user.id.substring(0, 16)}`);
    fetch(`${ROUTER_URL}/bridge/status`).then(r => r.json()).then(data => {
      const active = data.bridges?.some((b: { token: string }) => b.token.startsWith(`bridge_${user.id.substring(0, 8)}`));
      setBridgeActive(!!active);
    }).catch(() => {});

    // Load channel settings
    supabase.from("channel_settings").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.whatsapp) {
        setWaSettings(prev => ({ ...prev, ...data.whatsapp }));
      }
      if (data?.telegram) {
        const tg = data.telegram as any;
        if (tg.bot_token) { setTgBotToken(tg.bot_token); setTgConnected(true); setTgBotName(tg.bot_name || null); }
      }
    });

    // Check WhatsApp status
    checkWhatsAppStatus();
  }, [user]);

  const checkWhatsAppStatus = useCallback(async () => {
    setWaStatus("loading");
    try {
      const resp = await fetch(`${WAHA_PUBLIC_URL}/api/sessions/default`, {
        headers: { "X-Api-Key": "none" },
      });
      const data = await resp.json();
      if (data.status === "WORKING") {
        setWaStatus("connected");
        setWaPhone(data.me?.id?.replace("@c.us", "") || null);
      } else if (data.status === "SCAN_QR_CODE") {
        setWaStatus("qr");
        // Get QR code
        const qrResp = await fetch(`${WAHA_PUBLIC_URL}/api/sessions/default/auth/qr`, {
          headers: { "X-Api-Key": "none" },
        });
        if (qrResp.ok) {
          const qrData = await qrResp.json();
          setWaQr(qrData.value || null);
        }
      } else {
        setWaStatus("disconnected");
      }
    } catch {
      setWaStatus("disconnected");
    }
  }, []);

  const saveProfile = async () => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from("profiles").upsert({ id: user.id, name, phone });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateWaSetting = (key: string, value: any) => {
    setWaSettings(prev => ({ ...prev, [key]: value }));
    setWaSettingsChanged(true);
    setWaSettingsSaved(false);
  };

  const saveWaSettings = async () => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from("channel_settings").upsert({
      user_id: user.id,
      whatsapp: waSettings,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setWaSettingsChanged(false);
    setWaSettingsSaved(true);
    setTimeout(() => setWaSettingsSaved(false), 2000);
  };

  const connectTelegram = async () => {
    if (!tgBotToken.includes(":") || !user) return;
    setTgConnecting(true);
    setTgError(null);
    try {
      // Validate token with Telegram API
      const resp = await fetch(`https://api.telegram.org/bot${tgBotToken}/getMe`);
      const data = await resp.json();
      if (data.ok && data.result) {
        const botName = data.result.username;
        setTgBotName(botName);
        setTgConnected(true);
        // Save to Supabase
        const supabase = createClient();
        await supabase.from("channel_settings").upsert({
          user_id: user.id,
          telegram: { bot_token: tgBotToken, bot_name: botName, bot_id: data.result.id },
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      } else {
        setTgError(data.description || "Token invalido");
      }
    } catch {
      setTgError("No se pudo conectar con Telegram");
    }
    setTgConnecting(false);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(bridgeToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Configuracion</h1>
        <p className="mt-1 text-sm text-slate-400">Tu perfil, canales y conexiones</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Perfil</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0a1628] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Telefono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0a1628] focus:outline-none" placeholder="+56 9 1234 5678" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveProfile} className="rounded-lg bg-[#0a1628] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e3a5f]">
            {saved ? "Guardado!" : "Guardar"}
          </button>
          <span className="text-xs text-slate-400">{user?.email}</span>
        </div>
      </div>

      {/* Channels */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Canales de comunicacion</h2>
        <p className="text-xs text-slate-400">Conecta tus canales para hablar con Alfred desde cualquier lugar.</p>

        <div className="space-y-4">
          {/* WhatsApp */}
          <div className={`rounded-lg border p-4 space-y-3 ${waStatus === "connected" ? "border-green-200 bg-green-50" : "border-slate-200"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className={`h-4 w-4 ${waStatus === "connected" ? "text-green-600" : "text-slate-400"}`} />
                <span className="text-sm font-medium text-slate-900">WhatsApp</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${waStatus === "connected" ? "bg-green-500" : waStatus === "qr" ? "bg-yellow-500 animate-pulse" : "bg-slate-300"}`} />
                <span className={`text-xs ${waStatus === "connected" ? "text-green-600" : waStatus === "qr" ? "text-yellow-600" : "text-slate-400"}`}>
                  {waStatus === "connected" ? "Conectado" : waStatus === "qr" ? "Escanea el QR" : waStatus === "loading" ? "Verificando..." : "Desconectado"}
                </span>
              </div>
            </div>

            {waStatus === "connected" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-700">Numero: +{waPhone}</span>
                <button onClick={checkWhatsAppStatus} className="text-xs text-green-600 hover:underline flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Verificar
                </button>
              </div>
            )}

            {waStatus === "qr" && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Escanea este codigo QR con WhatsApp en tu telefono:</p>
                <div className="flex justify-center">
                  {waQr ? (
                    <div className="rounded-lg border border-slate-300 bg-white p-4">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(waQr)}`} alt="WhatsApp QR" className="h-48 w-48" />
                    </div>
                  ) : (
                    <div className="flex h-48 w-48 items-center justify-center rounded-lg border border-dashed border-slate-300">
                      <QrCode className="h-12 w-12 text-slate-300" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <button onClick={checkWhatsAppStatus} className="text-xs text-[#0a1628] hover:underline flex items-center gap-1 mx-auto">
                    <RefreshCw className="h-3 w-3" /> Ya escanee, verificar conexion
                  </button>
                </div>
              </div>
            )}

            {waStatus === "disconnected" && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">WhatsApp no esta conectado. Haz click en &ldquo;Conectar&rdquo; para generar un codigo QR.</p>
                <button onClick={checkWhatsAppStatus} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
                  Conectar WhatsApp
                </button>
              </div>
            )}

            {/* WhatsApp advanced config */}
            {waStatus === "connected" && (
              <div className="border-t border-slate-200 pt-3 mt-3 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Configuracion avanzada</p>

                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-slate-700">Permitir que otros me hablen</p><p className="text-[10px] text-slate-400">Si desactivas, solo tu puedes hablarle a Alfred</p></div>
                  <button onClick={() => updateWaSetting("allowOthers", !waSettings.allowOthers)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${waSettings.allowOthers ? "bg-green-600" : "bg-slate-300"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${waSettings.allowOthers ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>

                <div>
                  <p className="text-xs text-slate-700">Tag para grupos</p>
                  <p className="text-[10px] text-slate-400 mb-1">En grupos, Alfred solo responde si lo mencionan con este tag</p>
                  <input value={waSettings.groupTag} onChange={(e) => updateWaSetting("groupTag", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs" />
                </div>

                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-slate-700">Respuesta automatica</p><p className="text-[10px] text-slate-400">Si desactivas, Alfred espera tu confirmacion antes de responder</p></div>
                  <button onClick={() => updateWaSetting("autoRespond", !waSettings.autoRespond)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${waSettings.autoRespond ? "bg-green-600" : "bg-slate-300"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${waSettings.autoRespond ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>

                <div>
                  <p className="text-xs text-slate-700">Horario de atencion</p>
                  <p className="text-[10px] text-slate-400 mb-1">Fuera de este horario, Alfred envia respuesta automatica</p>
                  <div className="flex items-center gap-2">
                    <input type="time" value={waSettings.scheduleStart} onChange={(e) => updateWaSetting("scheduleStart", e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
                    <span className="text-xs text-slate-400">a</span>
                    <input type="time" value={waSettings.scheduleEnd} onChange={(e) => updateWaSetting("scheduleEnd", e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-slate-700">Modo solo lectura</p><p className="text-[10px] text-slate-400">Alfred lee chats pero no responde (monitoreo)</p></div>
                  <button onClick={() => updateWaSetting("readOnly", !waSettings.readOnly)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${waSettings.readOnly ? "bg-green-600" : "bg-slate-300"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${waSettings.readOnly ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div><p className="text-xs text-slate-700">Reenviar desconocidos</p><p className="text-[10px] text-slate-400">Si alguien pregunta algo que no sabe, te reenvia la pregunta</p></div>
                  <button onClick={() => updateWaSetting("forwardUnknown", !waSettings.forwardUnknown)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${waSettings.forwardUnknown ? "bg-green-600" : "bg-slate-300"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${waSettings.forwardUnknown ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>

                <div>
                  <p className="text-xs text-slate-700">Estilo de respuesta</p>
                  <select value={waSettings.responseStyle} onChange={(e) => updateWaSetting("responseStyle", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs mt-1">
                    <option value="conciso">Conciso (1-2 oraciones)</option>
                    <option value="normal">Normal</option>
                    <option value="detallado">Detallado (con explicaciones)</option>
                  </select>
                </div>

                <div>
                  <p className="text-xs text-slate-700">Idioma</p>
                  <select value={waSettings.language} onChange={(e) => updateWaSetting("language", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs mt-1">
                    <option value="es">Espanol</option>
                    <option value="en">English</option>
                    <option value="auto">Auto-detectar</option>
                  </select>
                </div>

                {/* Save button */}
                <button
                  onClick={saveWaSettings}
                  disabled={!waSettingsChanged}
                  className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    waSettingsChanged
                      ? "bg-[#e8864a] text-white hover:bg-[#d4722e]"
                      : "bg-slate-100 text-slate-400 cursor-default"
                  }`}
                >
                  {waSettingsSaved ? "Guardado!" : waSettingsChanged ? "Guardar cambios" : "Sin cambios"}
                </button>
              </div>
            )}
          </div>

          {/* Telegram */}
          <div className={`rounded-lg border p-4 space-y-3 ${tgConnected ? "border-[#0a1628]/20 bg-[#0a1628]/5" : "border-slate-200"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className={`h-4 w-4 ${tgConnected ? "text-[#0a1628]" : "text-slate-400"}`} />
                <span className="text-sm font-medium text-slate-900">Telegram</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${tgConnected ? "bg-[#0a1628]/50" : "bg-slate-300"}`} />
                <span className={`text-xs ${tgConnected ? "text-[#0a1628]" : "text-slate-400"}`}>
                  {tgConnected ? "Conectado" : "No configurado"}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Para conectar Telegram necesitas crear un Bot con @BotFather y poner el token aqui.
            </p>

            <div className="rounded-lg bg-slate-50 p-3 space-y-2">
              <p className="text-[10px] font-medium text-slate-700">Instrucciones:</p>
              <ol className="text-[10px] text-slate-500 space-y-1 list-decimal list-inside">
                <li>Abre Telegram y busca <code className="bg-slate-200 px-1 rounded">@BotFather</code></li>
                <li>Envia <code className="bg-slate-200 px-1 rounded">/newbot</code> y sigue las instrucciones</li>
                <li>Copia el token que te da (ej: <code className="bg-slate-200 px-1 rounded">123456:ABC-DEF...</code>)</li>
                <li>Pegalo abajo y haz click en Conectar</li>
              </ol>
            </div>

            {tgConnected && tgBotName && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#0a1628]">Bot: @{tgBotName}</span>
              </div>
            )}

            {!tgConnected && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bot Token</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={tgBotToken}
                    onChange={(e) => { setTgBotToken(e.target.value); setTgError(null); }}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0a1628] focus:outline-none"
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  />
                  <button
                    onClick={connectTelegram}
                    disabled={!tgBotToken.includes(":") || tgConnecting}
                    className="rounded-lg bg-[#0a1628] px-4 py-2 text-xs font-medium text-white hover:bg-[#1e3a5f] disabled:opacity-40"
                  >
                    {tgConnecting ? "..." : "Conectar"}
                  </button>
                </div>
                {tgError && <p className="text-xs text-red-500 mt-1">{tgError}</p>}
              </div>
            )}
          </div>

          {/* Web */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-slate-900">Web</span>
              </div>
              <span className="text-xs text-green-600">Siempre activo</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Estas usandolo ahora mismo. No requiere configuracion.</p>
          </div>
        </div>
      </div>

      {/* PC Bridge */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">PC Bridge</h2>
          <div className="flex items-center gap-1.5 text-xs">
            {bridgeActive ? (
              <><Wifi className="h-3.5 w-3.5 text-green-500" /><span className="text-green-600">Conectado</span></>
            ) : (
              <><WifiOff className="h-3.5 w-3.5 text-slate-400" /><span className="text-slate-400">Desconectado</span></>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Permite que Alfred navegue internet usando tu computador. Necesario para Lider, bancos y sitios con Cloudflare.
        </p>

        {/* Token — always visible */}
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Tu token (solo se necesita una vez)</label>
          <div className="flex gap-2">
            <code className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700 select-all">{bridgeToken}</code>
            <button onClick={copyToken} className="flex items-center gap-1 rounded-lg bg-[#0a1628] px-3 py-2 text-xs text-white hover:bg-[#1e3a5f]">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>

        {/* Chrome Extension */}
        <div className="rounded-lg border border-[#0a1628]/20 bg-[#0a1628]/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🧩</span>
            <p className="text-xs font-medium text-[#0a1628]">Extension de Chrome</p>
          </div>
          <ol className="text-[10px] text-[#0a1628] space-y-1.5 list-decimal list-inside">
            <li>Descarga e instala la extension</li>
            <li>Click en el icono <strong>A</strong> en la barra de Chrome</li>
            <li>Pega tu token (copialo arriba) y haz click Conectar</li>
            <li>Listo — funciona siempre que Chrome este abierto</li>
          </ol>
          <a href="/alfred-bridge-extension.zip" download className="inline-flex items-center gap-1 rounded-md bg-[#0a1628] px-4 py-2 text-xs font-medium text-white hover:bg-[#1e3a5f]">
            <Download className="h-3.5 w-3.5" /> Descargar Extension
          </a>
        </div>

        {/* Method 2: Script Python (advanced) */}
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-xs text-slate-500 hover:text-slate-700">
            <span className="group-open:rotate-90 transition-transform">▶</span>
            Metodo avanzado (script Python)
          </summary>
          <div className="mt-3 rounded-lg bg-slate-50 p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tu token</label>
              <div className="flex gap-2">
                <code className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-600">{bridgeToken}</code>
                <button onClick={copyToken} className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-white">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-700">Instrucciones:</p>
              <ol className="text-[10px] text-slate-500 space-y-1 list-decimal list-inside">
                <li>Descarga el archivo <code className="bg-slate-200 px-1 rounded">alfred-bridge.py</code></li>
                <li>Abre la Terminal (Mac) o CMD (Windows)</li>
                <li>Instala dependencias: <code className="bg-slate-200 px-1 rounded">pip3 install playwright websockets && python3 -m playwright install chromium</code></li>
                <li>Ejecuta: <code className="bg-slate-200 px-1 rounded">python3 alfred-bridge.py --token {bridgeToken}</code></li>
                <li>Se abrira un navegador controlado por Alfred</li>
              </ol>
            </div>

            <a
              href="/alfred-bridge.py"
              download="alfred-bridge.py"
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" /> Descargar alfred-bridge.py
            </a>
          </div>
        </details>
      </div>
    </div>
  );
}
