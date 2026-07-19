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
    const sid = await createSession(`Web ${user?.email ?? "user"}`);
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

  // Poll for responses
  const startPolling = useCallback(
    (userMsgCount: number) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        if (!sessionRef.current) return;
        const msgs = await getMessages(sessionRef.current);
        if (msgs.length <= userMsgCount) return; // No new messages yet

        // Find new assistant messages
        const newMsgs = msgs.slice(userMsgCount);
        const assistantMsgs = newMsgs.filter((m) => m.role === "assistant");

        if (assistantMsgs.length > 0) {
          const lastMsg = assistantMsgs[assistantMsgs.length - 1];

          // Check if this is a "done" response (not just progress)
          // Wait one more poll to confirm no more messages coming
          if (msgs.length === msgCountRef.current) {
            // Same count as last poll — response is stable
            if (pollRef.current) clearInterval(pollRef.current);
            setBusy(false);

            // Add assistant message(s)
            for (const am of assistantMsgs) {
              const chatMsg: ChatMessage = {
                id: `a-${Date.now()}-${Math.random()}`,
                role: "assistant",
                content: am.text,
                agent: am.agent,
                timestamp: new Date(),
              };
              setMessages((prev) => {
                // Avoid duplicates
                if (prev.some((p) => p.content === am.text && p.role === "assistant")) return prev;
                return [...prev, chatMsg];
              });
              saveMessage("assistant", am.text, am.agent);
            }
          }
          msgCountRef.current = msgs.length;
        }
      }, 2000);
    },
    [saveMessage]
  );

  const send = useCallback(
    async (text: string) => {
      if (!sessionRef.current || busy) return;

      // Add optimistic user message
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
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
