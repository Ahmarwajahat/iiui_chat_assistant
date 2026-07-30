import { NextResponse } from "next/server";

const QDRANT_URL = process.env.QDRANT_URL || "https://ac02f9f0-d08c-4b84-84dc-32d0755bb63e.eu-west-2-0.aws.cloud.qdrant.io";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

const COLLECTION_NAME = "iiui_knowledge_base";
const VECTOR_SIZE = 384;
const MIN_RELEVANCE_SCORE = 0.45;

const GREETING_PATTERNS = [
  /\bhello\b/i, /\bhi\b/i, /\bhey\b/i, /\bassalam\b/i, /\baslam\b/i, /\baoa\b/i,
  /\balaikum\b/i, /\bgreetings\b/i, /\bgood morning\b/i, /\bgood afternoon\b/i,
  /\bgood evening\b/i, /\bwho are you\b/i, /\bkaun ho\b/i, /\bkon ho\b/i, /\bhelp\b/i
];

function isGreeting(query: string): boolean {
  const clean = query.trim();
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

async function getEmbedding(text: string): Promise<number[]> {
  try {
    const res = await fetch("https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } })
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        if (Array.isArray(data[0])) return data[0];
        if (data.length === VECTOR_SIZE) return data;
      }
    }
  } catch (e) {
    console.warn("Embedding API notice:", e);
  }
  return new Array(VECTOR_SIZE).fill(0.0);
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

    // 1. Vectorize query
    const vector = await getEmbedding(query);

    // 2. Query Qdrant Cloud
    const qdrantRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": QDRANT_API_KEY
      },
      body: JSON.stringify({
        vector,
        limit: 3,
        with_payload: true
      })
    });

    let retrievedDocs: any[] = [];
    if (qdrantRes.ok) {
      const qdrantData = await qdrantRes.json();
      retrievedDocs = (qdrantData.result || []).map((hit: any) => ({
        score: hit.score || 0,
        content: hit.payload?.content || "",
        filename: hit.payload?.filename || "Document",
        title: hit.payload?.title || "IIUI Record"
      }));
    }

    const relevantDocs = retrievedDocs.filter((doc) => doc.score >= MIN_RELEVANCE_SCORE);
    const highestScore = Math.max(...relevantDocs.map((d) => d.score), 0);
    const confidence = Math.round(highestScore * 100) / 100;

    if (relevantDocs.length === 0) {
      return NextResponse.json({
        query,
        answer: "### Out of Scope / Unverified Query Notice\n\nI am strictly programmed to answer questions regarding **IBADAT International University, Islamabad (IIUI)** based exclusively on verified university fee structures, admission guidelines, and academic records.\n\nThe information requested is either out of scope or not present in the official IIUI records.\n\n---\n- **Official IIUI Website**: [https://iiui.edu.pk](https://iiui.edu.pk)\n- **Admission Office Contact**: +92-51-9019619 | Email: `admissions@iiui.edu.pk`",
        confidence_score: 0.0,
        sources: [],
        citations: [],
        conversation_id: conversation_id || `oos-${Date.now()}`
      });
    }

    const sourcesMeta = relevantDocs.map((doc, idx) => ({
      title: doc.filename.endsWith(".pdf") ? `IBADAT International University Fee Document (${doc.filename})` : doc.title,
      filename: doc.filename,
      score: Math.round(doc.score * 10000) / 10000,
      snippet: doc.content.slice(0, 150) + "..."
    }));

    const citationsList = relevantDocs.map((doc, idx) => `[${idx + 1}] ${doc.filename}`);

    const contextStr = relevantDocs.map((doc, idx) => `--- Document [${idx + 1}] (${doc.filename}) ---\n${doc.content}`).join("\n\n");

    // 3. Call Groq API
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

    let answer = "";
    if (groqRes.ok) {
      const groqData = await groqRes.json();
      answer = groqData.choices?.[0]?.message?.content || "Unable to synthesize response.";
    } else {
      answer = `### Retrieved Information\n\n${contextStr}\n\n*Official IIUI Record*`;
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
