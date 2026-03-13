const { test, expect } = require('@playwright/test')
const { credentialsByRole } = require('./helpers/auth')

test.use({ storageState: credentialsByRole.admin.storageState })

async function verifyImportantBroadcastToggle(page) {
  const modal = page.getByRole('dialog')

  await page.goto('/admin/promotions')
  await expect(page.getByRole('heading', { name: 'Promotions Management' })).toBeVisible()

  await page.getByRole('button', { name: 'New Marketing Post' }).click()
  await expect(modal.getByRole('heading', { name: 'New Marketing Post' })).toBeVisible()
  await expect(modal.getByText('Page only')).toBeVisible()

  await modal.getByRole('button', { name: /Mark as important broadcast/i }).click()
  await expect(modal.getByText('Broadcast all customers')).toBeVisible()

  await modal.getByRole('button', { name: /Close post modal/i }).click()
  await expect(modal).not.toBeVisible()
}

function buildPromotionPost({
  id,
  title,
  promoCode,
  important = false,
}) {
  return {
    PromotionPostID: id,
    PromotionID: 7000 + id,
    PromoCode: promoCode,
    Title: title,
    Content: `${title} gives customers a limited-time membership boost.`,
    DiscountPercent: 15,
    DiscountAmount: 0,
    BonusDurationMonths: important ? 1 : 0,
    ApplyTarget: 'MEMBERSHIP',
    BannerUrl: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800',
    EndAt: '2026-12-31T23:59:59',
    IsClaimed: 0,
    IsImportant: important ? 1 : 0,
  }
}

function buildNotificationForImportantPost(title) {
  return {
    notificationId: 6101,
    type: 'PROMOTION_POST_PUBLISHED',
    title: 'New promotion available',
    message: `${title} is now live. Open Promotions to claim it before it expires.`,
    linkUrl: '/customer/promotions',
    isRead: false,
    createdAt: '2026-03-13T08:00:00Z',
    reminder: {
      bucket: 'ACTIONABLE',
      category: 'PROMOTION',
      destination: {
        label: 'Open promotions',
      },
    },
  }
}

test.describe.serial('admin promotions business flows', () => {
  test('keeps page-only posts on promotions while important posts also reach reminder center', async ({
    browser,
    page,
  }) => {
    const suffix = Date.now()
    const standardPostTitle = `Page Only Boost ${suffix}`
    const importantPostTitle = `Important Broadcast ${suffix}`
    const promotionPosts = [
      buildPromotionPost({
        id: 101,
        title: standardPostTitle,
        promoCode: `PAGE${suffix}`,
      }),
      buildPromotionPost({
        id: 102,
        title: importantPostTitle,
        promoCode: `ALERT${suffix}`,
        important: true,
      }),
    ]
    const importantNotification = buildNotificationForImportantPost(importantPostTitle)

    await verifyImportantBroadcastToggle(page)

    const customerContext = await browser.newContext({ storageState: credentialsByRole.customer.storageState })

    await customerContext.route('**/api/v1/promotions/posts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            posts: promotionPosts,
          },
        }),
      })
    })

    await customerContext.route('**/api/v1/promotions/my-claims', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            wallet: {
              activeClaims: [],
              usedClaims: [],
              expiredClaims: [],
              allClaims: [],
            },
          },
        }),
      })
    })

    await customerContext.route('**/api/v1/notifications**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            unreadCount: 1,
            notifications: [importantNotification],
            reminderCenter: {
              actionable: [importantNotification],
              history: [],
              counts: {
                total: 1,
                actionable: 1,
                history: 0,
              },
            },
          },
        }),
      })
    })

    const customerPage = await customerContext.newPage()

    await customerPage.goto('/customer/promotions')
    await expect(customerPage.getByRole('heading', { name: 'Promotions & Special Offers' })).toBeVisible()
    await expect(customerPage.getByRole('heading', { name: standardPostTitle, exact: true })).toBeVisible()
    await expect(customerPage.getByRole('heading', { name: importantPostTitle, exact: true })).toBeVisible()

    await customerPage.goto('/notifications')
    await expect(customerPage.getByRole('heading', { name: 'Reminder Center' })).toBeVisible()
    await expect(customerPage.getByRole('heading', { name: 'Act now' })).toBeVisible()
    await expect(customerPage.locator('[data-notification-bucket="actionable"]')).toHaveCount(1)
    await expect(customerPage.getByText(importantPostTitle, { exact: false }).first()).toBeVisible()
    await expect(customerPage.getByRole('heading', { name: standardPostTitle, exact: true })).toHaveCount(0)

    await customerPage.locator('[data-notification-bucket="actionable"]').getByRole('link', { name: 'Open promotions' }).click()
    await expect(customerPage).toHaveURL(/\/customer\/promotions$/)
    await expect(customerPage.getByRole('heading', { name: standardPostTitle, exact: true })).toBeVisible()
    await expect(customerPage.getByRole('heading', { name: importantPostTitle, exact: true })).toBeVisible()

    await customerContext.close()
  })
})
