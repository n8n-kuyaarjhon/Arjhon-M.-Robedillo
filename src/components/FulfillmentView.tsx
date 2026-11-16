import { useState } from 'react';
import { advanceRequestRelease, extractReadableError } from '../lib/firebase';
import { DOCS, formatTimestamp, purposeDisplay, type ClearanceRequest } from '../types';

interface FulfillmentViewProps {
  requests: ClearanceRequest[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onToast: (message: string, via?: string, kind?: 'info' | 'error') => void;
}

export function FulfillmentView({ requests, loading, onRefresh, onToast }: FulfillmentViewProps) {
  const [claimInputs, setClaimInputs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const approved = requests.filter((r) => r.status === 'approved');

  async function handleReady(req: ClearanceRequest) {
    setBusyId(req.requestId);
    try {
      await advanceRequestRelease(req.requestId, req.tracking, 'ready');
      onToast('Marked ready for pick-up.');
      await onRefresh();
    } catch (err) {
      onToast(extractReadableError(err), '', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function handleClaimed(req: ClearanceRequest) {
    const defaultClaimer = req.claimerType === 'rep' ? req.repName || '' : req.name;
    const claimedBy = (claimInputs[req.requestId] ?? defaultClaimer).trim();
    if (!claimedBy) {
      onToast('Type who claimed the document first.', '', 'error');
      return;
    }
    setBusyId(req.requestId);
    try {
      await advanceRequestRelease(req.requestId, req.tracking, 'claimed', claimedBy);
      onToast('Document released and marked claimed.');
      await onRefresh();
    } catch (err) {
      onToast(extractReadableError(err), '', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="ful-heading">
      <h1 id="ful-heading" className="font-serif text-3xl mb-1 text-balance">
        Pick-ups
      </h1>
      <p className="text-ink/70 mb-6 max-w-2xl">
        Approved requests appear here. Mark a request Ready for pick-up when the signed document is
        ready, then Claimed when it is released.
      </p>

      <div className="bg-white border border-ink/15 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-ink/15">
            <tr>
              <th className="p-3">Learner</th>
              <th className="p-3">Purpose</th>
              <th className="p-3">Who will claim</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-4 text-ink/60">
                  Loading approved requests...
                </td>
              </tr>
            ) : approved.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-ink/60">
                  No approved requests waiting for pick-up.
                </td>
              </tr>
            ) : (
              approved.map((req) => {
                const isRep = req.claimerType === 'rep';
                const statusLabel =
                  req.release === 'claimed'
                    ? 'Claimed'
                    : req.release === 'ready'
                      ? 'Ready for pick-up'
                      : 'Preparing';
                const defaultClaimer = isRep ? req.repName || '' : req.name;
                const claimValue = claimInputs[req.requestId] ?? defaultClaimer;

                return (
                  <tr key={req.requestId} className="border-b border-ink/10 align-top">
                    <td className="p-3 font-medium">
                      {req.name}
                      <span className="block text-xs font-normal text-ink/60 tabular-nums">
                        {DOCS[req.doc]} &middot; {req.tracking}
                      </span>
                    </td>
                    <td className="p-3">{purposeDisplay(req)}</td>
                    <td className="p-3">
                      {isRep ? (
                        <div>
                          <span className="font-medium">{req.repName}</span>
                          {req.relationship && (
                            <span className="block text-xs text-ink/60">
                              Representative ({req.relationship})
                            </span>
                          )}
                        </div>
                      ) : (
                        'Learner personally'
                      )}
                    </td>
                    <td className="p-3 font-medium">{statusLabel}</td>
                    <td className="p-3">
                      {req.release === 'claimed' ? (
                        <span className="text-ok text-xs tabular-nums">
                          Claimed by {req.claimedBy || 'the learner'}
                          {req.claimedAt ? ` · ${formatTimestamp(req.claimedAt)}` : ''}
                        </span>
                      ) : req.release === 'ready' ? (
                        <div>
                          {isRep && (
                            <span className="block text-xs text-wait mb-1">
                              Compare the photo with the person claiming, then check the signed
                              letter, the learner&rsquo;s ID copy and their {req.repIdType}.
                            </span>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <input
                              value={claimValue}
                              onChange={(e) =>
                                setClaimInputs((prev) => ({
                                  ...prev,
                                  [req.requestId]: e.target.value,
                                }))
                              }
                              placeholder="Claimed by (name)"
                              className="border border-ink/30 rounded px-2 py-1 w-44 text-sm"
                            />
                            <button
                              type="button"
                              disabled={busyId === req.requestId}
                              onClick={() => handleClaimed(req)}
                              className="px-3 py-1 rounded bg-brand text-white text-xs font-medium disabled:opacity-60 whitespace-nowrap"
                            >
                              Mark claimed
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === req.requestId}
                          onClick={() => handleReady(req)}
                          className="px-3 py-1 rounded bg-brand text-white text-xs font-medium disabled:opacity-60 whitespace-nowrap"
                        >
                          Mark ready for pick-up
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
