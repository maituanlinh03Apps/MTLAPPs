

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const stripDataPrefix = (base64String: string): string => {
  if (base64String.startsWith('data:')) {
    const commaIndex = base64String.indexOf(',');
    if (commaIndex !== -1) {
      return base64String.substring(commaIndex + 1);
    }
  }
  return base64String;
};
