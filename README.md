# International Islamic University Islamabad (IIUI) AI Assistant 🎓

An enterprise-grade, modern, minimalist AI Chatbot Web Application for the **International Islamic University Islamabad (IIUI)** powered by **Retrieval-Augmented Generation (RAG)**, **Qdrant Cloud Vector Database**, and **Groq Llama-3.3-70B**.

![Tech Stack](https://img.shields.io/badge/Tech%20Stack-Next.js%2015%20%7C%20FastAPI%20%7C%20Qdrant%20%7C%20Groq-0B6E4F?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production%20Ready-success?style=for-the-badge)

---

## 🌟 Overview

The **IIUI AI Assistant** is a dedicated AI chatbot platform designed to assist students, applicants, and faculty by answering queries regarding:
- **BS, MS, M.Phil & Ph.D. Admissions 2026**
- **Detailed Fee Structures for All 78 Programs** (BS CS, BS AI, BS SE, Pharm-D, DPT, BBA, LL.B, etc.)
- **Hostel Allocation & Rules**
- **Merit & Entry Test Requirements**
- **Academic Regulations & Calendars**
- **Campus Locations & Department Contacts**

---

## 🚀 Key Features

### 1. Grounded RAG Architecture & 78 Fee PDFs Indexing
- Answers are generated using **Qdrant Cloud Vector Database** (`iiui_knowledge_base` with **160 vector chunks**).
- Includes full OCR-indexed text from all **78 official IIUI Fee Structure PDFs**.

### 2. Beautiful Rich Markdown Responses
- Automatic formatting with **Markdown Headings** (`###`), **Bold Labels**, **Markdown Tables** (`| Semester | Fee |`), and clear section dividers (`---`).

### 3. Dual PDF Export System
- **Export Answer PDF**: Download an official PDF transcript of any single AI response.
- **Export Full Chat PDF**: Download a PDF log of the entire conversation session.

### 4. Minimalist ChatGPT-Style Interface
- **Suggested Question Cards**: One-click quick queries (*How can I apply for BS AI?, What is the hostel fee?, etc.*).
- **Auto-Scroll & Typing Indicator**: Real-time interaction feedback.
- **Copy & Regenerate Actions**: One-click text copy and response regeneration.

### 5. Secure `.env` Integration & One-Time Vector Ingestion
- Seamless environment variable loading with `python-dotenv`.
- Smart vector check: skips re-embedding if vectors already exist in Qdrant.

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router) & React 19
- **Styling**: Tailwind CSS (IIUI Primary Green `#0B6E4F`)
- **Icons & Animation**: Lucide Icons & Framer Motion
- **PDF Export**: jsPDF

### Backend & AI Pipeline
- **Framework**: Python FastAPI with CORS Middleware
- **Vector Database**: Qdrant Cloud Vector Database (`qdrant-client`)
- **Embeddings**: SentenceTransformers (`all-MiniLM-L6-v2`, 384 dimensions)
- **Language Model**: Groq Llama-3.3-70B Versatile (`langchain-groq`)

---

## 📂 Repository Structure

```
iiui_chat_assistant/
├── backend/
│   ├── server.py              # FastAPI REST & streaming server
│   └── qdrant_rag.py          # Qdrant Vector DB & RAG pipeline
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx       # Minimalist ChatGPT-style UI
│   │   │   └── globals.css    # IIUI green design system
│   │   └── lib/
│   │       └── api.ts         # Configurable API client
│   ├── package.json
│   └── next.config.ts
├── docs/                      # IIUI Markdown documentation
├── scraped_output/            # 78 Fee Structure PDFs & scraped index
├── qdrant_manager.py          # Standalone Qdrant connection helper
├── .env                       # Environment variables (Qdrant & Groq keys)
└── README.md
```

---

## 💻 Setup & Run Instructions

### 1. Prerequisites
- **Node.js**: v18+ 
- **Python**: v3.10+
- **Qdrant Cloud & Groq API Keys**

### 2. Environment Setup (`.env`)
Create or edit `.env` in the root directory:
```env
QDRANT_URL=https://ac02f9f0-d08c-4b84-84dc-32d0755bb63e.eu-west-2-0.aws.cloud.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key
GROQ_API_KEY=your_groq_api_key
```

### 3. Run Python Backend API
```bash
cd backend
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```
*API Health Endpoint:* `http://127.0.0.1:8000/health`

### 4. Run Next.js Frontend
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:3000** in your browser.

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/chat` | Executes grounded RAG query against Qdrant & Groq |
| `POST` | `/contact` | Submits student inquiry ticket |
| `GET` | `/documents` | Returns indexed knowledge base catalog |
| `GET` | `/analytics` | System analytics and Qdrant vector metrics |
| `POST` | `/upload` | Admin document uploader and indexer |
| `POST` | `/embed` | Syncs Qdrant vector collection |

---

## ☁️ Deployment

- **Frontend**: Deploy `frontend/` directory to **Vercel** with `NEXT_PUBLIC_API_BASE_URL` pointing to your hosted FastAPI backend.
- **Backend**: Deploy `backend/` to any Python server (Render, Railway, AWS, or Docker).

---

## 📜 License & Disclaimer

**Disclaimer**: AI responses are generated from the university knowledge base and may not replace official university announcements.

© 2026 International Islamic University Islamabad (IIUI). All rights reserved.
