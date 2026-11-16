export function AboutView() {
  return (
    <section aria-labelledby="about-heading">
      <h1 id="about-heading" className="font-serif text-3xl mb-1 text-balance">
        About us
      </h1>
      <p className="text-ink/70 mb-6 max-w-2xl">
        The Student Clearance Document Request System is the official way to request school records
        from Cabiao Senior High School, without lining up at the Registrar&rsquo;s Office.
      </p>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <div className="bg-white border border-ink/15 rounded-md p-5">
          <h2 className="font-serif text-xl mb-2">What this system is for</h2>
          <p className="text-sm leading-relaxed">
            Current students and alumni can request Form 137 / SF10, Good Moral Certificates, School
            Clearances and Report Cards online. Each request has a purpose: employment (local or
            abroad), university, military or other. Employment needs only your valid ID as evidence.
            For a university you give its name, and for the military you upload proof from the
            office or unit. The Registrar&rsquo;s Office reviews it before release.
          </p>
        </div>
        <div className="bg-white border border-ink/15 rounded-md p-5">
          <h2 className="font-serif text-xl mb-2">Getting your document</h2>
          <p className="text-sm leading-relaxed">
            Every request gets a tracking number as soon as you submit it. Use it in Track my
            request to see if it is on-going or ready for pick-up, then claim your signed document
            at the Registrar&rsquo;s Office.
          </p>
        </div>
      </div>

      <div className="bg-white border border-ink/15 rounded-md p-5 mb-5">
        <h2 className="font-serif text-xl mb-3">How a request moves</h2>
        <ol className="space-y-3 text-sm">
          <li>
            <b>You submit.</b> Enter your LRN, choose a document and pick the purpose. For
            employment you upload your valid ID as evidence. For a university you give its name and
            upload proof, and for the military you upload proof from the office or unit. You get
            your tracking number right away.
          </li>
          <li>
            <b>The Registrar reviews.</b> The Registrar checks your uploaded documents, then approves
            the request or rejects it with a reason you can fix.
          </li>
          <li>
            <b>You get notified.</b> Every update about your request (approved, rejected with the
            reason, ready for pick-up) is linked to your verified Gmail and visible anytime in Track
            my request. When it is ready, pick it up at the Registrar&rsquo;s Office.
          </li>
        </ol>
      </div>

      <div className="bg-white border border-ink/15 rounded-md p-5">
        <h2 className="font-serif text-xl mb-3">Contact the Registrar&rsquo;s Office</h2>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-ink/60">Office</dt>
            <dd className="font-medium">Registrar&rsquo;s Office, Cabiao Senior High School</dd>
          </div>
          <div>
            <dt className="text-ink/60">Office hours</dt>
            <dd className="font-medium text-ink/70">Monday – Friday, 8:00 AM – 5:00 PM</dd>
          </div>
          <div>
            <dt className="text-ink/60">Portal</dt>
            <dd className="font-medium">CSHS Student Clearance Document Request System</dd>
          </div>
          <div>
            <dt className="text-ink/60">Location</dt>
            <dd className="font-medium">Cabiao, Nueva Ecija</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
