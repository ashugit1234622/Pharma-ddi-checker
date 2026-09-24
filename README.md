# Pharma DDI Checker

AI-Powered Oncology & Pharmacology Platform for Drug-Drug Interaction Analysis.
Built with Next.js, Google Gemini AI, better-sqlite3, and Chart.js.

## Features
- **Drug Search**: Autocomplete search for drugs loaded in the SQLite database.
- **Evidence-Based DDI**: Checks interactions using verified database facts (ADME profiling, enzyme kinetics, etc.).
- **Toxicity Radar Chart**: Visualizes combined hepatotoxicity, nephrotoxicity, cardiotoxicity, and neurotoxicity risks.
- **Aastha AI Chatbot**: Ask questions about the interaction directly from the report using Google Gemini.
- **Prescription OCR**: Scan a prescription image and automatically extract medicines using Gemini Vision.

## Setup
1. Run `npm install`
2. Create a `.env` file based on `.env.example` with your Gemini API keys.
3. Run `npm run seed` (or `node scripts/seed-expanded.js`) to populate the database.
4. Run `npm run dev` to start the dev server at `http://localhost:3000`.
