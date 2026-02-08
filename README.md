# OT-Sentinel: Industrial Cybersecurity Dashboard

OT-Sentinel is a sophisticated, real-time dashboard for monitoring the security of Operational Technology (OT) and industrial control systems. It leverages generative AI to analyze system metrics, detect anomalies, and provide actionable threat mitigation advice.

![OT-Sentinel Dashboard](https://storage.googleapis.com/farsight-dev-remix-original-images/eb092b76-a05e-47f2-8951-dc09e59d9f1c/image.png)

## Core Features

- **Real-time Monitoring**: Continuously tracks key system metrics like temperature, pressure, vibration, and network traffic.
- **AI-Powered Threat Detection**: Utilizes a generative AI model to analyze incoming data, identify anomalies, and assess the system's security status with a confidence score.
- **Attack Simulation**: Includes a "Simulate Attack" mode to test the system's response to critical threat scenarios and for demonstration purposes.
- **Instant Threat Mitigation**: When a threat is detected, an AI-powered alert dialog immediately provides a summary of the threat and suggests concrete mitigation steps.
- **Comprehensive Auditing**: Logs all significant events in a clear, filterable audit log for forensic analysis.
- **Data Export**: Allows users to export forensic data from the audit log as a CSV file for offline analysis and reporting.
- **Modern & Responsive UI**: Built with Next.js, ShadCN, and Tailwind CSS for a sleek, dark-themed, and responsive user experience that looks great on large screens.

## Tech Stack

- **Frontend**: Next.js (App Router), React, TypeScript
- **UI**: ShadCN UI, Tailwind CSS, Recharts
- **Generative AI**: Google Gemini via Genkit
- **Styling**: `globals.css` for a modern dark theme.

## Getting Started

The application is ready to run. Start the development server to see the dashboard in action:

```bash
npm run dev
```

The main application logic can be found in `src/app/page.tsx` and the primary UI component is `src/components/dashboard.tsx`. The AI flow for threat analysis is located at `src/ai/flows/threat-mitigation-alert.ts`.
