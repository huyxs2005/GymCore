const fs = require('fs')
const path = require('path')
const { expect } = require('@playwright/test')

const authDir = path.join(__dirname, '..', '.auth')

function ensureAuthDirectory() {
  fs.mkdirSync(authDir, { recursive: true })
}

const credentialsByRole = {
  admin: {
    email: 'admin@gymcore.local',
    password: 'Admin123456!',
    storageState: path.join(authDir, 'admin.json'),
  },
  reception: {
    email: 'reception@gymcore.local',
    password: 'Reception123456!',
    storageState: path.join(authDir, 'reception.json'),
  },
  coach: {
    email: 'coach@gymcore.local',
    password: 'Coach123456!',
    storageState: path.join(authDir, 'coach.json'),
  },
  customer: {
    email: 'customer@gymcore.local',
    password: 'Customer123456!',
    storageState: path.join(authDir, 'customer.json'),
  },
}

async function loginViaUi(page, credentials) {
  await page.goto('/auth/login')
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
  await page.getByLabel('Email').fill(credentials.email)
  await page.getByLabel('Password').fill(credentials.password)
  await Promise.all([
    page.waitForURL(/\/$/),
    page.getByRole('button', { name: 'Login' }).click(),
  ])
}

module.exports = {
  credentialsByRole,
  ensureAuthDirectory,
  loginViaUi,
}
