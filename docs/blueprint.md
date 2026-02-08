# **App Name**: OT-Sentinel

## Core Features:

- Real-time Metrics Monitoring: Collect and display real-time metrics (temperature, pressure, vibration, network traffic) from simulated PLC operations.
- Anomaly Detection: Use an Isolation Forest model to detect anomalies in real-time data based on a learned baseline of normal operations.
- Attack Simulation Toggle: Toggle between normal and attack modes to simulate cyber security threats and test the system's response.
- Visual Network Map: Display a dynamic SVG network map that visually represents the system's security status, changing color when under attack.
- Security Log Display: Show a clean data table security log of timestamp, source IP, and payload, providing real-time insight into network activity.
- Threat Mitigation Alert: Alert the user with a visual cue when a critical security status is detected, using an LLM as a tool to help the user decide on the appopriate threat mitigation action.
- API Communication: Establish communication channels for GET and POST requests in the backend.

## Style Guidelines:

- Background color: Light Gray / Off-White (bg-slate-50) for a modern, clean look.
- Card color: Pure White (bg-white) with subtle borders (border-slate-200) and soft shadows (shadow-sm) for a professional feel.
- Primary text color: Deep Navy Blue (text-slate-900) for readability and a corporate aesthetic.
- Success color: Muted Emerald (text-emerald-600, bg-emerald-50) for positive feedback.
- Critical color: Professional Rose/Red (text-rose-600, bg-rose-50) to indicate critical alerts and attack status.
- Headline and body font: 'Inter' or 'Roboto' for a clean, professional look.
- Data/Log font: 'JetBrains Mono' for displaying code and logs in a clear, monospaced format.
- Use minimalistic, clean line icons from Lucide React to represent different metrics and network components.
- Implement a clean grid layout for metrics display, a professional SVG diagram for network topology, and a data table for the audit log.
- Smooth transitions and subtle animations on data updates and interactive elements. More pronounced animations for critical alerts.