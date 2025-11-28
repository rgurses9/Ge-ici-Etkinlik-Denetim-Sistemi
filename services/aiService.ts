
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes event statistics using Gemini Flash Lite for low-latency responses.
 */
export async function generateEventAnalysis(eventsSummary: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: `Aşağıdaki etkinlik verilerini analiz et ve yöneticiye kısa, öz bir özet rapor sun. Hangi etkinliklerin doluluk oranının yüksek olduğunu ve dikkat edilmesi gerekenleri belirt:\n\n${eventsSummary}`,
    });
    return response.text || "Analiz oluşturulamadı.";
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "AI servisine erişilemedi. Lütfen API anahtarınızı kontrol edin.";
  }
}
