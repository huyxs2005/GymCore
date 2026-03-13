const { test, expect } = require('@playwright/test')
const { credentialsByRole } = require('./helpers/auth')
const { prepareCustomerAiPlanningState, prepareCustomerCommerceState } = require('./helpers/sql')

test.use({ storageState: credentialsByRole.customer.storageState })

test.describe.serial('customer ai weekly planning flows', () => {
  test.beforeEach(() => {
    prepareCustomerCommerceState()
    prepareCustomerAiPlanningState()
  })

  test('shows weekly guidance, exposes real action bridges, and forwards bounded AI actions', async ({ page }) => {
    let chatPayload = null
    await page.route('**/api/v1/ai/chat', async (route) => {
      chatPayload = JSON.parse(route.request().postData() || '{}')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            reply: 'Tap trung 2 buoi suc manh, theo doi Progress Hub, va neu qua tai thi mo PT booking.',
          },
        }),
      })
    })

    await page.goto('/customer/knowledge')

    await expect(page.getByText('Saved fitness goals')).toBeVisible()
    await expect(page.getByText(/Saved goals:/i)).toContainText(/GAIN_MUSCLE|LOSE_FAT/i)

    await page.getByRole('button', { name: 'Recommend from saved goals' }).click()
    await page.getByRole('button', { name: 'Build my weekly plan' }).click()

    await expect(page.getByText('Recommendation brief')).toBeVisible()
    await expect(page.getByText('Mini weekly plan')).toBeVisible()
    await expect(page.getByText('Scope guardrails')).toBeVisible()
    await expect(page.getByText(/This weekly plan does not replace medical advice/i)).toBeVisible()

    await page.getByRole('button', { name: 'Open AI chat' }).click()
    await expect(page.getByText('Quick actions')).toBeVisible()
    const quickActionsCard = page.getByText('Quick actions').locator('..')
    await expect(quickActionsCard.getByRole('button', { name: 'Review latest progress signals' })).toBeVisible()
    await expect(quickActionsCard.getByRole('button', { name: 'Get coach support if the week feels overloaded' })).toBeVisible()

    await quickActionsCard.getByRole('button', { name: 'Review latest progress signals' }).click()
    await expect(page).toHaveURL(/\/customer\/progress-hub$/)
    await expect(page.getByRole('heading', { name: 'Progress Hub' })).toBeVisible()

    await page.goto('/customer/knowledge')
    await page.getByRole('button', { name: 'Recommend from saved goals' }).click()
    await page.getByRole('button', { name: 'Build my weekly plan' }).click()
    await expect(page.getByText('Recommendation brief')).toBeVisible()
    await expect(page.getByText('Mini weekly plan')).toBeVisible()

    await page.getByRole('button', { name: 'Open AI chat' }).click()
    await page.getByText('Quick actions').locator('..').getByRole('button', { name: 'Open detail' }).first().click()
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible()
    await page.getByRole('button', { name: 'Close AI chat' }).click()

    await page.getByRole('button', { name: 'Open AI chat' }).click()
    await page.locator('input').last().fill('Tuan nay toi nen uu tien gi?')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByText(/Tap trung 2 buoi suc manh/i)).toBeVisible()

    expect(chatPayload?.context?.availableActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ route: '/customer/progress-hub', label: 'Review latest progress signals' }),
        expect.objectContaining({ route: '/customer/coach-booking', label: 'Get coach support if the week feels overloaded' }),
      ]),
    )
    expect(
      (chatPayload?.context?.availableActions || []).some((action) =>
        /^\/customer\/knowledge\/(workouts|foods)\/\d+$/.test(String(action.route || '')),
      ),
    ).toBe(true)

    await page.getByText('Quick actions').locator('..').getByRole('button', { name: 'Get coach support if the week feels overloaded' }).click()
    await expect(page).toHaveURL(/\/customer\/coach-booking$/)
    await expect(page.getByRole('heading', { name: 'Coach Booking' })).toBeVisible()
  })
})
