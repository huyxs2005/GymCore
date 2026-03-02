import { Toaster } from 'react-hot-toast'

function WorkspaceScaffold({ title, subtitle, children }) {
  return (
    <div className="bg-gym-dark-100/30 min-h-screen">
      <Toaster position="top-right" reverseOrder={false} />
      <main className="mx-auto max-w-7xl px-6 py-12">
        <section className="mb-10 gc-card p-10">
          <h1 className="text-3xl font-black text-gym-dark-900 tracking-tight">{title}</h1>
          <p className="mt-2 text-gym-dark-400 font-bold">{subtitle}</p>
        </section>
        <div className="space-y-8">
          {children}
        </div>
      </main>
    </div>
  )
}

export default WorkspaceScaffold
