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

  // Simple polling: show ALL new assistant messages as they appear
  const startPolling = useCallback(
    () => {
      if (pollRef.current) clearInterval(pollRef.current);
      let lastMsgCount = 0;
      let stablePolls = 0;
      let foundFinal = false;

      pollRef.current = setInterval(async () => {
        if (!sessionRef.current || foundFinal) return;
        try {
          const msgs = await getMessages(sessionRef.current);

          // Show any new assistant messages
          for (const msg of msgs) {
            if (msg.role !== "assistant") continue;
            if (seenTextsRef.current.has(msg.text)) continue;
            seenTextsRef.current.add(msg.text);

            setMessages((prev) => [...prev, {
              id: `a-${Date.now()}-${Math.random()}`,
              role: "assistant" as const,
              content: msg.text,
              agent: msg.agent,
              timestamp: new Date(),
              rich: msg.rich || undefined,
            }]);
          }

          // Check stability: if message count hasn't changed for 3 polls (6s) = done
          if (msgs.length === lastMsgCount && msgs.length > 0) {
            stablePolls++;
          } else {
            stablePolls = 0;
            lastMsgCount = msgs.length;
          }

          // After 3 stable polls AND we have at least 1 non-progress assistant message = done
          if (stablePolls >= 3) {
            const assistantMsgs = msgs.filter(m => m.role === "assistant");
            const hasRealResponse = assistantMsgs.some(m =>
              m.text.length > 30 &&
              !m.text.endsWith("...") &&
              !m.text.includes("% (~") &&
              !m.text.match(/^\s*(buscando|revisando|consultando|ejecutando|procesando)/i)
            );
            if (hasRealResponse) {
              foundFinal = true;
              if (pollRef.current) clearInterval(pollRef.current);
              setBusy(false);
              // Save the final response
              const lastReal = assistantMsgs.filter(m => m.text.length > 30 && !m.text.endsWith("...")).pop();
              if (lastReal) saveMessage("assistant", lastReal.text, lastReal.agent);
            }
          }

          // Safety: after 5 min of polling, stop
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
