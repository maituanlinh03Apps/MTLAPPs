
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { generateImageWithGemini } from './services/geminiService';
import { fileToBase64 } from './utils';
import { CharacterImage, BackgroundImage, StoredImage, AspectRatio } from './types';
import ImageUploadInput from './components/ImageUploadInput';

const LOCAL_STORAGE_KEY = 'linhAnimationSavedImages';

/**
 * ImageLightbox component for displaying enlarged images in a modal.
 */
const ImageLightbox: React.FC<{ imageUrl: string; onClose: () => void }> = ({
  imageUrl,
  onClose,
}) => {
  useEffect(() => {
    // Disable scrolling on body when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Close modal on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Close modal on Escape key press
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
      aria-label="Enlarged image view"
    >
      <div className="relative max-w-4xl w-full max-h-[90vh] overflow-auto bg-gray-800 p-4 rounded-lg shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 text-white bg-red-600 rounded-full hover:bg-red-700 transition-colors z-10"
          aria-label="Close image"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img src={imageUrl} alt="Enlarged result" className="max-w-full max-h-[85vh] object-contain mx-auto" />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [characterImages, setCharacterImages] = useState<CharacterImage[]>(
    Array.from({ length: 4 }, (_, i) => ({
      id: `char-${i + 1}`,
      file: null,
      base64: null,
      selected: false,
      previewUrl: null,
    }))
  );
  const [backgroundImage, setBackgroundImage] = useState<BackgroundImage>({
    file: null,
    base64: null,
    previewUrl: null,
    useBackground: false,
  });
  const [prompt, setPrompt] = useState<string>('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Removed apiKeySelected state as it's not needed for non-Veo models based on guidelines.
  const [savedImages, setSavedImages] = useState<StoredImage[]>([]);

  // New state for aspect ratio (visually disabled as per guidelines for gemini-2.5-flash-image)
  const aspectRatioOptions: AspectRatio[] = ['1:1', '4:3', '3:4', '16:9', '9:16'];
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('1:1'); // Default, non-functional

  // New state for lightbox
  const [selectedImageForLightbox, setSelectedImageForLightbox] = useState<string | null>(null);

  // Removed useEffect for checking API key status on mount, as process.env.API_KEY is assumed to be present.

  // Load saved images from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setSavedImages(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load saved images from local storage:", e);
    }
  }, []);

  const handleFileChange = useCallback(
    async (
      type: 'character' | 'background',
      index: number | null,
      file: File | null,
    ) => {
      setError(null);
      if (file) {
        try {
          const base64 = await fileToBase64(file);
          const previewUrl = URL.createObjectURL(file);

          if (type === 'character' && index !== null) {
            setCharacterImages((prev) =>
              prev.map((char, i) =>
                i === index ? { ...char, file, base64, previewUrl, selected: true } : char,
              ),
            );
          } else if (type === 'background') {
            setBackgroundImage((prev) => ({ ...prev, file, base64, previewUrl, useBackground: true }));
          }
        } catch (err) {
          setError(`Failed to read file: ${(err as Error).message}`);
        }
      } else {
        // Clear image
        if (type === 'character' && index !== null) {
          setCharacterImages((prev) =>
            prev.map((char, i) =>
              i === index
                ? { id: char.id, file: null, base64: null, selected: false, previewUrl: null }
                : char,
            ),
          );
        } else if (type === 'background') {
          setBackgroundImage({ file: null, base64: null, previewUrl: null, useBackground: false });
        }
      }
    },
    [],
  );

  const handleDeleteImage = useCallback((type: 'character' | 'background', index: number | null) => {
    if (type === 'character' && index !== null) {
      setCharacterImages((prev) =>
        prev.map((char, i) =>
          i === index
            ? { id: char.id, file: null, base64: null, selected: false, previewUrl: null }
            : char,
        ),
      );
    } else if (type === 'background') {
      setBackgroundImage({ file: null, base64: null, previewUrl: null, useBackground: false });
    }
  }, []);

  const handleToggleCharacterSelect = useCallback((index: number, selected: boolean) => {
    setCharacterImages((prev) =>
      prev.map((char, i) => (i === index ? { ...char, selected } : char)),
    );
  }, []);

  const handleToggleBackgroundUse = useCallback((useBackground: boolean) => {
    setBackgroundImage((prev) => ({ ...prev, useBackground }));
  }, []);

  const handleGenerateImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    // DO NOT CLEAR PREVIOUS IMAGES: new images will be prepended
    // setGeneratedImages([]); 

    const selectedCharImages = characterImages
      .filter((char) => char.selected && char.base64 && char.file)
      .map((char) => ({
        base64: char.base64!,
        mimeType: char.file!.type,
      }));

    const bgImage = backgroundImage.useBackground && backgroundImage.base64 && backgroundImage.file
      ? { base64: backgroundImage.base64, mimeType: backgroundImage.file.type }
      : null;

    if (selectedCharImages.length === 0 && (!bgImage || !backgroundImage.useBackground)) {
      setError('Vui lòng tải lên và chọn ít nhất một ảnh nhân vật hoặc sử dụng ảnh nền.');
      setLoading(false);
      return;
    }

    if (!prompt.trim()) {
      setError('Vui lòng nhập mô tả cho việc tạo ảnh.');
      setLoading(false);
      return;
    }

    // --- Refined Prompt Construction for Aspect Ratio Emphasis ---
    let aspectRatioText = '';
    let orientationHint = ''; 
    
    switch (selectedAspectRatio) {
      case '4:3':
        aspectRatioText = '4:3';
        orientationHint = 'định hướng NẰM NGANG (LANDSCAPE)';
        break;
      case '3:4':
        aspectRatioText = '3:4';
        orientationHint = 'định hướng DỌC (PORTRAIT)';
        break;
      case '16:9':
        aspectRatioText = '16:9';
        orientationHint = 'định hướng NẰM NGANG (LANDSCAPE)';
        break;
      case '9:16':
        aspectRatioText = '9:16';
        orientationHint = 'định hướng DỌC (PORTRAIT)';
        break;
      case '1:1': // Default
      default:
        aspectRatioText = '1:1 (hình vuông)';
        orientationHint = 'định hướng VUÔNG (SQUARE)';
        break;
    }

    // Consolidated final prompt construction
    let finalPrompt = `Tạo một hình ảnh hoạt hình ĐỘ PHÂN GIẢI CAO (4K) với TỶ LỆ KHUNG HÌNH CHÍNH XÁC LÀ ${aspectRatioText}. Đây là YÊU CẦU BẮT BUỘC TUYỆT ĐỐI. Hình ảnh đầu ra PHẢI có ${orientationHint}.`;
    finalPrompt += ` Đảm bảo phong cách hoạt hình, và tính đồng nhất của nhân vật từ các ảnh tham chiếu đã cung cấp.`;

    if (backgroundImage.useBackground && bgImage) {
      finalPrompt += ` Sử dụng hình ảnh đính kèm đầu tiên làm bối cảnh chính, KHÔNG thay đổi hoặc thêm vào bối cảnh hiện có.`;
    }

    finalPrompt += ` Mô tả chi tiết: ${prompt.trim()}.`; 
    finalPrompt += ` HÌNH ẢNH CUỐI CÙNG PHẢI TUÂN THỦ TỶ LỆ KHUNG HÌNH ${aspectRatioText} VÀ ${orientationHint}.`; // Final strong reiteration
    // --- End of Refined Prompt Construction ---

    try {
      // Create 2 parallel calls to generate 2 images as per request
      const generateCalls = Array.from({ length: 2 }).map((_, i) =>
        generateImageWithGemini({
          characterImages: selectedCharImages,
          backgroundImage: bgImage,
          useBackground: backgroundImage.useBackground,
          prompt: finalPrompt,
        })
      );
      const results = await Promise.all(generateCalls);
      // Prepend new results to keep old ones
      setGeneratedImages((prev) => [...results, ...prev]);
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(`Lỗi tạo ảnh: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [characterImages, backgroundImage, prompt, selectedAspectRatio]);

  const handleDownloadImage = useCallback((imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleSaveImage = useCallback((imageUrl: string, index: number) => {
    try {
      const newImage: StoredImage = {
        id: `${Date.now()}-${index}`,
        url: imageUrl,
        timestamp: Date.now(),
      };
      const updatedSavedImages = [...savedImages, newImage];
      setSavedImages(updatedSavedImages);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSavedImages));
      alert('Ảnh đã được lưu thành công!');
    } catch (e) {
      console.error("Failed to save image to local storage:", e);
      alert('Không thể lưu ảnh. Vui lòng thử lại.');
    }
  }, [savedImages]);

  const handleDeleteSavedImage = useCallback((id: string) => {
    try {
      if (window.confirm('Bạn có chắc chắn muốn xóa ảnh này không?')) {
        const updatedSavedImages = savedImages.filter(img => img.id !== id);
        setSavedImages(updatedSavedImages);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedSavedImages));
      }
    } catch (e) {
      console.error("Failed to delete saved image from local storage:", e);
      alert('Không thể xóa ảnh. Vui lòng thử lại.');
    }
  }, [savedImages]);

  const handleClearAllSavedImages = useCallback(() => {
    try {
      if (window.confirm('Bạn có chắc chắn muốn xóa TẤT CẢ ảnh đã lưu không? Hành động này không thể hoàn tác.')) {
        setSavedImages([]);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    } catch (e) {
      console.error("Failed to clear all saved images from local storage:", e);
      alert('Không thể xóa tất cả ảnh đã lưu. Vui lòng thử lại.');
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-gray-100">
      {/* Removed Global Header Banner */}
      
      <div className="flex flex-col lg:flex-row flex-1">
        {/* Control Panel (Left Column) */}
        <div className="lg:w-1/3 w-full bg-gray-800 p-6 shadow-lg lg:min-h-screen lg:max-h-screen overflow-y-auto relative pb-20">
          <h1 className="text-3xl font-bold text-white mb-2">Linh Animation</h1>
          <h2 className="text-xl font-semibold text-purple-600 mb-6 border-b border-gray-700 pb-4">
            Apps tạo ảnh nhân vật hoạt hình đồng nhất
          </h2>
          {/* Removed descriptive paragraph */}

          {/* Character Reference Images */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-purple-400 mb-4">Ảnh nhân vật tham chiếu</h2>
            <div className="grid grid-cols-2 gap-4">
              {characterImages.map((char, index) => (
                <ImageUploadInput
                  key={char.id}
                  id={char.id}
                  label={`Nhân vật ${index + 1}`}
                  previewUrl={char.previewUrl}
                  onFileChange={(file) => handleFileChange('character', index, file)}
                  onDelete={() => handleDeleteImage('character', index)}
                  showCheckbox={true}
                  isChecked={char.selected}
                  onToggleCheck={(checked) => handleToggleCharacterSelect(index, checked)}
                  tooltipText="Tải lên ảnh nhân vật tham chiếu. Chọn ít nhất một nhân vật để AI học và duy trì sự đồng nhất trong các ảnh đã tạo."
                />
              ))}
            </div>
          </section>

          {/* Background Reference Image */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-purple-400 mb-4">Bối cảnh tham chiếu</h2>
            <ImageUploadInput
              id="background"
              label="Ảnh nền"
              previewUrl={backgroundImage.previewUrl}
              onFileChange={(file) => handleFileChange('background', null, file)}
              onDelete={() => handleDeleteImage('background', null)}
              tooltipText="Tải lên ảnh nền mà bạn muốn AI sử dụng. Khi 'Dùng bối cảnh này' được chọn, AI sẽ cố gắng giữ nguyên bối cảnh trong ảnh đã tạo."
            />
            {/* Custom Toggle Switch for background use */}
            <div 
              className="flex items-center mt-4"
              title="Khi được chọn, AI sẽ sử dụng bối cảnh đã tải lên và chỉ thay đổi nhân vật/hành động."
            >
              <label htmlFor="use-background-toggle" className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="use-background-toggle"
                  checked={backgroundImage.useBackground}
                  onChange={(e) => handleToggleBackgroundUse(e.target.checked)}
                  disabled={!backgroundImage.file}
                  className="sr-only peer" // Hide checkbox visually, makes it the 'peer'
                  aria-label="Dùng bối cảnh này"
                />
                {/* Visual toggle switch (the track and thumb) */}
                <div
                  className={`relative w-12 h-6 flex-shrink-0 rounded-full transition-colors duration-200 ease-in-out
                    ${!backgroundImage.file ? 'opacity-50 cursor-not-allowed' : ''}
                    ${backgroundImage.useBackground ? 'bg-purple-600' : 'bg-gray-600'}
                    peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 peer-focus:ring-offset-2
                  `}
                >
                  <div
                    className={`absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out
                      ${backgroundImage.useBackground ? 'translate-x-6' : 'translate-x-0'}
                    `}
                  ></div>
                </div>
                <span className="ml-3 text-gray-200 whitespace-nowrap">Dùng bối cảnh này</span>
              </label>
              {!backgroundImage.file && (
                <span className="ml-2 text-sm text-gray-400 whitespace-nowrap">(Tải ảnh nền lên để bật nút này)</span>
              )}
            </div>
          </section>

          {/* Aspect Ratio Selection (Visually selectable but functionally inert) */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-purple-400 mb-4">
              Chọn Tỷ lệ ảnh
            </h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {aspectRatioOptions.map((ratio) => {
                let widthClass = '';
                let heightClass = '';
                switch (ratio) {
                  case '1:1': widthClass = 'w-6'; heightClass = 'h-6'; break;
                  case '4:3': widthClass = 'w-8'; heightClass = 'h-6'; break;
                  case '3:4': widthClass = 'w-6'; heightClass = 'h-8'; break;
                  case '16:9': widthClass = 'w-10'; heightClass = 'h-6'; break;
                  case '9:16': widthClass = 'w-6'; heightClass = 'h-10'; break;
                }
                return (
                  <button
                    key={ratio}
                    onClick={() => setSelectedAspectRatio(ratio)}
                    className={`px-3 py-2 text-sm font-medium rounded-md flex items-center justify-center space-x-2
                      ${selectedAspectRatio === ratio ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-400'}
                      hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors`}
                    aria-label={`Tỷ lệ ảnh ${ratio}`}
                    title={`Chọn tỷ lệ khung hình ${ratio} cho ảnh đầu ra.`}
                  >
                    <span className="text-base">{ratio}</span>
                    <div className={`border border-white/50 rounded-sm ${widthClass} ${heightClass}`}></div>
                  </button>
                );
              })}
            </div>
            {/* Prominent warning about aspect ratio limitations */}
            <div className="bg-yellow-900 border border-yellow-700 text-yellow-300 px-4 py-3 rounded relative text-sm" role="alert">
              <span className="block sm:inline mr-2">⚠️</span>
              <span className="block sm:inline">
                **Lưu ý:** Mô hình `gemini-2.5-flash-image` (Nano Banana) không hỗ trợ đặt tỷ lệ khung hình trực tiếp qua API (chỉ các mô hình tạo ảnh chuyên dụng mới có). Tùy chọn này chỉ *gợi ý mạnh mẽ* cho AI. Do đó, AI sẽ cố gắng tuân thủ nhưng **không đảm bảo độ chính xác tuyệt đối**. Mô hình này được chọn vì ưu tiên việc duy trì tính nhất quán nhân vật và bối cảnh.
              </span>
            </div>
          </section>

          {/* Prompt Input */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-purple-400 mb-4">Câu lệnh</h2>
            <textarea
              className="w-full p-3 border border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500 transition duration-150 ease-in-out resize-y min-h-[100px] bg-gray-700 text-gray-200"
              placeholder="Mô tả hành động/bố cục cho nhân vật của bạn, ví dụ: 'nhân vật hoạt hình đang chạy trong công viên, trời nắng, phong cách dễ thương'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              aria-label="Mô tả cho việc tạo ảnh"
              title="Nhập mô tả chi tiết về hành động, cảm xúc của nhân vật, và phong cách tổng thể bạn muốn cho hình ảnh."
            ></textarea>
          </section>

          {/* Action Button (Sticky) */}
          <div className="lg:sticky lg:bottom-0 left-0 right-0 bg-gray-800 p-6 border-t border-gray-700 shadow-md flex items-center justify-center -mx-6">
            <button
              onClick={handleGenerateImages}
              disabled={loading}
              className="w-full py-3 px-6 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              aria-label={loading ? "Đang tạo ảnh..." : "Tạo ảnh"}
              title="Nhấn để bắt đầu quá trình tạo ảnh dựa trên các tham chiếu và câu lệnh của bạn."
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang tạo ảnh...
                </span>
              ) : (
                'Tạo ảnh'
              )}
            </button>
          </div>
        </div>

        {/* Results Panel (Right Column) */}
        <div className="lg:w-2/3 w-full p-6 bg-slate-900 lg:max-h-screen overflow-y-auto">
          <h2 className="text-3xl font-bold text-purple-400 mb-6 border-b border-gray-700 pb-4">Kết quả</h2>
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded relative mb-4" role="alert">
              <strong className="font-bold">Lỗi!</strong>
              <span className="block sm:inline ml-2">{error}</span>
            </div>
          )}

          {loading && generatedImages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 bg-gray-800 text-white rounded-lg p-6">
              <svg className="animate-spin h-10 w-10 mb-4 text-red-500" viewBox="0 0 24 24"> {/* Spinner with red circle and white path */}
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-lg font-medium text-purple-400">Đang tạo hình ảnh 4K... Vui lòng chờ trong giây lát.</p>
              <p className="text-sm text-white mt-2">AI của Linh đang làm việc hết mình để tạo ra tác phẩm của bạn.</p>
            </div>
          )}

          {!loading && generatedImages.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-64 bg-gray-800 text-white border border-dashed border-gray-700 rounded-lg p-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-12 h-12 mb-4 text-purple-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0L15 14.25m-3.182-5.159a2.25 2.25 0 013.182 0L21.75 15.75V19.5A2.25 2.25 0 0119.5 21h-15A2.25 2.25 0 012.25 19.5V15.75z" />
              </svg>
              <p className="text-lg font-medium text-white">Chào mừng đến với Apps Linh Animation:</p>
              <p className="text-sm text-gray-300 mt-2 text-center max-w-md">Sử dụng bảng điều khiển bên trái để tải lên hình ảnh tham chiếu, viết câu lệnh và bắt đầu sáng tạo những nhân vật nhất quán!</p>
            </div>
          )}

          {generatedImages.length > 0 && (
            <>
              <h2 className="text-2xl font-bold text-purple-400 mb-4 mt-8">Ảnh đã tạo</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {generatedImages.map((imageUrl, index) => {
                  const isSaved = savedImages.some(img => img.url === imageUrl);
                  return (
                    <div key={index} className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                      <div
                        className="relative w-full h-64 bg-gray-700 flex items-center justify-center cursor-pointer"
                        onClick={() => setSelectedImageForLightbox(imageUrl)}
                        tabIndex={0}
                        role="button"
                        aria-label={`Xem phóng to ảnh đã tạo ${index + 1}`}
                      >
                        <img src={imageUrl} alt={`Generated Result ${index + 1}`} className="object-contain max-h-full max-w-full" />
                      </div>
                      <div className="p-4 flex flex-wrap justify-around items-center border-t border-gray-700 gap-2">
                        <button
                          onClick={() => setSelectedImageForLightbox(imageUrl)}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center min-w-[120px]"
                          aria-label={`Xem trước ảnh ${index + 1}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6.75c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125H3.375A1.125 1.125 0 012.25 10.5v-3.375z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 7.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-3.375zM12 15.75h2.25m-4.5 0H12m-4.5 0H1.875A.375.375 0 011.5 15.375V8.25m4.5.75H12m7.5 0h2.625c.205 0 .375.17.375.375v4.5c0 .205-.17.375-.375.375H12" />
                          </svg>
                          Xem trước
                        </button>
                        <button
                          onClick={() => handleDownloadImage(imageUrl, `linh-animation-result-${index + 1}.png`)}
                          className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex items-center justify-center min-w-[120px]"
                          aria-label={`Tải xuống ảnh ${index + 1}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          Tải xuống
                        </button>
                        <button
                          onClick={() => handleSaveImage(imageUrl, index)}
                          disabled={isSaved}
                          className={`flex-1 px-4 py-2 ${isSaved ? 'bg-gray-600 text-gray-300' : 'bg-purple-600'} text-white text-sm font-medium rounded-md ${isSaved ? '' : 'hover:bg-purple-700 focus:ring-2 focus:ring-purple-500'} focus:outline-none focus:ring-offset-2 transition-colors flex items-center justify-center min-w-[120px]`}
                          aria-label={isSaved ? `Ảnh đã lưu` : `Lưu ảnh ${index + 1}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v6.75m0 0l-3-3m3 3l3-3m-8.25 6h16.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H1.5a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                          {isSaved ? 'Đã lưu' : 'Lưu ảnh'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Saved Images Section */}
          <section className="mt-12">
            <h2 className="text-2xl font-bold text-purple-400 mb-4 border-b border-gray-700 pb-2">Danh sách Lưu Ảnh</h2>
            {savedImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 bg-gray-800 text-gray-300 border border-dashed border-gray-700 rounded-lg p-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-10 h-10 mb-3 text-purple-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
                </svg>
                <p className="text-lg font-medium text-white">Chưa có ảnh nào được lưu.</p>
                <p className="text-sm text-gray-300 mt-1">Hãy tạo và lưu ảnh bạn thích!</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {savedImages.map((image) => (
                    <div key={image.id} className="bg-gray-800 rounded-lg shadow-md overflow-hidden">
                      <div
                        className="relative w-full h-64 bg-gray-700 flex items-center justify-center cursor-pointer"
                        onClick={() => setSelectedImageForLightbox(image.url)}
                        tabIndex={0}
                        role="button"
                        aria-label={`Xem phóng to ảnh đã lưu ${image.id}`}
                      >
                        <img src={image.url} alt={`Saved Result ${image.id}`} className="object-contain max-h-full max-w-full" />
                      </div>
                      <div className="p-4 flex flex-wrap justify-around items-center border-t border-gray-700 gap-2">
                        <button
                          onClick={() => setSelectedImageForLightbox(image.url)}
                          className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center min-w-[100px]"
                          aria-label={`Xem trước ảnh đã lưu ${image.id}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6.75c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125H3.375A1.125 1.125 0 012.25 10.5v-3.375z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.125 7.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v3.375c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-3.375zM12 15.75h2.25m-4.5 0H12m-4.5 0H1.875A.375.375 0 011.5 15.375V8.25m4.5.75H12m7.5 0h2.625c.205 0 .375.17.375.375v4.5c0 .205-.17.375-.375.375H12" />
                          </svg>
                          Xem trước
                        </button>
                        <button
                          onClick={() => handleDownloadImage(image.url, `linh-animation-saved-${image.id}.png`)}
                          className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex items-center justify-center min-w-[100px]"
                          aria-label={`Tải xuống ảnh đã lưu ${image.id}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          Tải xuống
                        </button>
                        <button
                          onClick={() => handleDeleteSavedImage(image.id)}
                          className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors flex items-center justify-center min-w-[100px]"
                          aria-label={`Xóa ảnh đã lưu ${image.id}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.927a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.147-2.006-2.293a1.94 1.94 0 00-2.356-.274H10.5c-1.178 0-2.23-.718-2.614-1.815a1.979 1.979 0 00-1.88-1.555a1.967 1.967 0 00-1.296-.407" />
                          </svg>
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 text-center">
                  <button
                    onClick={handleClearAllSavedImages}
                    className="px-6 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors text-sm"
                    aria-label="Xóa tất cả ảnh đã lưu"
                  >
                    Xóa tất cả ảnh đã lưu
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
      {selectedImageForLightbox && (
        <ImageLightbox imageUrl={selectedImageForLightbox} onClose={() => setSelectedImageForLightbox(null)} />
      )}
    </div>
  );
};

export default App;
