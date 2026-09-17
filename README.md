# 🤖 Autonomous AI Expense & Task Agent

> A production-grade, full-stack **Autonomous AI Agent** built from scratch using **TypeScript**, **Express**, **SQLite**, and **Google Gemini 3.6 Flash (Function Calling / Tool Use)**.

---

## 🌟 Key Features

- **Autonomous Tool Calling (Function Calling):** The agent does not just chat—it autonomously decides when to trigger backend tools (`addExpense`, `getExpenseSummary`, `addTask`, `getPendingTasks`).
- **Permanent SQLite Persistence:** Zero cloud latency. All expenses and to-do items are saved locally in `agent_data.db` using WAL mode.
- **Multi-Tenant Data Isolation:** Supports multiple user profiles (`Rahul`, `Amit`, `Priya`). Each user has a completely isolated database partition and personal AI context session.
- **Split-Screen Glassmorphic Dashboard:** Real-time visual sync. When Gemini adds an expense or task, the live statistics card, expenses table, and task checklist update instantly.
- **100% Type-Safe:** Fully written in strict TypeScript with `@types/express`, `@types/node`, and `@google/genai` types.

---

## 🏗️ Architecture & ReAct Loop

```text
       ┌─────────────────────────────┐
       │   User (Browser / Chrome)   │
       └──────────────┬──────────────┘
                      │ HTTP POST /api/chat (message, userId)
                      ▼
       ┌─────────────────────────────┐
       │   Express + TypeScript API  │
       └──────────────┬──────────────┘
                      │ Prompt + Tool Definitions
                      ▼
       ┌─────────────────────────────┐
       │  Google Gemini 3.6 Flash    │
       │    (Function Calling)       │
       └──────────────┬──────────────┘
                      │ Tool Execution Request ("addExpense")
                      ▼
       ┌─────────────────────────────┐
       │   Agent Tool Executor       │
       └──────────────┬──────────────┘
                      │ SQL Queries (INSERT / SELECT WHERE user_id)
                      ▼
       ┌─────────────────────────────┐
       │   SQLite (agent_data.db)    │
       └─────────────────────────────┘
```

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, TypeScript, `tsx watch`
- **AI Engine:** Google Gemini 3.6 Flash via official `@google/genai` SDK
- **Database:** SQLite (`better-sqlite3`) with WAL (Write-Ahead Logging)
- **Frontend:** Vanilla HTML5, Modern CSS3 (Glassmorphic Dark Theme), Vanilla JS (Fetch API)
- **Environment & Security:** `dotenv`, `.gitignore`

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd ai-agent-project
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory (refer to `.env.example`):
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run Development Server
```bash
npm run dev
```
Open your browser and visit: `http://localhost:3000`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/chat` | Main conversational endpoint with autonomous tool loop |
| `GET` | `/api/dashboard/:userId` | Retrieves total spent, expense items, and tasks for a user |
| `POST` | `/api/tasks/:id/toggle` | Toggles completion status of a to-do task |
| `DELETE`| `/api/expenses/:id` | Deletes a specific expense record from SQLite |

---

## 👨‍💻 Author & Engineering Practice
Built as part of the **Top 1% Software Engineer Roadmap** mastering DSA, System Design, Backend Architecture, and Autonomous AI Agents.
