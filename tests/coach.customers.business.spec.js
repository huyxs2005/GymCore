const { test, expect } = require('@playwright/test')
const { loginViaUi } = require('./helpers/auth')
const { prepareCoachCustomersFlowState } = require('./helpers/sql')

const coachFlowCredentials = {
  email: 'coach.customers.coach@gymcore.local',
  password: 'Coach123456!',
}

const updatedProgress = {
  heightCm: '180',
  weightKg: '79',
}

const latestCoachNote = 'Session pacing improved and squat depth is more stable.'

test.describe.serial('coach customer management flows', () => {
  test.beforeEach(() => {
    prepareCoachCustomersFlowState()
  })

  test('coach reviews customers, updates progress, and manages notes', async ({ page }) => {
    await loginViaUi(page, coachFlowCredentials)

    await page.goto('/coach/customers')
    await expect(page.getByRole('heading', { name: 'Customer Management' })).toBeVisible()

    await page.getByRole('button', { name: /Coach Customers Customer/i }).first().click()
    await expect(page.getByText('coach.customers.customer@gymcore.local')).toBeVisible()

    await page.getByRole('button', { name: 'History' }).click()
    await expect(page.getByText(/Initial mobility assessment completed./i)).toHaveCount(0)
    await expect(page.getByText(/Slot 1:/i).first()).toBeVisible()

    await page.getByRole('button', { name: 'Progress' }).click()
    await page.getByPlaceholder('Example: 170').fill(updatedProgress.heightCm)
    await page.getByPlaceholder('Example: 65').fill(updatedProgress.weightKg)
    await page.getByRole('button', { name: /Save progress/i }).click()
    await expect(page.getByText('Progress updated successfully!')).toBeVisible()
    await page.getByRole('button', { name: 'Overview' }).click()
    await expect(page.getByText(updatedProgress.weightKg)).toBeVisible()

    await page.getByRole('button', { name: 'Notes' }).click()
    await page.locator('select').first().selectOption({ index: 1 })
    await page.getByPlaceholder(/Enter notes, meal guidance/i).fill('Session pacing improved after warm-up block.')
    await page.getByRole('button', { name: /Add note/i }).click()
    await expect(page.getByText('Note added successfully!')).toBeVisible()
    await expect(page.getByText('Session pacing improved after warm-up block.')).toBeVisible()

    const noteEditorTrigger = page.getByText('Session pacing improved after warm-up block.').locator('xpath=..').getByRole('button')
    await noteEditorTrigger.click()
    await page.locator('textarea').last().fill(latestCoachNote)
    await page.getByRole('button', { name: 'Save' }).last().click()
    await expect(page.getByText('Note updated successfully!')).toBeVisible()
    await expect(page.getByText(latestCoachNote)).toBeVisible()

    await page.locator('div.fixed.inset-0').getByRole('button').first().click()
    await page.getByRole('button', { name: /^Feedback/i }).click()
    await expect(page.getByText('Average rating')).toBeVisible()
    await expect(page.getByText('Very supportive coach.')).toBeVisible()
    await expect(page.getByText('Coach Customers Customer')).toBeVisible()
  })
})
