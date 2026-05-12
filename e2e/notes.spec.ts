import { test, expect } from '@playwright/test'
import { createFirstTable } from './helpers'

test.describe('Table Notes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('write notes and verify in SQL export as comments', async ({ page }) => {
    await createFirstTable(page, 'documented')
    await page.getByText('documented', { exact: true }).first().click()
    await page.waitForTimeout(300)

    // Switch to Notes tab
    await page.locator('button:has-text("Notes")').first().click()
    await page.waitForTimeout(300)

    const notesArea = page.locator('textarea[placeholder*="Add notes"]')
    await expect(notesArea).toBeVisible()
    await notesArea.fill('Stores all user documents and metadata.')
    await page.waitForTimeout(300)

    // Export and verify
    await page.locator('button:has-text("Export Schema")').click()
    await page.waitForTimeout(500)
    const sql = await page.locator('textarea[aria-label="Generated SQL Code"]').inputValue()
    expect(sql).toContain('-- Stores all user documents and metadata.')
    expect(sql).toContain('CREATE TABLE documented')
  })

  test('multi-line notes preserve line breaks in SQL comments', async ({ page }) => {
    await createFirstTable(page, 'multi')
    await page.getByText('multi', { exact: true }).first().click()
    await page.waitForTimeout(300)

    await page.locator('button:has-text("Notes")').first().click()
    await page.waitForTimeout(300)

    const notesArea = page.locator('textarea[placeholder*="Add notes"]')
    await notesArea.fill('Line one\nLine two')
    await page.waitForTimeout(300)

    await page.locator('button:has-text("Export Schema")').click()
    await page.waitForTimeout(500)
    const sql = await page.locator('textarea[aria-label="Generated SQL Code"]').inputValue()
    expect(sql).toContain('-- Line one')
    expect(sql).toContain('-- Line two')
  })
})
