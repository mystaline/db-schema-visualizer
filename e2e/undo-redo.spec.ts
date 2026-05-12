import { test, expect } from '@playwright/test'
import { createFirstTable } from './helpers'

test.describe('Undo / Redo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('undo column rename reverts name', async ({ page }) => {
    await createFirstTable(page, 'alpha')
    await page.getByText('alpha', { exact: true }).first().click()
    await page.waitForTimeout(300)

    // Add a column
    await page.locator('button:has-text("Add column")').click()
    await page.waitForTimeout(300)

    // Rename column to "col1"
    await page.locator('input[aria-label^="Column name"]').first().fill('col1')
    await page.waitForTimeout(300)

    // Undo → name should revert to "new_column"
    await page.locator('button[aria-label="Undo"]').click()
    await page.waitForTimeout(500)
    const reverted = await page.locator('input[aria-label^="Column name"]').first().inputValue()
    expect(reverted).toBe('new_column')

    // Redo → back to "col1"
    await page.locator('button[aria-label="Redo"]').click()
    await page.waitForTimeout(500)
    const restored = await page.locator('input[aria-label^="Column name"]').first().inputValue()
    expect(restored).toBe('col1')
  })

  test('undo table creation removes table', async ({ page }) => {
    await createFirstTable(page, 'temp')

    // Undo table creation
    await page.locator('button[aria-label="Undo"]').click()
    await page.waitForTimeout(500)

    // Canvas auto-opens create modal when empty; table should be gone
    // Check that "temp" is no longer in the sidebar
    await expect(page.getByText('temp', { exact: true }).first()).not.toBeVisible({ timeout: 3000 })

    // Redo brings it back
    await page.locator('button[aria-label="Redo"]').click()
    await page.waitForTimeout(500)
    await expect(page.getByText('temp', { exact: true }).first()).toBeVisible()
  })
})
