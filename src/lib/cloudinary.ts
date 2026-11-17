import {
  FILE_SIZE_LIMITS,
  formatFileSize,
  prepareMediaForUpload,
  validateAttachmentFile,
} from '../types';

interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

let cachedConfig: CloudinaryConfig | null = null;

async function resolveCloudinaryConfig(): Promise<CloudinaryConfig> {
  const envCloud = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim();
  const envPreset = String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim();
  if (envCloud && envPreset) {
    return { cloudName: envCloud, uploadPreset: envPreset };
  }

  if (cachedConfig && cachedConfig.cloudName && cachedConfig.uploadPreset) {
    return cachedConfig;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch('/api/upload-config', { signal: controller.signal });
    if (res.ok) {
      const data = (await res.json()) as Partial<CloudinaryConfig>;
      const cloudName = String(data.cloudName || '').trim();
      const uploadPreset = String(data.uploadPreset || '').trim();
      if (cloudName && uploadPreset) {
        cachedConfig = { cloudName, uploadPreset };
        return cachedConfig;
      }
    }
  } catch {
    // Fall through to missing-config error below
  } finally {
    clearTimeout(timer);
  }

  throw new Error(
    'Cloudinary upload is not configured yet. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET (Unsigned upload preset) in your Render / environment variables.',
  );
}

export async function uploadMediaToCloudinary(
  file: File,
  uid: string,
  kind: 'id' | 'proof' | 'photo',
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<{ url: string; mime: string }> {
  if (!uid) {
    throw new Error('Sign in with Google before uploading files.');
  }
  if (signal?.aborted) {
    throw new Error('File upload was canceled.');
  }

  const validationError = validateAttachmentFile(file, kind);
  if (validationError) {
    throw new Error(validationError);
  }

  const { cloudName, uploadPreset } = await resolveCloudinaryConfig();
  if (signal?.aborted) {
    throw new Error('File upload was canceled.');
  }

  const prepared = await prepareMediaForUpload(file);
  if (signal?.aborted) {
    throw new Error('File upload was canceled.');
  }

  if (prepared.blob.size > FILE_SIZE_LIMITS.maxBytes) {
    throw new Error(
      `File size (${formatFileSize(prepared.blob.size)}) exceeds the 5 MB maximum limit.`,
    );
  }

  const safeName = (prepared.filename || 'upload')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-100);

  const formData = new FormData();
  formData.append('file', prepared.blob, safeName);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', `cshs-clearance/${uid}/${kind}`);

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`;

  return new Promise<{ url: string; mime: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const onAbort = () => {
      try {
        xhr.abort();
      } catch {
        // Ignore abort error
      }
      fail(new Error('File upload was canceled.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    xhr.open('POST', endpoint, true);
    xhr.timeout = 180000; // 3 minutes for large videos

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const pct = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
        onProgress?.(pct);
      }
    };

    xhr.onload = () => {
      let body: { secure_url?: string; error?: { message?: string } } = {};
      try {
        body = JSON.parse(xhr.responseText || '{}') as typeof body;
      } catch {
        // Ignore invalid JSON
      }

      if (xhr.status >= 200 && xhr.status < 300 && body.secure_url) {
        if (!settled) {
          settled = true;
          cleanup();
          onProgress?.(100);
          resolve({ url: body.secure_url, mime: prepared.mime });
        }
        return;
      }

      const apiMsg = body.error?.message || `Upload failed (HTTP ${xhr.status}).`;
      if (apiMsg.toLowerCase().includes('preset')) {
        fail(
          new Error(
            `Cloudinary upload preset error: "${apiMsg}". Make sure your upload preset exists and its Signing Mode is set to Unsigned.`,
          ),
        );
        return;
      }
      fail(new Error(`Cloudinary upload failed: ${apiMsg}`));
    };

    xhr.onerror = () => {
      fail(
        new Error(
          'Could not connect to Cloudinary. Check your internet connection and verify VITE_CLOUDINARY_CLOUD_NAME is correct.',
        ),
      );
    };

    xhr.ontimeout = () => {
      fail(
        new Error('Upload timed out. Check your internet connection or try a smaller video file.'),
      );
    };

    xhr.send(formData);
  });
}
