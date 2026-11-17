import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  getRedirectResult,
  indexedDBLocalPersistence,
  initializeAuth,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  FIELD_LIMITS,
  generateId,
  generateTrackingCode,
  type ClearanceRequest,
  type PublicTrackingStatus,
  type StaffMember,
  type StaffNotification,
  type StaffRole,
  type StudentRecord,
  type UserPrivateInfo,
} from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: [
      indexedDBLocalPersistence,
      browserLocalPersistence,
      browserSessionPersistence,
    ],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch {
  authInstance = getAuth(app);
}
export const auth = authInstance;

const REMEMBER_LOGIN_KEY = 'cshs_remember_login';

export function getRememberLoginPref(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_LOGIN_KEY) !== 'false';
  } catch {
    return true;
  }
}

function setRememberLoginPref(remember: boolean): void {
  try {
    window.localStorage.setItem(REMEMBER_LOGIN_KEY, remember ? 'true' : 'false');
  } catch {
    // Ignore storage restriction
  }
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. The Firestore client is offline.');
    }
  }
}

void testConnection();

export function extractReadableError(err: unknown): string {
  if (!(err instanceof Error)) return String(err || 'Operation failed.');
  const raw = err.message || '';
  if (raw.includes('auth/popup-closed-by-user')) {
    return 'Google sign-in popup was closed before completing sign-in. Please try again.';
  }
  if (raw.includes('auth/popup-blocked')) {
    return 'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
  }
  if (raw.includes('auth/cancelled-popup-request')) {
    return 'Another sign-in popup was opened. Please complete the active Google sign-in window.';
  }
  if (raw.includes('auth/unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return `Domain "${host}" is not authorized in Firebase Authentication yet. Add "${host}" in Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (raw.includes('auth/network-request-failed')) {
    return 'Network error while connecting to Google sign-in. Please check your connection and try again.';
  }
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed && parsed.error) {
      if (parsed.error.includes('Missing or insufficient permissions')) {
        return 'Permission denied. Please sign in with an authorized verified Google account.';
      }
      return parsed.error;
    }
  } catch {
    // Plain error message
  }
  return raw;
}

export async function consumeRedirectSignIn(): Promise<User | null> {
  try {
    const res = await getRedirectResult(auth);
    return res?.user || null;
  } catch {
    return null;
  }
}

export async function signInWithGoogle(rememberDevice = true): Promise<User> {
  setRememberLoginPref(rememberDevice);
  try {
    if (!rememberDevice) {
      await setPersistence(auth, browserSessionPersistence);
    } else {
      await setPersistence(auth, indexedDBLocalPersistence).catch(() =>
        setPersistence(auth, browserLocalPersistence),
      );
    }
  } catch {
    // Keep initialized persistence stack if browser restricts storage changes
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    const isStandaloneWindow = typeof window !== 'undefined' && window.self === window.top;
    if (
      isStandaloneWindow &&
      (msg.includes('auth/popup-blocked') ||
        msg.includes('auth/operation-not-supported-in-this-environment'))
    ) {
      await signInWithRedirect(auth, googleProvider);
      return new Promise<User>(() => {
        // Page redirects to Google OAuth
      });
    }
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

function cleanStr(val: string | undefined, max: number): string | undefined {
  const trimmed = String(val || '').trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function buildPayload<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export interface ResolvedSession {
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | StaffRole;
  staff: StaffMember | null;
  isAdmin: boolean;
}

export async function resolveUserSession(user: User): Promise<ResolvedSession> {
  const uid = user.uid;
  const email = (user.email || '').trim().toLowerCase();
  const fallbackDisplayName = (user.displayName || email.split('@')[0] || 'User').slice(0, 120);
  let resolvedDisplayName = fallbackDisplayName;

  // Ensure users/{uid} exists and load saved displayName
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) {
      await setDoc(doc(db, 'users', uid), {
        uid,
        displayName: fallbackDisplayName,
        role: 'student',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = userSnap.data() as { displayName?: string };
      if (existingData.displayName && existingData.displayName.trim()) {
        resolvedDisplayName = existingData.displayName.trim().slice(0, 120);
      }
    }
  } catch (err) {
    console.warn('Could not sync users/{uid} during session resolution:', err);
  }

  const isBootstrappedAdmin = email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;

  if (isBootstrappedAdmin) {
    try {
      const adminSnap = await getDoc(doc(db, 'admins', uid));
      if (!adminSnap.exists()) {
        await setDoc(doc(db, 'admins', uid), {
          uid,
          email,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn('Could not verify admins/{uid} marker:', err);
    }

    // Ensure a staff record exists for bootstrapped Registrar so notifications & directory work
    try {
      const q = query(collection(db, 'staff'), where('email', '==', email), limit(1));
      const snap = await getDocs(q);
      let staffDoc: StaffMember;
      if (snap.empty) {
        const staffId = generateId('staff');
        staffDoc = {
          staffId,
          name: resolvedDisplayName || 'Registrar',
          role: 'registrar',
          email,
          active: true,
        };
        await setDoc(doc(db, 'staff', staffId), {
          ...staffDoc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        staffDoc = snap.docs[0].data() as StaffMember;
      }

      return {
        uid,
        email,
        displayName: staffDoc.name || resolvedDisplayName,
        role: 'registrar',
        staff: staffDoc,
        isAdmin: true,
      };
    } catch (err) {
      console.warn('Could not load/create bootstrapped staff record:', err);
      return {
        uid,
        email,
        displayName: resolvedDisplayName,
        role: 'registrar',
        staff: {
          staffId: `admin_${uid}`.slice(0, 128),
          name: resolvedDisplayName,
          role: 'registrar',
          email,
          active: true,
        },
        isAdmin: true,
      };
    }
  }

  // Check if user is an explicit admin in admins/{uid}
  try {
    const adminSnap = await getDoc(doc(db, 'admins', uid));
    if (adminSnap.exists()) {
      const q = query(collection(db, 'staff'), where('email', '==', email), limit(1));
      const snap = await getDocs(q);
      const staffDoc = !snap.empty
        ? (snap.docs[0].data() as StaffMember)
        : {
            staffId: `admin_${uid}`.slice(0, 128),
            name: resolvedDisplayName,
            role: 'registrar' as StaffRole,
            email,
            active: true,
          };
      return {
        uid,
        email,
        displayName: staffDoc.name || resolvedDisplayName,
        role: 'registrar',
        staff: staffDoc,
        isAdmin: true,
      };
    }
  } catch (err) {
    console.warn('Admin lookup skipped:', err);
  }

  // Check if email matches an active staff member
  if (email && user.emailVerified) {
    try {
      const q = query(collection(db, 'staff'), where('email', '==', email), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const staffDoc = snap.docs[0].data() as StaffMember;
        if (staffDoc.active) {
          const bindingRef = doc(db, 'staff_roles', uid);
          const roleBindingSnap = await getDoc(bindingRef);
          const existingBinding = roleBindingSnap.exists()
            ? (roleBindingSnap.data() as { staffId?: string; role?: StaffRole; active?: boolean })
            : null;
          if (
            !existingBinding ||
            existingBinding.staffId !== staffDoc.staffId ||
            existingBinding.role !== staffDoc.role ||
            !existingBinding.active
          ) {
            if (roleBindingSnap.exists()) {
              await deleteDoc(bindingRef);
            }
            await setDoc(bindingRef, {
              uid,
              staffId: staffDoc.staffId,
              role: staffDoc.role,
              email,
              active: true,
              createdAt: serverTimestamp(),
            });
          }
          return {
            uid,
            email,
            displayName: staffDoc.name || resolvedDisplayName,
            role: staffDoc.role,
            staff: staffDoc,
            isAdmin: staffDoc.role === 'registrar',
          };
        }
      }
    } catch (err) {
      console.warn('Staff role lookup skipped:', err);
    }
  }

  return {
    uid,
    email,
    displayName: resolvedDisplayName,
    role: 'student',
    staff: null,
    isAdmin: false,
  };
}

// ---------------------------------------------------------------------------
// User Private Profile Info (users/{uid}/private/info)
// ---------------------------------------------------------------------------
export async function getUserPrivateInfo(uid: string): Promise<UserPrivateInfo | null> {
  const path = `users/${uid}/private/info`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
    return snap.exists() ? (snap.data() as UserPrivateInfo) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function saveUserPrivateInfo(
  uid: string,
  info: Omit<UserPrivateInfo, 'uid' | 'updatedAt'>,
): Promise<void> {
  const path = `users/${uid}/private/info`;
  const cleanFirst = cleanStr(info.firstName, FIELD_LIMITS.firstNameMax);
  const cleanMiddle = cleanStr(info.middleName, FIELD_LIMITS.firstNameMax);
  const cleanLast = cleanStr(info.lastName, FIELD_LIMITS.lastNameMax);

  const payload = buildPayload({
    uid,
    email: String(info.email || '').trim().toLowerCase().slice(0, FIELD_LIMITS.emailMax),
    firstName: cleanFirst,
    middleName: cleanMiddle,
    lastName: cleanLast,
    phone: cleanStr(info.phone, FIELD_LIMITS.phoneMax),
    lrn: cleanStr(info.lrn, 12),
    strand: cleanStr(info.strand, 32),
    section: cleanStr(info.section, FIELD_LIMITS.sectionMax),
    yearGraduated: cleanStr(info.yearGraduated, 4),
    address: cleanStr(info.address, FIELD_LIMITS.addressMax),
    updatedAt: serverTimestamp(),
  });
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const fullName = [cleanFirst, cleanLast].filter(Boolean).join(' ').slice(0, 120);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid,
        displayName: fullName || String(info.email || 'User').split('@')[0].slice(0, 120),
        role: 'student',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (fullName) {
      await updateDoc(userRef, {
        displayName: fullName,
        updatedAt: serverTimestamp(),
      });
    }

    await setDoc(doc(db, 'users', uid, 'private', 'info'), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ---------------------------------------------------------------------------
// Student / Learner Records (students/{lrn})
// ---------------------------------------------------------------------------
export async function listStudents(): Promise<StudentRecord[]> {
  try {
    const q = query(collection(db, 'students'), orderBy('lastName', 'asc'), limit(300));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as StudentRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'students');
  }
}

export async function lookupStudentByLrn(lrn: string): Promise<StudentRecord | null> {
  const path = `students/${lrn}`;
  try {
    const snap = await getDoc(doc(db, 'students', lrn));
    return snap.exists() ? (snap.data() as StudentRecord) : null;
  } catch (err) {
    // Allow graceful fallback to manual entry if user does not yet have read access
    if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
      return null;
    }
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function findMyLinkedStudent(email: string): Promise<StudentRecord[]> {
  try {
    const q = query(collection(db, 'students'), where('email', '==', email.toLowerCase()), limit(5));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as StudentRecord);
  } catch {
    return [];
  }
}

export async function saveStudentRecord(
  record: Omit<StudentRecord, 'createdByUid' | 'createdAt' | 'updatedAt'>,
  currentUid: string,
): Promise<StudentRecord> {
  const lrn = String(record.lrn || '').trim();
  if (!/^\d{12}$/.test(lrn)) {
    throw new Error('The LRN must be 12 digits.');
  }
  const firstName = cleanStr(record.firstName, FIELD_LIMITS.firstNameMax);
  const lastName = cleanStr(record.lastName, FIELD_LIMITS.lastNameMax);
  if (!firstName || !lastName) {
    throw new Error('First name and last name are required.');
  }

  const path = `students/${lrn}`;
  try {
    const existingSnap = await getDoc(doc(db, 'students', lrn));
    if (existingSnap.exists()) {
      const existing = existingSnap.data() as StudentRecord;
      const updated = buildPayload({
        lrn,
        firstName,
        middleName: cleanStr(record.middleName, FIELD_LIMITS.firstNameMax),
        lastName,
        strand: cleanStr(record.strand, 32),
        lastGradeLevel: cleanStr(record.lastGradeLevel, 4),
        section: cleanStr(record.section, FIELD_LIMITS.sectionMax),
        yearGraduated: cleanStr(record.yearGraduated, 4),
        email: cleanStr(record.email?.toLowerCase(), FIELD_LIMITS.emailMax),
        phone: cleanStr(record.phone, FIELD_LIMITS.phoneMax),
        createdByUid: existing.createdByUid,
        createdAt: existing.createdAt,
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'students', lrn), updated);
      return updated as unknown as StudentRecord;
    }

    const created = buildPayload({
      lrn,
      firstName,
      middleName: cleanStr(record.middleName, FIELD_LIMITS.firstNameMax),
      lastName,
      strand: cleanStr(record.strand, 32),
      lastGradeLevel: cleanStr(record.lastGradeLevel, 4),
      section: cleanStr(record.section, FIELD_LIMITS.sectionMax),
      yearGraduated: cleanStr(record.yearGraduated, 4),
      email: cleanStr(record.email?.toLowerCase(), FIELD_LIMITS.emailMax),
      phone: cleanStr(record.phone, FIELD_LIMITS.phoneMax),
      createdByUid: currentUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'students', lrn), created);
    return created as unknown as StudentRecord;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteStudentRecord(lrn: string): Promise<void> {
  const path = `students/${lrn}`;
  try {
    await deleteDoc(doc(db, 'students', lrn));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// Staff Management (staff/{staffId})
// ---------------------------------------------------------------------------
export async function listStaffMembers(): Promise<StaffMember[]> {
  try {
    const q = query(collection(db, 'staff'), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as StaffMember);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'staff');
  }
}

export async function createStaffMember(input: {
  name: string;
  role: StaffRole;
  phone?: string;
  email: string;
}): Promise<StaffMember> {
  const email = input.email.trim().toLowerCase();
  try {
    const existingQ = query(collection(db, 'staff'), where('email', '==', email), limit(1));
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      throw new Error('A staff account with that Gmail already exists.');
    }

    const staffId = generateId('staff');
    const payload = buildPayload({
      staffId,
      name: input.name.trim().slice(0, 120),
      role: input.role,
      phone: cleanStr(input.phone, FIELD_LIMITS.phoneMax),
      email: email.slice(0, FIELD_LIMITS.emailMax),
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'staff', staffId), payload);
    return payload as unknown as StaffMember;
  } catch (err) {
    if (err instanceof Error && err.message.includes('already exists')) throw err;
    handleFirestoreError(err, OperationType.CREATE, 'staff');
  }
}

export async function toggleStaffMemberActive(staffId: string, active: boolean): Promise<void> {
  const path = `staff/${staffId}`;
  try {
    await updateDoc(doc(db, 'staff', staffId), {
      active,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Clearance Requests & Public Tracking
// ---------------------------------------------------------------------------
export async function submitClearanceRequest(
  input: Omit<
    ClearanceRequest,
    'requestId' | 'tracking' | 'status' | 'release' | 'authCheck' | 'idVerified' | 'createdAt' | 'updatedAt'
  >,
): Promise<ClearanceRequest> {
  const requestId = generateId('req');
  const tracking = generateTrackingCode();
  const batch = writeBatch(db);

  const reqPayload = buildPayload({
    requestId,
    tracking,
    ownerUid: input.ownerUid,
    doc: input.doc,
    name: input.name.trim().slice(0, FIELD_LIMITS.nameMax),
    lrn: cleanStr(input.lrn, 12),
    section: cleanStr(input.section, 120),
    phone: cleanStr(input.phone, FIELD_LIMITS.phoneMax),
    email: input.email.trim().toLowerCase().slice(0, FIELD_LIMITS.emailMax),
    purpose: input.purpose,
    purposeOther: cleanStr(input.purposeOther, FIELD_LIMITS.purposeOtherMax),
    employment: cleanStr(input.employment, 16),
    idType: cleanStr(input.idType, 80),
    university: cleanStr(input.university, FIELD_LIMITS.universityMax),
    claimerType: input.claimerType,
    repName: cleanStr(input.repName, FIELD_LIMITS.repNameMax),
    relationship: cleanStr(input.relationship, FIELD_LIMITS.relationshipMax),
    repPhone: cleanStr(input.repPhone, FIELD_LIMITS.phoneMax),
    repIdType: cleanStr(input.repIdType, 80),
    repReason: cleanStr(input.repReason, FIELD_LIMITS.purposeOtherMax),
    signedName: cleanStr(input.signedName, FIELD_LIMITS.repNameMax),
    signedAt: cleanStr(input.signedAt, 40),
    idFileUrl: cleanStr(input.idFileUrl, 1000),
    idFileMime: cleanStr(input.idFileMime, 80),
    proofFileUrl: cleanStr(input.proofFileUrl, 1000),
    proofFileMime: cleanStr(input.proofFileMime, 80),
    photoFileUrl: cleanStr(input.photoFileUrl, 1000),
    status: 'pending',
    release: '',
    authCheck: '',
    idVerified: false,
    complete: Boolean(input.complete),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const publicPayload = buildPayload({
    tracking,
    ownerUid: input.ownerUid,
    doc: input.doc,
    purpose: input.purpose,
    claimerType: input.claimerType,
    status: 'pending',
    release: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'requests', requestId), reqPayload);
  batch.set(doc(db, 'requests_public', tracking), publicPayload);

  const notifId = generateId('notif');
  batch.set(doc(db, 'notifications', notifId), {
    notificationId: notifId,
    recipientEmail: BOOTSTRAPPED_ADMIN_EMAIL,
    message: `New request ${tracking} submitted by ${input.name.trim().slice(0, 80)}.`,
    via: 'portal',
    read: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return {
      ...(reqPayload as unknown as ClearanceRequest),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `requests/${requestId}`);
  }
}

export async function listAllRequests(): Promise<ClearanceRequest[]> {
  try {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(200));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ClearanceRequest);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'requests');
  }
}

export async function listMyRequests(uid: string): Promise<ClearanceRequest[]> {
  try {
    const q = query(
      collection(db, 'requests'),
      where('ownerUid', '==', uid),
      limit(50),
    );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => d.data() as ClearanceRequest);
    return items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'requests');
  }
}

function getMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'string') return new Date(ts).getTime() || 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export async function lookupPublicTracking(tracking: string): Promise<PublicTrackingStatus | null> {
  const path = `requests_public/${tracking}`;
  try {
    const snap = await getDoc(doc(db, 'requests_public', tracking));
    return snap.exists() ? (snap.data() as PublicTrackingStatus) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function markRequestIdVerified(requestId: string): Promise<void> {
  const path = `requests/${requestId}`;
  try {
    await updateDoc(doc(db, 'requests', requestId), {
      idVerified: true,
      complete: true,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function setRequestAuthCheck(
  requestId: string,
  authCheck: 'correct' | 'not_found',
): Promise<void> {
  const path = `requests/${requestId}`;
  try {
    await updateDoc(doc(db, 'requests', requestId), {
      authCheck,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function decideClearanceRequest(
  requestId: string,
  tracking: string,
  decision: 'approved' | 'rejected',
  reason?: string,
): Promise<void> {
  const batch = writeBatch(db);
  const nowStr = new Date().toISOString();
  const cleanReason = cleanStr(reason, FIELD_LIMITS.reasonMax) || '';

  if (decision === 'approved') {
    batch.update(doc(db, 'requests', requestId), {
      status: 'approved',
      release: 'preparing',
      reason: cleanReason,
      approvedAt: nowStr,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'requests_public', tracking), {
      status: 'approved',
      release: 'preparing',
      reason: cleanReason,
      approvedAt: nowStr,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(doc(db, 'requests', requestId), {
      status: 'rejected',
      reason: cleanReason,
      rejectedAt: nowStr,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'requests_public', tracking), {
      status: 'rejected',
      reason: cleanReason,
      rejectedAt: nowStr,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `requests/${requestId}`);
  }
}

export async function bulkUpdateRequestsStatus(
  items: Array<{ requestId: string; tracking: string; release?: ClearanceRequest['release'] }>,
  nextStatus: 'pending' | 'approved' | 'rejected',
  reason?: string,
): Promise<void> {
  if (items.length === 0) return;
  const nowStr = new Date().toISOString();
  const cleanReason = nextStatus === 'rejected' ? cleanStr(reason, FIELD_LIMITS.reasonMax) || '' : '';

  // Each item writes to 2 documents (requests + requests_public); stay well below Firestore's 500-op batch limit
  const CHUNK_SIZE = 200;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const item of chunk) {
      if (nextStatus === 'approved') {
        const nextRelease =
          item.release === 'ready' || item.release === 'claimed' ? item.release : 'preparing';
        batch.update(doc(db, 'requests', item.requestId), {
          status: 'approved',
          release: nextRelease,
          reason: '',
          approvedAt: nowStr,
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'requests_public', item.tracking), {
          status: 'approved',
          release: nextRelease,
          reason: '',
          approvedAt: nowStr,
          updatedAt: serverTimestamp(),
        });
      } else if (nextStatus === 'rejected') {
        batch.update(doc(db, 'requests', item.requestId), {
          status: 'rejected',
          release: '',
          reason: cleanReason,
          rejectedAt: nowStr,
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'requests_public', item.tracking), {
          status: 'rejected',
          release: '',
          reason: cleanReason,
          rejectedAt: nowStr,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.update(doc(db, 'requests', item.requestId), {
          status: 'pending',
          release: '',
          reason: '',
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, 'requests_public', item.tracking), {
          status: 'pending',
          release: '',
          reason: '',
          updatedAt: serverTimestamp(),
        });
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'requests');
    }
  }
}

export async function advanceRequestRelease(
  requestId: string,
  tracking: string,
  nextRelease: 'ready' | 'claimed',
  claimedBy?: string,
): Promise<void> {
  const batch = writeBatch(db);
  const nowStr = new Date().toISOString();

  if (nextRelease === 'ready') {
    batch.update(doc(db, 'requests', requestId), {
      release: 'ready',
      readyAt: nowStr,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'requests_public', tracking), {
      release: 'ready',
      readyAt: nowStr,
      updatedAt: serverTimestamp(),
    });
  } else {
    const claimer = cleanStr(claimedBy, FIELD_LIMITS.nameMax) || 'Learner';
    batch.update(doc(db, 'requests', requestId), {
      release: 'claimed',
      claimedAt: nowStr,
      claimedBy: claimer,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'requests_public', tracking), {
      release: 'claimed',
      claimedAt: nowStr,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `requests/${requestId}`);
  }
}

// ---------------------------------------------------------------------------
// Staff Notifications
// ---------------------------------------------------------------------------
export async function listStaffNotifications(
  email: string,
  isAdminUser: boolean,
): Promise<StaffNotification[]> {
  try {
    const q = isAdminUser
      ? query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(100))
      : query(
          collection(db, 'notifications'),
          where('recipientEmail', '==', email.toLowerCase()),
          limit(100),
        );
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => d.data() as StaffNotification);
    return items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'notifications');
  }
}

export async function markNotificationsAsRead(items: StaffNotification[]): Promise<void> {
  const unread = items.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  for (const item of unread.slice(0, 50)) {
    batch.update(doc(db, 'notifications', item.notificationId), {
      read: true,
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'notifications');
  }
}
