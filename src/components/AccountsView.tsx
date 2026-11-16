import { useMemo, useState, type FormEvent } from 'react';
import {
  createStaffMember,
  deleteStudentRecord,
  extractReadableError,
  saveStudentRecord,
  toggleStaffMemberActive,
} from '../lib/firebase';
import {
  ROLE_LABEL,
  fullStudentName,
  normPhone,
  type StaffMember,
  type StaffRole,
  type StudentRecord,
} from '../types';

interface AccountsViewProps {
  currentUid: string;
  currentStaffId?: string;
  isRegistrar: boolean;
  students: StudentRecord[];
  staffList: StaffMember[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onToast: (message: string, via?: string, kind?: 'info' | 'error') => void;
}

export function AccountsView({
  currentUid,
  currentStaffId,
  isRegistrar,
  students,
  staffList,
  loading,
  onRefresh,
  onToast,
}: AccountsViewProps) {
  const [tab, setTab] = useState<'students' | 'staff'>('students');

  // Student form state
  const [lrn, setLrn] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [strand, setStrand] = useState('');
  const [lastGradeLevel, setLastGradeLevel] = useState('12');
  const [section, setSection] = useState('');
  const [yearGraduated, setYearGraduated] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [editingLrn, setEditingLrn] = useState<string | null>(null);
  const [studentMsg, setStudentMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [studentBusy, setStudentBusy] = useState(false);

  // Staff form state
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('admin_assistant');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffMsg, setStaffMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [staffBusy, setStaffBusy] = useState(false);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const name = fullStudentName(s).toLowerCase();
      return (
        s.lrn.includes(q) ||
        name.includes(q) ||
        (s.strand || '').toLowerCase().includes(q) ||
        (s.section || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      );
    });
  }, [students, studentSearch]);

  function resetStudentForm() {
    setLrn('');
    setFirstName('');
    setMiddleName('');
    setLastName('');
    setStrand('');
    setLastGradeLevel('12');
    setSection('');
    setYearGraduated('');
    setStudentEmail('');
    setStudentPhone('');
    setEditingLrn(null);
  }

  function populateStudentForEdit(s: StudentRecord) {
    setEditingLrn(s.lrn);
    setLrn(s.lrn);
    setFirstName(s.firstName);
    setMiddleName(s.middleName || '');
    setLastName(s.lastName);
    setStrand(s.strand || '');
    setLastGradeLevel(s.lastGradeLevel || '');
    setSection(s.section || '');
    setYearGraduated(s.yearGraduated || '');
    setStudentEmail(s.email || '');
    setStudentPhone(s.phone || '');
    setStudentMsg(null);
  }

  async function handleSaveStudent(e: FormEvent) {
    e.preventDefault();
    setStudentMsg(null);

    const cleanLrn = lrn.trim();
    if (!/^\d{12}$/.test(cleanLrn)) {
      setStudentMsg({ text: 'LRN must be exactly 12 digits.', ok: false });
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setStudentMsg({ text: 'First name and last name are required.', ok: false });
      return;
    }
    const cleanPhone = studentPhone.trim();
    const normalizedPhone = cleanPhone ? normPhone(cleanPhone) : '';
    if (cleanPhone && !normalizedPhone) {
      setStudentMsg({ text: 'Enter a valid PH mobile number (e.g. 0917 123 4567) or leave blank.', ok: false });
      return;
    }
    const cleanEmail = studentEmail.trim().toLowerCase();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setStudentMsg({ text: 'Enter a valid email address or leave blank.', ok: false });
      return;
    }

    setStudentBusy(true);
    try {
      await saveStudentRecord(
        {
          lrn: cleanLrn,
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          lastName: lastName.trim(),
          strand: strand.trim(),
          lastGradeLevel: lastGradeLevel.trim(),
          section: section.trim(),
          yearGraduated: yearGraduated.trim(),
          email: cleanEmail,
          phone: normalizedPhone || '',
        },
        currentUid,
      );
      setStudentMsg({
        text: editingLrn
          ? `Updated learner record for ${firstName.trim()} ${lastName.trim()}.`
          : `Saved ${firstName.trim()} ${lastName.trim()} to the learner database.`,
        ok: true,
      });
      resetStudentForm();
      await onRefresh();
    } catch (err) {
      setStudentMsg({ text: extractReadableError(err), ok: false });
    } finally {
      setStudentBusy(false);
    }
  }

  async function handleDeleteStudent(targetLrn: string, name: string) {
    try {
      await deleteStudentRecord(targetLrn);
      onToast(`Removed ${name} (${targetLrn}) from the database.`);
      if (editingLrn === targetLrn) resetStudentForm();
      await onRefresh();
    } catch (err) {
      onToast(extractReadableError(err), '', 'error');
    }
  }

  async function handleAddStaff(e: FormEvent) {
    e.preventDefault();
    setStaffMsg(null);
    const name = staffName.trim();
    const email = staffEmail.trim().toLowerCase();
    const phoneRaw = staffPhone.trim();

    if (!name) {
      setStaffMsg({ text: 'Enter the full name.', ok: false });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStaffMsg({ text: 'Enter a valid Google / Gmail address so they can sign in.', ok: false });
      return;
    }
    const normalizedPhone = phoneRaw ? normPhone(phoneRaw) : '';
    if (phoneRaw && !normalizedPhone) {
      setStaffMsg({ text: 'Enter a valid mobile number, like 0917 123 4567.', ok: false });
      return;
    }

    setStaffBusy(true);
    try {
      await createStaffMember({
        name,
        role: staffRole,
        phone: normalizedPhone || undefined,
        email,
      });
      setStaffName('');
      setStaffPhone('');
      setStaffEmail('');
      setStaffMsg({
        text: `${name} can now log in with Google as ${ROLE_LABEL[staffRole]}.`,
        ok: true,
      });
      await onRefresh();
    } catch (err) {
      setStaffMsg({ text: extractReadableError(err), ok: false });
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleToggleStaff(staff: StaffMember) {
    try {
      await toggleStaffMemberActive(staff.staffId, !staff.active);
      await onRefresh();
    } catch (err) {
      onToast(extractReadableError(err), '', 'error');
    }
  }

  return (
    <section aria-labelledby="accounts-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 id="accounts-heading" className="font-serif text-3xl mb-1 text-balance">
            Manage accounts &amp; user database
          </h1>
          <p className="text-ink/70 max-w-2xl">
            Add and manage learner records and staff accounts stored in Cloud Firestore.
          </p>
        </div>

        {isRegistrar && (
          <div className="inline-flex items-center gap-1 p-1 bg-white border border-ink/15 rounded-md">
            <button
              type="button"
              onClick={() => setTab('students')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                tab === 'students' ? 'bg-brand text-white' : 'text-ink/80 hover:bg-paper'
              }`}
            >
              Learner records ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('staff')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                tab === 'staff' ? 'bg-brand text-white' : 'text-ink/80 hover:bg-paper'
              }`}
            >
              Staff accounts ({staffList.length})
            </button>
          </div>
        )}
      </div>

      {tab === 'students' && (
        <>
          <form
            onSubmit={handleSaveStudent}
            className="bg-white border border-ink/15 rounded-md p-5 mb-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
              <h2 className="font-serif text-xl">
                {editingLrn ? `Edit learner record (${editingLrn})` : 'Add learner to database'}
              </h2>
              {editingLrn && (
                <button
                  type="button"
                  onClick={resetStudentForm}
                  className="text-sm underline text-ink/70 hover:text-ink whitespace-nowrap"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <div>
              <label htmlFor="st-lrn" className="block text-sm font-medium mb-1">
                12-digit LRN *
              </label>
              <input
                id="st-lrn"
                value={lrn}
                onChange={(e) => setLrn(e.target.value.replace(/\D/g, '').slice(0, 12))}
                disabled={Boolean(editingLrn)}
                inputMode="numeric"
                maxLength={12}
                placeholder="123456789012"
                className="w-full border border-ink/30 rounded px-3 py-2 tabular-nums disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="st-first" className="block text-sm font-medium mb-1">
                First name *
              </label>
              <input
                id="st-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={80}
                placeholder="Juan"
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="st-middle" className="block text-sm font-medium mb-1">
                Middle name
              </label>
              <input
                id="st-middle"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                maxLength={80}
                placeholder="Santos"
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="st-last" className="block text-sm font-medium mb-1">
                Last name *
              </label>
              <input
                id="st-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={80}
                placeholder="Dela Cruz"
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="st-strand" className="block text-sm font-medium mb-1">
                Strand
              </label>
              <select
                id="st-strand"
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
              <label htmlFor="st-grade" className="block text-sm font-medium mb-1">
                Last grade level
              </label>
              <select
                id="st-grade"
                value={lastGradeLevel}
                onChange={(e) => setLastGradeLevel(e.target.value)}
                className="w-full border border-ink/30 rounded px-3 py-2"
              >
                <option value="">Select grade</option>
                <option value="11">Grade 11</option>
                <option value="12">Grade 12</option>
              </select>
            </div>

            <div>
              <label htmlFor="st-section" className="block text-sm font-medium mb-1">
                Section
              </label>
              <input
                id="st-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                maxLength={80}
                placeholder="e.g. Newton"
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="st-year" className="block text-sm font-medium mb-1">
                Year graduated
              </label>
              <input
                id="st-year"
                value={yearGraduated}
                onChange={(e) => setYearGraduated(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                maxLength={4}
                placeholder="e.g. 2025"
                className="w-full border border-ink/30 rounded px-3 py-2 tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="st-email" className="block text-sm font-medium mb-1">
                Student Gmail (links LRN lookup)
              </label>
              <input
                id="st-email"
                type="email"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                maxLength={200}
                placeholder="learner@gmail.com"
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="st-phone" className="block text-sm font-medium mb-1">
                Mobile number
              </label>
              <input
                id="st-phone"
                value={studentPhone}
                onChange={(e) => setStudentPhone(e.target.value)}
                inputMode="tel"
                maxLength={24}
                placeholder="0917 123 4567"
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={studentBusy}
                className="bg-brand text-white px-5 py-2 rounded font-medium disabled:opacity-60 whitespace-nowrap"
              >
                {studentBusy
                  ? 'Saving...'
                  : editingLrn
                    ? 'Update learner record'
                    : 'Save learner record'}
              </button>
              {studentMsg && (
                <p role="status" className={`text-sm ${studentMsg.ok ? 'text-ok' : 'text-bad'}`}>
                  {studentMsg.text}
                </p>
              )}
            </div>
          </form>

          <div className="bg-white border border-ink/15 rounded-md overflow-hidden">
            <div className="p-4 border-b border-ink/10 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-lg">Stored learner records</h2>
              <input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by LRN, name, strand, or Gmail..."
                className="w-full sm:w-72 border border-ink/30 rounded px-3 py-1.5 text-sm"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left border-b border-ink/15">
                  <tr>
                    <th className="p-3">LRN</th>
                    <th className="p-3">Learner name</th>
                    <th className="p-3">Strand &amp; section</th>
                    <th className="p-3">Year</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-ink/60">
                        Loading learner records...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-ink/60">
                        {studentSearch
                          ? 'No learner records match your search.'
                          : 'No learner records saved yet. Use the form above to add a learner.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.lrn} className="border-b border-ink/10 hover:bg-paper/40">
                        <td className="p-3 font-mono text-xs tabular-nums">{s.lrn}</td>
                        <td className="p-3 font-medium">{fullStudentName(s)}</td>
                        <td className="p-3">
                          {[
                            s.strand,
                            s.lastGradeLevel ? `Grade ${s.lastGradeLevel}` : '',
                            s.section,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </td>
                        <td className="p-3 tabular-nums">{s.yearGraduated || '—'}</td>
                        <td className="p-3 text-xs">
                          <div>{s.email || '—'}</div>
                          {s.phone && <div className="text-ink/60 tabular-nums">{s.phone}</div>}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => populateStudentForEdit(s)}
                              className="px-3 py-1 rounded border border-ink/30 hover:bg-paper text-xs font-medium whitespace-nowrap"
                            >
                              Edit
                            </button>
                            {isRegistrar && (
                              <button
                                type="button"
                                onClick={() => handleDeleteStudent(s.lrn, fullStudentName(s))}
                                className="px-3 py-1 rounded border border-bad text-bad hover:bg-bad/5 text-xs font-medium whitespace-nowrap"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'staff' && isRegistrar && (
        <>
          <form
            onSubmit={handleAddStaff}
            className="bg-white border border-ink/15 rounded-md p-5 mb-6 grid sm:grid-cols-2 gap-4"
          >
            <div className="sm:col-span-2 border-b border-ink/10 pb-3">
              <h2 className="font-serif text-xl">Add staff account</h2>
              <p className="text-xs text-ink/60 mt-1">
                Added staff sign in using &ldquo;Continue with Google&rdquo; with their Gmail address.
              </p>
            </div>

            <div>
              <label htmlFor="staff-name" className="block text-sm font-medium mb-1">
                Full name *
              </label>
              <input
                id="staff-name"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                maxLength={120}
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="staff-role" className="block text-sm font-medium mb-1">
                Role
              </label>
              <select
                id="staff-role"
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as StaffRole)}
                className="w-full border border-ink/30 rounded px-3 py-2"
              >
                <option value="admin_assistant">Administrative assistant</option>
                <option value="principal">Principal</option>
                <option value="registrar">Registrar (administrator)</option>
              </select>
            </div>

            <div>
              <label htmlFor="staff-phone" className="block text-sm font-medium mb-1">
                Mobile number (optional)
              </label>
              <input
                id="staff-phone"
                value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value)}
                inputMode="tel"
                placeholder="0917 123 4567"
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="staff-email" className="block text-sm font-medium mb-1">
                Gmail *
              </label>
              <input
                id="staff-email"
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="name@gmail.com"
                className="w-full border border-ink/30 rounded px-3 py-2"
              />
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={staffBusy}
                className="bg-brand text-white px-5 py-2 rounded font-medium disabled:opacity-60 whitespace-nowrap"
              >
                {staffBusy ? 'Adding...' : 'Add account'}
              </button>
              {staffMsg && (
                <p role="status" className={`text-sm ${staffMsg.ok ? 'text-ok' : 'text-bad'}`}>
                  {staffMsg.text}
                </p>
              )}
            </div>
          </form>

          <div className="bg-white border border-ink/15 rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left border-b border-ink/15">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Mobile</th>
                  <th className="p-3">Gmail</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((staff) => (
                  <tr key={staff.staffId} className="border-b border-ink/10">
                    <td className="p-3 font-medium">{staff.name}</td>
                    <td className="p-3">{ROLE_LABEL[staff.role]}</td>
                    <td className="p-3 tabular-nums">{staff.phone || '—'}</td>
                    <td className="p-3">{staff.email}</td>
                    <td className="p-3">
                      <span className={staff.active ? 'text-ok font-medium' : 'text-bad font-medium'}>
                        {staff.active ? 'Active' : 'Turned off'}
                      </span>
                    </td>
                    <td className="p-3">
                      {staff.staffId === currentStaffId ? (
                        <span className="text-ink/50">You</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleStaff(staff)}
                          className={`px-3 py-1 rounded border text-xs font-medium whitespace-nowrap ${
                            staff.active ? 'border-bad text-bad' : 'border-ok text-ok'
                          }`}
                        >
                          {staff.active ? 'Turn off' : 'Turn on'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
