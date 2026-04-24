import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface EventSuggestion {
  title: string;
  description: string;
  category: string;
  suggestedVenue: string;
}

export async function generateEventSuggestion(searchTerm: string): Promise<EventSuggestion | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `A lot of users are searching for "${searchTerm}" on our event platform. 
      Generate a compelling event idea based on this search term.
      Return the response in JSON format with the following structure:
      {
        "title": "A catchy event title",
        "description": "A detailed and exciting description of the event",
        "category": "One of: Music, Tech, Sports, Workshop, Arts",
        "suggestedVenue": "A generic type of venue suitable for this event"
      }`,
      config: {
        responseMimeType: "application/json",
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim()) as EventSuggestion;
    }
    return null;
  } catch (error) {
    console.error("Error generating event suggestion:", error);
    return null;
  }
}
