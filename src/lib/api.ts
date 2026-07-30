export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: number;
  confidence_score?: number;
  sources?: Array<{
    title: string;
    filename: string;
    score: number;
    snippet: string;
  }>;
  citations?: string[];
}

export async function sendChatMessage(query: string, conversationId?: string) {
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  
  const targetUrls = [
    process.env.NEXT_PUBLIC_API_BASE_URL,
    currentOrigin,
    "",
    "http://127.0.0.1:8000",
    "http://localhost:8000"
  ].filter((url): url is string => url !== undefined && url !== null);

  const uniqueUrls = Array.from(new Set(targetUrls));

  for (const baseUrl of uniqueUrls) {
    try {
      const url = baseUrl ? `${baseUrl}/chat` : "/chat";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          conversation_id: conversationId,
        }),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (err: any) {
      console.warn(`[API] Failed to connect to ${baseUrl}:`, err);
    }
  }

  // Graceful fallback response if API server is offline/unreachable
  return {
    query: query,
    answer: "### API Server Connection Notice\n\nUnable to reach the **IBADAT International University AI Backend server**.\n\nIf running locally, please verify python server.py is active on `http://127.0.0.1:8000`.\nIf deployed on Vercel, please make sure your backend Web Service URL is set in Vercel Environment Variable `NEXT_PUBLIC_API_BASE_URL`.",
    confidence_score: 0.0,
    sources: [],
    citations: [],
    conversation_id: conversationId || `err-${Date.now()}`
  };
}
