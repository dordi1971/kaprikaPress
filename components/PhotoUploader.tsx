'use client';

import React, { useCallback, useRef, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';

type PhotoUploaderProps = {
  label?: string;
  /** Called when final 1:1 image is ready */
  onChange?: (file: File, previewUrl: string) => void;
  /** Initial preview (e.g. for edit mode) */
  initialPreviewUrl?: string;
};

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  label = 'Upload photo',
  onChange,
  initialPreviewUrl,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null); // original
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialPreviewUrl || null
  ); // cropped preview

  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const openFileDialog = () => {
    inputRef.current?.click();
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setIsCropping(true);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Utility: create HTMLImageElement from URL
  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.addEventListener('load', () => resolve(img));
      img.addEventListener('error', (error) => reject(error));
      img.setAttribute('crossOrigin', 'anonymous');
      img.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area
  ): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    // 1:1 aspect: use crop width as size
    const size = pixelCrop.width;
    canvas.width = size;
    canvas.height = size;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      size,
      size
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  };

  const handleConfirmCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });

      const preview = URL.createObjectURL(blob);
      setPreviewUrl(preview);
      setIsCropping(false);

      onChange?.(file, preview);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setImageSrc(null);
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setImageSrc(null);
    setIsCropping(false);
    if (onChange) {
      // optional: you can also signal "removed" with nulls if you want
      onChange(
        new File([], 'empty.jpg', { type: 'image/jpeg' }),
        ''
      );
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-200">
          {label}
        </label>
      )}

      {/* Dropzone / thumbnail */}
      <div
        className="relative aspect-square w-48 cursor-pointer rounded-xl border border-dashed border-gray-500/70 bg-gray-900/40 flex items-center justify-center overflow-hidden transition hover:border-blue-400 hover:bg-gray-900/70"
        onClick={openFileDialog}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* Hidden input */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* If we have a preview – show thumbnail */}
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Photo preview"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2 py-1 text-xs text-gray-100 flex items-center justify-between">
              <span>Click to change</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="rounded bg-black/50 px-2 py-0.5 text-[11px] hover:bg-black/80"
              >
                Remove
              </button>
            </div>
          </>
        ) : (
          // Empty state
          <div className="flex flex-col items-center justify-center text-center px-4">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-gray-500/70">
              <span className="text-xl">📷</span>
            </div>
            <p className="text-xs text-gray-200">
              Click or drop a photo here
            </p>
            <p className="mt-1 text-[10px] text-gray-400">
              JPG/PNG, will be cropped to 1:1
            </p>
          </div>
        )}
      </div>

      {/* Cropping overlay */}
      {isCropping && imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-xl bg-gray-900 p-4 shadow-xl border border-gray-700">
            <h2 className="mb-3 text-sm font-medium text-gray-100">
              Adjust your photo (1:1)
            </h2>
            <div className="relative h-72 w-full overflow-hidden rounded-lg bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                restrictPosition
              />
            </div>

            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs text-gray-400">Zoom</span>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelCrop}
                className="rounded-md border border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
