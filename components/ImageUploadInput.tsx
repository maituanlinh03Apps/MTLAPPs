
import React, { useRef } from 'react';

interface ImageUploadInputProps {
  id: string;
  label: string;
  previewUrl: string | null;
  onFileChange: (file: File | null) => void;
  onDelete?: () => void;
  showCheckbox?: boolean;
  isChecked?: boolean;
  onToggleCheck?: (checked: boolean) => void;
  tooltipText?: string; // New prop for tooltip text
}

const ImageUploadInput: React.FC<ImageUploadInputProps> = ({
  id,
  label,
  previewUrl,
  onFileChange,
  onDelete,
  showCheckbox = false,
  isChecked = false,
  onToggleCheck,
  tooltipText, // Destructure new prop
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileChange(event.target.files[0]);
    } else {
      onFileChange(null);
      // Reset the file input value if no file was selected (e.g., user cancelled)
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the file input click from the label
    onDelete?.();
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear the input so same file can be re-uploaded
    }
  };

  return (
    <div
      className="relative flex flex-col items-center p-4 border border-dashed border-gray-600 rounded-lg bg-gray-700"
      title={tooltipText} // Add tooltip to the main container
    >
      <h3 className="text-sm font-semibold text-gray-200 mb-2">{label}</h3>

      {/* The actual hidden file input */}
      <input
        type="file"
        id={id}
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileInputChange}
        className="sr-only" // Visually hidden but accessible
        aria-hidden="true" // Hide from assistive technologies as the label is the primary interaction
        tabIndex={-1} // Make it not focusable via keyboard directly
      />

      {/* The visible label that triggers the file input */}
      <label
        htmlFor={id}
        className="w-full cursor-pointer relative flex flex-col items-center group" // Use group for hover effects on children
        tabIndex={0} // Make label focusable for keyboard users
        onKeyDown={(e) => { // Allow activation with Enter/Space key for accessibility
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // Removed fileInputRef.current?.click(); as the label itself triggers the input.
            // This prevents duplicate clicks/conflicts causing the "flickering" issue.
          }
        }}
      >
        {previewUrl ? (
          <div className="relative w-full h-32 bg-gray-600 rounded-md overflow-hidden flex items-center justify-center mb-2">
            <img src={previewUrl} alt="Preview" className="object-contain max-h-full max-w-full" />
          </div>
        ) : (
          <div className="w-full h-32 bg-gray-600 rounded-md flex items-center justify-center text-gray-400 mb-2 group-hover:bg-gray-500 transition-colors">
            <span className="text-3xl">+</span>
          </div>
        )}

        <span className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md group-hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
          {previewUrl ? 'Thay đổi ảnh' : '+ Tải ảnh lên'}
        </span>
      </label>

      {onDelete && previewUrl && ( // Only show delete button if there's a preview and onDelete is provided
        <button
          onClick={handleDeleteClick}
          className="absolute top-5 right-5 bg-red-600 text-white rounded-full p-1 text-xs leading-none flex items-center justify-center w-5 h-5 opacity-80 hover:opacity-100 transition-opacity z-10"
          aria-label="Delete image"
        >
          &times;
        </button>
      )}

      {showCheckbox && onToggleCheck && (
        <label htmlFor={`${id}-checkbox`} className="flex items-center mt-3 text-sm text-gray-200 cursor-pointer">
          <input
            type="checkbox"
            id={`${id}-checkbox`}
            checked={isChecked}
            onChange={(e) => onToggleCheck(e.target.checked)}
            className="form-checkbox h-4 w-4 text-purple-600 rounded focus:ring-purple-500 mr-2 bg-gray-600 border-gray-500"
          />
          Tick chọn nhân vật
        </label>
      )}
    </div>
  );
};

export default ImageUploadInput;
