<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# cacsms-cinema

This project contains the cacsms-cinema workspace for autonomous visual intelligence and image generation.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env.local`. With a placeholder `GEMINI_API_KEY`, `PROVIDER_MODE=auto` uses local-dev image/script/eval providers so the pipeline runs without Google credentials. Set a real Gemini key (length ≥ 20) when you want live Gemini generation.
3. Run the app:
   `npm run dev`
