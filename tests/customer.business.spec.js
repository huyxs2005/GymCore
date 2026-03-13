const { test, expect } = require('@playwright/test')
const { credentialsByRole } = require('./helpers/auth')
const { prepareCustomerAiPlanningState, prepareCustomerCommerceState, runSqlScript } = require('./helpers/sql')

test.use({ storageState: credentialsByRole.customer.storageState })

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

  test('adds product coupon code to wallet in cart, previews it, and submits checkout payload', async ({ page }) => {
    await clearCart(page)
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

    await page.getByPlaceholder('Enter coupon code from social media').fill('WELCOME10')
    await page.getByRole('button', { name: 'Add code to wallet' }).click()
    await expect(page.locator('#cart-page-promo-code')).toContainText('WELCOME10')
    await page.locator('#cart-page-promo-code').selectOption('WELCOME10')
    await expect(page.getByText(/Preview: discount/i)).toBeVisible()
    await expect(page.getByText('Claimable now')).toBeVisible()
    await expect(page.getByText('Used')).toBeVisible()
    await expect(page.getByText('Expired')).toBeVisible()

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

    await page.unroute('**/api/v1/orders/checkout')
    await clearCart(page)
  })

  test('adds an external coupon code from promotions and updates wallet state', async ({ page }) => {
    await page.goto('/customer/promotions')
    await expect(page.getByRole('heading', { name: 'Promotions & Special Offers' })).toBeVisible()

    const activeCard = page.locator('text=Active').locator('..')
    const activeBefore = Number((await activeCard.textContent())?.replace(/\D/g, '') || '0')

    await page.getByPlaceholder('Enter external coupon code').fill('WELCOME10')
    await page.getByRole('button', { name: 'Add code to wallet' }).click()

    await expect(page.getByRole('heading', { name: 'Claim Successful!' })).toBeVisible()
    await expect(page.getByText(/#WELCOME10/i)).toBeVisible()
    await page.getByRole('button', { name: 'Awesome!' }).click()
    await expect(activeCard).toContainText(String(activeBefore + 1))
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

  test('reorders a picked-up order, manages recipient change requests, and gates reviews by pickup', async ({ page }) => {
    await page.goto('/customer/orders')
    await expect(page.getByRole('heading', { name: 'Order History' })).toBeVisible()

    const awaitingOrder = page.locator('article').filter({ hasText: 'ORD-COMMERCE-AWAITING' }).first()
    const pickedOrder = page.locator('article').filter({ hasText: 'ORD-COMMERCE-PICKED' }).first()

    await expect(awaitingOrder).toBeVisible()
    await expect(pickedOrder).toBeVisible()
    await expect(awaitingOrder.getByText('Review unlocks after pickup is confirmed.')).toBeVisible()

    await awaitingOrder.getByRole('button', { name: 'Request recipient change' }).click()
    await page.getByPlaceholder('Pickup recipient name').fill('Pickup Delegate One')
    await page.getByPlaceholder('0900...').fill('0900000123')
    await page.getByPlaceholder('pickup@gymcore.local').fill('delegate.one@gymcore.local')
    await page.getByRole('button', { name: 'Save recipient change' }).click()
    await expect(page.getByText(/Recipient change request saved/i)).toBeVisible()
    await expect(awaitingOrder.getByRole('button', { name: 'Update recipient change' })).toBeVisible()
    await expect(awaitingOrder.getByText(/Pickup Delegate One/)).toBeVisible()

    await awaitingOrder.getByRole('button', { name: 'Update recipient change' }).click()
    await page.getByPlaceholder('Pickup recipient name').fill('Pickup Delegate Final')
    await page.getByPlaceholder('0900...').fill('0900000456')
    await page.getByPlaceholder('pickup@gymcore.local').fill('delegate.final@gymcore.local')
    await page.getByRole('button', { name: 'Save recipient change' }).click()
    await expect(awaitingOrder.getByText(/Pickup Delegate Final/)).toBeVisible()

    await pickedOrder.getByRole('button', { name: 'Reorder' }).click()
    await expect(page.getByText(/Reorder added 1 item line\(s\) to your cart/i)).toBeVisible()

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
    await expect(page.getByRole('heading', { name: 'PT Dashboard' })).toBeVisible()

    const membershipGate = page.getByRole('heading', { name: 'Coach booking is locked for your current membership.' })
    if (await membershipGate.isVisible()) {
      await expect(page.getByText(/Membership required/i)).toBeVisible()
      await expect(page.getByRole('link', { name: /View my membership/i })).toBeVisible()
      return
    }

    if (await page.getByText('Active PT phase', { exact: true }).isVisible()) {
      await expect(page.getByText('Latest coach note')).toBeVisible()
      await expect(page.getByText(/Latest progress/i)).toBeVisible()
      return
    }

    await page.getByRole('button', { name: 'Book PT Plan' }).click()
    await page.getByRole('button', { name: 'Open Schedule Planner' }).click()

    const plannerTitle = page.getByRole('heading', { name: 'Set Desired PT Schedule', exact: true })
    const ptGate = page.getByRole('heading', { name: 'You already have a PT booking in progress.' })
    if (await ptGate.isVisible()) {
      await expect(page.getByRole('button', { name: 'Open PT Dashboard' })).toBeVisible()
      return
    }

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
    page,
  }) => {
    const currentPhase = {
      data: {
        activePhase: {
          ptRequestId: 901,
          coachId: 3,
          coachName: 'Coach Alex',
          startDate: '2026-03-17',
          endDate: '2026-04-14',
          bookingMode: 'INSTANT',
          templateSlots: [
            { dayOfWeek: 1, timeSlotId: 1 },
            { dayOfWeek: 3, timeSlotId: 2 },
          ],
        },
        dashboard: {
          nextSession: {
            ptSessionId: 301,
            coachName: 'Coach Alex',
            sessionDate: '2026-03-17',
            timeSlotId: 1,
            status: 'SCHEDULED',
          },
          weeklySchedule: [
            {
              ptSessionId: 301,
              sessionDate: '2026-03-17',
              timeSlotId: 1,
              status: 'SCHEDULED',
            },
          ],
          latestNote: {
            noteId: 88,
            noteContent: 'Strong improvement in posture',
          },
          latestProgress: {
            heightCm: 172.5,
            weightKg: 70.2,
            bmi: 23.6,
            recordedAt: '2026-03-15T02:00:00Z',
          },
          completedSessions: 2,
          remainingSessions: 4,
        },
      },
    }

    const schedule = {
      data: {
        items: [
          {
            ptSessionId: 301,
            coachName: 'Coach Alex',
            sessionDate: '2026-03-17',
            timeSlotId: 1,
            slotIndex: 1,
            startTime: '07:00:00',
            endTime: '08:30:00',
            status: 'SCHEDULED',
            replacementOffer: {
              offerId: 91,
              status: 'PENDING_CUSTOMER',
              note: 'Medical leave this week.',
              replacementCoachName: 'Coach Jamie',
              originalCoachName: 'Coach Alex',
              sessionDate: '2026-03-17',
              timeSlotId: 1,
            },
          },
        ],
        pendingRequests: [],
        deniedRequests: [],
      },
    }

    let reschedulePayload = null
    let seriesPayload = null
    let replacementPayload = null

    await page.route('**/api/v1/time-slots', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            items: [
              { timeSlotId: 1, slotIndex: 1, startTime: '07:00:00', endTime: '08:30:00' },
              { timeSlotId: 2, slotIndex: 2, startTime: '08:30:00', endTime: '10:00:00' },
            ],
          },
        }),
      })
    })

    await page.route('**/api/v1/memberships/current-center', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            membership: {
              status: 'ACTIVE',
              plan: {
                name: 'Gym + Coach - 6 Months',
                planType: 'GYM_PLUS_COACH',
                allowsCoachBooking: true,
              },
            },
          },
        }),
      })
    })

    await page.route('**/api/v1/coach-booking/current-phase', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentPhase),
      })
    })

    await page.route('**/api/v1/coach-booking/my-schedule', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(schedule),
      })
    })

    await page.route('**/api/v1/coach-booking/current-phase/reschedule-series', async (route) => {
      seriesPayload = JSON.parse(route.request().postData() || '{}')
      currentPhase.data.activePhase.templateSlots = seriesPayload.slots
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { status: 'UPDATED' } }),
      })
    })

    await page.route('**/api/v1/coach-booking/sessions/*/replacement-response', async (route) => {
      replacementPayload = JSON.parse(route.request().postData() || '{}')
      schedule.data.items[0].replacementOffer.status = replacementPayload.decision === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED'
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { status: schedule.data.items[0].replacementOffer.status } }),
      })
    })

    await page.route('**/api/v1/coach-booking/sessions/*/reschedule', async (route) => {
      reschedulePayload = JSON.parse(route.request().postData() || '{}')
      schedule.data.items[0].sessionDate = reschedulePayload.sessionDate
      schedule.data.items[0].timeSlotId = reschedulePayload.timeSlotId
      schedule.data.items[0].slotIndex = 2
      schedule.data.items[0].startTime = '08:30:00'
      schedule.data.items[0].endTime = '10:00:00'
      currentPhase.data.dashboard.nextSession = {
        ...currentPhase.data.dashboard.nextSession,
        sessionDate: reschedulePayload.sessionDate,
        timeSlotId: reschedulePayload.timeSlotId,
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { status: 'UPDATED' } }),
      })
    })

    await page.goto('/customer/coach-booking')
    await expect(page.getByRole('heading', { name: 'PT Dashboard' })).toBeVisible()
    await expect(page.getByText('Replacement coach offer').first()).toBeVisible()

    await page.getByRole('button', { name: 'Accept replacement' }).first().click()
    expect(replacementPayload).toMatchObject({ decision: 'ACCEPT' })

    await page.getByRole('button', { name: 'Change recurring plan' }).click()
    await page.getByLabel('Apply new template from').fill('2026-03-24')
    await page.getByRole('button', { name: /Tuesday/i }).click()
    await page.getByRole('button', { name: /Slot 2/i }).first().click()
    await page.getByRole('button', { name: 'Save future series' }).click()

    expect(seriesPayload).toMatchObject({
      cutoverDate: '2026-03-24',
      slots: [
        { dayOfWeek: 1, timeSlotId: 1 },
        { dayOfWeek: 2, timeSlotId: 2 },
        { dayOfWeek: 3, timeSlotId: 2 },
      ],
    })

    await page.getByRole('button', { name: 'Reschedule' }).click()
    await page.getByLabel('New date').fill('2026-03-24')
    await page.getByLabel('New time slot').selectOption('2')
    await page.getByRole('button', { name: 'Update session now' }).click()

    expect(reschedulePayload).toMatchObject({
      sessionDate: '2026-03-24',
      timeSlotId: 2,
    })
    await expect(page.getByText(/PT session updated immediately/i)).toBeVisible()
  })
})
