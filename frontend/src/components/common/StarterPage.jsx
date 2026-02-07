function StarterPage({ title, subtitle, notes, endpoints, frontendFiles, backendFiles }) {
  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        {notes ? (
          <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{notes}</p>
        ) : null}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">API Endpoints To Implement</h3>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {endpoints.map((endpoint) => (
            <li key={endpoint} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 font-mono">
              {endpoint}
            </li>
          ))}
        </ul>
      </article>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Frontend Files</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {frontendFiles.map((file) => (
              <li key={file} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 font-mono">
                {file}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Backend Files</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {backendFiles.map((file) => (
              <li key={file} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 font-mono">
                {file}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}

export default StarterPage
