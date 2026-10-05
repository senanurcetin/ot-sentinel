import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Initializes and configures the Genkit AI instance.
 *
 * Uses the Google AI plugin with Gemini 2.5 Flash as the default model:
 * low latency suits the operator-facing alert dialog. The model is only used to
 * explain a detection that the anomaly scorer has already made; it never decides
 * whether an anomaly exists.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});
