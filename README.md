# Franchise Finder

Franchise Finder is a web application that helps users find franchise locations in any city, state, and country. It uses AI agents to search multiple sources (like Google Maps and official websites) and streams results in real-time.

## Features

- **Search Franchise Locations:** Enter a franchise name and location to find addresses and phone numbers.
- **Multiple Data Sources:** Results are gathered from Google Maps and official websites using AI agents.
- **Streaming Results:** See locations appear in real-time as they are found.
- **Search History:** Quickly repeat previous searches.
- **Export:** Download results as a CSV file.
- **Modern UI:** Built with React, Tailwind CSS, and Lucide icons.

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Lucide React
- **Backend:** FastAPI, LangChain, OpenAI GPT-4o, browser-use
- **Other:** Vite, ESLint, dotenv

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- Python 3.9+
- OpenAI API Key (set in `.env`)

### Setup

#### 1. Clone the repository

```sh
git clone <your-repo-url>
cd <project-directory>
```

#### 2. Install frontend dependencies

```sh
npm install
```

#### 3. Set up environment variables

Create a `.env` file in the project root:

```
OPENAI_API_KEY="your-openai-api-key"
```

#### 4. Install backend dependencies

```sh
pip install fastapi uvicorn langchain-openai browser-use python-dotenv
```

#### 5. Start the backend server

```sh
python app.py
```

#### 6. Start the frontend development server

```sh
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
.
├── app.py                  # FastAPI backend with streaming endpoints
├── .env                    # Environment variables (OpenAI API key)
├── src/                    # Frontend source code (React, TypeScript)
│   ├── components/         # UI components
│   ├── context/            # React context for state management
│   ├── services/           # API service logic
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── package.json            # Frontend dependencies and scripts
├── tailwind.config.js      # Tailwind CSS configuration
├── postcss.config.js       # PostCSS configuration
└── ...
```

## API Endpoints

- `POST /get-franchise-details-stream`  
  Streams franchise locations as they are found.

## Customization

- **Add more sources:** Extend the backend agents in [`app.py`](app.py) to include more data sources.
- **UI changes:** Edit React components in [`src/components/`](src/components/).

## License

MIT

---

© 2025 Franchise Finder. All rights reserved.
