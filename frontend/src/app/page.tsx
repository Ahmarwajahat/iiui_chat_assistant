"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Send, Bot, User, Sparkles, Copy, Check, RotateCcw, Trash2, 
  ArrowUpRight, CheckCircle2, FileText, Download, FileDown, MessageSquare
} from "lucide-react";
import { sendChatMessage, ChatMessage } from "@/lib/api";
import jsPDF from "jspdf";

const SUGGESTED_QUESTIONS = [
  "How can I apply for BS AI?",
  "What is the hostel fee?",
  "Tell me about scholarships.",
  "What documents are required for admission?",
  "Where is the Faculty of Engineering?",
];

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
    doc.text("International Islamic University Islamabad (IIUI)", 14, 20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Official AI Assistant Response Transcript - ${new Date().toLocaleDateString()}`, 14, 27);
    doc.setLineWidth(0.5);
    doc.line(14, 30, 196, 30);

    const cleanText = answerText.replace(/[#*_`]/g, "");
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
    doc.text("International Islamic University Islamabad (IIUI)", 14, 20);
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

      const cleanText = msg.text.replace(/[#*_`]/g, "");
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-[#0B6E4F]/20">
      
      {/* 1. TOP NAVIGATION */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* IIUI Emblem Icon */}
            <div className="w-10 h-10 rounded-xl bg-[#0B6E4F] flex items-center justify-center text-white shadow-md shadow-[#0B6E4F]/20">
              <Sparkles className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-slate-900 tracking-tight">IIUI AI Assistant</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-[#0B6E4F]/10 text-[#0B6E4F] rounded-full border border-[#0B6E4F]/20">
                  RAG Powered
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1">
                Ask questions about admissions, departments, fee structure, hostels, scholarships, regulations, and university information.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <>
                <button
                  onClick={handleExportFullChatPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-[#0B6E4F] hover:bg-emerald-100 border border-emerald-200 transition-all"
                  title="Export entire chat conversation as PDF"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export Full Chat PDF</span>
                </button>

                <button
                  onClick={handleClearChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-all"
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
      <main className="flex-1 max-w-4xl mx-auto w-full flex flex-col p-4 md:p-6 justify-between">
        
        {/* Messages Feed or Empty State */}
        <div className="flex-1 overflow-y-auto space-y-6 pb-6">
          {messages.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-[#0B6E4F]/10 text-[#0B6E4F] flex items-center justify-center shadow-inner">
                <Bot className="w-9 h-9" />
              </div>
              
              <div className="max-w-md space-y-2">
                <h2 className="text-xl font-bold text-slate-900">How can I help you today?</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  I am the AI Assistant for International Islamic University Islamabad. Select a suggested question below or type your query.
                </p>
              </div>

              {/* SUGGESTED QUESTIONS CARDS */}
              <div className="w-full max-w-2xl pt-4">
                <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider text-left">
                  Suggested Questions
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-[#0B6E4F] hover:shadow-md transition-all flex items-center justify-between group text-xs text-slate-800 font-medium"
                    >
                      <span>{q}</span>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#0B6E4F] transition-colors shrink-0 ml-2" />
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
                  <div className="w-8 h-8 rounded-xl bg-[#0B6E4F] flex items-center justify-center text-white shrink-0 shadow-sm mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 shadow-sm text-xs leading-relaxed space-y-3 ${
                    msg.sender === "user"
                      ? "bg-[#0B6E4F] text-white rounded-tr-none font-medium"
                      : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                  {/* AI Response Footer: Confidence Score, Sources & Export Actions */}
                  {msg.sender === "ai" && (
                    <div className="pt-3 border-t border-slate-100 space-y-2.5 text-[11px] text-slate-500">
                      {msg.confidence_score && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-slate-500">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Knowledge Confidence:
                          </span>
                          <span className="font-bold text-[#0B6E4F]">
                            {Math.round(msg.confidence_score * 100)}%
                          </span>
                        </div>
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-600">Retrieved Sources:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] border border-slate-200"
                              >
                                📄 {src.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions: Copy, Regenerate, Export Single Answer PDF */}
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-2">
                        <div className="flex items-center gap-3 text-slate-500">
                          <button
                            onClick={() => handleCopy(msg.text, msg.id)}
                            className="flex items-center gap-1 hover:text-[#0B6E4F] transition-colors"
                            title="Copy Answer Text"
                          >
                            {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedId === msg.id ? "Copied" : "Copy"}</span>
                          </button>

                          <button
                            onClick={handleRegenerate}
                            className="flex items-center gap-1 hover:text-[#0B6E4F] transition-colors"
                            title="Regenerate Answer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Regenerate</span>
                          </button>
                        </div>

                        {/* Export Answer PDF Button */}
                        <button
                          onClick={() => handleExportSingleAnswerPDF(msg.text)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-[#0B6E4F] text-slate-700 hover:text-white transition-all font-semibold text-[10px] border border-slate-200"
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
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-slate-500">
              <div className="w-8 h-8 rounded-xl bg-[#0B6E4F] flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4 animate-bounce" />
              </div>
              <div className="px-4 py-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2">
                <span>IIUI AI is thinking...</span>
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
            className="relative flex items-center bg-white rounded-2xl border border-slate-300 shadow-sm focus-within:border-[#0B6E4F] focus-within:ring-2 focus-within:ring-[#0B6E4F]/20 transition-all p-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask anything about IIUI admissions, fee structures, hostels, departments..."
              className="w-full px-3 py-2 text-xs sm:text-sm outline-none bg-transparent text-slate-800 placeholder-slate-400"
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
                className="px-4 py-2 bg-[#0B6E4F] hover:bg-[#08563d] text-white text-xs font-semibold rounded-xl disabled:opacity-40 shadow transition-all flex items-center gap-1.5"
              >
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>

        {/* 6. FOOTER */}
        <footer className="mt-6 pt-4 border-t border-slate-200 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-600">
            Powered by <span className="text-[#0B6E4F]">IIUI AI Assistant</span>
          </p>
          <p className="text-[11px] text-slate-400">
            AI responses are generated from the university knowledge base and may not replace official announcements.
          </p>
        </footer>
      </main>

    </div>
  );
}
