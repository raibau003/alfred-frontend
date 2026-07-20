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
  const sessionRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgCountRef = useRef(0);

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
          setMessages(
            data.map((m) => ({
              id: String(m.id),
              role: m.role as "user" | "assistant",
              content: m.content,
              agent: m.agent ?? undefined,
              timestamp: new Date(m.created_at),
            }))
          );
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

      // Create thread if needed
      let tid = currentThreadId;
      if (!tid) {
        const { data } = await supabase
          .from("conversation_threads")
          .insert({ user_id: user.id, channel: "web", title: content.substring(0, 50) })
          .select("id")
          .single();
        if (data) {
          tid = data.id;
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
    [user, currentThreadId]
  );

  // Poll for responses — update progress live, detect final response
  const startPolling = useCallback(
    (userMsgCount: number) => {
      if (pollRef.current) clearInterval(pollRef.current);
      let lastContent = "";
      let stableCount = 0;

      pollRef.current = setInterval(async () => {
        if (!sessionRef.current) return;
        const msgs = await getMessages(sessionRef.current);

        // Get all assistant messages after the user's message
        const assistantMsgs = msgs.filter((m, i) => m.role === "assistant" && i >= userMsgCount - 1);
        if (assistantMsgs.length === 0) return;

        const lastMsg = assistantMsgs[assistantMsgs.length - 1];
        const PROGRESS_RE = /^(buscando|revisando|consultando|ejecutando|procesando|analizando|conectando|obteniendo|cargando|trabajando)/i;
        const isProgress = PROGRESS_RE.test(lastMsg.text.trim()) || lastMsg.text.endsWith("...");

        // Update progress message in chat (replace the dots/progress)
        if (isProgress) {
          setMessages((prev) => {
            const existing = prev.find(p => p.id === "progress");
            if (existing) {
              return prev.map(p => p.id === "progress" ? { ...p, content: lastMsg.text } : p);
            }
            return [...prev, { id: "progress", role: "assistant" as const, content: lastMsg.text, timestamp: new Date() }];
          });
          stableCount = 0;
          lastContent = lastMsg.text;
          return;
        }

        // Non-progress text — check if stable (same content 2 polls in a row)
        if (lastMsg.text === lastContent) {
          stableCount++;
        } else {
          stableCount = 0;
          lastContent = lastMsg.text;
        }

        if (stableCount >= 1) {
          // Stable — this is the final response
          if (pollRef.current) clearInterval(pollRef.current);
          setBusy(false);

          // Remove progress message and add final response
          setMessages((prev) => {
            const withoutProgress = prev.filter(p => p.id !== "progress");
            // Avoid duplicates
            if (withoutProgress.some(p => p.content === lastMsg.text && p.role === "assistant")) return withoutProgress;
            return [...withoutProgress, {
              id: `a-${Date.now()}`,
              role: "assistant" as const,
              content: lastMsg.text,
              agent: lastMsg.agent,
              timestamp: new Date(),
              rich: lastMsg.rich || undefined,
            }];
          });
          saveMessage("assistant", lastMsg.text, lastMsg.agent);
        }
      }, 2000);
    },
    [saveMessage]
  );

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Add optimistic user message FIRST (always show what user typed)
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
      if (!sessionRef.current) return; // Still no session — Router might be down
      saveMessage("user", text);

      setBusy(true);
      msgCountRef.current = 0;

      try {
        await sendPrompt(sessionRef.current, text);
        // Count current messages to know where new ones start
        const currentMsgs = await getMessages(sessionRef.current);
        startPolling(currentMsgs.length);
      } catch {
        setBusy(false);
      }
    },
    [busy, saveMessage, startPolling]
  );

  const newThread = useCallback(() => {
    setMessages([]);
    setCurrentThreadId(null);
    sessionRef.current = null;
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
