import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-8">
        <h1 className="text-9xl font-black text-gym-dark-100 tracking-tighter absolute -z-10 opacity-50 select-none">404</h1>
        <h2 className="text-5xl font-black text-gym-dark-900 tracking-tight mt-12 relative">Lost in the Gym?</h2>
      </div>
      <p className="text-gym-dark-400 font-bold text-lg mb-10 max-w-md">
        The page you're looking for doesn't exist or has been moved to another level.
      </p>
      <Link
        to="/"
        className="btn-primary px-10 py-4 text-lg"
      >
        Back to Transformation
      </Link>
    </section>
  )
}

export default NotFoundPage
