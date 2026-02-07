import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold text-slate-900">404</h1>
      <p className="mt-2 text-sm text-slate-600">Trang ban tim khong ton tai.</p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-gym-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gym-700"
      >
        Quay ve trang chu
      </Link>
    </section>
  )
}

export default NotFoundPage
