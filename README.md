# OT-Sentinel

OT-Sentinel is a documentation-first industrial cybersecurity dashboard that visualizes OT telemetry, simulates incident scenarios, and uses AI-assisted workflows to explain threats in operator-friendly language.

![OT-Sentinel interface](https://github.com/user-attachments/assets/160b1ec4-267f-4084-b599-971810920d0e)

Demo: [YouTube walkthrough](https://www.youtube.com/watch?v=KcpTW0QM0FM)

## Why this project exists

Plant teams often have monitoring signals, but they still lack a clear operator-facing workflow for interpreting anomalies, understanding severity, and documenting mitigation actions. OT-Sentinel demonstrates how a modern web interface can bridge cyber monitoring, simulated incidents, and explainable operational response.

## What it does

- Streams industrial telemetry such as temperature, pressure, vibration, and traffic indicators.
- Uses Genkit and Gemini to classify anomalies and generate mitigation guidance.
- Supports attack simulation for demo and training scenarios.
- Generates a forensic summary with charts and exportable audit data.
- Includes Jest-based UI tests and a baseline GitHub Actions workflow.

## Architecture snapshot

- **Frontend:** Next.js App Router, React 19, TypeScript
- **AI runtime:** Genkit with Google Gemini
- **Visualization:** ShadCN UI, Tailwind CSS, Recharts
- **Testing:** Jest and React Testing Library
- **Deployment target:** Vercel or any Node-compatible host

## Local setup

### Prerequisites

- Node.js 20+
- npm
- A Google AI Studio API key

### Install

```bash
npm install
cp .env.example .env
```

Update `.env` with your Gemini API key.

### Run

```bash
npm run dev
```

The app runs on `http://localhost:9002`.

## Quality checks

```bash
npm test
npm run typecheck
npm run build
```

## Repository highlights

- `src/components/dashboard.tsx` contains the main monitoring surface.
- `src/ai/flows/threat-mitigation-alert.ts` contains the anomaly-to-guidance workflow.
- `src/app/page.test.tsx` covers the main page interaction path.
- `docs/blueprint.md` captures the product blueprint.

## Portfolio note

This repository is intended as an Industrial AI and OT security portfolio piece. It focuses on system design, operator workflows, and explainable incident response rather than production-grade backend integrations.

## License

MIT
