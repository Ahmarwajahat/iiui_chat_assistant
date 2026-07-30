export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

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
  const targetUrls = [
    API_BASE_URL,
    "http://127.0.0.1:8000",
    "http://localhost:8000"
  ];

  // Remove duplicates
  const uniqueUrls = Array.from(new Set(targetUrls));

  let lastError: any = null;

  for (const baseUrl of uniqueUrls) {
    try {
      const response = await fetch(`${baseUrl}/chat`, {
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
      lastError = err;
      console.warn(`[API] Failed to connect to ${baseUrl}:`, err);
    }
  }

  // Graceful fallback response if API server is offline/unreachable
  return {
    query: query,
    answer: "### API Server Connection Notice\n\nUnable to reach the **IBADAT International University AI Backend server**.\n\nPlease verify that the Python FastAPI backend process is running on `http://127.0.0.1:8000`:\n```bash\ncd backend\npython server.py\n```\n\nIf deployed to production, please check that `NEXT_PUBLIC_API_BASE_URL` is set in your Vercel Environment Variables.",
    confidence_score: 0.0,
    sources: [],
    citations: [],
    conversation_id: conversationId || `err-${Date.now()}`
  };
}
