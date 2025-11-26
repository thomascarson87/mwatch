import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY not found in environment variables");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateAssistantResponse = async (
  query: string,
  context: string = "Generic sports context"
): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "AI Assistant is unavailable (Missing API Key).";

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Context: The users are watching a sports match. Current stream info: ${context}.
      
      User Query: ${query}
      
      Answer the user's question briefly and enthusiastically, acting as a knowledgeable sports commentator/friend. Keep it under 50 words unless asked for detailed stats.`,
      config: {
        systemInstruction: "You are mwatch AI, a world-class sports analyst and hype-man.",
      }
    });
    return response.text || "I couldn't catch that play, try again!";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Technical foul! I couldn't process that request.";
  }
};

export const generateHypeCommentary = async (streamTitle: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Let's gooooo!";

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a short, high-energy, 1-sentence hype message for a group of friends about to watch: "${streamTitle}". usage slang suitable for sports fans.`,
    });
    return response.text || "Game on!";
  } catch (error) {
    return "It's game time!";
  }
};