import { useState, useRef, useCallback, useEffect } from "react";
import type { ChatMessage } from "@/lib/data";
import { gradingChat } from "@/lib/api";

export function useChat(sessionId: string) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Start writing your solution on the whiteboard, and I'll help once there's something to read.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const scrollTimeout1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimeout2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (scrollTimeout1Ref.current) clearTimeout(scrollTimeout1Ref.current);
      if (scrollTimeout2Ref.current) clearTimeout(scrollTimeout2Ref.current);
    };
  }, []);

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    if (scrollTimeout1Ref.current) clearTimeout(scrollTimeout1Ref.current);
    scrollTimeout1Ref.current = setTimeout(() => {
      if (mountedRef.current) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    try {
      setIsChatLoading(true);

      const result = await gradingChat({
        session_id: sessionId,
        message: userMsg.content,
      });

      if (!mountedRef.current) return;

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.ok
          ? result.data.reply
          : result.error || "Sorry, something went wrong. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, assistantMsg]);

      if (scrollTimeout2Ref.current) clearTimeout(scrollTimeout2Ref.current);
      scrollTimeout2Ref.current = setTimeout(() => {
        if (mountedRef.current) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } finally {
      if (mountedRef.current) setIsChatLoading(false);
    }
  }, [chatInput, sessionId]);

  return {
    chatMessages,
    chatInput,
    setChatInput,
    isChatLoading,
    chatEndRef,
    handleSendChat,
  };
}
