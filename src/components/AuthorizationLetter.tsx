import { DOCS, type ClearanceRequest } from '../types';

interface AuthorizationLetterProps {
  request: Pick<
    ClearanceRequest,
    'name' | 'lrn' | 'doc' | 'tracking' | 'claimerType' | 'repName' | 'relationship' | 'repIdType' | 'repPhone' | 'repReason' | 'signedName' | 'signedAt'
  >;
  showFullLrn?: boolean;
}

export function AuthorizationLetter({ request, showFullLrn = true }: AuthorizationLetterProps) {
  const isRep = request.claimerType === 'rep';
  const formattedDay =
    isRep && request.signedAt
      ? new Date(request.signedAt).toLocaleDateString([], {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '____________________';
  const lrnDisplay = showFullLrn ? request.lrn || 'not provided' : request.lrn ? `••••••••${request.lrn.slice(-4)}` : 'not provided';

  return (
    <div className="mt-3 bg-white border border-ink/30 rounded p-5 font-serif text-sm leading-relaxed">
      <p className="text-center font-bold mb-3">AUTHORIZATION LETTER</p>
      <p className="text-right mb-3">Date: {formattedDay}</p>
      <p>
        To the Registrar,
        <br />
        Cabiao Senior High School
      </p>
      <p className="mt-3">
        I, <b>{request.name}</b> (LRN <span className="tabular-nums">{lrnDisplay}</span>), authorize{' '}
        {isRep && request.repName ? (
          <b>{request.repName}</b>
        ) : (
          <span className="inline-block border-b border-ink min-w-[12rem]">&nbsp;</span>
        )}
        {isRep && request.relationship ? ` (my ${request.relationship})` : ''} to claim my{' '}
        <b>{DOCS[request.doc]}</b> (Tracking No.{' '}
        <b className="tabular-nums">{request.tracking || '____________'}</b>)
        {isRep && request.repReason ? ` because ${request.repReason}` : ''}.
      </p>
      <p className="mt-3">
        My representative will show{' '}
        {isRep && request.repIdType ? (
          <>
            their <b>{request.repIdType}</b>
          </>
        ) : (
          'their valid ID'
        )}
        {isRep && request.repPhone ? ` and can be reached at ${request.repPhone}` : ''}. A photocopy of
        my valid ID is attached, and their photo with their valid ID is included in the uploaded
        request file (they will bring that exact same ID when claiming).
      </p>
      <div className="mt-8 w-64">
        {isRep && request.signedName ? (
          <div className="h-8 border-b border-ink font-serif italic text-lg">{request.signedName}</div>
        ) : (
          <div className="border-b border-ink h-8" />
        )}
        <p className="text-xs mt-1 font-sans">Signature over printed name of the learner</p>
      </div>
      <p className="text-xs text-ink/60 mt-4 font-sans">
        {isRep
          ? 'Filled up online. Print it and sign it by hand before it is claimed, and bring the exact ID included in the uploaded photo.'
          : 'Sample letter.'}
      </p>
    </div>
  );
}
