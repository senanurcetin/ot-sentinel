# OT-Sentinel: Industrial Cybersecurity Dashboard

OT-Sentinel is a sophisticated, real-time dashboard for monitoring the security of Operational Technology (OT) and industrial control systems. It leverages generative AI to analyze system metrics, detect anomalies, and provide actionable threat mitigation advice.

![OT-Sentinel Dashboard](https://storage.googleapis.com/farsight-dev-remix-original-images/eb092b76-a05e-47f2-8951-dc09e59d9f1c/image.png)

## Core Features

- **Real-time Monitoring**: Continuously tracks key system metrics like temperature, pressure, vibration, and network traffic.
- **AI-Powered Threat Detection**: Utilizes a generative AI model to analyze incoming data, identify anomalies, and assess the system's security status with a confidence score.
- **Attack Simulation**: Includes a "Simulate Attack" mode to test the system's response to critical threat scenarios and for demonstration purposes.
- **Instant Threat Mitigation**: When a threat is detected, an AI-powered alert dialog immediately provides a summary of the threat and suggests concrete mitigation steps.
- **In-App Forensic Reporting**: Provides a detailed, interactive forensic report with summary statistics, event distribution charts, and a filterable audit log.
- **Data Export**: Allows users to export the full audit log from the forensic report as a CSV file for offline analysis.
- **Modern & Responsive UI**: Built with Next.js, ShadCN, and Tailwind CSS for a sleek, dark-themed, and responsive user experience.

## Tech Stack

- **Frontend**: Next.js (App Router), React, TypeScript
- **UI**: ShadCN UI, Tailwind CSS, Recharts
- **Generative AI**: Google Gemini via Genkit
- **Testing**: Jest, React Testing Library
- **CI/CD**: GitHub Actions

## Environment Setup

Before running the application, you need to set up your environment variables. The application uses Genkit and the Google Gemini model, which requires an API key.

1.  **Create an environment file:** In the root of the project, create a new file named `.env`. You can do this by copying the example file:
    ```bash
    cp .env.example .env
    ```
2.  **Get an API Key:** Obtain a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
3.  **Set the API Key:** Open your new `.env` file and replace `YOUR_API_KEY_HERE` with the key you obtained.
    ```
    GEMINI_API_KEY=xxxxxxxxxxxxxxxxxxxxxxx
    ```

## Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

The main application logic can be found in `src/app/page.tsx` and the primary UI component is `src/components/dashboard.tsx`. The AI flow for threat analysis is located at `src/ai/flows/threat-mitigation-alert.ts`.
