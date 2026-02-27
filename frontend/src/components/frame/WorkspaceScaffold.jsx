import { Toaster } from 'react-hot-toast'

function WorkspaceScaffold({ title, subtitle, children }) {
  return (
    <div className="bg-slate-50">
      <Toaster position="top-right" reverseOrder={false} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="mb-6 rounded-2xl border border-gym-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </section>
        {children}
      </main>
    </div>
  )
}

export default WorkspaceScaffold
