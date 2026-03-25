import AppRouter from './routes/AppRouter'
import AppShell from './components/frame/AppShell'

function App() {
  return (
    <AppShell>
      <AppRouter />
    </AppShell>
  )
}

export default App
