import { useEffect, useState, type FormEvent } from 'react';
import {
  extractReadableError,
  listMyRequests,
  lookupPublicTracking,
} from '../lib/firebase';
import {
  DOCS,
  PURPOSE,
  formatTimestamp,
  normTracking,
  type ClearanceRequest,
  type PublicTrackingStatus,
} from '../types';

interface TrackViewProps {
  uid: string | null;
  initialTracking?: string;
  onOpenAuth: () => void;
}

const STAGES = [
  ['received', 'Request received'],
  ['review', 'Under review'],
  ['approved', 'Approved. Preparing your document'],
  ['ready', 'Ready for pick-up'],
  ['claimed', 'Claimed'],
] as const;

function currentStageIndex(status: string, release: string): number {
  if (release === 'claimed') return 4;
  if (release === 'ready') return 3;
  if (status === 'approved') return 2;
  return 1;
}

function stageLabel(req: Pick<PublicTrackingStatus, 'status' | 'release'>): {
  text: string;
  tone: string;
} {
  if (req.status === 'rejected') return { text: 'Rejected', tone: 'text-bad' };
  if (req.release === 'claimed') return { text: 'Claimed', tone: 'text-ok' };
  if (req.release === 'ready') return { text: 'Ready for pick-up', tone: 'text-ok' };
  if (req.status === 'approved') return { text: 'Approved (Preparing)', tone: 'text-brand' };
  return { text: 'Under review', tone: 'text-wait' };
}

export function TrackView({ uid, initialTracking, onOpenAuth }: TrackViewProps) {
  const [trackingInput, setTrackingInput] = useState(initialTracking || '');
  const [result, setResult] = useState<PublicTrackingStatus | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [searching, setSearching] = useState(false);

  const [myRequests, setMyRequests] = useState<ClearanceRequest[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);

  useEffect(() => {
    if (initialTracking) {
      setTrackingInput(initialTracking);
      void runLookup(initialTracking);
    }
  }, [initialTracking]);

  useEffect(() => {
    if (!uid) {
      setMyRequests([]);
      return;
    }
    let active = true;
    setLoadingMine(true);
    listMyRequests(uid)
      .then((rows) => {
        if (active) setMyRequests(rows);
      })
      .catch(() => {
        // Ignore if unverified
      })
      .finally(() => {
        if (active) setLoadingMine(false);
      });
    return () => {
      active = false;
    };
  }, [uid]);

  async function runLookup(rawCode: string) {
    const code = normTracking(rawCode);
    setMsg(null);
    if (!/^CSHS-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      setResult(null);
      setMsg({ text: 'Enter a valid tracking number like CSHS-XXXX-XXXX.', ok: false });
      return;
    }

    setSearching(true);
    try {
      const found = await lookupPublicTracking(code);
      if (!found) {
        setResult(null);
        setMsg({ text: 'No request found for this tracking number.', ok: false });
      } else {
        setResult(found);
      }
    } catch (err) {
      setResult(null);
      setMsg({ text: extractReadableError(err), ok: false });
    } finally {
      setSearching(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runLookup(trackingInput);
  }

  return (
    <section aria-labelledby="track-heading">
      <h1 id="track-heading" className="font-serif text-3xl mb-1 text-balance">
        Track my request
      </h1>
      <p className="text-ink/70 mb-6">
        Enter the tracking number you got when you submitted your request. No account needed.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-ink/15 rounded-md p-5 mb-5"
      >
        <label htmlFor="track-no" className="block font-medium mb-1">
          Tracking number
        </label>
        <div className="flex gap-2">
          <input
            id="track-no"
            value={trackingInput}
            onChange={(e) => setTrackingInput(e.target.value.toUpperCase())}
            placeholder="CSHS-XXXX-XXXX"
            autoCapitalize="characters"
            className="flex-1 min-w-0 border border-ink/30 rounded px-3 py-2 uppercase tabular-nums"
          />
          <button
            type="submit"
            disabled={searching}
            className="bg-brand text-white px-4 py-2 rounded font-medium whitespace-nowrap disabled:opacity-60"
          >
            {searching ? 'Checking...' : 'Track'}
          </button>
        </div>
        {msg && (
          <p role="status" className={`text-sm mt-2 ${msg.ok ? 'text-ok' : 'text-bad'}`}>
            {msg.text}
          </p>
        )}
      </form>

      {result && (
        <div className="bg-white border border-ink/15 rounded-md p-5 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 pb-3 mb-4">
            <div>
              <p className="text-xs text-ink/60 tabular-nums">{result.tracking}</p>
              <h2 className="font-serif text-xl">{DOCS[result.doc]}</h2>
              <p className="text-sm text-ink/70">
                {PURPOSE[result.purpose]} &middot;{' '}
                {result.claimerType === 'rep' ? 'Representative pick-up' : 'Personal pick-up'}
              </p>
            </div>
            <span className={`font-medium text-sm ${stageLabel(result).tone}`}>
              {stageLabel(result).text}
            </span>
          </div>

          {result.status === 'rejected' ? (
            <div className="bg-bad/5 border border-bad/25 rounded p-4 text-sm">
              <p className="font-medium text-bad mb-1">Request rejected</p>
              <p className="text-ink/80">
                {result.reason || 'Please contact the Registrar’s Office for details.'}
              </p>
            </div>
          ) : (
            <ol className="space-y-2.5 text-sm">
              {STAGES.map(([key, label], index) => {
                const activeIdx = currentStageIndex(result.status, result.release);
                const done = index <= activeIdx;
                return (
                  <li key={key} className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full grid place-items-center text-xs font-medium shrink-0 tabular-nums ${
                        done
                          ? 'bg-brand text-white'
                          : 'border border-ink/25 text-ink/50 bg-paper/40'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className={done ? 'font-medium text-ink' : 'text-ink/55'}>{label}</span>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-4 pt-3 border-t border-ink/10 text-xs text-ink/60 tabular-nums">
            Submitted {formatTimestamp(result.createdAt)}
            {result.readyAt ? ` · Ready ${formatTimestamp(result.readyAt)}` : ''}
            {result.claimedAt ? ` · Claimed ${formatTimestamp(result.claimedAt)}` : ''}
          </div>
        </div>
      )}

      {/* Signed-in user's own requests */}
      <div className="bg-white border border-ink/15 rounded-md p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-serif text-xl">My submitted requests</h2>
          {!uid && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="text-sm font-medium text-brand underline whitespace-nowrap"
            >
              Sign in with Google to view your history
            </button>
          )}
        </div>

        {!uid ? (
          <p className="text-sm text-ink/65">
            Sign in with your Google account to automatically view every document request you have
            submitted.
          </p>
        ) : loadingMine ? (
          <p className="text-sm text-ink/65">Loading your requests...</p>
        ) : myRequests.length === 0 ? (
          <p className="text-sm text-ink/65">You have not submitted any requests yet.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {myRequests.map((req) => {
              const badge = stageLabel(req);
              return (
                <li
                  key={req.requestId}
                  className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {DOCS[req.doc]} &middot;{' '}
                      <span className="font-mono text-xs tabular-nums">{req.tracking}</span>
                    </p>
                    <p className="text-xs text-ink/60 tabular-nums">
                      {PURPOSE[req.purpose]} &middot; Submitted {formatTimestamp(req.createdAt)}
                    </p>
                    {req.status === 'rejected' && req.reason && (
                      <p className="text-xs text-bad mt-1">Reason: {req.reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-medium text-xs ${badge.tone}`}>{badge.text}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTrackingInput(req.tracking);
                        void runLookup(req.tracking);
                      }}
                      className="px-3 py-1 rounded border border-ink/25 text-xs font-medium hover:bg-paper whitespace-nowrap"
                    >
                      View progress
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
