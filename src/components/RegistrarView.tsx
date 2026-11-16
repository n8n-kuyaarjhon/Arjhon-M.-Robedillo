import { useState } from 'react';
import {
  decideClearanceRequest,
  extractReadableError,
  markRequestIdVerified,
  setRequestAuthCheck,
} from '../lib/firebase';
import { DOCS, formatTimestamp, purposeDisplay, type ClearanceRequest } from '../types';
import { AuthorizationLetter } from './AuthorizationLetter';

interface RegistrarViewProps {
  requests: ClearanceRequest[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onToast: (message: string, via?: string, kind?: 'info' | 'error') => void;
}

const REJECT_REASONS = [
  'Documents are invalid',
  'Authorization not found',
  'Invalid ID',
  'Missing or invalid proof of request',
  'Unpaid balance',
  'Missing clearance',
];

function FilePreview({ url, mime, label }: { url?: string; mime?: string; label: string }) {
  if (!url) return null;
  if (mime === 'application/pdf') {
    return (
      <div className="space-y-2">
        <object data={url} type="application/pdf" className="w-full h-72 rounded">
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-brand">
            Open the PDF
          </a>
        </object>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs underline text-brand"
        >
          Open {label} in new tab
        </a>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={label}
      referrerPolicy="no-referrer"
      className="max-h-72 max-w-full object-contain mx-auto rounded"
    />
  );
}

export function RegistrarView({ requests, loading, onRefresh, onToast }: RegistrarViewProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [approveAfterView, setApproveAfterView] = useState(false);
  const [rejectingReq, setRejectingReq] = useState<ClearanceRequest | null>(null);
  const [reasonSelect, setReasonSelect] = useState(REJECT_REASONS[0]);
  const [reasonText, setReasonText] = useState('');
  const [modalErr, setModalErr] = useState('');
  const [busy, setBusy] = useState(false);

  const viewingReq = requests.find((r) => r.requestId === viewingId) || null;
  const filtered =
    filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  async function handleApprove(req: ClearanceRequest) {
    const isRep = req.claimerType === 'rep';
    if (!req.idVerified || (isRep && req.authCheck !== 'correct')) {
      setViewingId(req.requestId);
      setApproveAfterView(true);
      return;
    }
    setBusy(true);
    try {
      await decideClearanceRequest(req.requestId, req.tracking, 'approved');
      onToast('Request approved.');
      await onRefresh();
    } catch (err) {
      onToast(extractReadableError(err), '', 'error');
    } finally {
      setBusy(false);
    }
  }

  function openReject(req: ClearanceRequest, defaultReason?: string) {
    setRejectingReq(req);
    setReasonSelect(defaultReason && REJECT_REASONS.includes(defaultReason) ? defaultReason : REJECT_REASONS[0]);
    setReasonText('');
    setModalErr('');
  }

  async function confirmReject() {
    if (!rejectingReq) return;
    const reason = [reasonSelect, reasonText.trim()].filter(Boolean).join(' — ');
    if (!reason) {
      setModalErr('Give a reason so the student knows what to fix.');
      return;
    }
    setBusy(true);
    try {
      await decideClearanceRequest(rejectingReq.requestId, rejectingReq.tracking, 'rejected', reason);
      setRejectingReq(null);
      onToast('Request rejected.');
      await onRefresh();
    } catch (err) {
      onToast(extractReadableError(err), '', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSetAuthCheck(req: ClearanceRequest, value: 'correct' | 'not_found') {
    try {
      await setRequestAuthCheck(req.requestId, value);
      await onRefresh();
    } catch (err) {
      onToast(extractReadableError(err), '', 'error');
    }
  }

  async function handleMarkDocsOk(req: ClearanceRequest) {
    if (req.claimerType === 'rep') {
      if (req.authCheck === 'not_found') {
        setViewingId(null);
        openReject(req, 'Authorization not found');
        return;
      }
      if (!req.authCheck) {
        onToast(
          'Check the authorization first: choose Authorization is correct or Not found.',
          '',
          'error',
        );
        return;
      }
    }

    setBusy(true);
    try {
      if (!req.idVerified) {
        await markRequestIdVerified(req.requestId);
      }
      const shouldApprove = approveAfterView;
      setViewingId(null);
      setApproveAfterView(false);
      if (shouldApprove) {
        await decideClearanceRequest(req.requestId, req.tracking, 'approved');
        onToast('Documents verified and request approved.');
      } else {
        onToast('Documents marked as correct.');
      }
      await onRefresh();
    } catch (err) {
      onToast(extractReadableError(err), '', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="registrar-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 id="registrar-heading" className="font-serif text-3xl mb-1 text-balance">
            Registrar review
          </h1>
          <p className="text-ink/70 max-w-3xl">
            Pressing Approve opens the uploaded documents for a quick check, then approves. You can
            also open View documents any time.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-white border border-ink/15 rounded-md">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((statusKey) => (
            <button
              key={statusKey}
              type="button"
              onClick={() => setFilter(statusKey)}
              className={`px-3 py-1.5 text-xs font-medium rounded capitalize transition-colors whitespace-nowrap shrink-0 ${
                filter === statusKey ? 'bg-brand text-white' : 'text-ink/70 hover:bg-paper'
              }`}
            >
              {statusKey}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-ink/15 rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-ink/15">
            <tr>
              <th className="p-3">Learner</th>
              <th className="p-3">Document</th>
              <th className="p-3">Purpose</th>
              <th className="p-3">Who will claim</th>
              <th className="p-3">Documents</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-4 text-ink/60">
                  Loading requests...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-ink/60">
                  No document requests in this view.
                </td>
              </tr>
            ) : (
              filtered.map((req) => {
                const isRep = req.claimerType === 'rep';
                return (
                  <tr key={req.requestId} className="border-b border-ink/10 align-top">
                    <td className="p-3">
                      <div className="font-medium">{req.name}</div>
                      <div className="text-xs text-ink/60 tabular-nums">
                        {req.lrn ? `LRN ${req.lrn}` : 'Manual record'} &middot; {req.tracking}
                      </div>
                      <div className="text-xs text-ink/60">{req.email}</div>
                    </td>
                    <td className="p-3">
                      <div>{DOCS[req.doc]}</div>
                      <div className="text-xs text-ink/60 tabular-nums">
                        {formatTimestamp(req.createdAt)}
                      </div>
                    </td>
                    <td className="p-3">{purposeDisplay(req)}</td>
                    <td className="p-3">
                      {isRep ? (
                        <div>
                          <span className="font-medium">{req.repName}</span>
                          {req.relationship && (
                            <span className="block text-xs text-ink/60">({req.relationship})</span>
                          )}
                        </div>
                      ) : (
                        'Self'
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setViewingId(req.requestId);
                          setApproveAfterView(false);
                        }}
                        className="px-3 py-1 rounded border border-ink/30 hover:bg-paper text-xs font-medium whitespace-nowrap"
                      >
                        View documents
                      </button>
                      {req.idVerified && (
                        <span className="block text-xs text-ok mt-1">Checked</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`font-medium capitalize ${
                          req.status === 'approved'
                            ? 'text-ok'
                            : req.status === 'rejected'
                              ? 'text-bad'
                              : 'text-wait'
                        }`}
                      >
                        {req.status}
                      </span>
                      {req.reason && (
                        <span className="block text-xs text-ink/60 max-w-44">{req.reason}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {req.status === 'pending' ? (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleApprove(req)}
                            className="px-3 py-1 rounded bg-ok text-white text-xs font-medium disabled:opacity-60 whitespace-nowrap"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openReject(req)}
                            className="px-3 py-1 rounded border border-bad text-bad text-xs font-medium disabled:opacity-60 whitespace-nowrap"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-ink/50">Reviewed</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Check the documents modal */}
      {viewingReq && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="id-modal-title"
        >
          <div className="bg-white rounded-md p-5 w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <h2 id="id-modal-title" className="font-serif text-xl mb-1">
              Check the documents
            </h2>
            <p className="text-sm text-ink/70 mb-4 tabular-nums">
              {viewingReq.name} &middot; {DOCS[viewingReq.doc]} &middot; {viewingReq.tracking}
            </p>

            <div className="space-y-4 mb-4">
              {viewingReq.idFileUrl && (
                <div>
                  <p className="text-sm font-medium mb-1">
                    Government ID: {viewingReq.idType || 'not stated'} (evidence for employment)
                  </p>
                  <div className="border border-ink/15 rounded bg-paper p-2">
                    <FilePreview
                      url={viewingReq.idFileUrl}
                      mime={viewingReq.idFileMime}
                      label="Government ID"
                    />
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium">Purpose: {purposeDisplay(viewingReq)}</p>
              </div>

              {viewingReq.proofFileUrl && (
                <div>
                  <p className="text-sm font-medium mb-1">Proof of request</p>
                  <div className="border border-ink/15 rounded bg-paper p-2">
                    <FilePreview
                      url={viewingReq.proofFileUrl}
                      mime={viewingReq.proofFileMime}
                      label="Proof of request"
                    />
                  </div>
                </div>
              )}

              {!viewingReq.idFileUrl && !viewingReq.proofFileUrl && (
                <p className="text-sm text-ink/60">
                  No uploaded files are needed for this purpose. Check that the details match the
                  learner.
                </p>
              )}

              {viewingReq.claimerType === 'rep' ? (
                <div>
                  <p className="text-sm font-medium">Who will claim: {viewingReq.repName}</p>
                  <p className="text-xs text-ink/60">
                    Authorization letter, filled up online by the learner. Check the signed printed
                    copy and the IDs when the document is claimed.
                  </p>
                  {viewingReq.photoFileUrl && (
                    <div className="border border-ink/15 rounded bg-paper p-2 mt-2">
                      <p className="text-xs font-medium mb-1">
                        Photo of the person who will claim
                      </p>
                      <img
                        src={viewingReq.photoFileUrl}
                        alt={`Photo of ${viewingReq.repName || 'representative'}`}
                        referrerPolicy="no-referrer"
                        className="max-h-56 max-w-full object-contain mx-auto rounded"
                      />
                    </div>
                  )}

                  <AuthorizationLetter request={viewingReq} showFullLrn />

                  {viewingReq.status === 'pending' ? (
                    <div className="mt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">Check the authorization:</span>
                        <button
                          type="button"
                          onClick={() => handleSetAuthCheck(viewingReq, 'correct')}
                          className={`px-3 py-1 rounded border text-xs font-medium whitespace-nowrap ${
                            viewingReq.authCheck === 'correct'
                              ? 'bg-ok text-white border-ok'
                              : 'border-ink/30'
                          }`}
                        >
                          Authorization is correct
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAuthCheck(viewingReq, 'not_found')}
                          className={`px-3 py-1 rounded border text-xs font-medium whitespace-nowrap ${
                            viewingReq.authCheck === 'not_found'
                              ? 'bg-bad text-white border-bad'
                              : 'border-ink/30'
                          }`}
                        >
                          Not found
                        </button>
                      </div>
                      <p className="text-xs text-ink/60 mt-1">
                        Choose Not found if the letter or the photo is missing or cannot be seen.
                      </p>
                    </div>
                  ) : (
                    viewingReq.authCheck && (
                      <p
                        className={`mt-2 text-sm ${
                          viewingReq.authCheck === 'correct' ? 'text-ok' : 'text-bad'
                        }`}
                      >
                        Authorization:{' '}
                        {viewingReq.authCheck === 'correct'
                          ? 'Authorization is correct'
                          : 'Not found'}
                      </p>
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink/70">
                  The learner will claim the document personally.
                </p>
              )}
            </div>

            {approveAfterView ? (
              <p className="text-sm text-ok mb-2">Check the documents, then approve this request.</p>
            ) : (
              viewingReq.idVerified && (
                <p className="text-sm text-ok mb-2">You marked these documents as correct.</p>
              )
            )}

            <p className="text-sm mb-3">
              Do the documents look valid, and do they match the learner and the request?
            </p>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setViewingId(null);
                  setApproveAfterView(false);
                }}
                className="px-4 py-2 rounded border border-ink/30 text-sm whitespace-nowrap"
              >
                Close
              </button>
              {viewingReq.status === 'pending' && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const target = viewingReq;
                      setViewingId(null);
                      openReject(target, 'Documents are invalid');
                    }}
                    className="px-4 py-2 rounded border border-bad text-bad text-sm whitespace-nowrap"
                  >
                    Documents are invalid
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleMarkDocsOk(viewingReq)}
                    className="px-4 py-2 rounded bg-ok text-white font-medium text-sm disabled:opacity-60 whitespace-nowrap"
                  >
                    {approveAfterView
                      ? viewingReq.idVerified
                        ? 'Approve this request'
                        : 'Documents are correct. Approve'
                      : 'Documents are correct'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject request modal */}
      {rejectingReq && (
        <div
          className="fixed inset-0 z-[60] bg-ink/60 grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
        >
          <div className="bg-white rounded-md p-6 w-full max-w-md">
            <h2 id="reject-modal-title" className="font-serif text-xl mb-3">
              Reject this request
            </h2>
            <label htmlFor="reason-select" className="block text-sm font-medium mb-1">
              Reason for rejection
            </label>
            <select
              id="reason-select"
              value={reasonSelect}
              onChange={(e) => setReasonSelect(e.target.value)}
              className="w-full border border-ink/30 rounded px-3 py-2 mb-3"
            >
              {REJECT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="">Other (type below)</option>
            </select>
            <textarea
              rows={3}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Add details for the student (optional)"
              className="w-full border border-ink/30 rounded px-3 py-2"
            />
            <p className="text-xs text-ink/60 mt-1">
              The student sees this reason in Track my request.
            </p>
            {modalErr && (
              <p role="alert" className="text-bad text-sm mt-1">
                {modalErr}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setRejectingReq(null)}
                className="px-4 py-2 rounded border border-ink/30 text-sm whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmReject}
                className="px-4 py-2 rounded bg-bad text-white font-medium text-sm disabled:opacity-60 whitespace-nowrap"
              >
                {busy ? 'Rejecting...' : 'Reject request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
