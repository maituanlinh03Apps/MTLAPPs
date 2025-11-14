
export type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16';

export interface CharacterImage {
  id: string;
  file: File | null;
  base64: string | null;
  selected: boolean;
  previewUrl: string | null;
}

export interface BackgroundImage {
  file: File | null;
  base64: string | null;
  previewUrl: string | null;
  useBackground: boolean;
}

export interface StoredImage {
  id: string; // Unique ID for the saved image
  url: string; // Base64 image data
  timestamp: number; // For sorting and identifying when it was saved
}