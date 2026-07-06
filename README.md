#  Research Mentor AI

**An AI-powered research paper discovery platform** that helps students, researchers, and developers find, understand, and explore academic papers through semantic search, intelligent summarization, difficulty estimation, and personalized recommendations.

Instead of relying only on keyword matching, Research Mentor AI uses **vector embeddings and semantic similarity** to retrieve the most relevant research papers and presents **AI-generated summaries** to improve research efficiency.

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/React-Frontend-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/ChromaDB-Vector%20Store-purple" />
  <img src="https://img.shields.io/badge/Gemini-LLM%20Engine-4285F4?logo=googlegemini&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-Auth-3ECF8E?logo=supabase&logoColor=white" />
</p>

---

## 📸 Screenshots

<!-- Replace the paths below with your actual screenshot files once added to a /screenshots folder -->

| Landing Page | Workspace |
|---|---|
| ![Landing Page](screenshots/home.png) | ![Workspace](screenshots/workspace.png) |

| Profile | bookmarks |
|---|---|
| ![Search Results](screenshots/profile.png) | ![Paper Detail](screenshots/bookmarks.png) |



---

## 🚀 Features

### 🔍 Semantic Paper Search
- Search research papers using natural language.
- Semantic similarity search using Sentence Transformers.
- Retrieves papers from Semantic Scholar with arXiv as fallback.

### 🤖 AI Paper Analysis
- AI-generated paper summaries using **Gemini**.
- Automatic keyword extraction.
- Difficulty classification:
  - Beginner
  - Intermediate
  - Advanced

### 🧠 Vector Search Engine
- **ChromaDB** vector database for semantic retrieval.
- Embedding-based cache system.
- Intelligent cache hit / cache miss routing.

### 📚 Paper Detail Console
- Original paper abstract
- AI summary
- Keywords
- Difficulty level
- Publication information
- Direct paper link

### 🎯 AI Recommendations
- Similar paper recommendation using embedding similarity.
- Context-aware recommendation engine.
- Fast retrieval from local vector database.

### ⭐ User Features
- Secure authentication using **Supabase**
- Bookmark papers
- Responsive dashboard
- Modern UI with **Tailwind CSS**

---

## 🏗️ System Architecture

```
User Query
   │
   ▼
Gemini Intent Extraction
   │
   ▼
ChromaDB Semantic Search
   │
   ▼
Cache Hit? ──── YES ──► Return Cached Papers
   │
   NO
   │
   ▼
Semantic Scholar API
   │
   ▼
arXiv Fallback
   │
   ▼
Gemini Analysis
   │
   ▼
Generate Embeddings
   │
   ▼
Store in ChromaDB
   │
   ▼
Return Results
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React.js, Vite, Tailwind CSS, Framer Motion, React Router |
| **Backend** | FastAPI, Python |
| **AI / ML** | Google Gemini API, Sentence Transformers, ChromaDB, Semantic Search |
| **External APIs** | Semantic Scholar API, arXiv API |
| **Database / Auth** | ChromaDB, Supabase |

---

## 📂 Project Structure

```
frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/           # Route-level pages
│   ├── context/         # React context providers
│   ├── layouts/         # Page layouts
│   └── services/        # API service calls

backend/
├── src/
│   ├── backend/          # FastAPI app entrypoint & routes
│   │   ├── main.py
│   │   └── routes.py
│   ├── common/           # Shared config & utilities
│   │   ├── config_loader.py
│   │   └── logger.py
│   ├── ingestion/        # Paper fetching (Semantic Scholar, arXiv)
│   │   └── fetch_paper.py
│   └── ml_pipeline/       # Embeddings, LLM analysis, vector store
│       ├── embedder.py
│       ├── llm_analyzer.py
│       ├── search_papers.py
│       └── vector_store.py
```

---

## ⚙️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/research-mentor-ai.git
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # On Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn src.backend.main:app --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Environment Variables

Create a `.env` file in the backend directory:

```env
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_KEY=YOUR_SUPABASE_ANON_KEY
```

---

## 🎯 Future Improvements

- [ ] PDF upload & summarization
- [ ] Citation generation
- [ ] Research roadmap generation
- [ ] Notes & collections
- [ ] Multi-model LLM support
- [ ] Research trend visualization

---

## 👩‍💻 Author

**Swati Singh**

Built as an end-to-end AI-powered research assistant integrating semantic search, vector databases, and Large Language Models to simplify academic literature exploration.

---

## 📄 License

This project is open for learning and portfolio purposes. Add a license here if you plan to open-source it further.
