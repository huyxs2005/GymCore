const { test, expect } = require('@playwright/test')
const { loginViaUi } = require('./helpers/auth')
const { prepareCoachCustomersFlowState } = require('./helpers/sql')

const coachFlowCredentials = {
  email: 'progress.hub.flow.coach@gymcore.local',
  password: 'Coach123456!',
}

const customerFlowCredentials = {
  email: 'progress.hub.flow.customer@gymcore.local',
  password: 'Customer123456!',
}

const updatedProgress = {
  heightCm: '180',
  weightKg: '79',
  bmi: '24.4',
}

const latestCoachNote = 'Session pacing improved and squat depth is more stable.'

test.describe.serial('customer progress hub flows', () => {
  test.setTimeout(60000)

  test.beforeEach(() => {
    prepareCoachCustomersFlowState({
      scope: 'progress.hub.flow',
      coachName: 'Progress Hub Coach',
      customerName: 'Progress Hub Customer',
      coachPhone: '0988555001',
      customerPhone: '0988666001',
    })
  })

  test('customer sees the latest coach-authored progress and note in the progress hub', async ({ browser }) => {
    const coachContext = await browser.newContext()
    const customerContext = await browser.newContext()
    const coachPage = await coachContext.newPage()
    const customerPage = await customerContext.newPage()

    try {
      await loginViaUi(coachPage, coachFlowCredentials)
      await loginViaUi(customerPage, customerFlowCredentials)

      await coachPage.goto('/coach/customers')
      await expect(coachPage.getByRole('heading', { name: 'Customer Management' })).toBeVisible()
      await coachPage.getByRole('button', { name: /Progress Hub Customer/i }).first().click()

      await coachPage.getByRole('button', { name: 'Progress', exact: true }).click()
      await coachPage.getByPlaceholder('Example: 170').fill(updatedProgress.heightCm)
      await coachPage.getByPlaceholder('Example: 65').fill(updatedProgress.weightKg)
      await coachPage.getByRole('button', { name: /Save progress/i }).click()
      await expect(coachPage.getByText('Progress updated successfully!')).toBeVisible()

      await coachPage.getByRole('button', { name: 'Notes' }).click()
      await coachPage.locator('select').first().selectOption({ index: 1 })
      await coachPage.getByPlaceholder(/Enter notes, meal guidance/i).fill(latestCoachNote)
      await coachPage.getByRole('button', { name: /Add note/i }).click()
      await expect(coachPage.getByText('Note added successfully!')).toBeVisible()

      await customerPage.goto('/customer/progress-hub')
      await expect(customerPage.getByRole('heading', { name: 'Progress Hub' })).toBeVisible()
      await expect(customerPage.getByText('One place for your current progress and PT follow-up')).toBeVisible()
      await expect(customerPage.getByText('Latest coach note')).toBeVisible()
      await expect(customerPage.getByText(latestCoachNote).first()).toBeVisible()
      await expect(customerPage.getByText('Progress Hub Coach').first()).toBeVisible()
      await expect(customerPage.getByText(`${updatedProgress.weightKg}.0 kg`).first()).toBeVisible()
      await expect(customerPage.getByText(`${updatedProgress.heightCm}.0 cm`).first()).toBeVisible()
      await expect(customerPage.getByText(updatedProgress.bmi).first()).toBeVisible()
      await expect(customerPage.getByText(/completed \/ \d+ remaining PT sessions/i)).toBeVisible()
      await expect(customerPage.getByRole('link', { name: 'Check-in utilities' })).toHaveAttribute('href', '/customer/checkin-health')
      await expect(customerPage.getByRole('link', { name: 'Open PT dashboard' })).toHaveAttribute('href', '/customer/coach-booking')

      await customerPage.goto('/customer/checkin-health')
      await expect(customerPage.getByRole('heading', { name: 'Check-in & Health Log' })).toBeVisible()
      await expect(customerPage.getByRole('link', { name: 'Open Progress Hub' })).toHaveAttribute('href', '/customer/progress-hub')
    } finally {
      await coachContext.close()
      await customerContext.close()
    }
  })
})
