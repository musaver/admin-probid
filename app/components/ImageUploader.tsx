'use client';
import React, { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, X, Upload } from 'lucide-react';

interface ImageUploaderProps {
  currentImage?: string;
  onImageUpload: (imageUrl: string) => void;
  onImageRemove: () => void;
  label?: string;
  disabled?: boolean;
  directory?: 'courses' | 'batches' | 'general' | 'articles';
}

export default function ImageUploader({
  currentImage,
  onImageUpload,
  onImageRemove,
  label = "Upload Image",
  disabled = false,
  directory = 'general'
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg' as const,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      const fileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
      return new File([compressedFile], fileName, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
    } catch (error) {
      console.error('Error compressing image:', error);
      return file;
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    setUploading(true);

    try {
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      const compressedFile = await compressImage(file);

      const formData = new FormData();
      formData.append('file', compressedFile);
      formData.append('directory', directory);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const { url } = await response.json();
      onImageUpload(url);
      URL.revokeObjectURL(previewUrl);
      setPreview(url);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(`Error uploading image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPreview(currentImage || null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setPreview(null);
    onImageRemove();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>

      {preview && (
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Preview"
            className="w-32 h-32 object-cover rounded-lg border"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={handleRemoveImage}
            disabled={disabled || uploading}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={disabled || uploading}
          className="hidden"
          id="image-upload"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              {preview ? 'Change Image' : 'Select Image'}
            </>
          )}
        </Button>

        {preview && (
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={handleRemoveImage}
            disabled={disabled || uploading}
          >
            Remove
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Supports JPEG, PNG, WebP. Max size: 5MB. Images will be automatically compressed.
      </p>
    </div>
  );
}
