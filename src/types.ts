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

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadAttachment(file: File, kind: 'id' | 'proof' | 'photo'): Promise<{ url: string; mime: string }> {
  const dataBase64 = await fileToBase64(file);
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      filename: file.name,
      mime: file.type || 'application/octet-stream',
      dataBase64,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string; mime?: string; error?: string };
  if (!res.ok || !body.url) {
    throw new Error(body.error || 'Could not upload the file.');
  }
  return { url: body.url, mime: body.mime || file.type };
}
