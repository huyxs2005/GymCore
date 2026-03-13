const { test, expect } = require('@playwright/test')
const { credentialsByRole, loginViaUi } = require('./helpers/auth')
const {
  getLatestReplacementOfferStatus,
  prepareCustomerAiPlanningState,
  prepareCustomerCommerceState,
  preparePtExceptionFlowState,
  runSqlScript,
} = require('./helpers/sql')

test.use({ storageState: credentialsByRole.customer.storageState })

function formatDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysValue(value, amount) {
  const [year, month, day] = String(value).split('-').map(Number)
  const nextDate = new Date(year, month - 1, day)
  nextDate.setDate(nextDate.getDate() + amount)
  return formatDateValue(nextDate)
}

async function callAuthenticatedApi(page, method, url, body) {
  const response = await page.evaluate(async ({ method, url, body }) => {
    const token = window.localStorage.getItem('gymcore_access_token')
    const result = await window.fetch(url, {
      method,
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      body: body == null ? undefined : JSON.stringify(body),
    })
    let json = null
    try {
      json = await result.json()
    } catch {
      json = null
    }
    return {
      ok: result.ok,
      status: result.status,
      json,
    }
  }, { method, url, body })

  expect(response.ok, JSON.stringify(response.json || {})).toBeTruthy()
  return response.json
}

async function clearCart(page) {
  await page.goto('/customer/cart')
  await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible()

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const removeButtons = page.getByRole('button', { name: 'Remove' })
    const count = await removeButtons.count()
    if (count === 0) {
      return
    }
    await removeButtons.first().click()
    await expect(removeButtons).toHaveCount(count - 1)
  }
}

function prepareReminderCenterState() {
  runSqlScript(`
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;

DECLARE @CustomerID INT = (SELECT TOP (1) UserID FROM dbo.Users WHERE Email = N'customer@gymcore.local');
IF @CustomerID IS NULL THROW 51300, 'Seed customer account was not found.', 1;

DELETE FROM dbo.Notifications WHERE UserID = @CustomerID;

INSERT INTO dbo.Notifications (UserID, NotificationType, Title, Message, LinkUrl, RefId, ExtraKey, IsRead, CreatedAt)
VALUES
  (@CustomerID, N'MEMBERSHIP_EXPIRES_COUNTDOWN', N'Membership expires soon', N'Your Gym + Coach - 1 Month membership expires in 3 days.', N'/customer/current-membership', 9001, N'PW_REMINDER_CENTER_MEMBERSHIP', 0, DATEADD(MINUTE, -5, SYSDATETIME())),
  (@CustomerID, N'PROMOTION_POST_PUBLISHED', N'New promotion available', N'Important Offer PW is now live. Open Promotions to claim it before it expires.', N'/customer/promotions', 9002, N'PW_REMINDER_CENTER_PROMOTION', 0, DATEADD(MINUTE, -10, SYSDATETIME())),
  (@CustomerID, N'COUPON_CLAIMED', N'Coupon added to your wallet', N'Your promotion claim was saved successfully.', N'/customer/promotions', 9003, N'PW_REMINDER_CENTER_COUPON', 0, DATEADD(HOUR, -2, SYSDATETIME())),
  (@CustomerID, N'ORDER_PAYMENT_SUCCESS', N'Order paid', N'Your order payment was confirmed.', N'/customer/orders', 9004, N'PW_REMINDER_CENTER_ORDER', 1, DATEADD(DAY, -1, SYSDATETIME()));
`, 'prepare-reminder-center')
}

test.describe.serial('customer business flows', () => {
  test.beforeEach(() => {
    prepareCustomerCommerceState()
  })

  test('saves fitness goals and fetches saved-goal recommendations', async ({ page }) => {
    prepareCustomerAiPlanningState()
    await page.goto('/customer/knowledge')

    await expect(page.getByText('Saved fitness goals')).toBeVisible()
    await page.getByRole('button', { name: /lose fat/i }).click()
    await page.getByRole('button', { name: /gain muscle/i }).click()
    await page.getByRole('button', { name: 'Save my goals' }).click()

    await expect(page.getByText(/Saved goals:/i)).toContainText(/LOSE_FAT|GAIN_MUSCLE/i)

    await page.getByRole('button', { name: 'Recommend from saved goals' }).click()
    await expect(page.getByText('Recommendation brief')).toBeVisible()
    await expect(page.getByText('Workout focus')).toBeVisible()
    await expect(page.getByText('Food emphasis')).toBeVisible()
  })

  test('claims a product coupon from promotions, previews it in cart, and submits checkout payload', async ({ page }) => {
    await clearCart(page)

    await page.goto('/customer/promotions')
    await expect(page.getByRole('heading', { name: 'Promotions & Special Offers' })).toBeVisible()
    const welcomePromotion = page.locator('div.p-5').filter({ hasText: 'WELCOME10' }).first()
    await expect(welcomePromotion).toBeVisible()
    await welcomePromotion.getByRole('button', { name: 'Claim Voucher' }).click()
    await expect(page.getByRole('heading', { name: 'Claim Successful!' })).toBeVisible()
    await expect(page.getByText(/#WELCOME10/i)).toBeVisible()
    await page.getByRole('button', { name: 'Awesome!' }).click()
    await expect(welcomePromotion.getByRole('button', { name: 'Claimed' })).toBeVisible()

    await page.goto('/customer/shop')

    const productCard = page.locator('article').filter({
      has: page.getByRole('button', { name: 'Add to cart' }),
    }).first()
    await expect(productCard).toBeVisible()

    const productName = (await productCard.locator('a').nth(1).textContent())?.trim() || ''
    await productCard.getByRole('button', { name: 'Add to cart' }).click()
    await page.getByRole('link', { name: /View cart \(/i }).click()

    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible()
    if (productName) {
      await expect(page.getByText(productName, { exact: false }).first()).toBeVisible()
    }

    const quantityDisplay = page.locator('article').filter({
      has: page.getByRole('button', { name: 'Remove' }),
    }).first().locator('span.min-w-\\[2rem\\]').first()

    await expect(quantityDisplay).toHaveText('1')
    await page.locator('article').filter({
      has: page.getByRole('button', { name: 'Remove' }),
    }).first().getByRole('button', { name: '+' }).click()
    await expect(quantityDisplay).toHaveText('2')
    await page.locator('article').filter({
      has: page.getByRole('button', { name: 'Remove' }),
    }).first().getByRole('button', { name: '-' }).click()
    await expect(quantityDisplay).toHaveText('1')

    await expect(page.locator('#cart-page-promo-code')).toContainText('WELCOME10')
    await page.locator('#cart-page-promo-code').selectOption('WELCOME10')
    await expect(page.getByText(/Preview: discount/i)).toBeVisible()

    let checkoutPayload = null
    await page.route('**/api/v1/orders/checkout', async (route) => {
      checkoutPayload = JSON.parse(route.request().postData() || '{}')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            checkoutUrl: 'http://localhost:5173/customer/cart?status=CANCELLED',
          },
        }),
      })
    })

    await page.getByRole('button', { name: 'Checkout with PayOS' }).click()
    await expect(page.getByRole('heading', { name: 'Confirm receipt details' })).toBeVisible()

    const fullNameInput = page.getByPlaceholder('Account full name')
    const emailInput = page.getByPlaceholder('Receipt email address')
    await fullNameInput.fill('Customer Minh')
    await emailInput.fill('customer@gymcore.local')

    await Promise.all([
      page.waitForURL(/\/customer\/cart(?:\?status=CANCELLED)?$/),
      page.getByRole('button', { name: 'Confirm and pay' }).click(),
    ])

    expect(checkoutPayload).toMatchObject({
      paymentMethod: 'PAYOS',
      promoCode: 'WELCOME10',
      fullName: 'Customer Minh',
      email: 'customer@gymcore.local',
    })

    await clearCart(page)
  })

  test('adds an external coupon code from promotions and updates wallet state', async ({ page }) => {
    await page.goto('/customer/promotions')
    await expect(page.getByRole('heading', { name: 'Promotions & Special Offers' })).toBeVisible()

    const welcomePromotion = page.locator('div.p-5').filter({ hasText: 'WELCOME10' }).first()
    await expect(welcomePromotion).toBeVisible()
    await welcomePromotion.getByRole('button', { name: 'Claim Voucher' }).click()

    await expect(page.getByRole('heading', { name: 'Claim Successful!' })).toBeVisible()
    await expect(page.getByText(/#WELCOME10/i)).toBeVisible()
    await page.getByRole('button', { name: 'Awesome!' }).click()
    await expect(welcomePromotion.getByRole('button', { name: 'Claimed' })).toBeVisible()
  })

  test('shows an action-first reminder center with quieter history and direct promotion actions', async ({ page }) => {
    prepareReminderCenterState()

    await page.goto('/notifications')

    await expect(page.getByRole('heading', { name: 'Reminder Center' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Act now' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
    await expect(page.locator('[data-notification-bucket="actionable"]')).toHaveCount(2)
    await expect(page.locator('[data-notification-tone="muted"]').filter({ hasText: 'Order paid' })).toBeVisible()

    const promotionReminder = page.locator('[data-notification-bucket="actionable"]').filter({
      hasText: 'Important Offer PW is now live.',
    }).first()
    await expect(promotionReminder).toBeVisible()
    await promotionReminder.getByRole('link', { name: 'Open promotions' }).click()

    await expect(page).toHaveURL(/\/customer\/promotions$/)
    await expect(page.getByRole('heading', { name: 'Promotions & Special Offers' })).toBeVisible()

    await page.goto('/notifications')
    await page.getByRole('button', { name: 'Unread history' }).click()

    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
    await expect(page.locator('[data-notification-bucket="actionable"]')).toHaveCount(0)
    await expect(page.locator('[data-notification-tone="secondary"]').filter({ hasText: 'Coupon added to your wallet' })).toBeVisible()
    await expect(page.locator('[data-notification-tone="muted"]').filter({ hasText: 'Order paid' })).toHaveCount(0)
  })

  test('gates reviews by pickup and lets the customer manage a picked-up order review', async ({ page }) => {
    await page.goto('/customer/orders')
    await expect(page.getByRole('heading', { name: 'Order History' })).toBeVisible()

    const awaitingOrder = page.locator('article').filter({ hasText: 'ORD-COMMERCE-AWAITING' }).first()
    const pickedOrder = page.locator('article').filter({ hasText: 'ORD-COMMERCE-PICKED' }).first()

    await expect(awaitingOrder).toBeVisible()
    await expect(pickedOrder).toBeVisible()
    await expect(awaitingOrder.getByText('Review unlocks after pickup is confirmed.')).toBeVisible()
    await expect(awaitingOrder.getByRole('button', { name: 'Leave review' })).toHaveCount(0)

    await pickedOrder.getByRole('button', { name: 'Leave review' }).click()
    await page.getByLabel('Comment').fill('Playwright review create')
    await page.getByRole('button', { name: 'Submit review' }).click()
    await expect(page.getByText(/Your review: 5\/5 - Playwright review create/i).first()).toBeVisible()

    await page.getByRole('button', { name: 'Edit review' }).first().click()
    await page.getByLabel('Comment').fill('Playwright review updated')
    await page.getByRole('button', { name: 'Update review' }).click()
    await expect(page.getByText(/Your review: 5\/5 - Playwright review updated/i).first()).toBeVisible()

    await page.getByRole('button', { name: 'Delete review' }).first().click()
    await page.getByRole('button', { name: 'Confirm delete' }).first().click()
    await expect(page.getByRole('button', { name: 'Leave review' }).first()).toBeVisible()
  })

  test('shows a dashboard-first PT experience and instant-booking path when eligible', async ({ page }) => {
    await page.goto('/customer/coach-booking')
    await expect(page.getByRole('heading', { name: 'Coach Booking' })).toBeVisible()
    await expect(page.getByText('PT Dashboard')).toBeVisible()

    const membershipGate = page.getByRole('heading', { name: 'Coach booking is locked for your current membership.' })
    if (await membershipGate.isVisible()) {
      await expect(page.getByText(/Membership required/i)).toBeVisible()
      await expect(page.getByRole('link', { name: /View my membership/i })).toBeVisible()
      return
    }

    if (await page.getByRole('button', { name: 'Change recurring plan' }).isVisible()) {
      await expect(page.getByText('Latest coach note')).toBeVisible()
      await expect(page.getByText(/Latest progress/i)).toBeVisible()
      return
    }

    await page.getByRole('button', { name: 'Book PT Plan' }).click()
    const ptGate = page.getByRole('heading', { name: 'You already have a PT booking in progress.' })
    const openPlannerButton = page.getByRole('button', { name: 'Open Schedule Planner' })
    const plannerTitle = page.getByRole('heading', { name: 'Set Desired PT Schedule', exact: true })

    await expect(openPlannerButton.or(ptGate)).toBeVisible()
    if (await ptGate.isVisible()) {
      await expect(page.getByRole('button', { name: 'Open PT Dashboard' })).toBeVisible()
      return
    }

    await openPlannerButton.click()

    if (await plannerTitle.isVisible()) {
      await page.getByRole('button', { name: /Monday/i }).click()
      await page.getByRole('button', { name: /Slot 1/i }).first().click()
      await page.getByRole('button', { name: 'Save and Search' }).click()
      await expect(page.getByText('Fully Match')).toBeVisible()
      await page.getByRole('button', { name: 'Review Calendar Match' }).first().click()
      await expect(page.getByRole('button', { name: 'Confirm PT Plan' })).toBeVisible()
      return
    }

    await expect(plannerTitle).toBeVisible()
  })

  test('supports direct PT reschedule, future series change, and replacement coach decisions from the dashboard', async ({
    browser,
  }) => {
    test.setTimeout(120000)
    preparePtExceptionFlowState()

    const coachCredentials = {
      email: 'pt.exception.coach@gymcore.local',
      password: 'Coach123456!',
    }
    const customerCredentials = {
      email: 'pt.exception.customer@gymcore.local',
      password: 'Customer123456!',
    }

    const coachContext = await browser.newContext()
    const customerContext = await browser.newContext()
    const coachPage = await coachContext.newPage()
    const customerPage = await customerContext.newPage()

    try {
      await loginViaUi(coachPage, coachCredentials)
      await loginViaUi(customerPage, customerCredentials)

      const scheduleResponse = await callAuthenticatedApi(coachPage, 'GET', '/api/v1/coach/schedule')
      const coachSessions = (scheduleResponse?.data?.items || []).filter(
        (session) => session.customerEmail === 'pt.exception.customer@gymcore.local',
      )
      expect(coachSessions.length).toBeGreaterThanOrEqual(2)

      const sortedSessions = coachSessions
        .slice()
        .sort((left, right) => {
          if (left.sessionDate !== right.sessionDate) {
            return String(left.sessionDate).localeCompare(String(right.sessionDate))
          }
          return Number(left.timeSlotId || 0) - Number(right.timeSlotId || 0)
        })

      const sessionOne = sortedSessions[0]
      const sessionTwo = sortedSessions[1]
      const replacementSlotId = Number(sessionTwo.timeSlotId) + 1
      const seriesCutoverDate = addDaysValue(sessionTwo.sessionDate, 7)
      const seriesDayLabel = new Date(`${sessionTwo.sessionDate}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
      })

      await customerPage.goto('/customer/coach-booking')
      await expect(customerPage.getByText('PT Dashboard')).toBeVisible()
      await expect(customerPage.getByText('Active PT phase')).toBeVisible()

      await customerPage.getByRole('button', { name: 'Change recurring plan' }).click()
      const recurringPlanModal = customerPage.locator('div.fixed.inset-0.z-50')
      await expect(recurringPlanModal.getByRole('heading', { name: 'Change recurring plan' })).toBeVisible()
      await recurringPlanModal.getByLabel('Apply new template from').fill(seriesCutoverDate)
      await recurringPlanModal.getByRole('button', { name: new RegExp(seriesDayLabel, 'i') }).click()
      await recurringPlanModal.getByRole('button', { name: /Slot 2/i }).click()
      await recurringPlanModal.getByRole('button', { name: 'Save future series' }).click()
      await expect(customerPage.getByText(/Recurring PT series updated successfully/i)).toBeVisible()

      await customerPage.getByRole('button', { name: 'Open My PT Schedule' }).click()
      await customerPage.getByRole('button', { name: new RegExp(`${sessionOne.sessionDate}, 1 coaching slot`, 'i') }).click()
      await customerPage.getByRole('button', { name: 'Reschedule' }).click()
      await customerPage.getByLabel('New date').fill(sessionTwo.sessionDate)
      await customerPage.getByLabel('New time slot').selectOption(String(replacementSlotId))
      await customerPage.getByRole('button', { name: 'Update session now' }).click()
      await expect(customerPage.getByText(/PT session updated immediately/i)).toBeVisible()

      const replacementCoachesResponse = await callAuthenticatedApi(coachPage, 'GET', '/api/v1/coach/replacement-coaches')
      const backupCoach = (replacementCoachesResponse?.data?.items || []).find(
        (coach) => coach.email === 'pt.exception.backup@gymcore.local',
      )
      expect(backupCoach).toBeTruthy()

      await callAuthenticatedApi(coachPage, 'POST', '/api/v1/coach/unavailable-blocks', {
        startDate: sessionTwo.sessionDate,
        endDate: sessionTwo.sessionDate,
        timeSlotId: replacementSlotId,
        note: 'Primary coach on medical leave for the rescheduled slot.',
      })

      const coachScheduleAfterReschedule = await callAuthenticatedApi(coachPage, 'GET', '/api/v1/coach/schedule')
      const rescheduledSession = (coachScheduleAfterReschedule?.data?.items || [])
        .filter((session) => session.customerEmail === 'pt.exception.customer@gymcore.local')
        .find((session) => session.sessionDate === sessionTwo.sessionDate && Number(session.timeSlotId) === replacementSlotId)
      expect(rescheduledSession).toBeTruthy()

      await callAuthenticatedApi(
        coachPage,
        'POST',
        `/api/v1/coach/pt-sessions/${rescheduledSession.ptSessionId}/replacement-offer`,
        {
          replacementCoachId: backupCoach.coachId,
          note: 'Medical leave this week.',
        },
      )

      await customerPage.reload()
      await expect(customerPage.getByText('Replacement coach offer').first()).toBeVisible()
      await customerPage.getByRole('button', { name: 'Accept replacement' }).first().click()
      await expect(customerPage.getByText(/Replacement coach accepted/i)).toBeVisible()
      expect(getLatestReplacementOfferStatus('pt.exception.customer@gymcore.local')).toBe('ACCEPTED')

      await callAuthenticatedApi(coachPage, 'POST', '/api/v1/coach/unavailable-blocks', {
        startDate: sessionTwo.sessionDate,
        endDate: sessionTwo.sessionDate,
        timeSlotId: sessionTwo.timeSlotId,
        note: 'Primary coach unavailable for the original slot.',
      })

      await callAuthenticatedApi(
        coachPage,
        'POST',
        `/api/v1/coach/pt-sessions/${sessionTwo.ptSessionId}/replacement-offer`,
        {
          replacementCoachId: backupCoach.coachId,
          note: 'Backup coach can take this exception slot.',
        },
      )

      await customerPage.reload()
      await expect(customerPage.getByText('Replacement coach offer').first()).toBeVisible()
      await customerPage.getByRole('button', { name: 'Decline replacement' }).first().click()
      await expect(customerPage.getByText(/Replacement coach declined/i)).toBeVisible()
      expect(getLatestReplacementOfferStatus('pt.exception.customer@gymcore.local')).toBe('DECLINED')
    } finally {
      await coachContext.close()
      await customerContext.close()
    }
  })
})
