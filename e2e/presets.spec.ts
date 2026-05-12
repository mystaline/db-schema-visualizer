import { test, expect } from '@playwright/test'
import { createFirstTable } from './helpers'

test.describe('Presets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('load Blog preset with two-click confirmation', async ({ page }) => {
    // Dismiss modals and create dummy table
    await page.waitForTimeout(1500)
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button')
      for (const btn of buttons) {
        if (btn.textContent?.includes('Got it')) {
          ;(btn as HTMLButtonElement).click()
          return
        }
      }
    })
    await page.waitForTimeout(500)
    const input = page.locator('input[placeholder="e.g. user_profiles"]')
    await input.waitFor({ state: 'visible', timeout: 5000 })
    await input.fill('_dummy')
    await input.press('Enter')
    await page.waitForTimeout(500)

    // First click "Blog" → should show "Confirm?"
    await page.locator('button:has-text("Blog")').first().click()
    await page.waitForTimeout(300)
    await expect(page.locator('button:has-text("Confirm?")')).toBeVisible({ timeout: 3000 })

    // Second click confirms
    await page.locator('button:has-text("Confirm?")').click()
    await page.waitForTimeout(1000)

    // Verify blog schema loaded
    await expect(page.locator('text=profiles').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=articles').first()).toBeVisible()
    await expect(page.locator('text=comments').first()).toBeVisible()
    await expect(page.locator('text=tags').first()).toBeVisible()
    await expect(page.locator('text=article_tags').first()).toBeVisible()
  })

  test('load Shop preset with two-click confirmation', async ({ page }) => {
    await page.waitForTimeout(1500)
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button')
      for (const btn of buttons) {
        if (btn.textContent?.includes('Got it')) {
          ;(btn as HTMLButtonElement).click()
          return
        }
      }
    })
    await page.waitForTimeout(500)
    const input = page.locator('input[placeholder="e.g. user_profiles"]')
    await input.waitFor({ state: 'visible', timeout: 5000 })
    await input.fill('_dummy')
    await input.press('Enter')
    await page.waitForTimeout(500)

    // First click "Shop" → "Confirm?"
    await page.locator('button:has-text("Shop")').first().click()
    await page.waitForTimeout(300)
    await expect(page.locator('button:has-text("Confirm?")')).toBeVisible({ timeout: 3000 })

    // Confirm
    await page.locator('button:has-text("Confirm?")').click()
    await page.waitForTimeout(1000)

    await expect(page.locator('text=customers').first()).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=products').first()).toBeVisible()
    await expect(page.locator('text=orders').first()).toBeVisible()
    await expect(page.locator('text=categories').first()).toBeVisible()
    await expect(page.locator('text=order_line_items').first()).toBeVisible()
  })
})
