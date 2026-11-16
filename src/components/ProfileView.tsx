import { useEffect, useState, type FormEvent } from 'react';
import { extractReadableError, getUserPrivateInfo, saveUserPrivateInfo } from '../lib/firebase';
import { normPhone } from '../types';

interface ProfileViewProps {
  uid: string;
  email: string;
  displayName: string;
  onProfileSaved?: (newDisplayName: string) => void;
  onToast: (message: string, via?: string, kind?: 'info' | 'error') => void;
}

export function ProfileView({
  uid,
  email,
  displayName,
  onProfileSaved,
  onToast,
}: ProfileViewProps) {
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [lrn, setLrn] = useState('');
  const [strand, setStrand] = useState('');
  const [section, setSection] = useState('');
  const [yearGraduated, setYearGraduated] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getUserPrivateInfo(uid)
      .then((info) => {
        if (!active) return;
        if (!info) {
          const parts = displayName.trim().split(/\s+/);
          setFirstName(parts[0] || '');
          setLastName(parts.length > 1 ? parts.slice(1).join(' ') : '');
          return;
        }
        setFirstName(info.firstName || '');
        setMiddleName(info.middleName || '');
        setLastName(info.lastName || '');
        setLrn(info.lrn || '');
        setStrand(info.strand || '');
        setSection(info.section || '');
        setYearGraduated(info.yearGraduated || '');
        setPhone(info.phone || '');
        setAddress(info.address || '');
      })
      .catch((err) => {
        if (active) onToast(extractReadableError(err), '', 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uid, displayName, onToast]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setStatusMsg(null);

    const cleanLrn = lrn.trim();
    if (cleanLrn && !/^\d{12}$/.test(cleanLrn)) {
      setStatusMsg({ text: 'LRN must be 12 digits, or leave it blank.', ok: false });
      return;
    }
    const cleanPhone = phone.trim();
    const normalizedPhone = cleanPhone ? normPhone(cleanPhone) : '';
    if (cleanPhone && !normalizedPhone) {
      setStatusMsg({ text: 'Enter a valid mobile number (e.g. 0917 123 4567) or leave blank.', ok: false });
      return;
    }

    setSaving(true);
    try {
      await saveUserPrivateInfo(uid, {
        email,
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        lrn: cleanLrn,
        strand: strand.trim(),
        section: section.trim(),
        yearGraduated: yearGraduated.trim(),
        phone: normalizedPhone || '',
        address: address.trim(),
      });
      const updatedName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').slice(0, 120);
      if (updatedName) {
        onProfileSaved?.(updatedName);
      }
      setStatusMsg({ text: 'Your user information has been saved securely.', ok: true });
      onToast('User profile saved.');
    } catch (err) {
      setStatusMsg({ text: extractReadableError(err), ok: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="profile-heading">
      <h1 id="profile-heading" className="font-serif text-3xl mb-1 text-balance">
        My user info
      </h1>
      <p className="text-ink/70 mb-6 max-w-2xl">
        Save your learner details once so future document requests auto-fill automatically. Your
        information is stored privately under your verified account.
      </p>

      <div className="bg-white border border-ink/15 rounded-md p-5">
        <div className="mb-5 pb-4 border-b border-ink/10 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            <span className="text-ink/60">Signed in as </span>
            <span className="font-medium">{displayName}</span>
            <span className="text-ink/50"> &middot; {email}</span>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-ink/60">Loading your saved info...</p>
        ) : (
          <form onSubmit={handleSave} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prof-first" className="block text-sm font-medium mb-1">
                First name
              </label>
              <input
                id="prof-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={80}
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="prof-middle" className="block text-sm font-medium mb-1">
                Middle name
              </label>
              <input
                id="prof-middle"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                maxLength={80}
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="prof-last" className="block text-sm font-medium mb-1">
                Last name
              </label>
              <input
                id="prof-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={80}
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="prof-lrn" className="block text-sm font-medium mb-1">
                12-digit LRN
              </label>
              <input
                id="prof-lrn"
                value={lrn}
                onChange={(e) => setLrn(e.target.value.replace(/\D/g, '').slice(0, 12))}
                inputMode="numeric"
                maxLength={12}
                placeholder="123456789012"
                className="w-full border border-ink/30 rounded px-3 py-2 tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="prof-strand" className="block text-sm font-medium mb-1">
                Strand
              </label>
              <select
                id="prof-strand"
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
              <label htmlFor="prof-section" className="block text-sm font-medium mb-1">
                Section
              </label>
              <input
                id="prof-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                maxLength={80}
                placeholder="e.g. Grade 12 - Rizal"
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="prof-year" className="block text-sm font-medium mb-1">
                Year graduated
              </label>
              <input
                id="prof-year"
                value={yearGraduated}
                onChange={(e) => setYearGraduated(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                maxLength={4}
                placeholder="e.g. 2025"
                className="w-full border border-ink/30 rounded px-3 py-2 tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="prof-phone" className="block text-sm font-medium mb-1">
                Mobile number
              </label>
              <input
                id="prof-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="0917 123 4567"
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="prof-address" className="block text-sm font-medium mb-1">
                Home address (optional)
              </label>
              <input
                id="prof-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={250}
                placeholder="Barangay, Municipality, Province"
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="bg-brand text-white px-5 py-2 rounded font-medium disabled:opacity-60 whitespace-nowrap"
              >
                {saving ? 'Saving...' : 'Save my info'}
              </button>
              {statusMsg && (
                <p role="status" className={`text-sm ${statusMsg.ok ? 'text-ok' : 'text-bad'}`}>
                  {statusMsg.text}
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
