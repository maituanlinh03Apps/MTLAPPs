
import { GoogleGenAI, Modality } from "@google/genai";
import { stripDataPrefix } from "../utils";

// Removed duplicate declare global for window.aistudio.
// The type declaration is now centralized in types/aistudio.d.ts.

interface GenerateImageParams {
  characterImages: Array<{ base64: string; mimeType: string } | null>;
  backgroundImage: { base64: string; mimeType: string } | null;
  useBackground: boolean;
  prompt: string;
}

/**
 * Generates an image using the Gemini 'gemini-2.5-flash-image' model.
 * It takes character images, an optional background image, and a text prompt as input.
 * Handles API key validation and specific error responses.
 * @param params - An object containing character images, background image details,
 *                 a flag for using the background, and the text prompt.
 * @returns A Promise that resolves to the Base64 string of the generated image,
 *          prefixed with its data URI for direct browser display.
 */
export const generateImageWithGemini = async (
  params: GenerateImageParams,
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is not defined in environment variables.");
  }

  // Create a new GoogleGenAI instance right before making an API call
  // to ensure it uses the most up-to-date API key from the dialog if selected.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts = [];

  // CRITICAL: Place the main prompt (including aspect ratio instruction) FIRST.
  // This ensures the model processes the core instructions before visual context.
  parts.push({
    text: params.prompt,
  });

  // Add background image if 'useBackground' is true
  if (params.useBackground && params.backgroundImage?.base64) {
    parts.push({
      inlineData: {
        mimeType: params.backgroundImage.mimeType,
        data: stripDataPrefix(params.backgroundImage.base64),
      },
    });
  }

  // Add selected character images
  for (const charImage of params.characterImages) {
    if (charImage?.base64) {
      parts.push({
        inlineData: {
          mimeType: charImage.mimeType,
          data: stripDataPrefix(charImage.base64),
        },
      });
    }
  }
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image", // Corresponds to Gemini Nano Banana
      contents: { parts: parts },
      config: {
        responseModalities: [Modality.IMAGE], // Request image output
      },
    });

    const generatedImagePart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (generatedImagePart) {
      // Re-add the data URI prefix for display in the browser
      return `data:${generatedImagePart.mimeType};base64,${generatedImagePart.data}`;
    } else {
      console.error("No image data found in the response:", response);
      throw new Error("Could not generate image: No image data returned.");
    }
  } catch (error) {
    console.error("Error from generateImageWithGemini:", error); // Log the full error
    // Specifically handle the "RESOURCE_EXHAUSTED" error for API quota issues
    if (error instanceof Error && error.message.includes("RESOURCE_EXHAUSTED")) {
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        // Prompt user to select/update API key, which often leads to billing info.
        window.aistudio.openSelectKey(); 
        throw new Error(
          "Hạn mức API đã hết. Vui lòng kiểm tra gói dịch vụ và chi tiết thanh toán của bạn, hoặc thử chọn một khóa API khác. " +
          "Bạn có thể tìm thêm thông tin tại: ai.google.dev/gemini-api/docs/rate-limits"
        );
      } else {
        throw new Error(
          "Hạn mức API đã hết. Vui lòng kiểm tra gói dịch vụ và chi tiết thanh toán của bạn. " +
          "Bạn có thể tìm thêm thông tin tại: ai.google.dev/gemini-api/docs/rate-limits"
        );
      }
    } 
    // Handle "Requested entity was not found." for invalid API key or other server-side issues
    else if (error instanceof Error && error.message.includes("Requested entity was not found.")) {
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        // The API key selection dialog link: ai.google.dev/gemini-api/docs/billing
        // It's assumed openSelectKey will show a link to the billing documentation.
        window.aistudio.openSelectKey(); // Prompt user to select/update API key
        throw new Error("Khóa API không hợp lệ. Vui lòng thử lại sau khi chọn khóa.");
      } else {
        throw new Error("Khóa API không hợp lệ. Vui lòng kiểm tra khóa API của bạn.");
      }
    }
    throw error; // Re-throw other errors
  }
};
