import { onAuthStateChanged } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { AboutView } from './components/AboutView';
import { AccountsView } from './components/AccountsView';
import { AuthModal } from './components/AuthModal';
import { FulfillmentView } from './components/FulfillmentView';
import { NotificationsView } from './components/NotificationsView';
import { ProfileView } from './components/ProfileView';
import { RegistrarView } from './components/RegistrarView';
import { RequestView } from './components/RequestView';
import { TrackView } from './components/TrackView';
import {
  auth,
  extractReadableError,
  getRememberLoginPref,
  listAllRequests,
  listStaffMembers,
  listStaffNotifications,
  listStudents,
  markNotificationsAsRead,
  resolveUserSession,
  signOutUser,
  type ResolvedSession,
} from './lib/firebase';
import {
  ROLE_LABEL,
  ROLE_VIEWS,
  generateId,
  type AppView,
  type ClearanceRequest,
  type StaffMember,
  type StaffNotification,
  type StudentRecord,
  type ToastItem,
  type UserRole,
} from './types';

const NAV_ITEMS: Array<{ view: AppView; label: string }> = [
  { view: 'request', label: 'Request a document' },
  { view: 'track', label: 'Track my request' },
  { view: 'profile', label: 'My user info' },
  { view: 'registrar', label: 'Registrar review' },
  { view: 'fulfillment', label: 'Pick-ups' },
  { view: 'accounts', label: 'Manage accounts' },
  { view: 'notifications', label: 'Notifications' },
  { view: 'about', label: 'About us' },
];

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<ResolvedSession | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup'>('login');

  const [view, setView] = useState<AppView>('request');
  const [trackCode, setTrackCode] = useState<string>('');

  const [requests, setRequests] = useState<ClearanceRequest[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [loadingStaffData, setLoadingStaffData] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, via?: string, kind: 'info' | 'error' = 'info') => {
    const id = generateId('toast');
    setToasts((prev) => [...prev, { id, message, via, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6500);
  }, []);

  const userRole: UserRole = session ? session.role : 'public';
  const allowedViews = ROLE_VIEWS[userRole];
  const isStaffUser =
    userRole === 'registrar' || userRole === 'admin_assistant' || userRole === 'principal';

  const loadStaffData = useCallback(
    async (activeSession: ResolvedSession) => {
      if (activeSession.role === 'student') return;
      setLoadingStaffData(true);
      try {
        const [reqRows, notifRows] = await Promise.all([
          listAllRequests(),
          listStaffNotifications(activeSession.email, activeSession.isAdmin),
        ]);
        setRequests(reqRows);
        setNotifications(notifRows);

        if (activeSession.role === 'registrar' || activeSession.role === 'admin_assistant') {
          const studentRows = await listStudents();
          setStudents(studentRows);
        }
        if (activeSession.isAdmin) {
          const staffRows = await listStaffMembers();
          setStaffList(staffRows);
        }
      } catch (err) {
        addToast(extractReadableError(err), '', 'error');
      } finally {
        setLoadingStaffData(false);
      }
    },
    [addToast],
  );

  const applyAuthenticatedSession = useCallback(
    async (resolved: ResolvedSession) => {
      setSession(resolved);
      setAuthReady(true);

      const roleViews = ROLE_VIEWS[resolved.role];
      setView((prev) => (roleViews.includes(prev) ? prev : roleViews[0]));

      if (resolved.role !== 'student') {
        await loadStaffData(resolved);
      }
    },
    [loadStaffData],
  );

  // Listen to Firebase Auth state (one-time persistent login)
  useEffect(() => {
    let active = true;

    if (typeof auth.authStateReady === 'function') {
      void auth.authStateReady().then(() => {
        if (active && !auth.currentUser) {
          setAuthReady(true);
        }
      });
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return;
      if (!firebaseUser) {
        setSession(null);
        setRequests([]);
        setStudents([]);
        setStaffList([]);
        setNotifications([]);
        setAuthReady(true);
        return;
      }

      try {
        const resolved = await resolveUserSession(firebaseUser);
        if (!active) return;
        await applyAuthenticatedSession(resolved);
      } catch (err) {
        if (!active) return;
        // Keep a base authenticated session even if role lookup encounters a transient error
        const email = (firebaseUser.email || '').trim().toLowerCase();
        const fallbackSession: ResolvedSession = {
          uid: firebaseUser.uid,
          email,
          displayName: (firebaseUser.displayName || email.split('@')[0] || 'User').slice(0, 120),
          role: 'student',
          staff: null,
          isAdmin: false,
        };
        setSession(fallbackSession);
        setAuthReady(true);
        addToast(extractReadableError(err), '', 'error');
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, [addToast, applyAuthenticatedSession]);

  // Support #track-CSHS-XXXX-XXXX deep links
  useEffect(() => {
    function syncHash() {
      const match = /^#track-(CSHS-[A-Z0-9]{4}-[A-Z0-9]{4})$/.exec(window.location.hash);
      if (match) {
        setTrackCode(match[1]);
        setView('track');
      }
    }
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  async function handleSelectView(nextView: AppView) {
    setView(nextView);
    if (nextView === 'notifications' && session && isStaffUser && notifications.some((n) => !n.read)) {
      try {
        await markNotificationsAsRead(notifications);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      } catch {
        // Ignore read update failures
      }
    }
  }

  async function handleSignOut() {
    try {
      await signOutUser();
      setView('request');
      addToast('Signed out.');
    } catch (err) {
      addToast(extractReadableError(err), '', 'error');
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Sidebar */}
      <aside className="md:w-60 bg-ink text-white p-5 md:min-h-screen border-b-4 md:border-b-0 md:border-r-4 border-gold shrink-0">
        <div className="flex items-center gap-3 mb-8">
          <img
            src="/assets/school-seal.png"
            alt="Cabiao National Senior High School seal"
            className="w-14 h-14 rounded-full bg-white p-0.5 object-contain shrink-0"
          />
          <div className="font-serif text-base leading-snug">
            Student Clearance Document Request System
            <span className="block text-xs font-sans text-white/70 mt-1">
              Cabiao Senior High School
            </span>
          </div>
        </div>

        <nav className="flex md:flex-col gap-2 overflow-x-auto pb-1" aria-label="Views">
          {NAV_ITEMS.filter((item) => allowedViews.includes(item.view)).map((item) => {
            const active = view === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => void handleSelectView(item.view)}
                className={`text-left px-3 py-2 rounded transition-colors whitespace-nowrap shrink-0 flex items-center justify-between gap-2 ${
                  active
                    ? 'bg-gold text-ink font-medium'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <span>{item.label}</span>
                {item.view === 'notifications' && unreadCount > 0 && (
                  <span className="text-xs font-semibold tabular-nums">({unreadCount})</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-6 md:mt-10 border-t border-white/15 pt-4 text-sm">
          {session ? (
            <div>
              <div className="font-medium truncate">{session.displayName}</div>
              <div className="text-xs text-white/70">
                {session.role === 'student'
                  ? 'Learner account'
                  : ROLE_LABEL[session.role]}
              </div>
              <div className="text-[11px] text-white/55 mb-2">
                {getRememberLoginPref()
                  ? 'One-time login · Stayed signed in'
                  : 'Session active until tab closes'}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="underline text-white/80 hover:text-white"
              >
                Log out
              </button>
            </div>
          ) : !authReady ? (
            <div className="text-xs text-white/70">Restoring one-time login...</div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setAuthModalTab('login');
                  setAuthModalOpen(true);
                }}
                className="w-full text-left px-3 py-2 rounded border border-white/30 hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                Staff / User log in
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthModalTab('signup');
                  setAuthModalOpen(true);
                }}
                className="w-full text-left px-3 py-1.5 rounded text-xs text-white/85 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                New learner? Sign up once
              </button>
              <p className="text-[11px] text-white/55 px-1">
                Sign in once to stay logged in automatically.
              </p>
            </div>
          )}
        </div>

        <p className="hidden md:block mt-10 text-xs text-white/60">
          Records are stored securely in Cloud Firestore.
        </p>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-5 md:p-10 max-w-5xl min-w-0">
        <div className="rounded-md bg-ink text-white px-6 py-5 mb-8 border-b-4 border-gold">
          <p className="font-serif text-xl">Cabiao Senior High School</p>
          <p className="text-sm text-white/75">
            Office of the Registrar &middot; Student Clearance Document Request System
          </p>
        </div>

        {view === 'request' && (
          <RequestView
            uid={session?.uid || null}
            userEmail={session?.email || null}
            onVerified={(resolved) => {
              void applyAuthenticatedSession(resolved);
            }}
            onOpenProfile={() => setView('profile')}
            onTrackTracking={(code) => {
              setTrackCode(code);
              setView('track');
            }}
            onToast={addToast}
          />
        )}

        {view === 'track' && (
          <TrackView
            uid={session?.uid || null}
            initialTracking={trackCode}
            onOpenAuth={() => {
              setAuthModalTab('login');
              setAuthModalOpen(true);
            }}
          />
        )}

        {view === 'profile' && session && (
          <ProfileView
            uid={session.uid}
            email={session.email}
            displayName={session.displayName}
            onProfileSaved={(newDisplayName) => {
              setSession((prev) => (prev ? { ...prev, displayName: newDisplayName } : prev));
            }}
            onToast={addToast}
          />
        )}

        {view === 'registrar' && isStaffUser && (
          <RegistrarView
            requests={requests}
            loading={loadingStaffData}
            onRefresh={async () => {
              if (session) await loadStaffData(session);
            }}
            onToast={addToast}
          />
        )}

        {view === 'fulfillment' && isStaffUser && (
          <FulfillmentView
            requests={requests}
            loading={loadingStaffData}
            onRefresh={async () => {
              if (session) await loadStaffData(session);
            }}
            onToast={addToast}
          />
        )}

        {view === 'accounts' && session && (session.role === 'registrar' || session.role === 'admin_assistant') && (
          <AccountsView
            currentUid={session.uid}
            currentStaffId={session.staff?.staffId}
            isRegistrar={session.isAdmin}
            students={students}
            staffList={staffList}
            loading={loadingStaffData}
            onRefresh={async () => {
              await loadStaffData(session);
            }}
            onToast={addToast}
          />
        )}

        {view === 'notifications' && isStaffUser && (
          <NotificationsView items={notifications} loading={loadingStaffData} />
        )}

        {view === 'about' && <AboutView />}
      </main>

      {/* Toasts */}
      <div
        className="fixed top-4 right-4 z-[80] w-[min(22rem,calc(100vw-2rem))] space-y-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
            className={`w-full text-left bg-white border rounded p-3 text-sm shadow-sm ${
              t.kind === 'error' ? 'border-bad text-bad' : 'border-ink/20 text-ink'
            }`}
          >
            <div className="font-medium">{t.message}</div>
            {t.via && <div className="text-xs text-ink/60 mt-1">{t.via}</div>}
          </button>
        ))}
      </div>

      {/* Sign-in / Sign-up modal */}
      <AuthModal
        open={authModalOpen}
        initialTab={authModalTab}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={(resolved, toastMessage) => {
          void applyAuthenticatedSession(resolved);
          if (toastMessage) addToast(toastMessage);
        }}
      />
    </div>
  );
}
