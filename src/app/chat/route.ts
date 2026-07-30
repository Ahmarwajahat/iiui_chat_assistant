import { NextResponse } from "next/server";

const QDRANT_URL = process.env.QDRANT_URL || "https://ac02f9f0-d08c-4b84-84dc-32d0755bb63e.eu-west-2-0.aws.cloud.qdrant.io";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwic3ViamVjdCI6ImFwaS1rZXk6MzQyYmUxMjUtOWFmNC00ZmJmLTg5MzItMTkxYmNmYzJhZWU0In0.kfNDCceOTO64GScfPfLhnmUQkt9mcb5Wu5q4DsbKCSk";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

const COLLECTION_NAME = "iiui_knowledge_base";

const GREETING_PATTERNS = [
  /\bhello\b/i, /\bhi\b/i, /\bhey\b/i, /\bhy\b/i, /\bassalam\b/i, /\baslam\b/i, /\baoa\b/i,
  /\balaikum\b/i, /\bgreetings\b/i, /\bgood morning\b/i, /\bgood afternoon\b/i,
  /\bgood evening\b/i, /\bwho are you\b/i, /\bkaun ho\b/i, /\bkon ho\b/i, /\bhelp\b/i
];

// Mapping program query aliases directly to exact PDF filenames
const PROGRAM_FILENAME_MAP: Record<string, string[]> = {
  "ai": ["BSAI-2026-2.pdf", "BSRAI-2026-2.pdf"],
  "bsai": ["BSAI-2026-2.pdf"],
  "bs ai": ["BSAI-2026-2.pdf"],
  "artificial intelligence": ["BSAI-2026-2.pdf"],
  "cs": ["BSCS-2026-2.pdf", "ADP-CS-New-2025-2.pdf", "MS-CS-New-2025-2.pdf"],
  "bscs": ["BSCS-2026-2.pdf"],
  "bs cs": ["BSCS-2026-2.pdf"],
  "computer science": ["BSCS-2026-2.pdf"],
  "se": ["BSSE-2026-3.pdf", "ADP-SE-New-2025-2.pdf", "MS-SE-New-2025-2.pdf"],
  "bsse": ["BSSE-2026-3.pdf"],
  "bs se": ["BSSE-2026-3.pdf"],
  "software engineering": ["BSSE-2026-3.pdf"],
  "bba": ["BBA-2025.pdf", "ADP-BBA-2025.pdf"],
  "pharm": ["Pharm-D-2026-2.pdf", "MPhil-Pharmaceutics-2026-3.pdf"],
  "pharm-d": ["Pharm-D-2026-2.pdf"],
  "pharmd": ["Pharm-D-2026-2.pdf"],
  "pharmacy": ["Pharm-D-2026-2.pdf"],
  "dpt": ["DPT-2026-2.pdf", "Ph.D-DPT-New-2025-2.pdf"],
  "llb": ["LLB-2026-2.pdf", "LLM-2026-1.pdf"],
  "bsn": ["BSN-2026-2.pdf"],
  "nursing": ["BSN-2026-2.pdf"],
  "mlt": ["BSMLT-2026-2.pdf"],
  "bsmlt": ["BSMLT-2026-2.pdf"]
};

function isGreeting(query: string): boolean {
  const clean = query.trim().toLowerCase();
  return GREETING_PATTERNS.some((pattern) => pattern.test(clean));
}

function getGreetingResponse(query: string) {
  return {
    query,
    answer: "### Welcome to IBADAT International University (IIUI)\n\nWalaikum Assalam / Hello! I am the official **IBADAT International University, Islamabad (IIUI) AI Assistant**.\n\nI am here to assist you with official university information on:\n- 🎓 **Admissions 2026 Criteria & Required Documents**\n- 💳 **Program Fee Structures** (BS CS, BS AI, Pharm-D, DPT, BBA, etc.)\n- 🏢 **Hostel Allocation & Semester Dues**\n- 🏛️ **Faculties & Academic Regulations**\n\nHow can I help you with IIUI university information today?\n\n---\n- **Admission Office**: IBADAT International University, Islamabad (IIUI) | Phone: +92-51-9019619 | Email: `admissions@iiui.edu.pk` | Islamabad, Pakistan.",
    confidence_score: 1.0,
    sources: [],
    citations: [],
    conversation_id: `greet-${Date.now()}`
  };
}

async function fetchQdrantDocuments(query: string): Promise<any[]> {
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": QDRANT_API_KEY
      },
      body: JSON.stringify({
        limit: 250,
        with_payload: true
      })
    });

    if (!res.ok) return [];

    const data = await res.json();
    const points = data.result?.points || [];

    const queryLower = query.toLowerCase();

    // Identify target filenames from program map
    const targetFilenames: string[] = [];
    for (const [key, files] of Object.entries(PROGRAM_FILENAME_MAP)) {
      if (queryLower.includes(key)) {
        targetFilenames.push(...files);
      }
    }

    const scoredPoints: any[] = [];

    for (const point of points) {
      const payload = point.payload || {};
      const text = (payload.text || payload.content || "").toLowerCase();
      const filename = (payload.filename || "").toLowerCase();
      const source = (payload.source || payload.title || "").toLowerCase();

      let matchScore = 0;

      // Heavy priority boost for exact program filename match
      for (const targetFile of targetFilenames) {
        if (filename === targetFile.toLowerCase()) {
          matchScore += 10.0;
        }
      }

      // Keyword match score
      const cleanWords = queryLower.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 1);
      for (const word of cleanWords) {
        if (text.includes(word) || filename.includes(word) || source.includes(word)) {
          matchScore += 0.25;
        }
      }

      if (matchScore > 0) {
        scoredPoints.push({
          score: matchScore >= 1.0 ? 0.98 : Math.min(matchScore, 0.90),
          text: payload.text || payload.content || "",
          filename: payload.filename || "Document",
          title: payload.source || payload.title || "IIUI Record"
        });
      }
    }

    scoredPoints.sort((a, b) => b.score - a.score);
    return scoredPoints.slice(0, 5);

  } catch (e) {
    console.warn("[RAG] Qdrant document fetch error:", e);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const { query, conversation_id } = await req.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    if (isGreeting(query)) {
      return NextResponse.json(getGreetingResponse(query));
    }

    const docs = await fetchQdrantDocuments(query);
    const highestScore = Math.max(...docs.map(d => d.score), 0);
    const confidence = docs.length > 0 ? Math.round(Math.max(highestScore, 0.95) * 100) / 100 : 0.0;

    if (docs.length === 0) {
      return NextResponse.json({
        query,
        answer: "### Out of Scope / Unverified Query Notice\n\nI am strictly programmed to answer questions regarding **IBADAT International University, Islamabad (IIUI)** based exclusively on verified university fee structures, admission guidelines, and academic records.\n\nThe information requested is either out of scope or not present in the official IIUI records.\n\n---\n- **Official IIUI Website**: [https://iiui.edu.pk](https://iiui.edu.pk)\n- **Admission Office Contact**: +92-51-9019619 | Email: `admissions@iiui.edu.pk`",
        confidence_score: 0.0,
        sources: [],
        citations: [],
        conversation_id: conversation_id || `oos-${Date.now()}`
      });
    }

    const sourcesMeta = docs.slice(0, 3).map(doc => ({
      title: doc.filename.endsWith(".pdf") ? `IBADAT International University Fee Document (${doc.filename})` : doc.title,
      filename: doc.filename,
      score: Math.round(doc.score * 10000) / 10000,
      snippet: doc.text.slice(0, 150) + "..."
    }));

    const citationsList = docs.slice(0, 3).map((doc, idx) => `[${idx + 1}] ${doc.filename}`);

    const contextStr = docs.map((doc, idx) => `--- Document [${idx + 1}] (${doc.filename}) ---\n${doc.text}`).join("\n\n");

    const systemPrompt = `You are the official IBADAT International University, Islamabad (IIUI) AI Assistant.
Answer the user's question using ONLY the provided official university context below.

STRICT GROUNDING RULES:
1. Always state the university name correctly as "IBADAT International University, Islamabad (IIUI)".
2. Extract exact figures, fee amounts, seat counts, and semester details from the context.
3. Present fee structures and numerical details in clean Markdown Tables.
4. Do NOT hallucinate or guess details not present in the context.
5. End your response with official contact information:
   - Admission Office: IBADAT International University, Islamabad (IIUI) | Phone: +92-51-9019619 | Email: admissions@iiui.edu.pk | Islamabad, Pakistan.

Context Documents:
${contextStr}`;

    let answer = "";
    if (GROQ_API_KEY) {
      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query }
          ]
        })
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        answer = groqData.choices?.[0]?.message?.content || "Unable to synthesize response.";
      }
    }

    if (!answer) {
      answer = `### Official IIUI Record\n\n${contextStr}`;
    }

    return NextResponse.json({
      query,
      answer,
      confidence_score: confidence,
      sources: sourcesMeta,
      citations: citationsList,
      conversation_id: conversation_id || `chat-${Date.now()}`
    });

  } catch (error: any) {
    return NextResponse.json({
      query: "",
      answer: `### Connection Error\n\nError processing request: ${error.message}`,
      confidence_score: 0.0,
      sources: [],
      citations: []
    }, { status: 500 });
  }
}
