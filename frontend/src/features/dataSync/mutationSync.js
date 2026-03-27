export const GLOBAL_MUTATION_SYNC_EVENT = 'gymcore:mutation-sync'
const GLOBAL_MUTATION_SYNC_STORAGE_KEY = 'gymcore:mutation-sync'

function buildSyncPayload(detail = {}) {
  return {
    timestamp: Date.now(),
    ...detail,
  }
}

export function broadcastMutationSync(detail = {}) {
  if (typeof window === 'undefined') {
    return
  }

  const payload = buildSyncPayload(detail)
  const serialized = JSON.stringify(payload)

  try {
    window.localStorage.setItem(GLOBAL_MUTATION_SYNC_STORAGE_KEY, serialized)
  } catch {
    // Ignore localStorage failures; in-tab dispatch still keeps the UI current.
  }

  window.dispatchEvent(new CustomEvent(GLOBAL_MUTATION_SYNC_EVENT, { detail: payload }))
}

export function attachQueryClientMutationSync(queryClient) {
  if (typeof window === 'undefined' || !queryClient) {
    return () => {}
  }

  let invalidateTimer = null

  const invalidateAllQueries = () => {
    if (invalidateTimer != null) {
      window.clearTimeout(invalidateTimer)
    }
    invalidateTimer = window.setTimeout(() => {
      queryClient.invalidateQueries()
      invalidateTimer = null
    }, 50)
  }

  const handleWindowEvent = () => {
    invalidateAllQueries()
  }

  const handleStorageEvent = (event) => {
    if (event.key === GLOBAL_MUTATION_SYNC_STORAGE_KEY) {
      invalidateAllQueries()
    }
  }

  window.addEventListener(GLOBAL_MUTATION_SYNC_EVENT, handleWindowEvent)
  window.addEventListener('storage', handleStorageEvent)

  return () => {
    if (invalidateTimer != null) {
      window.clearTimeout(invalidateTimer)
    }
    window.removeEventListener(GLOBAL_MUTATION_SYNC_EVENT, handleWindowEvent)
    window.removeEventListener('storage', handleStorageEvent)
  }
}
