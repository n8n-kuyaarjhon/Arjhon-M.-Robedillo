import { useEffect, useState, type FormEvent } from 'react';
import {
  extractReadableError,
  getRememberLoginPref,
  getUserPrivateInfo,
  resolveUserSession,
  saveUserPrivateInfo,
  signInWithGoogle,
  type ResolvedSession,
} from '../lib/firebase';
import { normPhone } from '../types';

interface AuthModalProps {
  open: boolean;
  initialTab?: 'login' | 'signup';
  onClose: () => void;
  onAuthenticated: (session: ResolvedSession, toastMessage?: string) => void;
}

export function AuthModal({
  open,
  initialTab = 'login',
  onClose,
  onAuthenticated,
}: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'signup'>(initialTab);
  const [step, setStep] = useState<'auth' | 'complete-profile'>('auth');
  const [pendingSession, setPendingSession] = useState<ResolvedSession | null>(null);

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [lrn, setLrn] = useState('');
  const [strand, setStrand] = useState('');
  const [section, setSection] = useState('');
  const [yearGraduated, setYearGraduated] = useState('');
  const [phone, setPhone] = useState('');

  const [rememberDevice, setRememberDevice] = useState<boolean>(() => getRememberLoginPref());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setStep('auth');
    setPendingSession(null);
    setRememberDevice(getRememberLoginPref());
    setError('');
  }, [open, initialTab]);

  if (!open) return null;

  function validateProfileFields(requireName: boolean): { normalizedPhone: string } | null {
    if (requireName && (!firstName.trim() || !lastName.trim())) {
      setError('Enter your first name and last name so your account info can be saved.');
      return null;
    }
    const cleanLrn = lrn.trim();
    if (cleanLrn && !/^\d{12}$/.test(cleanLrn)) {
      setError('12-digit LRN must be 12 numbers, or leave it blank.');
      return null;
    }
    const cleanPhone = phone.trim();
    const normalizedPhone = cleanPhone ? normPhone(cleanPhone) : '';
    if (cleanPhone && !normalizedPhone) {
      setError('Enter a valid mobile number (e.g. 0917 123 4567) or leave it blank.');
      return null;
    }
    return { normalizedPhone: normalizedPhone || '' };
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setError('');
    try {
      const user = await signInWithGoogle(rememberDevice);
      const resolved = await resolveUserSession(user);

      if (resolved.role === 'student') {
        const priv = await getUserPrivateInfo(resolved.uid).catch(() => null);
        if (!priv || (!priv.firstName && !priv.lastName)) {
          // Persist active login immediately and invite the user to save their details
          onAuthenticated(resolved);
          setPendingSession(resolved);
          if (!firstName && !lastName && resolved.displayName) {
            const parts = resolved.displayName.trim().split(/\s+/);
            setFirstName(parts[0] || '');
            setLastName(parts.length > 1 ? parts.slice(1).join(' ') : '');
          }
          setStep('complete-profile');
          return;
        }
      }

      onAuthenticated(resolved, `Signed in as ${resolved.displayName}.`);
      onClose();
    } catch (err) {
      setError(extractReadableError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignup(e: FormEvent) {
    e.preventDefault();
    setError('');
    const validated = validateProfileFields(true);
    if (!validated) return;

    setBusy(true);
    try {
      const user = await signInWithGoogle(rememberDevice);
      const resolved = await resolveUserSession(user);

      await saveUserPrivateInfo(resolved.uid, {
        email: resolved.email,
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        lrn: lrn.trim(),
        strand: strand.trim(),
        section: section.trim(),
        yearGraduated: yearGraduated.trim(),
        phone: validated.normalizedPhone,
      });

      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').slice(0, 120);
      const updatedSession: ResolvedSession =
        resolved.role === 'student' && fullName
          ? { ...resolved, displayName: fullName }
          : resolved;

      onAuthenticated(
        updatedSession,
        `Account created and info saved for ${updatedSession.displayName}.`,
      );
      onClose();
    } catch (err) {
      setError(extractReadableError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveCompletedProfile(e: FormEvent) {
    e.preventDefault();
    if (!pendingSession) return;
    setError('');
    const validated = validateProfileFields(true);
    if (!validated) return;

    setBusy(true);
    try {
      await saveUserPrivateInfo(pendingSession.uid, {
        email: pendingSession.email,
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        lrn: lrn.trim(),
        strand: strand.trim(),
        section: section.trim(),
        yearGraduated: yearGraduated.trim(),
        phone: validated.normalizedPhone,
      });

      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').slice(0, 120);
      const updatedSession: ResolvedSession = fullName
        ? { ...pendingSession, displayName: fullName }
        : pendingSession;

      onAuthenticated(updatedSession, `User info saved for ${updatedSession.displayName}.`);
      onClose();
    } catch (err) {
      setError(extractReadableError(err));
    } finally {
      setBusy(false);
    }
  }

  function renderProfileInputs() {
    return (
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div>
          <label htmlFor="auth-first" className="block font-medium mb-1">
            First name *
          </label>
          <input
            id="auth-first"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            maxLength={80}
            required
            className="w-full border border-ink/30 rounded px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="auth-last" className="block font-medium mb-1">
            Last name *
          </label>
          <input
            id="auth-last"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            maxLength={80}
            required
            className="w-full border border-ink/30 rounded px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="auth-middle" className="block font-medium mb-1">
            Middle name
          </label>
          <input
            id="auth-middle"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            maxLength={80}
            placeholder="Optional"
            className="w-full border border-ink/30 rounded px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="auth-lrn" className="block font-medium mb-1">
            12-digit LRN
          </label>
          <input
            id="auth-lrn"
            value={lrn}
            onChange={(e) => setLrn(e.target.value.replace(/\D/g, '').slice(0, 12))}
            inputMode="numeric"
            maxLength={12}
            placeholder="Optional"
            className="w-full border border-ink/30 rounded px-3 py-2 tabular-nums"
          />
        </div>

        <div>
          <label htmlFor="auth-strand" className="block font-medium mb-1">
            Strand
          </label>
          <select
            id="auth-strand"
            value={strand}
            onChange={(e) => setStrand(e.target.value)}
            className="w-full border border-ink/30 rounded px-3 py-2"
          >
            <option value="">Select strand</option>
            <option value="STEM">STEM</option>
            <option value="ABM">ABM</option>
            <option value="HUMSS">HUMSS</option>
            <option value="TVL">TVL</option>
          </select>
        </div>

        <div>
          <label htmlFor="auth-section" className="block font-medium mb-1">
            Grade &amp; section
          </label>
          <input
            id="auth-section"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            maxLength={80}
            placeholder="e.g. Grade 12 - Rizal"
            className="w-full border border-ink/30 rounded px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="auth-year" className="block font-medium mb-1">
            Year graduated
          </label>
          <input
            id="auth-year"
            value={yearGraduated}
            onChange={(e) => setYearGraduated(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            placeholder="e.g. 2025"
            className="w-full border border-ink/30 rounded px-3 py-2 tabular-nums"
          />
        </div>

        <div>
          <label htmlFor="auth-phone" className="block font-medium mb-1">
            Mobile number
          </label>
          <input
            id="auth-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="0917 123 4567"
            className="w-full border border-ink/30 rounded px-3 py-2"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto grid place-items-center p-4 auth-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-lg py-6">
        <div className="text-center mb-5">
          <img
            src="/assets/school-seal.png"
            alt="Cabiao National Senior High School seal"
            className="w-20 h-20 mx-auto mb-3 rounded-full bg-white p-1 object-contain"
          />
          <h1 id="auth-modal-title" className="font-serif text-2xl leading-snug">
            {step === 'complete-profile'
              ? 'Save your learner info'
              : tab === 'login'
                ? 'Account log in'
                : 'Create your account'}
          </h1>
          <p className="text-sm text-ink/70">
            Student Clearance Document Request System &middot; Cabiao Senior High School
          </p>
        </div>

        <div className="bg-white border border-ink/15 rounded-md p-6">
          {step === 'complete-profile' && pendingSession ? (
            <form onSubmit={handleSaveCompletedProfile} className="space-y-4">
              <div className="border border-ok/40 bg-paper/60 rounded px-3 py-2 text-sm">
                Signed in as <b>{pendingSession.email}</b>. Fill in your details below so they stay
                saved on your account.
              </div>

              {renderProfileInputs()}

              {error && (
                <p role="alert" className="text-sm text-bad">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-brand text-white px-5 py-2 rounded font-medium disabled:opacity-60 whitespace-nowrap"
                >
                  {busy ? 'Saving...' : 'Save my info'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onAuthenticated(pendingSession, `Signed in as ${pendingSession.displayName}.`);
                    onClose();
                  }}
                  className="text-sm underline text-ink/70 hover:text-ink"
                >
                  Skip for now
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-2 border-b border-ink/15 mb-5" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'login'}
                  onClick={() => {
                    setTab('login');
                    setError('');
                  }}
                  className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
                    tab === 'login'
                      ? 'border-brand text-brand'
                      : 'border-transparent text-ink/60 hover:text-ink'
                  }`}
                >
                  Log in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'signup'}
                  onClick={() => {
                    setTab('signup');
                    setError('');
                  }}
                  className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
                    tab === 'signup'
                      ? 'border-brand text-brand'
                      : 'border-transparent text-ink/60 hover:text-ink'
                  }`}
                >
                  Sign up
                </button>
              </div>

              {tab === 'login' ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 border border-ink/30 rounded py-2.5 px-4 font-medium hover:bg-paper transition-colors disabled:opacity-60 whitespace-nowrap"
                  >
                    <span className="font-bold text-lg text-[#4285F4]" aria-hidden="true">
                      G
                    </span>
                    <span>{busy ? 'Signing in...' : 'One-time log in with Google'}</span>
                  </button>

                  <label className="flex items-start gap-2.5 text-sm text-ink/85 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Keep me logged in on this browser{' '}
                      <span className="text-xs text-ink/60 block">
                        One-time login: stay signed in automatically across reloads until you log
                        out. Uncheck on shared devices.
                      </span>
                    </span>
                  </label>

                  {error && (
                    <p role="alert" className="text-sm text-bad">
                      {error}
                    </p>
                  )}

                  <p className="text-xs text-ink/70 leading-relaxed">
                    Your saved info stays stored in Cloud Firestore. School staff added by the
                    Registrar automatically unlock Registrar review, Pick-ups, and Learner Database
                    tools.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleGoogleSignup} className="space-y-4">
                  <p className="text-xs text-ink/75">
                    Enter your learner details once, then verify with Google. Your account and info
                    are saved permanently and you stay logged in automatically.
                  </p>

                  {renderProfileInputs()}

                  <label className="flex items-start gap-2.5 text-sm text-ink/85 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Keep me logged in on this browser (one-time login)
                    </span>
                  </label>

                  {error && (
                    <p role="alert" className="text-sm text-bad">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-3 bg-brand text-white rounded py-2.5 px-4 font-medium hover:opacity-95 transition-opacity disabled:opacity-60 whitespace-nowrap"
                  >
                    <span
                      className="font-bold text-base bg-white text-[#4285F4] w-5 h-5 rounded-full grid place-items-center"
                      aria-hidden="true"
                    >
                      G
                    </span>
                    <span>{busy ? 'Creating & saving account...' : 'Sign up & save with Google'}</span>
                  </button>
                </form>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="mt-4 text-sm underline text-ink/70 hover:text-ink"
              >
                Back to the website
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
