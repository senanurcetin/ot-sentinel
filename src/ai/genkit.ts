import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Initializes and configures the Genkit AI instance.
 *
 * This setup specifies the Google AI plugin for generative capabilities and
 * sets the default model to 'gemini-1.5-flash-latest' for all AI operations.
 * Using a 'latest' model ensures that the application benefits from the
 * most recent stable updates and improvements automatically.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      // The API version can be specified here. 'v1beta' is common for recent features.
      // apiVersion: 'v1beta',
    }),
  ],
  // Using 'gemini-1.5-flash-latest' ensures access to the most recent stable version of the Flash model,
  // balancing performance, cost, and cutting-edge capabilities.
  model: 'gemini-1.5-flash-latest',
});
