import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
}

interface CurrentAnswer {
  content: string;
  reasoning: string;
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
  thinking: boolean;
}

export function useMultiModelChat(apiKey: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [current, setCurrent] = useState<CurrentAnswer>({
    content: "",
    reasoning: "",
    imageUrl: null,
    loading: false,
    error: null,
    thinking: false,
  });
  const abortRef = useRef<AbortController | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);
  const MIN_UPDATE_INTERVAL = 16;

  const flushBatchUpdate = useCallback((updates: Partial<CurrentAnswer>) => {
    const now = performance.now();
    if (now - lastUpdateRef.current < MIN_UPDATE_INTERVAL) {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          setCurrent((prev) => ({ ...prev, ...updates }));
          rafRef.current = null;
        });
      }
      return;
    }
    lastUpdateRef.current = now;
    setCurrent((prev) => ({ ...prev, ...updates }));
  }, []);

  const sendMessage = useCallback(async (userContent: string) => {
    if (!apiKey) return;
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const newUserMsg: ChatMessage = { role: "user", content: userContent };
    
    // 使用函数式更新获取最新消息列表
    let latestMessages: ChatMessage[];
    setMessages((prev) => {
      latestMessages = [...prev, newUserMsg];
      return latestMessages;
    });

    setCurrent({
      content: "",
      reasoning: "",
      imageUrl: null,
      loading: true,
      error: null,
      thinking: true,
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          messages: latestMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalContent = "";
      let finalReasoning = "";
      let finalImageUrl: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]" || payload === "done") continue;

          try {
            const data = JSON.parse(payload);
            if (data.type === "done") {
              setCurrent((prev) => ({ ...prev, loading: false, thinking: false }));
              const assistantMsg: ChatMessage = {
                role: "assistant",
                content: finalContent || "（无内容）",
                imageUrl: finalImageUrl,
              };
              setMessages((prev) => [...prev, assistantMsg]);
              continue;
            }

            if (data.type === "thinking") {
              flushBatchUpdate({ thinking: true });
            } else if (data.type === "token") {
              finalContent += data.content;
              flushBatchUpdate({ content: finalContent, thinking: false });
            } else if (data.type === "reasoning") {
              finalReasoning += data.content;
              flushBatchUpdate({ reasoning: finalReasoning });
            } else if (data.type === "image") {
              finalImageUrl = data.url;
              flushBatchUpdate({ imageUrl: data.url });
            } else if (data.type === "finish") {
              flushBatchUpdate({ loading: false });
            } else if (data.type === "error") {
              const err = JSON.stringify(data.error);
              flushBatchUpdate({ error: err, loading: false });
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
      const msg = e.message || String(e);
      setCurrent((prev) => ({ ...prev, loading: false, thinking: false, error: msg }));
    }
  }, [apiKey]);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setCurrent((prev) => ({ ...prev, loading: false, thinking: false }));
  }, []);

  return { messages, current, sendMessage, stop };
}
