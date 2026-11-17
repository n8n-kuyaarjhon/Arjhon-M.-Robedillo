export type DocType = 'form137_sf10' | 'good_moral' | 'clearance' | 'report_card';
export type PurposeType = 'employment' | 'university' | 'military' | 'others';
export type StaffRole = 'registrar' | 'admin_assistant' | 'principal';
export type UserRole = StaffRole | 'student' | 'public';
export type AppView =
  | 'request'
  | 'track'
  | 'profile'
  | 'registrar'
  | 'fulfillment'
  | 'accounts'
  | 'notifications'
  | 'about';

export const DOCS: Record<DocType, string> = {
  form137_sf10: 'Form 137 / SF10',
  good_moral: 'Good Moral Certificate',
  clearance: 'School Clearance',
  report_card: 'Report Card / Transcript',
};

export const PURPOSE: Record<PurposeType, string> = {
  employment: 'For Employment',
  university: 'For University',
  military: 'For Military',
  others: 'Others',
};

export const ID_TYPES = [
  'Philippine Passport',
  'Driver’s License',
  'UMID',
  'PhilSys National ID (PhilID / ePhilID)',
  'PRC ID',
  'Postal ID',
  'Voter’s ID',
  'SSS ID',
  'GSIS ID',
  'PhilHealth ID',
  'TIN ID',
  'Senior Citizen ID',
  'PWD ID',
  'OFW ID (iDOLE)',
] as const;

export const PROOF_LABEL: Record<'university' | 'military' | 'others', string> = {
  university: 'Proof that the university requested your documents (request letter or admission requirement)',
  military: 'Proof that the head of the military office or unit requested your documents (letter or memorandum)',
  others: 'Proof of the request (optional)',
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin_assistant: 'Administrative assistant',
  principal: 'Principal',
  registrar: 'Registrar (administrator)',
};

export const ROLE_VIEWS: Record<UserRole, AppView[]> = {
  public: ['request', 'track', 'about'],
  student: ['request', 'track', 'profile', 'about'],
  admin_assistant: ['registrar', 'fulfillment', 'accounts', 'notifications', 'request', 'track', 'profile', 'about'],
  principal: ['registrar', 'notifications', 'request', 'track', 'profile', 'about'],
  registrar: ['registrar', 'fulfillment', 'accounts', 'notifications', 'request', 'track', 'profile', 'about'],
};

export const FIELD_LIMITS = {
  nameMax: 160,
  firstNameMax: 80,
  lastNameMax: 80,
  emailMax: 200,
  phoneMax: 24,
  sectionMax: 80,
  addressMax: 250,
  reasonMax: 300,
  universityMax: 160,
  purposeOtherMax: 200,
  repNameMax: 120,
  relationshipMax: 60,
} as const;

export const BOOTSTRAPPED_ADMIN_EMAIL = 'romandidter@gmail.com';

export interface StudentRecord {
  lrn: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  strand?: string;
  lastGradeLevel?: string;
  section?: string;
  yearGraduated?: string;
  email?: string;
  phone?: string;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  lrn?: string;
  strand?: string;
  section?: string;
  yearGraduated?: string;
  address?: string;
  updatedAt?: unknown;
}

export interface StaffMember {
  staffId: string;
  name: string;
  role: StaffRole;
  phone?: string;
  email: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ClearanceRequest {
  requestId: string;
  tracking: string;
  ownerUid: string;
  doc: DocType;
  name: string;
  lrn?: string;
  section?: string;
  phone?: string;
  email: string;
  purpose: PurposeType;
  purposeOther?: string;
  employment?: string;
  idType?: string;
  university?: string;
  claimerType: 'self' | 'rep';
  repName?: string;
  relationship?: string;
  repPhone?: string;
  repIdType?: string;
  repReason?: string;
  signedName?: string;
  signedAt?: string;
  idFileUrl?: string;
  idFileMime?: string;
  proofFileUrl?: string;
  proofFileMime?: string;
  photoFileUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  release: '' | 'preparing' | 'ready' | 'claimed';
  reason?: string;
  authCheck: '' | 'correct' | 'not_found';
  idVerified: boolean;
  complete: boolean;
  claimedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  approvedAt?: string;
  rejectedAt?: string;
  readyAt?: string;
  claimedAt?: string;
}

export interface PublicTrackingStatus {
  tracking: string;
  ownerUid: string;
  doc: DocType;
  purpose: PurposeType;
  claimerType: 'self' | 'rep';
  status: 'pending' | 'approved' | 'rejected';
  release: '' | 'preparing' | 'ready' | 'claimed';
  reason?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  approvedAt?: string;
  rejectedAt?: string;
  readyAt?: string;
  claimedAt?: string;
}

export interface StaffNotification {
  notificationId: string;
  recipientEmail: string;
  message: string;
  via: string;
  read: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ToastItem {
  id: string;
  message: string;
  via?: string;
  kind?: 'info' | 'error';
}

export function normPhone(value: string): string | null {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .replace(/^63/, '')
    .replace(/^0/, '');
  return /^9\d{9}$/.test(digits) ? `+63${digits}` : null;
}

export function maskLrn(lrn?: string): string {
  return lrn ? `••••••••${String(lrn).slice(-4)}` : 'Not provided';
}

export function normTracking(value: string): string {
  const raw = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (raw.length === 12 && raw.startsWith('CSHS')) {
    return `CSHS-${raw.slice(4, 8)}-${raw.slice(8)}`;
  }
  return String(value || '').trim().toUpperCase();
}

export function generateTrackingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n: number) => {
    const arr = new Uint32Array(n);
    crypto.getRandomValues(arr);
    return Array.from(arr, (x) => chars[x % chars.length]).join('');
  };
  return `CSHS-${pick(4)}-${pick(4)}`;
}

export function generateId(prefix = 'id'): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

export function fullStudentName(s: { firstName: string; middleName?: string; lastName: string }): string {
  return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ');
}

export function formatTimestamp(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? value
      : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return '';
}

export function purposeDisplay(req: Pick<ClearanceRequest, 'purpose' | 'purposeOther' | 'employment' | 'university'>): string {
  if (req.purpose === 'employment') {
    return `${PURPOSE.employment} (${req.employment === 'abroad' ? 'Abroad' : 'Local'})`;
  }
  if (req.purpose === 'university') {
    return `${PURPOSE.university}${req.university ? `: ${req.university}` : ''}`;
  }
  if (req.purpose === 'others') {
    return req.purposeOther ? `Others: ${req.purposeOther}` : 'Others';
  }
  return PURPOSE[req.purpose];
}

export const FILE_SIZE_LIMITS = {
  maxBytes: 5 * 1024 * 1024, // 5 MB strict maximum per uploaded picture or file
} as const;

export function isImageFile(file: File): boolean {
  if (file.type && file.type.toLowerCase().startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || '');
}

export function isVideoFile(file: File): boolean {
  if (file.type && file.type.toLowerCase().startsWith('video/')) return true;
  return /\.(mp4|mov|webm|m4v|3gp|avi|mkv)$/i.test(file.name || '');
}

export function isPdfFile(file: File): boolean {
  if (file.type && file.type.toLowerCase() === 'application/pdf') return true;
  return /\.pdf$/i.test(file.name || '');
}

export function inferFileMime(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type.toLowerCase().split(';')[0].trim();
  }
  const lower = (file.name || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (isVideoFile(file)) return 'video/mp4';
  if (isImageFile(file)) return 'image/jpeg';
  return 'application/octet-stream';
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function validateAttachmentFile(
  file: File,
  kind: 'id' | 'proof' | 'photo',
): string | null {
  if (!file || file.size === 0) {
    return 'Selected file is empty.';
  }
  const isImage = isImageFile(file);
  const isVideo = isVideoFile(file);
  const isPdf = isPdfFile(file);

  if (kind === 'photo' && !isImage) {
    return 'The photo of the person claiming must be an image file.';
  }
  if (kind !== 'photo' && !isImage && !isVideo && !isPdf) {
    return 'Upload an image, PDF, or video file only.';
  }

  if (file.size > FILE_SIZE_LIMITS.maxBytes) {
    return `File too large (${formatFileSize(file.size)}). Maximum allowed is 5 MB only — hindi ito tatanggapin. Tip: I-send muna sa Messenger ang picture at i-save ulit para lumiit ang size.`;
  }

  return null;
}

export async function prepareMediaForUpload(
  file: File,
): Promise<{ blob: Blob; filename: string; mime: string }> {
  const mime = inferFileMime(file);
  if (!isImageFile(file)) {
    return {
      blob: file,
      filename: file.name || 'upload',
      mime,
    };
  }

  // Re-encode oversized images (> 700 KB) or HEIC/HEIF photos to fast, universally viewable JPEGs
  const needsResize =
    file.size > 700 * 1024 ||
    !file.type ||
    file.type === 'image/heic' ||
    file.type === 'image/heif';
  if (!needsResize) {
    return {
      blob: file,
      filename: file.name || 'image.jpg',
      mime,
    };
  }

  const encodeTask = (async (): Promise<{ blob: Blob; filename: string; mime: string }> => {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Unsupported image format'));
        el.src = objectUrl;
      });
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round((img.width || 800) * scale));
      const h = Math.max(1, Math.round((img.height || 800) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82),
      );
      if (!blob) throw new Error('Failed to encode JPEG');
      const cleanBaseName = (file.name || 'upload').replace(/\.[^.]+$/, '');
      return {
        blob,
        filename: `${cleanBaseName}.jpg`,
        mime: 'image/jpeg',
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  })();

  const timeoutFallback = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Image optimization timed out')), 5000),
  );

  try {
    return await Promise.race([encodeTask, timeoutFallback]);
  } catch {
    return {
      blob: file,
      filename: file.name || 'upload',
      mime,
    };
  }
}
