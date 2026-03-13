const { test } = require('@playwright/test')
const { credentialsByRole, ensureAuthDirectory, loginViaUi } = require('./helpers/auth')

test('create shared storage states', async ({ browser }) => {
  ensureAuthDirectory()

  for (const credentials of Object.values(credentialsByRole)) {
    const context = await browser.newContext()
    const page = await context.newPage()
    try {
      await loginViaUi(page, credentials)
      await context.storageState({ path: credentials.storageState })
    } finally {
      await context.close()
    }
  }
})
