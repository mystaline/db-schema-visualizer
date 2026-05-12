import { test, expect } from '@playwright/test'
import { createFirstTable } from './helpers'

test.describe('Delete Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('delete table from sidebar with confirm', async ({ page }) => {
    await createFirstTable(page, 'keep_me')
    // Create second table
    await page.locator('button:has-text("New Entity")').click()
    await page.waitForTimeout(400)
    await page.locator('input[placeholder="e.g. user_profiles"]').fill('delete_me')
    await page.locator('button:has-text("Create")').click()
    await page.waitForTimeout(500)

    await expect(page.getByText('delete_me', { exact: true }).first()).toBeVisible()

    // Hover to reveal delete button
    const deleteRow = page.getByText('delete_me', { exact: true }).first().locator('..')
    await deleteRow.hover()
    await page.waitForTimeout(300)
    await deleteRow.locator('button').click()
    await page.waitForTimeout(300)

    // Confirm
    await expect(page.locator('h2:has-text("Delete Table")')).toBeVisible()
    await page.locator('button.bg-danger-500').click()
    await page.waitForTimeout(500)

    await expect(page.getByText('delete_me', { exact: true }).first()).not.toBeVisible({ timeout: 3000 })
    await expect(page.getByText('keep_me', { exact: true }).first()).toBeVisible()
  })

  test('cancel delete preserves table', async ({ page }) => {
    await createFirstTable(page, 'protected')

    // Hover to reveal delete button
    const keepRow = page.getByText('protected', { exact: true }).first().locator('..')
    await keepRow.hover()
    await page.waitForTimeout(300)
    await keepRow.locator('button').click()
    await page.waitForTimeout(300)

    // Cancel
    await expect(page.locator('h2:has-text("Delete Table")')).toBeVisible()
    await page.locator('button:has-text("Cancel")').first().click()
    await page.waitForTimeout(300)

    await expect(page.getByText('protected', { exact: true }).first()).toBeVisible()
  })

  test('delete column with confirmation', async ({ page }) => {
    await createFirstTable(page, 'items')
    await page.getByText('items', { exact: true }).first().click()
    await page.waitForTimeout(300)

    await page.locator('button:has-text("Add column")').click()
    await page.waitForTimeout(300)
    await page.locator('input[aria-label^="Column name"]').first().fill('remove_me')
    await page.waitForTimeout(200)

    // Click delete button on column
    await page.locator('button[aria-label^="Delete column"]').first().click()
    await page.waitForTimeout(300)

    // Confirm
    await expect(page.locator('h2:has-text("Delete column?")')).toBeVisible()
    await page.locator('button.bg-danger-500').click()
    await page.waitForTimeout(500)

    // Column should be gone
    const cols = page.locator('input[aria-label^="Column name"]')
    await expect(cols).toHaveCount(0)
  })
})
