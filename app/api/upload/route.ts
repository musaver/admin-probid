import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export async function POST(request: NextRequest) {
  try {
    console.log('Upload API called');
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const directory = formData.get('directory') as string || 'general';

    console.log('Received file:', file ? { name: file.name, size: file.size, type: file.type } : 'null');
    console.log('Directory:', directory);

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.error('Invalid file type:', file.type);
      return NextResponse.json({
        error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'
      }, { status: 400 });
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      console.error('File too large:', file.size);
      return NextResponse.json({
        error: 'File too large. Maximum size is 5MB.'
      }, { status: 400 });
    }

    // Validate directory parameter
    const allowedDirectories = ['courses', 'batches', 'general', 'articles'];
    if (!allowedDirectories.includes(directory)) {
      console.error('Invalid directory:', directory);
      return NextResponse.json({
        error: 'Invalid directory. Allowed directories: courses, batches, general, articles'
      }, { status: 400 });
    }

    // Generate unique filename with directory structure
    const timestamp = Date.now();
    const fileName = `${directory}/${timestamp}-${file.name}`;
    console.log('Generated filename:', fileName);

    // Upload to Vercel Blob
    console.log('Starting Vercel Blob upload...');
    const blob = await put(fileName, file, {
      access: 'public',
    });
    console.log('Upload successful, blob URL:', blob.url);

    return NextResponse.json({
      url: blob.url,
      fileName: fileName
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload file';
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.stack : String(error) },
      { status: 500 }
    );
  }
} 