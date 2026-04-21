## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the following values in [.env.local](.env.local):
   - `API_NINJAS_KEY` for EV data prefilling
   - `DEEPL_API_KEY` for blog translation
   - `GEMINI_API_KEY` for Gemini enrichment and chat
   - `OCM_API_KEY` for charging-station data
   - `VITE_ENABLE_GEMINI_PREFILL=true` to keep the AI buttons enabled in the UI
3. Run the app:
   `npm run dev`
