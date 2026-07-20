"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createSession, sendPrompt, getMessages, type AlfredMessage } from "@/lib/alfred/client";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: string;
  timestamp: Date;
  rich?: { type: string; products?: any[]; actions?: any[]; [key: string]: any };
}

export function useAlfred(threadId?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(threadId ?? null);
  const threadIdRef = useRef<string | null>(threadId ?? null);
  const sessionRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenTextsRef = useRef<Set<string>>(new Set());

  // Load existing messages from Supabase if threadId provided
  useEffect(() => {
    if (!threadId) return;
    const supabase = createClient();
    supabase
      .from("conversation_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages(data.map((m) => ({
            id: String(m.id),
            role: m.role as "user" | "assistant",
            content: m.content,
            agent: m.agent ?? undefined,
            timestamp: new Date(m.created_at),
          })));
        }
      });
  }, [threadId]);

  // Initialize Router session
  const initSession = useCallback(async () => {
    if (sessionRef.current) return;
    const sid = await createSession(`Web ${user?.email ?? "user"}`, user?.id);
    if (sid) {
      sessionRef.current = sid;
      setConnected(true);
    }
  }, [user]);

  useEffect(() => {
    initSession();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [initSession]);

  // Save message to Supabase
  const saveMessage = useCallback(
    async (role: "user" | "assistant", content: string, agent?: string) => {
      if (!user) return;
      const supabase = createClient();
      let tid = threadIdRef.current;
      if (!tid) {
        const { data } = await supabase
          .from("conversation_threads")
          .insert({ user_id: user.id, channel: "web", title: content.substring(0, 50) })
          .select("id")
          .single();
        if (data) {
          tid = data.id;
          threadIdRef.current = tid;
          setCurrentThreadId(tid);
        }
      }
      if (!tid) return;
      await supabase.from("conversation_messages").insert({
        thread_id: tid,
        role,
        content,
        agent: agent ?? null,
      });
    },
    [user]
  );

  // Polling: show messages + heartbeat + detect final response
  const startPolling = useCallback(
    () => {
      if (pollRef.current) clearInterval(pollRef.current);
      let lastMsgCount = 0;
      let stablePolls = 0;
      let foundFinal = false;
      let lastHeartbeat = Date.now();
      const HEARTBEAT_INTERVAL = 15000; // Show "sigue trabajando" every 15s

      pollRef.current = setInterval(async () => {
        if (!sessionRef.current || foundFinal) return;
        try {
          const { messages: msgs, status } = await getMessages(sessionRef.current);

          // Show any new assistant messages
          let hasNew = false;
          for (const msg of msgs) {
            if (msg.role !== "assistant") continue;
            if (seenTextsRef.current.has(msg.text)) continue;
            seenTextsRef.current.add(msg.text);
            hasNew = true;

            setMessages((prev) => [...prev, {
              id: `a-${Date.now()}-${Math.random()}`,
              role: "assistant" as const,
              content: msg.text,
              agent: msg.agent,
              timestamp: new Date(),
              rich: msg.rich || undefined,
            }]);
          }

          if (hasNew) lastHeartbeat = Date.now();

          // Heartbeat: if no new messages for 15s, show "sigue trabajando"
          if (!hasNew && Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL) {
            const heartbeatId = `hb-${Date.now()}`;
            const elapsed = Math.round((Date.now() - lastHeartbeat) / 1000);
            setMessages((prev) => {
              // Remove previous heartbeat
              const withoutHb = prev.filter(m => !m.id.startsWith("hb-"));
              return [...withoutHb, {
                id: heartbeatId,
                role: "assistant" as const,
                content: `Alfred sigue trabajando... (${elapsed}s)`,
                timestamp: new Date(),
              }];
            });
          }

          // PRIMARY: Router says "done" = we're done
          if (status === "done") {
            foundFinal = true;
            if (pollRef.current) clearInterval(pollRef.current);
            setBusy(false);
            setMessages(prev => prev.filter(m => !m.id.startsWith("hb-")));
            // Save last real response
            const isProgress = (t: string) => t.endsWith("...") || t.includes("% (~") || t.includes("restantes)") || /^\s*(buscando|revisando|consultando|ejecutando|procesando|trabajando|alfred sigue)/i.test(t);
            const lastReal = msgs.filter(m => m.role === "assistant" && m.text.length > 30 && !isProgress(m.text)).pop();
            if (lastReal) saveMessage("assistant", lastReal.text, lastReal.agent);
            return;
          }

          // Safety: after 5 min of polling, stop
          stablePolls++;
          if (stablePolls > 150) {
            if (pollRef.current) clearInterval(pollRef.current);
            setBusy(false);
          }
        } catch {}
      }, 2000);
    },
    [saveMessage]
  );

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Add optimistic user message
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // If no session yet, create one
      if (!sessionRef.current) {
        await initSession();
      }
      if (!sessionRef.current) return;

      saveMessage("user", text);
      setBusy(true);
      seenTextsRef.current.clear();

      try {
        await sendPrompt(sessionRef.current, text);
        startPolling();
      } catch {
        setBusy(false);
      }
    },
    [saveMessage, startPolling, initSession]
  );

  const newThread = useCallback(() => {
    setMessages([]);
    setCurrentThreadId(null);
    threadIdRef.current = null;
    sessionRef.current = null;
    seenTextsRef.current.clear();
    if (pollRef.current) clearInterval(pollRef.current);
    setBusy(false);
    initSession();
  }, [initSession]);

  return {
    messages,
    busy,
    connected,
    send,
    newThread,
    currentThreadId,
  };
}
