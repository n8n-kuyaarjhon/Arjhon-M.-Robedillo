import { useEffect, useState, type FormEvent } from 'react';
import {
  extractReadableError,
  findMyLinkedStudent,
  getUserPrivateInfo,
  lookupStudentByLrn,
  resolveUserSession,
  saveUserPrivateInfo,
  signInWithGoogle,
  submitClearanceRequest,
  uploadMediaToStorage,
  type ResolvedSession,
} from '../lib/firebase';
import {
  DOCS,
  ID_TYPES,
  PROOF_LABEL,
  fullStudentName,
  isImageFile,
  normPhone,
  validateAttachmentFile,
  type ClearanceRequest,
  type DocType,
  type PurposeType,
  type StudentRecord,
} from '../types';
import { AuthorizationLetter } from './AuthorizationLetter';

interface RequestViewProps {
  uid: string | null;
  userEmail: string | null;
  onVerified?: (session: ResolvedSession) => void;
  onOpenProfile?: () => void;
  onTrackTracking: (tracking: string) => void;
  onToast: (message: string, via?: string, kind?: 'info' | 'error') => void;
}

export function RequestView({
  uid,
  userEmail,
  onVerified,
  onOpenProfile,
  onTrackTracking,
  onToast,
}: RequestViewProps) {
  const [findMode, setFindMode] = useState<'lrn' | 'name'>('lrn');
  const [lrnInput, setLrnInput] = useState('');
  const [fnFirst, setFnFirst] = useState('');
  const [fnLast, setFnLast] = useState('');
  const [fnMiddle, setFnMiddle] = useState('');
  const [fnStrand, setFnStrand] = useState('');
  const [fnYear, setFnYear] = useState('');
  const [lookupMsg, setLookupMsg] = useState<{ text: string; tone?: 'ok' | 'bad' } | null>(null);

  const [foundStudent, setFoundStudent] = useState<StudentRecord | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [mFirst, setMFirst] = useState('');
  const [mMiddle, setMMiddle] = useState('');
  const [mLast, setMLast] = useState('');
  const [mStrand, setMStrand] = useState('');
  const [mSection, setMSection] = useState('');
  const [mYear, setMYear] = useState('');

  // Form fields
  const [docType, setDocType] = useState<DocType>('form137_sf10');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState<PurposeType | ''>('');
  const [purposeOther, setPurposeOther] = useState('');
  const [employment, setEmployment] = useState<'local' | 'abroad' | ''>('');
  const [idType, setIdType] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [university, setUniversity] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  const [claimerType, setClaimerType] = useState<'self' | 'rep'>('self');
  const [repName, setRepName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [repReason, setRepReason] = useState('');
  const [repIdType, setRepIdType] = useState('');
  const [repPhone, setRepPhone] = useState('');
  const [signedName, setSignedName] = useState('');
  const [auConfirm, setAuConfirm] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [saveProfileChecked, setSaveProfileChecked] = useState(true);

  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ label: string; percent: number } | null>(null);
  const [submitMsg, setSubmitMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<ClearanceRequest | null>(null);

  // Restore draft text inputs on mount (helps if mobile redirect login reloads the page)
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('cshs_request_draft');
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, string>;
      if (d.lrnInput) setLrnInput(d.lrnInput);
      if (d.mFirst) { setMFirst(d.mFirst); setManualOpen(true); }
      if (d.mMiddle) setMMiddle(d.mMiddle);
      if (d.mLast) { setMLast(d.mLast); setManualOpen(true); }
      if (d.mStrand) setMStrand(d.mStrand);
      if (d.mSection) setMSection(d.mSection);
      if (d.mYear) setMYear(d.mYear);
      if (d.docType && d.docType in DOCS) setDocType(d.docType as DocType);
      if (d.phone) setPhone(d.phone);
      if (d.purpose) setPurpose(d.purpose as PurposeType);
      if (d.purposeOther) setPurposeOther(d.purposeOther);
      if (d.employment === 'local' || d.employment === 'abroad') setEmployment(d.employment);
      if (d.idType) setIdType(d.idType);
      if (d.university) setUniversity(d.university);
      if (d.claimerType === 'self' || d.claimerType === 'rep') setClaimerType(d.claimerType);
      if (d.repName) setRepName(d.repName);
      if (d.relationship) setRelationship(d.relationship);
      if (d.repReason) setRepReason(d.repReason);
      if (d.repIdType) setRepIdType(d.repIdType);
      if (d.repPhone) setRepPhone(d.repPhone);
      if (d.signedName) setSignedName(d.signedName);
    } catch {
      // Ignore draft restore failure
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        'cshs_request_draft',
        JSON.stringify({
          lrnInput,
          mFirst,
          mMiddle,
          mLast,
          mStrand,
          mSection,
          mYear,
          docType,
          phone,
          purpose,
          purposeOther,
          employment,
          idType,
          university,
          claimerType,
          repName,
          relationship,
          repReason,
          repIdType,
          repPhone,
          signedName,
        }),
      );
    } catch {
      // Ignore storage restriction
    }
  }, [
    lrnInput,
    mFirst,
    mMiddle,
    mLast,
    mStrand,
    mSection,
    mYear,
    docType,
    phone,
    purpose,
    purposeOther,
    employment,
    idType,
    university,
    claimerType,
    repName,
    relationship,
    repReason,
    repIdType,
    repPhone,
    signedName,
  ]);

  // Auto-fill empty fields from saved private info or linked student record when signed in
  useEffect(() => {
    if (!uid || !userEmail) return;
    let active = true;

    Promise.all([getUserPrivateInfo(uid), findMyLinkedStudent(userEmail)])
      .then(([priv, linked]) => {
        if (!active) return;
        const hasManualEntry = Boolean(
          mFirst.trim() || mLast.trim() || fnFirst.trim() || fnLast.trim(),
        );
        if (linked.length > 0 && !foundStudent && !hasManualEntry) {
          const s = linked[0];
          setFoundStudent(s);
          setLrnInput((prev) => prev || s.lrn);
          setManualOpen(false);
          setLookupMsg({ text: 'Linked learner record loaded from your account.', tone: 'ok' });
        } else if (priv && (priv.firstName || priv.lastName) && !foundStudent && !hasManualEntry) {
          setMFirst((prev) => prev || priv.firstName || '');
          setMMiddle((prev) => prev || priv.middleName || '');
          setMLast((prev) => prev || priv.lastName || '');
          setMStrand((prev) => prev || priv.strand || '');
          setMSection((prev) => prev || priv.section || '');
          setMYear((prev) => prev || priv.yearGraduated || '');
          if (priv.lrn) setLrnInput((prev) => prev || priv.lrn || '');
          setManualOpen(true);
        }
        if (priv && priv.phone) {
          setPhone((prev) => prev || priv.phone || '');
        }
      })
      .catch(() => {
        // Silent auto-fill fallback
      });

    return () => {
      active = false;
    };
  }, [uid, userEmail]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  async function handleLookupByLrn() {
    const clean = lrnInput.trim();
    setFoundStudent(null);
    setLookupMsg(null);
    if (!/^\d{12}$/.test(clean)) {
      setLookupMsg({ text: 'Enter all 12 digits of your LRN.', tone: 'bad' });
      return;
    }

    try {
      const student = await lookupStudentByLrn(clean);
      if (student) {
        setFoundStudent(student);
        setManualOpen(false);
        setLookupMsg({ text: 'Record found.', tone: 'ok' });
      } else {
        setManualOpen(true);
        setLookupMsg({
          text: 'We could not automatically retrieve that LRN. Enter your details below.',
        });
      }
    } catch (err) {
      setManualOpen(true);
      setLookupMsg({ text: extractReadableError(err), tone: 'bad' });
    }
  }

  function handleFindByName() {
    setLookupMsg(null);
    if (!fnFirst.trim() || !fnLast.trim()) {
      setLookupMsg({ text: 'Enter your first name and last name.', tone: 'bad' });
      return;
    }
    setMFirst(fnFirst.trim());
    setMMiddle(fnMiddle.trim());
    setMLast(fnLast.trim());
    setMStrand(fnStrand);
    setMYear(fnYear.trim());
    setManualOpen(true);
    setLookupMsg({
      text: 'Your details are pre-filled below. Complete any remaining fields and submit your request.',
      tone: 'ok',
    });
  }

  async function handleGoogleVerify() {
    setVerifying(true);
    try {
      const user = await signInWithGoogle(true);
      const resolved = await resolveUserSession(user);
      onVerified?.(resolved);
      onToast(`Signed in and remembered as ${resolved.email}.`);
    } catch (err) {
      onToast(extractReadableError(err), '', 'error');
    } finally {
      setVerifying(false);
    }
  }

  const learnerFullName = foundStudent
    ? fullStudentName(foundStudent)
    : [mFirst.trim(), mMiddle.trim(), mLast.trim()].filter(Boolean).join(' ') || '(your name)';

  const learnerLrnDisplay = foundStudent ? foundStudent.lrn : lrnInput.trim() || 'not provided';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitMsg(null);

    const failValidation = (text: string) => {
      setSubmitMsg({ text, ok: false });
      onToast(text, '', 'error');
    };

    if (!uid || !userEmail) {
      failValidation('Sign in with Google first (click "One-time sign in with Google") before submitting.');
      return;
    }

    const cleanLrn = (foundStudent ? foundStudent.lrn : lrnInput).trim();
    if (cleanLrn && !/^\d{12}$/.test(cleanLrn)) {
      failValidation('The LRN must be 12 digits.');
      return;
    }

    // Automatically fall back to "I forgot my LRN" fields if the user didn't click "Use these details"
    const resolvedFirst = foundStudent ? foundStudent.firstName : mFirst.trim() || fnFirst.trim();
    const resolvedMiddle = foundStudent ? foundStudent.middleName || '' : mMiddle.trim() || fnMiddle.trim();
    const resolvedLast = foundStudent ? foundStudent.lastName : mLast.trim() || fnLast.trim();
    const resolvedStrand = foundStudent ? foundStudent.strand || '' : mStrand || fnStrand;
    const resolvedYear = foundStudent ? foundStudent.yearGraduated || '' : mYear.trim() || fnYear.trim();

    if (!foundStudent && (resolvedFirst !== mFirst.trim() || resolvedLast !== mLast.trim())) {
      setMFirst(resolvedFirst);
      setMMiddle(resolvedMiddle);
      setMLast(resolvedLast);
      setMStrand(resolvedStrand);
      setMYear(resolvedYear);
    }

    if (!resolvedFirst || !resolvedLast) {
      setManualOpen(true);
      failValidation('Enter your first name and last name.');
      return;
    }

    const computedName = foundStudent
      ? fullStudentName(foundStudent)
      : [resolvedFirst, resolvedMiddle, resolvedLast].filter(Boolean).join(' ');

    const phoneRaw = phone.trim();
    const normalizedPhone = phoneRaw ? normPhone(phoneRaw) : '';
    if (phoneRaw && !normalizedPhone) {
      failValidation('Enter a valid mobile number, like 0917 123 4567, or leave it blank.');
      return;
    }

    if (!purpose) {
      failValidation('Choose the purpose of your request.');
      return;
    }
    if (purpose === 'others' && !purposeOther.trim()) {
      failValidation('Please specify the purpose.');
      return;
    }
    if (purpose === 'employment' && !['local', 'abroad'].includes(employment)) {
      failValidation('Choose whether the employment is local or abroad.');
      return;
    }
    if (purpose === 'employment' && !idType) {
      failValidation('Choose the type of government ID.');
      return;
    }
    if (purpose === 'employment' && !idFile) {
      failValidation('Upload your government ID as your evidence for employment.');
      return;
    }
    if (purpose === 'university' && !university.trim()) {
      failValidation('Enter the name of the university or school requesting your documents.');
      return;
    }
    if ((purpose === 'university' || purpose === 'military') && !proofFile) {
      failValidation(`Upload the proof of request. ${PROOF_LABEL[purpose]}.`);
      return;
    }

    if (claimerType === 'rep') {
      if (!repName.trim() || !relationship.trim() || !repIdType.trim()) {
        failValidation(
          'Fill in the authorization letter: name, relationship, and ID of the person claiming.',
        );
        return;
      }
      if (repPhone.trim() && !normPhone(repPhone.trim())) {
        failValidation('Enter a valid mobile number for the representative, or leave it blank.');
        return;
      }
      if (!signedName.trim()) {
        failValidation('Type your full name as your signature on the letter.');
        return;
      }
      if (!auConfirm) {
        failValidation('Tick the box to confirm that you authorize this person.');
        return;
      }
      if (!photoFile || !isImageFile(photoFile)) {
        failValidation('Upload a clear image photo of the person who will claim the document.');
        return;
      }
    }

    setSubmitting(true);
    setUploadStatus(null);
    try {
      let idUpload: { url: string; mime: string } | undefined;
      let proofUpload: { url: string; mime: string } | undefined;
      let photoUpload: { url: string; mime: string } | undefined;

      if (purpose === 'employment' && idFile) {
        setUploadStatus({ label: 'Uploading government ID...', percent: 0 });
        idUpload = await uploadMediaToStorage(idFile, uid, 'id', (percent) =>
          setUploadStatus({ label: 'Uploading government ID...', percent }),
        );
      }
      if (proofFile) {
        setUploadStatus({ label: 'Uploading proof of request...', percent: 0 });
        proofUpload = await uploadMediaToStorage(proofFile, uid, 'proof', (percent) =>
          setUploadStatus({ label: 'Uploading proof of request...', percent }),
        );
      }
      if (claimerType === 'rep' && photoFile) {
        setUploadStatus({ label: 'Uploading representative photo...', percent: 0 });
        photoUpload = await uploadMediaToStorage(photoFile, uid, 'photo', (percent) =>
          setUploadStatus({ label: 'Uploading representative photo...', percent }),
        );
      }
      setUploadStatus(null);

      const sectionDisplay = foundStudent
        ? foundStudent.lastGradeLevel
          ? `Grade ${foundStudent.lastGradeLevel}${foundStudent.section ? ` - ${foundStudent.section}` : ''}`
          : foundStudent.section || ''
        : [resolvedStrand, mSection.trim()].filter(Boolean).join(' - ');

      const created = await submitClearanceRequest({
        ownerUid: uid,
        doc: docType,
        name: computedName,
        lrn: cleanLrn || undefined,
        section: sectionDisplay || undefined,
        phone: normalizedPhone || undefined,
        email: userEmail,
        purpose,
        purposeOther: purpose === 'others' ? purposeOther.trim() : undefined,
        employment: purpose === 'employment' ? employment : undefined,
        idType: purpose === 'employment' ? idType : undefined,
        university: purpose === 'university' ? university.trim() : undefined,
        claimerType,
        repName: claimerType === 'rep' ? repName.trim() : undefined,
        relationship: claimerType === 'rep' ? relationship.trim() : undefined,
        repPhone: claimerType === 'rep' && repPhone.trim() ? normPhone(repPhone.trim()) || undefined : undefined,
        repIdType: claimerType === 'rep' ? repIdType.trim() : undefined,
        repReason: claimerType === 'rep' ? repReason.trim() : undefined,
        signedName: claimerType === 'rep' ? signedName.trim() : undefined,
        signedAt: claimerType === 'rep' ? new Date().toISOString() : undefined,
        idFileUrl: idUpload?.url,
        idFileMime: idUpload?.mime,
        proofFileUrl: proofUpload?.url,
        proofFileMime: proofUpload?.mime,
        photoFileUrl: photoUpload?.url,
        complete: Boolean(foundStudent),
      });

      if (saveProfileChecked) {
        try {
          await saveUserPrivateInfo(uid, {
            email: userEmail,
            firstName: resolvedFirst,
            middleName: resolvedMiddle,
            lastName: resolvedLast,
            lrn: cleanLrn,
            strand: resolvedStrand,
            section: foundStudent ? foundStudent.section : mSection.trim(),
            yearGraduated: resolvedYear,
            phone: normalizedPhone || '',
          });
        } catch (profileErr) {
          console.warn('Could not sync user profile after request submit:', profileErr);
        }
      }

      try {
        window.sessionStorage.removeItem('cshs_request_draft');
      } catch {
        // Ignore storage error
      }

      setSubmittedRequest(created);
      setSubmitMsg({ text: `Request submitted! Tracking number: ${created.tracking}`, ok: true });
      onToast(`Request ${created.tracking} saved.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg = extractReadableError(err);
      setSubmitMsg({ text: msg, ok: false });
      onToast(msg, '', 'error');
    } finally {
      setUploadStatus(null);
      setSubmitting(false);
    }
  }

  function handlePickFile(
    file: File | null,
    kind: 'id' | 'proof' | 'photo',
    setter: (f: File | null) => void,
    inputEl: HTMLInputElement,
  ) {
    if (!file) {
      setter(null);
      return;
    }
    const err = validateAttachmentFile(file, kind);
    if (err) {
      inputEl.value = '';
      setter(null);
      onToast(err, '', 'error');
      return;
    }
    setter(file);
  }

  return (
    <section aria-labelledby="request-heading">
      <h1 id="request-heading" className="font-serif text-3xl mb-1 text-balance">
        Request a document
      </h1>
      <p className="text-ink/70 mb-6">
        Find your record with your LRN, or enter your learner details below.
      </p>

      {submittedRequest && (
        <div className="bg-white border border-ok rounded-md p-5 mb-6">
          <p className="text-xs font-medium text-ok mb-1">Request saved to database</p>
          <h2 className="font-serif text-2xl mb-1 tabular-nums">
            Tracking No. {submittedRequest.tracking}
          </h2>
          <p className="text-sm text-ink/75 mb-4">
            We recorded your <b>{DOCS[submittedRequest.doc]}</b> request under{' '}
            <b>{submittedRequest.email}</b>. Save this tracking number to check when it is ready for
            pick-up at the Registrar&rsquo;s Office.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onTrackTracking(submittedRequest.tracking)}
              className="bg-brand text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
            >
              Track this request
            </button>
            <button
              type="button"
              onClick={() => setSubmittedRequest(null)}
              className="border border-ink/30 px-4 py-2 rounded text-sm font-medium whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Find my record card */}
      <div className="bg-white border border-ink/15 rounded-md p-5 mb-5">
        <p className="font-medium mb-2">How do you want to find your record?</p>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <label
            className={`flex items-start gap-3 border rounded p-3 cursor-pointer ${
              findMode === 'lrn' ? 'border-brand bg-paper ring-1 ring-brand' : 'border-ink/20'
            }`}
          >
            <input
              type="radio"
              name="find"
              value="lrn"
              checked={findMode === 'lrn'}
              onChange={() => setFindMode('lrn')}
              className="mt-1"
            />
            <span>
              <span className="font-medium block">I know my LRN</span>
              <span className="text-xs text-ink/60">
                Enter your 12-digit Learner Reference Number.
              </span>
            </span>
          </label>
          <label
            className={`flex items-start gap-3 border rounded p-3 cursor-pointer ${
              findMode === 'name' ? 'border-brand bg-paper ring-1 ring-brand' : 'border-ink/20'
            }`}
          >
            <input
              type="radio"
              name="find"
              value="name"
              checked={findMode === 'name'}
              onChange={() => setFindMode('name')}
              className="mt-1"
            />
            <span>
              <span className="font-medium block">I forgot my LRN</span>
              <span className="text-xs text-ink/60">
                Enter your name and school details instead.
              </span>
            </span>
          </label>
        </div>

        {findMode === 'lrn' ? (
          <div>
            <label htmlFor="lrn" className="block font-medium mb-1">
              Learner Reference Number (LRN)
            </label>
            <div className="flex gap-2">
              <input
                id="lrn"
                value={lrnInput}
                onChange={(e) => setLrnInput(e.target.value.replace(/\D/g, '').slice(0, 12))}
                inputMode="numeric"
                maxLength={12}
                placeholder="12 digits"
                className="flex-1 min-w-0 border border-ink/30 rounded px-3 py-2 tabular-nums"
              />
              <button
                type="button"
                onClick={handleLookupByLrn}
                className="bg-brand text-white px-4 py-2 rounded font-medium whitespace-nowrap"
              >
                Find my record
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="fn-first" className="block text-sm font-medium mb-1">
                  First name
                </label>
                <input
                  id="fn-first"
                  value={fnFirst}
                  onChange={(e) => setFnFirst(e.target.value)}
                  className="w-full border border-ink/30 rounded px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="fn-last" className="block text-sm font-medium mb-1">
                  Last name
                </label>
                <input
                  id="fn-last"
                  value={fnLast}
                  onChange={(e) => setFnLast(e.target.value)}
                  className="w-full border border-ink/30 rounded px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="fn-middle" className="block text-sm font-medium mb-1">
                  Middle name (optional)
                </label>
                <input
                  id="fn-middle"
                  value={fnMiddle}
                  onChange={(e) => setFnMiddle(e.target.value)}
                  className="w-full border border-ink/30 rounded px-3 py-2"
                />
              </div>
              <div>
                <label htmlFor="fn-strand" className="block text-sm font-medium mb-1">
                  Strand (optional)
                </label>
                <select
                  id="fn-strand"
                  value={fnStrand}
                  onChange={(e) => setFnStrand(e.target.value)}
                  className="w-full border border-ink/30 rounded px-3 py-2"
                >
                  <option value="">Any strand</option>
                  <option>STEM</option>
                  <option>ABM</option>
                  <option>HUMSS</option>
                  <option>TVL</option>
                </select>
              </div>
              <div>
                <label htmlFor="fn-year" className="block text-sm font-medium mb-1">
                  Year graduated (optional)
                </label>
                <input
                  id="fn-year"
                  value={fnYear}
                  onChange={(e) => setFnYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="e.g. 2024"
                  className="w-full border border-ink/30 rounded px-3 py-2 tabular-nums"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleFindByName}
              className="mt-3 bg-brand text-white px-4 py-2 rounded font-medium whitespace-nowrap"
            >
              Use these details
            </button>
          </div>
        )}

        {lookupMsg && (
          <p
            role="status"
            className={`text-sm mt-2 ${
              lookupMsg.tone === 'ok'
                ? 'text-ok'
                : lookupMsg.tone === 'bad'
                  ? 'text-bad'
                  : 'text-ink/75'
            }`}
          >
            {lookupMsg.text}
          </p>
        )}

        {foundStudent && (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 mt-4 text-sm border-t border-ink/10 pt-4">
            <div>
              <dt className="text-ink/60">Name</dt>
              <dd className="font-medium">{fullStudentName(foundStudent)}</dd>
            </div>
            <div>
              <dt className="text-ink/60">Strand</dt>
              <dd className="font-medium">{foundStudent.strand || '—'}</dd>
            </div>
            <div>
              <dt className="text-ink/60">Section</dt>
              <dd className="font-medium">
                {foundStudent.lastGradeLevel ? `Grade ${foundStudent.lastGradeLevel} ` : ''}
                {foundStudent.section || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-ink/60">Year graduated</dt>
              <dd className="font-medium tabular-nums">{foundStudent.yearGraduated || '—'}</dd>
            </div>
          </dl>
        )}

        {(manualOpen || !foundStudent) && (
          <div className="mt-4 border-t border-ink/10 pt-4">
            <p className="font-medium mb-2">
              {manualOpen ? 'Enter your learner details' : 'Learner details'}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={mFirst}
                onChange={(e) => setMFirst(e.target.value)}
                placeholder="First name *"
                aria-label="First name"
                className="border border-ink/30 rounded px-3 py-2"
              />
              <input
                value={mLast}
                onChange={(e) => setMLast(e.target.value)}
                placeholder="Last name *"
                aria-label="Last name"
                className="border border-ink/30 rounded px-3 py-2"
              />
              <input
                value={mMiddle}
                onChange={(e) => setMMiddle(e.target.value)}
                placeholder="Middle name (optional)"
                aria-label="Middle name"
                className="border border-ink/30 rounded px-3 py-2"
              />
              <select
                value={mStrand}
                onChange={(e) => setMStrand(e.target.value)}
                aria-label="Strand"
                className="border border-ink/30 rounded px-3 py-2"
              >
                <option value="">Strand</option>
                <option>STEM</option>
                <option>ABM</option>
                <option>HUMSS</option>
                <option>TVL</option>
              </select>
              <input
                value={mSection}
                onChange={(e) => setMSection(e.target.value)}
                placeholder="Grade &amp; section (optional)"
                aria-label="Section"
                className="border border-ink/30 rounded px-3 py-2"
              />
              <input
                value={mYear}
                onChange={(e) => setMYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                maxLength={4}
                placeholder="Year graduated (optional)"
                aria-label="Year graduated"
                className="border border-ink/30 rounded px-3 py-2 tabular-nums"
              />
            </div>
            <p className="text-xs text-ink/60 mt-2">
              Manually entered details are checked by the Registrar before processing.
            </p>
          </div>
        )}
      </div>

      {/* Main request form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-ink/15 rounded-md p-5 space-y-4"
        noValidate
      >
        <div>
          <label htmlFor="doctype" className="block font-medium mb-1">
            Document
          </label>
          <select
            id="doctype"
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocType)}
            className="w-full border border-ink/30 rounded px-3 py-2"
          >
            <option value="form137_sf10">Form 137 / SF10</option>
            <option value="good_moral">Good Moral Certificate</option>
            <option value="clearance">School Clearance</option>
            <option value="report_card">Report Card / Transcript</option>
          </select>
        </div>

        <div>
          <label className="block font-medium mb-1">Verified Gmail</label>
          {uid && userEmail ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border border-ok/40 bg-paper/50 rounded px-3 py-2 text-sm">
              <span>
                Verified as <b className="text-ink">{userEmail}</b>
              </span>
              <div className="flex items-center gap-3">
                {onOpenProfile && (
                  <button
                    type="button"
                    onClick={onOpenProfile}
                    className="text-xs underline text-brand hover:text-ink whitespace-nowrap"
                  >
                    Edit saved info
                  </button>
                )}
                <span className="text-ok font-medium text-xs">Remembered (one-time login)</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={verifying}
                onClick={handleGoogleVerify}
                className="flex items-center gap-2 border border-brand text-brand px-4 py-2 rounded font-medium hover:bg-paper disabled:opacity-60 whitespace-nowrap"
              >
                <span className="font-bold text-[#4285F4]" aria-hidden="true">
                  G
                </span>
                <span>{verifying ? 'Verifying...' : 'One-time sign in with Google'}</span>
              </button>
              <span className="text-xs text-ink/65">
                Sign in once to stay logged in automatically and save your learner info.
              </span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="req-phone" className="block font-medium mb-1">
            Mobile number (optional)
          </label>
          <input
            id="req-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="0917 123 4567"
            className="w-full border border-ink/30 rounded px-3 py-2"
          />
          <p className="text-xs text-ink/60 mt-1">
            Only so the Registrar&rsquo;s Office can call you if needed.
          </p>
        </div>

        <div className="border-t border-ink/10 pt-4">
          <label htmlFor="purpose" className="block font-medium mb-1">
            Request purpose
          </label>
          <select
            id="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as PurposeType | '')}
            className="w-full border border-ink/30 rounded px-3 py-2"
          >
            <option value="">Select the purpose</option>
            <option value="employment">For Employment</option>
            <option value="university">For University</option>
            <option value="military">For Military</option>
            <option value="others">Others (please specify)</option>
          </select>

          {purpose === 'others' && (
            <div className="mt-3">
              <label htmlFor="purpose-other" className="block text-sm font-medium mb-1">
                Please specify the purpose
              </label>
              <input
                id="purpose-other"
                value={purposeOther}
                onChange={(e) => setPurposeOther(e.target.value)}
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>
          )}
        </div>

        {purpose === 'employment' && (
          <div>
            <p className="font-medium mb-2">Is the employment local or abroad?</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {(['local', 'abroad'] as const).map((val) => (
                <label
                  key={val}
                  className={`flex items-start gap-3 border rounded p-3 cursor-pointer ${
                    employment === val ? 'border-brand bg-paper ring-1 ring-brand' : 'border-ink/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="emp"
                    value={val}
                    checked={employment === val}
                    onChange={() => setEmployment(val)}
                    className="mt-1"
                  />
                  <span className="font-medium capitalize">{val}</span>
                </label>
              ))}
            </div>

            {employment && (
              <div className="mt-3">
                <label htmlFor="id-type" className="block font-medium mb-1">
                  Government ID
                </label>
                <p className="text-xs text-ink/60 mb-1">
                  This is your evidence for employment. Choose the type of government ID, then
                  upload it.
                </p>
                <select
                  id="id-type"
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="w-full border border-ink/30 rounded px-3 py-2"
                >
                  <option value="">Select the type of government ID</option>
                  {ID_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label htmlFor="valid-id" className="block text-sm font-medium mt-3 mb-1">
                  Upload a photo, PDF, or video of the ID
                </label>
                <p className="text-xs text-ink/60 mb-1">
                  Images/PDF up to 15 MB; videos up to 50 MB.
                </p>
                <input
                  id="valid-id"
                  type="file"
                  accept="image/*,video/*,.pdf"
                  onChange={(e) => handlePickFile(e.target.files?.[0] || null, 'id', setIdFile, e.currentTarget)}
                  className="w-full text-sm"
                />
              </div>
            )}
          </div>
        )}

        {purpose === 'university' && (
          <div>
            <label htmlFor="university-name" className="block font-medium mb-1">
              Name of the university or school that is requesting your documents
            </label>
            <input
              id="university-name"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="Name of the university"
              className="w-full border border-ink/30 rounded px-3 py-2"
            />
          </div>
        )}

        {(purpose === 'university' || purpose === 'military' || purpose === 'others') && (
          <div>
            <label htmlFor="proof-file" className="block font-medium mb-1">
              {PROOF_LABEL[purpose]}
            </label>
            <p className="text-xs text-ink/60 mb-1">
              Upload a photo, PDF, or short video (images/PDF up to 15 MB; videos up to 50 MB).
            </p>
            <input
              id="proof-file"
              type="file"
              accept="image/*,video/*,.pdf"
              onChange={(e) => handlePickFile(e.target.files?.[0] || null, 'proof', setProofFile, e.currentTarget)}
              className="w-full text-sm"
            />
          </div>
        )}

        <div className="border-t border-ink/10 pt-4">
          <p className="font-medium mb-1">Claiming your document</p>
          <p className="text-sm text-ink/70 mb-3">
            You pick up your document at the school&rsquo;s Registrar&rsquo;s Office. We tell you
            when it is ready.
          </p>

          <div className="border border-wait/35 bg-wait/10 rounded p-3 text-sm mb-4">
            <p className="font-medium mb-1">Disclaimer</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Documents are claimed at the school&rsquo;s Registrar&rsquo;s Office. Come only when
                Track my request says Ready for pick-up.
              </li>
              <li>Bring your tracking number and a valid ID.</li>
              <li>
                If the learner named on this request cannot come, the person claiming must bring the
                authorization letter signed by the learner (print it and sign it by hand), a
                photocopy of the learner&rsquo;s valid ID, and their own valid ID.
              </li>
              <li>
                The person claiming must be the one in the photo you uploaded. The Registrar&rsquo;s
                Office compares the photo with the person who comes.
              </li>
            </ul>
          </div>

          <fieldset>
            <legend className="font-medium mb-2">Who will claim the document?</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-3 border rounded p-3 cursor-pointer ${
                  claimerType === 'self'
                    ? 'border-brand bg-paper ring-1 ring-brand'
                    : 'border-ink/20'
                }`}
              >
                <input
                  type="radio"
                  name="claimer"
                  value="self"
                  checked={claimerType === 'self'}
                  onChange={() => setClaimerType('self')}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium block">I will claim it myself</span>
                  <span className="text-xs text-ink/60">
                    Bring your tracking number and valid ID.
                  </span>
                </span>
              </label>

              <label
                className={`flex items-start gap-3 border rounded p-3 cursor-pointer ${
                  claimerType === 'rep'
                    ? 'border-brand bg-paper ring-1 ring-brand'
                    : 'border-ink/20'
                }`}
              >
                <input
                  type="radio"
                  name="claimer"
                  value="rep"
                  checked={claimerType === 'rep'}
                  onChange={() => setClaimerType('rep')}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium block">Someone else will claim it for me</span>
                  <span className="text-xs text-ink/60">Fill up the authorization letter.</span>
                </span>
              </label>
            </div>
          </fieldset>

          {claimerType === 'rep' && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="font-medium">Authorization letter</p>
                <p className="text-xs text-ink/60 mb-2">
                  Fill up the blanks in the letter. It is saved with your request, and the
                  Registrar&rsquo;s Office sees who will claim your document.
                </p>

                <div className="bg-white border border-ink/30 rounded p-5 font-serif text-sm leading-[2.4]">
                  <p className="text-center font-bold mb-2">AUTHORIZATION LETTER</p>
                  <p className="text-right">
                    Date:{' '}
                    <span>
                      {new Date().toLocaleDateString([], {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </p>
                  <p className="leading-relaxed mt-2">
                    To the Registrar,
                    <br />
                    Cabiao Senior High School
                  </p>
                  <p className="mt-2">
                    I, <b>{learnerFullName}</b> (LRN{' '}
                    <span className="tabular-nums">{learnerLrnDisplay}</span>), authorize{' '}
                    <input
                      value={repName}
                      onChange={(e) => setRepName(e.target.value)}
                      aria-label="Full name of the person who will claim"
                      placeholder="full name of the person who will claim"
                      className="inline-input w-64 max-w-full"
                    />{' '}
                    (my{' '}
                    <input
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      aria-label="Relationship to you"
                      placeholder="relationship, e.g. Mother"
                      className="inline-input w-44 max-w-full"
                    />
                    ) to claim my <b>{DOCS[docType]}</b> (Tracking No. <b>given after you submit</b>)
                    because{' '}
                    <input
                      value={repReason}
                      onChange={(e) => setRepReason(e.target.value)}
                      aria-label="Reason"
                      placeholder="reason (optional)"
                      className="inline-input w-64 max-w-full"
                    />
                    .
                  </p>
                  <p className="mt-2">
                    My representative will show their{' '}
                    <input
                      value={repIdType}
                      onChange={(e) => setRepIdType(e.target.value)}
                      aria-label="ID the representative will show"
                      placeholder="ID, e.g. Driver’s License"
                      className="inline-input w-56 max-w-full"
                    />{' '}
                    and can be reached at{' '}
                    <input
                      value={repPhone}
                      onChange={(e) => setRepPhone(e.target.value)}
                      inputMode="tel"
                      aria-label="Mobile number of the representative"
                      placeholder="mobile number (optional)"
                      className="inline-input w-48 max-w-full"
                    />
                    . A photocopy of my valid ID is attached.
                  </p>
                  <div className="mt-6 w-72 max-w-full">
                    <input
                      value={signedName}
                      onChange={(e) => setSignedName(e.target.value)}
                      aria-label="Type your full name as your signature"
                      placeholder="type your full name here"
                      className="inline-input w-full italic text-lg"
                    />
                    <p className="text-xs mt-1 font-sans leading-normal">
                      Signature over printed name of the learner
                    </p>
                  </div>
                </div>

                <label className="flex items-start gap-2 text-sm mt-3">
                  <input
                    type="checkbox"
                    checked={auConfirm}
                    onChange={(e) => setAuConfirm(e.target.checked)}
                    className="mt-1"
                  />
                  <span>I confirm that I am authorizing this person to claim my document.</span>
                </label>
              </div>

              <div className="rounded border border-ink/20 p-4">
                <label htmlFor="au-photo" className="block font-medium mb-1">
                  Photo of the person who will claim the document
                </label>
                <p className="text-xs text-ink/60 mb-2">
                  Upload a clear photo of their face. The Registrar compares it with the person who
                  comes to claim the document.
                </p>
                <input
                  id="au-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePickFile(e.target.files?.[0] || null, 'photo', setPhotoFile, e.currentTarget)}
                  className="w-full text-sm"
                />
                {photoPreviewUrl && (
                  <img
                    src={photoPreviewUrl}
                    alt="Representative preview"
                    className="mt-3 max-h-48 rounded border border-ink/15 object-contain"
                  />
                )}
              </div>

              <AuthorizationLetter
                request={{
                  name: learnerFullName,
                  lrn: cleanLrnPreview(foundStudent ? foundStudent.lrn : lrnInput),
                  doc: docType,
                  tracking: '',
                  claimerType: 'rep',
                  repName,
                  relationship,
                  repIdType,
                  repPhone,
                  repReason,
                  signedName,
                  signedAt: new Date().toISOString(),
                }}
              />
            </div>
          )}
        </div>

        {uid && (
          <label className="flex items-center gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={saveProfileChecked}
              onChange={(e) => setSaveProfileChecked(e.target.checked)}
            />
            <span>Save my learner details to My user info for future requests</span>
          </label>
        )}

        {uploadStatus && (
          <div className="space-y-1.5" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-ink/75">
              <span>{uploadStatus.label}</span>
              <span className="tabular-nums font-medium">{uploadStatus.percent}%</span>
            </div>
            <div className="h-2 w-full rounded bg-ink/10 overflow-hidden">
              <div
                className="h-full bg-brand transition-[width] duration-150"
                style={{ width: `${uploadStatus.percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-brand text-white px-5 py-2 rounded font-medium disabled:opacity-60 whitespace-nowrap"
          >
            {submitting
              ? uploadStatus
                ? `Uploading (${uploadStatus.percent}%)...`
                : 'Submitting...'
              : 'Submit request'}
          </button>
          {(!uid || !userEmail) && (
            <button
              type="button"
              disabled={verifying}
              onClick={handleGoogleVerify}
              className="border border-brand text-brand px-4 py-2 rounded text-sm font-medium hover:bg-paper disabled:opacity-60 whitespace-nowrap"
            >
              {verifying ? 'Signing in...' : 'Sign in with Google first'}
            </button>
          )}
          {submitMsg && (
            <p role="status" className={`text-sm ${submitMsg.ok ? 'text-ok' : 'text-bad'}`}>
              {submitMsg.text}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

function cleanLrnPreview(val: string): string | undefined {
  const trimmed = val.trim();
  return trimmed || undefined;
}
