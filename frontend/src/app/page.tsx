"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Send, Bot, User, Sparkles, Copy, Check, RotateCcw, Trash2, 
  ArrowUpRight, CheckCircle2, FileText, Download, FileDown, ShieldCheck, ExternalLink, HelpCircle,
  Database, Layers, Award, BookOpen, Search
} from "lucide-react";
import { sendChatMessage, ChatMessage } from "@/lib/api";
import jsPDF from "jspdf";

const SUGGESTED_QUESTIONS = [
  { text: "How can I apply for BS AI in Admissions 2026?", icon: "🎓", tag: "Admissions", desc: "Eligibility criteria & required entry tests" },
  { text: "What is the fee structure for BS CS?", icon: "💳", tag: "Fee Details", desc: "Tuition, admission & total semester dues" },
  { text: "Tell me about hostel facilities & semester dues.", icon: "🏢", tag: "Hostels", desc: "Room allotment & hostel fee details" },
  { text: "What documents are required for admission?", icon: "📄", tag: "Requirements", desc: "Matric, FSC, CNIC & photograph rules" },
  { text: "Where is the Faculty of Engineering?", icon: "🏛️", tag: "Campus Guide", desc: "Department locations & office hours" },
  { text: "What is the fee structure in Pharm-D?", icon: "💊", tag: "Pharmacy", desc: "5-Year Pharm-D tuition & lab charges" },
];

/**
 * Custom Markdown Parser for Visual Excellence
 * Converts Markdown tables, headings, bold text, bullet points, and dividers into rich styled elements.
 */
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];

  const flushTable = (key: number) => {
    if (tableHeader.length > 0) {
      elements.push(
        <div key={`table-${key}`} className="overflow-x-auto my-3 rounded-xl border border-slate-200 shadow-sm">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-[#0B6E4F] to-[#14B8A6] text-white">
                {tableHeader.map((th, i) => (
                  <th key={i} className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider">
                    {th.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 1 ? "bg-slate-50/60" : "bg-white"}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2 text-[11px] text-slate-700 font-medium">
                      {cell.trim().replace(/\*\*(.*?)\*\*/g, "$1")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    inTable = false;
    tableHeader = [];
    tableRows = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // 1. Table Detection (| Cell | Cell |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.split("|").slice(1, -1);
      
      // Divider line (| --- | --- |)
      if (trimmed.includes("---")) {
        return;
      }
      
      if (!inTable) {
        inTable = true;
        tableHeader = cells;
      } else {
        tableRows.push(cells);
      }
      return;
    } else if (inTable) {
      flushTable(idx);
    }

    // 2. Headings (### or ##)
    if (trimmed.startsWith("###") || trimmed.startsWith("##")) {
      const headingText = trimmed.replace(/^#+\s*/, "");
      elements.push(
        <div key={idx} className="flex items-center gap-2 mt-4 mb-2 pb-1.5 border-b border-emerald-100/80">
          <span className="w-1.5 h-4 bg-gradient-to-b from-[#0B6E4F] to-[#14B8A6] rounded-full" />
          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{headingText}</h3>
        </div>
      );
      return;
    }

    // 3. Divider (---)
    if (trimmed === "---") {
      elements.push(
        <div key={idx} className="my-3 border-t border-dashed border-slate-200" />
      );
      return;
    }

    // 4. Bullet Points (* or - or •)
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      const listText = trimmed.replace(/^[*•-]\s*/, "");
      elements.push(
        <div key={idx} className="flex items-start gap-2.5 my-1.5 pl-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0B6E4F] shrink-0 mt-1.5 shadow-sm shadow-[#0B6E4F]/40" />
          <span className="text-xs text-slate-700 leading-relaxed font-medium">
            {formatInlineFormatting(listText)}
          </span>
        </div>
      );
      return;
    }

    // 5. Regular Paragraph
    if (trimmed) {
      elements.push(
        <p key={idx} className="my-1.5 text-xs text-slate-800 leading-relaxed font-normal">
          {formatInlineFormatting(trimmed)}
        </p>
      );
    }
  });

  if (inTable) {
    flushTable(9999);
  }

  return <div className="space-y-1">{elements}</div>;
}

/** Format bold text (**text**) and code tags (`code`) inline */
function formatInlineFormatting(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-extrabold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="px-1.5 py-0.5 rounded bg-emerald-50 text-[#0B6E4F] font-mono text-[11px] border border-emerald-200/80 font-bold shadow-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function IIUIAIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    setInputQuery("");
    setIsLoading(true);

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);

    try {
      const data = await sendChatMessage(textToSend);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: data.answer,
        confidence_score: data.confidence_score,
        sources: data.sources,
        citations: data.citations,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("API Chat Error:", err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: "I'm having trouble connecting to the IIUI AI Backend server. Please ensure the Python API server is active on `http://127.0.0.1:8000`.",
        confidence_score: 0.5,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerate = () => {
    if (messages.length === 0) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.sender === "user");
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.text);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  // Export Single Answer PDF
  const handleExportSingleAnswerPDF = (answerText: string) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("IBADAT International University, Islamabad (IIUI)", 14, 20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Official AI Assistant Response Transcript - ${new Date().toLocaleDateString()}`, 14, 27);
    doc.setLineWidth(0.5);
    doc.line(14, 30, 196, 30);

    const cleanText = answerText.replace(/[#*_`|]/g, " ");
    const splitText = doc.splitTextToSize(cleanText, 170);
    
    let yPos = 40;
    splitText.forEach((line: string) => {
      if (yPos > 275) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, 14, yPos);
      yPos += 6;
    });

    doc.save(`IIUI_AI_Response_${Date.now()}.pdf`);
  };

  // Export Full Chat PDF
  const handleExportFullChatPDF = () => {
    if (messages.length === 0) return;
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("IBADAT International University, Islamabad (IIUI)", 14, 20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Full AI Conversation Log - ${new Date().toLocaleDateString()}`, 14, 27);
    doc.setLineWidth(0.5);
    doc.line(14, 30, 196, 30);

    let yPos = 38;
    messages.forEach((msg) => {
      if (yPos > 265) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`${msg.sender.toUpperCase()}:`, 14, yPos);
      yPos += 6;
      doc.setFont("helvetica", "normal");

      const cleanText = msg.text.replace(/[#*_`|]/g, " ");
      const splitText = doc.splitTextToSize(cleanText, 170);
      
      splitText.forEach((line: string) => {
        if (yPos > 275) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, 14, yPos);
        yPos += 6;
      });
      yPos += 4;
    });

    doc.save(`IIUI_Full_Chat_Log_${Date.now()}.pdf`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-mesh-glow selection:bg-[#0B6E4F]/20">
      
      {/* 1. TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* IIUI Shield Emblem */}
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0B6E4F] via-[#08563d] to-[#14B8A6] flex items-center justify-center text-white shadow-lg shadow-[#0B6E4F]/25 border border-white/20">
              <Sparkles className="w-5 h-5 text-emerald-200 animate-pulse" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white pulse-green" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                  IBADAT International University
                </h1>
                <span className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-50 text-[#0B6E4F] rounded-full border border-emerald-200/80 shadow-2xs">
                  <Database className="w-3 h-3 text-[#0B6E4F]" />
                  Qdrant Cloud Active
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Official RAG AI Assistant & Knowledge Base (78 Fee Structure PDFs Included)
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <>
                <button
                  onClick={handleExportFullChatPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-50 to-teal-50 text-[#0B6E4F] hover:from-emerald-100 hover:to-teal-100 border border-emerald-200/80 transition-all shadow-xs active:scale-95"
                  title="Export entire chat conversation as PDF"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export Full Chat PDF</span>
                </button>

                <button
                  onClick={handleClearChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-all active:scale-95"
                  title="Clear conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN CHAT AREA */}
      <main className="flex-1 max-w-5xl mx-auto w-full flex flex-col p-4 md:p-6 justify-between">
        
        {/* Messages Feed or Empty State */}
        <div className="flex-1 overflow-y-auto space-y-6 pb-6">
          {messages.length === 0 ? (
            <div className="py-8 sm:py-12 flex flex-col items-center justify-center text-center space-y-6">
              
              {/* HERO EMBLEM CARD */}
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#0B6E4F] via-[#08563d] to-[#14B8A6] text-white flex items-center justify-center shadow-2xl shadow-[#0B6E4F]/30 border-2 border-white/20">
                  <Bot className="w-10 h-10" />
                </div>
                <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded-full shadow-md uppercase tracking-wider">
                  2026 AI Agent
                </div>
              </div>

              <div className="max-w-lg space-y-2">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
                  Ask anything about IIUI Admissions, Fees & Hostels
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">
                  Trained strictly on 160 official vector chunks & 78 program fee PDFs. Instant, verified answers grounded in official records.
                </p>
              </div>

              {/* CATEGORY TAG CHIPS */}
              <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                {["🎓 Admissions 2026", "💳 Fee Structures", "🏢 Hostels", "📄 Eligibility", "🏛️ Faculties"].map((tag, i) => (
                  <span key={i} className="px-3 py-1 bg-white/80 rounded-full border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs">
                    {tag}
                  </span>
                ))}
              </div>

              {/* SUGGESTED QUESTIONS GRID */}
              <div className="w-full max-w-3xl pt-2">
                <div className="flex items-center justify-between mb-3 px-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    Popular Queries
                  </p>
                  <span className="text-[11px] font-bold text-[#0B6E4F] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> One-click search
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-left">
                  {SUGGESTED_QUESTIONS.map((sq, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(sq.text)}
                      className="glass-card glass-card-hover p-4 rounded-2xl text-left flex flex-col justify-between group cursor-pointer"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xl p-1.5 bg-emerald-50 rounded-xl border border-emerald-100">{sq.icon}</span>
                          <span className="px-2 py-0.5 text-[9px] font-extrabold bg-[#0B6E4F]/10 text-[#0B6E4F] rounded-full border border-[#0B6E4F]/20 uppercase">
                            {sq.tag}
                          </span>
                        </div>
                        <p className="font-extrabold text-xs text-slate-900 group-hover:text-[#0B6E4F] transition-colors leading-snug">
                          {sq.text}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {sq.desc}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 group-hover:text-[#0B6E4F] transition-colors">
                        <span>Query Assistant</span>
                        <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 md:gap-4 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "ai" && (
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#0B6E4F] via-[#08563d] to-[#14B8A6] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[#0B6E4F]/20 mt-1 border border-white/20">
                    <Bot className="w-4.5 h-4.5" />
                  </div>
                )}

                <div
                  className={`max-w-3xl rounded-3xl p-5 shadow-xs text-xs leading-relaxed space-y-3.5 ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-[#0B6E4F] to-[#08563d] text-white rounded-tr-xs font-semibold shadow-md shadow-[#0B6E4F]/15"
                      : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-xs"
                  }`}
                >
                  {/* AI Badge Header */}
                  {msg.sender === "ai" && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[10px] font-bold">
                      <div className="flex items-center gap-1.5 text-[#0B6E4F]">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>IIUI Verified RAG Assistant</span>
                      </div>
                      <span className="text-slate-400 font-mono">Grounded Vector Search</span>
                    </div>
                  )}

                  {msg.sender === "user" ? (
                    <div className="whitespace-pre-wrap font-semibold text-sm leading-relaxed">{msg.text}</div>
                  ) : (
                    <MarkdownRenderer content={msg.text} />
                  )}

                  {/* AI Response Footer: Confidence Score Bar, Retrieved Qdrant Sources & Action Toolbar */}
                  {msg.sender === "ai" && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      
                      {/* GROUNDED CONFIDENCE PROGRESS BAR */}
                      {msg.confidence_score !== undefined && (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-slate-700">
                              <Award className="w-3.5 h-3.5 text-[#0B6E4F]" />
                              Document Grounding Score:
                            </span>
                            <span className={`px-2 py-0.5 rounded-full font-black ${
                              msg.confidence_score > 0.7 
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                                : msg.confidence_score > 0
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-slate-200 text-slate-700"
                            }`}>
                              {Math.round(msg.confidence_score * 100)}% Match
                            </span>
                          </div>

                          {/* Visual Progress Bar */}
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-[#0B6E4F] to-[#14B8A6] rounded-full transition-all duration-500" 
                              style={{ width: `${Math.round(msg.confidence_score * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* RETRIEVED QDRANT SOURCES CARDS */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <BookOpen className="w-3 h-3 text-[#0B6E4F]" />
                            Retrieved Qdrant Documents ({msg.sources.length}):
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200/90 shadow-2xs hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
                              >
                                <span>📄</span>
                                <span className="truncate max-w-[180px]">{src.filename || src.title}</span>
                                {src.score && (
                                  <span className="text-[9px] text-[#0B6E4F] bg-white px-1.5 py-0.2 rounded border border-emerald-200">
                                    {Math.round(src.score * 100)}%
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ACTION TOOLBAR */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                        <div className="flex items-center gap-3 text-slate-500">
                          <button
                            onClick={() => handleCopy(msg.text, msg.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-[#0B6E4F] transition-colors font-bold text-[11px]"
                            title="Copy Answer Text"
                          >
                            {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                          </button>

                          <button
                            onClick={handleRegenerate}
                            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 text-slate-600 hover:text-[#0B6E4F] transition-colors font-bold text-[11px]"
                            title="Regenerate Answer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Regenerate</span>
                          </button>
                        </div>

                        {/* Export Answer PDF Button */}
                        <button
                          onClick={() => handleExportSingleAnswerPDF(msg.text)}
                          className="flex items-center gap-1.5 px-3 py-1.2 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-[#0B6E4F] hover:to-[#08563d] text-[#0B6E4F] hover:text-white transition-all font-black text-[10px] border border-emerald-200/80 shadow-2xs active:scale-95"
                          title="Download this response as PDF document"
                        >
                          <Download className="w-3 h-3" />
                          <span>Export Answer PDF</span>
                        </button>
                      </div>

                    </div>
                  )}
                </div>

                {msg.sender === "user" && (
                  <div className="w-9 h-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-md mt-1 font-extrabold text-xs">
                    <User className="w-4.5 h-4.5" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-slate-500">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#0B6E4F] to-[#14B8A6] flex items-center justify-center text-white shrink-0 shadow-md">
                <Bot className="w-4.5 h-4.5 animate-bounce" />
              </div>
              <div className="px-5 py-3.5 bg-white border border-slate-200 rounded-2xl flex items-center gap-2.5 shadow-sm">
                <span className="font-bold text-slate-700">IIUI AI is querying Qdrant Cloud vectors...</span>
                <div className="flex items-center gap-1">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. INPUT AREA */}
        <div className="pt-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="relative flex items-center bg-white rounded-2xl border border-slate-300 shadow-lg shadow-slate-200/50 focus-within:border-[#0B6E4F] focus-within:ring-4 focus-within:ring-[#0B6E4F]/15 transition-all p-2.5"
          >
            <div className="pl-2 pr-1 text-slate-400">
              <Search className="w-4 h-4 text-[#0B6E4F]" />
            </div>
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask anything about IBADAT International University admissions, fee structures, hostels..."
              className="w-full px-2 py-1 text-xs sm:text-sm outline-none bg-transparent text-slate-900 placeholder-slate-400 font-medium"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors"
                  title="Clear Chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={!inputQuery.trim() || isLoading}
                className="px-4 py-2.5 bg-gradient-to-r from-[#0B6E4F] via-[#08563d] to-[#14B8A6] hover:from-[#08563d] hover:to-[#0f9f8e] text-white text-xs font-black rounded-xl disabled:opacity-40 shadow-md shadow-[#0B6E4F]/25 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <span>Ask AI</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>

        {/* 4. FOOTER */}
        <footer className="mt-6 pt-4 border-t border-slate-200 text-center space-y-1">
          <p className="text-xs font-bold text-slate-600">
            Powered by <span className="text-[#0B6E4F] font-black">IBADAT International University (IIUI) AI Assistant</span>
          </p>
          <p className="text-[11px] text-slate-400 font-medium">
            Strictly grounded in official university documentation & 78 fee structure PDFs.
          </p>
        </footer>
      </main>

    </div>
  );
}
