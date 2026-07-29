"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Send, User, Copy, Check, RotateCcw, Trash2, 
  ArrowUpRight, CheckCircle2, FileText, Download, FileDown, ShieldCheck, 
  Search, BookOpen, GraduationCap, Building2, CreditCard, PhoneCall, HelpCircle,
  Sparkles, CheckCircle, ChevronRight, Info
} from "lucide-react";
import { sendChatMessage, ChatMessage } from "@/lib/api";
import jsPDF from "jspdf";

const CATEGORY_TABS = [
  { id: "all", label: "All Info", icon: BookOpen },
  { id: "admissions", label: "Admissions 2026", icon: GraduationCap },
  { id: "fees", label: "Program Fees", icon: CreditCard },
  { id: "hostels", label: "Hostels & Dues", icon: Building2 },
  { id: "contact", label: "Contact Desk", icon: PhoneCall },
];

const PRESET_QUERIES = [
  { text: "How can I apply for BS AI in Admissions 2026?", category: "admissions", tag: "BS AI", icon: "🎓" },
  { text: "What is the fee structure for BS CS?", category: "fees", tag: "BS CS Fee", icon: "💻" },
  { text: "What is the fee structure in BSAI-2026-2.pdf?", category: "fees", tag: "BS AI Fee", icon: "💳" },
  { text: "What are the hostel allotment rules & fees?", category: "hostels", tag: "Hostels", icon: "🏢" },
  { text: "What documents are required for admission?", category: "admissions", tag: "Required Docs", icon: "📄" },
  { text: "What is the fee structure for 5-Year Pharm-D?", category: "fees", tag: "Pharm-D", icon: "💊" },
];

/**
 * Custom Markdown Parser for Handcrafted University Portal
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
        <div key={`table-${key}`} className="overflow-x-auto my-3 rounded-xl border border-slate-200 shadow-2xs">
          <table className="min-w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0B6E4F] text-white">
                {tableHeader.map((th, i) => (
                  <th key={i} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider">
                    {th.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className={rIdx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2 text-[11px] text-slate-700 font-medium">
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
        <div key={idx} className="flex items-center gap-2 mt-4 mb-2 pb-1.5 border-b border-slate-200">
          <span className="w-1.5 h-4 bg-[#0B6E4F] rounded-full" />
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
          <span className="w-1.5 h-1.5 rounded-full bg-[#0B6E4F] shrink-0 mt-1.5" />
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
        <code key={index} className="px-1.5 py-0.5 rounded bg-slate-100 text-[#0B6E4F] font-mono text-[11px] border border-slate-200 font-bold">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function IIUIPortalPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");

  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        text: "I'm having trouble connecting to the IIUI Helpdesk server. Please ensure the backend server is active on `http://127.0.0.1:8000`.",
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

  const handleExportSingleAnswerPDF = (answerText: string) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("IBADAT International University, Islamabad (IIUI)", 14, 20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Official Student Helpdesk Transcript - ${new Date().toLocaleDateString()}`, 14, 27);
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

    doc.save(`IIUI_Helpdesk_Record_${Date.now()}.pdf`);
  };

  const handleExportFullChatPDF = () => {
    if (messages.length === 0) return;
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("IBADAT International University, Islamabad (IIUI)", 14, 20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Complete Information Desk Session Log - ${new Date().toLocaleDateString()}`, 14, 27);
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

    doc.save(`IIUI_Session_Log_${Date.now()}.pdf`);
  };

  const filteredPresets = activeCategory === "all" 
    ? PRESET_QUERIES 
    : PRESET_QUERIES.filter(p => p.category === activeCategory);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-[#0B6E4F]/20">
      
      {/* 1. OFFICIAL IIUI BRANDED HEADER */}
      <header className="sticky top-0 z-40 bg-[#0B6E4F] text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-lg text-emerald-200">
              IIUI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg tracking-tight">
                  IBADAT International University, Islamabad
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-extrabold bg-white/15 text-emerald-100 rounded-md border border-white/20">
                  Official Helpdesk
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-medium">
                Student Information Desk & Grounded Knowledge Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <>
                <button
                  onClick={handleExportFullChatPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-[#0B6E4F] hover:bg-emerald-50 transition-all shadow-2xs"
                  title="Export entire chat conversation as PDF"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download Session PDF</span>
                </button>

                <button
                  onClick={handleClearChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-100 hover:bg-white/15 transition-all"
                  title="Clear conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </>
            )}
          </div>

        </div>

        {/* CATEGORY NAV TABS */}
        <div className="bg-[#08563d] border-t border-emerald-800/60">
          <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 overflow-x-auto py-1">
            {CATEGORY_TABS.map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-white text-[#0B6E4F] shadow-2xs"
                      : "text-emerald-100 hover:bg-white/10"
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* 2. MAIN LAYOUT (SIDEBAR + CONTENT FEED) */}
      <main className="flex-1 max-w-6xl mx-auto w-full flex flex-col md:flex-row gap-6 p-4 md:p-6">
        
        {/* LEFT SIDEBAR: HELPDESK QUICK SEARCH & VERIFICATION STATS */}
        <aside className="w-full md:w-72 shrink-0 space-y-4">
          
          {/* Quick Navigator Box */}
          <div className="portal-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-[#0B6E4F]" />
                Frequent Inquiries
              </h3>
              <span className="text-[10px] font-bold text-[#0B6E4F] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {filteredPresets.length} Topics
              </span>
            </div>

            <div className="space-y-1.5">
              {filteredPresets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(preset.text)}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-100 hover:border-[#0B6E4F] hover:bg-emerald-50/50 transition-all group flex items-start justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[9px] font-bold text-slate-600">
                      {preset.tag}
                    </span>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-[#0B6E4F] leading-snug">
                      {preset.text}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#0B6E4F] shrink-0 mt-1" />
                </button>
              ))}
            </div>
          </div>

          {/* Database Verification Info */}
          <div className="portal-card p-4 space-y-2.5 bg-gradient-to-br from-emerald-50/60 to-white border-emerald-200/80">
            <div className="flex items-center gap-2 text-[#0B6E4F]">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-extrabold">Verified Document Base</h4>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
              System is synced with official IIUI records including 78 Fee Structure PDFs and academic guidelines.
            </p>
            <div className="pt-1 flex flex-wrap gap-2 text-[10px] font-extrabold text-[#0B6E4F]">
              <span className="px-2 py-0.5 bg-white rounded border border-emerald-200">160 Vectors</span>
              <span className="px-2 py-0.5 bg-white rounded border border-emerald-200">78 Fee PDFs</span>
            </div>
          </div>

        </aside>

        {/* RIGHT MAIN CONVERSATION FEED */}
        <section className="flex-1 flex flex-col justify-between space-y-4">
          
          <div className="flex-1 overflow-y-auto space-y-4 min-h-[420px]">
            {messages.length === 0 ? (
              <div className="portal-card p-8 flex flex-col items-center justify-center text-center space-y-5 my-auto">
                <div className="w-14 h-14 rounded-2xl bg-[#0B6E4F] text-white flex items-center justify-center font-black text-xl shadow-md">
                  IIUI
                </div>

                <div className="max-w-md space-y-1.5">
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Welcome to IIUI Information Portal
                  </h2>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Select a topic from the left sidebar or enter your query below to retrieve official university records.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg pt-2 text-left">
                  {PRESET_QUERIES.slice(0, 4).map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q.text)}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-[#0B6E4F] hover:bg-white transition-all text-xs font-bold text-slate-800 flex items-center justify-between group"
                    >
                      <span>{q.icon} {q.text}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0B6E4F] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.sender === "ai" && (
                    <div className="w-8 h-8 rounded-xl bg-[#0B6E4F] text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-xs mt-1">
                      IIUI
                    </div>
                  )}

                  <div
                    className={`max-w-2xl rounded-2xl p-4 sm:p-5 text-xs leading-relaxed space-y-3 ${
                      msg.sender === "user"
                        ? "bg-[#0B6E4F] text-white rounded-tr-xs font-semibold shadow-xs"
                        : "portal-card text-slate-800 rounded-tl-xs"
                    }`}
                  >
                    {/* Official Record Header */}
                    {msg.sender === "ai" && (
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[10px] font-bold">
                        <span className="text-[#0B6E4F] flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Official IIUI Record Answer
                        </span>
                        {msg.confidence_score !== undefined && (
                          <span className="text-slate-500 font-mono">
                            Match Score: {Math.round(msg.confidence_score * 100)}%
                          </span>
                        )}
                      </div>
                    )}

                    {msg.sender === "user" ? (
                      <div className="whitespace-pre-wrap font-semibold text-sm">{msg.text}</div>
                    ) : (
                      <MarkdownRenderer content={msg.text} />
                    )}

                    {/* Sources & Action Toolbar */}
                    {msg.sender === "ai" && (
                      <div className="pt-3 border-t border-slate-100 space-y-2.5">
                        
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-extrabold uppercase text-slate-400">
                              Retrieved Reference Files:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.map((src, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200"
                                >
                                  📄 {src.filename || src.title}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                          <div className="flex items-center gap-3 text-slate-500">
                            <button
                              onClick={() => handleCopy(msg.text, msg.id)}
                              className="flex items-center gap-1 font-bold text-[11px] hover:text-[#0B6E4F] transition-colors"
                              title="Copy Answer Text"
                            >
                              {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                            </button>

                            <button
                              onClick={handleRegenerate}
                              className="flex items-center gap-1 font-bold text-[11px] hover:text-[#0B6E4F] transition-colors"
                              title="Regenerate Answer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Regenerate</span>
                            </button>
                          </div>

                          <button
                            onClick={() => handleExportSingleAnswerPDF(msg.text)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#0B6E4F] hover:bg-[#0B6E4F] hover:text-white transition-all font-bold text-[10px] border border-emerald-200"
                            title="Download response PDF"
                          >
                            <Download className="w-3 h-3" />
                            <span>Export Record PDF</span>
                          </button>
                        </div>

                      </div>
                    )}
                  </div>

                  {msg.sender === "user" && (
                    <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-xs mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex gap-3 items-center text-xs text-slate-500">
                <div className="w-8 h-8 rounded-xl bg-[#0B6E4F] text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  IIUI
                </div>
                <div className="portal-card px-4 py-3 flex items-center gap-2">
                  <span className="font-bold text-slate-700">Retrieving official records...</span>
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

          {/* INPUT BAR */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="portal-card p-2 flex items-center gap-2 focus-within:border-[#0B6E4F] focus-within:ring-2 focus-within:ring-[#0B6E4F]/20 transition-all"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Query admissions, fee structure, hostel allocation, requirements..."
              className="w-full px-3 py-2 text-xs sm:text-sm outline-none bg-transparent text-slate-900 placeholder-slate-400 font-medium"
            />
            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-colors"
                  title="Clear Chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={!inputQuery.trim() || isLoading}
                className="px-4 py-2 bg-[#0B6E4F] hover:bg-[#08563d] text-white text-xs font-bold rounded-xl disabled:opacity-40 shadow-2xs transition-all flex items-center gap-1.5"
              >
                <span>Search</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* FOOTER */}
          <footer className="text-center pt-2">
            <p className="text-[11px] text-slate-400 font-medium">
              © 2026 IBADAT International University, Islamabad (IIUI) — Official Student Information Desk
            </p>
          </footer>

        </section>

      </main>

    </div>
  );
}
