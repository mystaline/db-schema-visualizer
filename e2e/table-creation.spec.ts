import { test, expect } from '@playwright/test'
import { createFirstTable } from './helpers'

test.describe('Table Creation & Column Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('create table via auto-opened modal', async ({ page }) => {
    await createFirstTable(page, 'users')
    await expect(page.getByText('users', { exact: true }).first()).toBeVisible()
  })

  test('add column with PK, set type, toggle NULL/UNQ', async ({ page }) => {
    await createFirstTable(page, 'products')
    await page.getByText('products', { exact: true }).first().click()
    await page.waitForTimeout(300)

    // Add column
    await page.locator('button:has-text("Add column")').click()
    await page.waitForTimeout(300)

    // Rename to "id"
    const colInput = page.locator('input[aria-label^="Column name"]').first()
    await colInput.click()
    await colInput.fill('id')

    // Set type to uuid via TypeSelector custom entry
    await page.locator('button:has-text("varchar")').first().click()
    await page.waitForTimeout(200)
    await page.locator('input[placeholder="Search or type custom..."]').fill('uuid')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    // Toggle PK → col becomes not nullable
    await page.locator('button[aria-label$="is primary key"]').first().click()
    await page.waitForTimeout(200)

    // Toggle UNQ
    await page.locator('button[aria-label$="is unique"]').first().click()
    await page.waitForTimeout(200)

    // Set default value
    const defaultInput = page.locator('input[placeholder*="now()"]')
    await defaultInput.fill('gen_random_uuid()')
    await page.waitForTimeout(200)

    // Green dot should appear when default is set
    await expect(page.locator('.bg-success-500.w-2.h-2')).toBeVisible()
  })

  test('create multiple tables', async ({ page }) => {
    await createFirstTable(page, 'alpha')
    // Second via sidebar New Entity
    await page.locator('button:has-text("New Entity")').click()
    await page.waitForTimeout(400)
    await page.locator('input[placeholder="e.g. user_profiles"]').fill('beta')
    await page.locator('button:has-text("Create")').click()
    await page.waitForTimeout(500)

    await expect(page.getByText('alpha', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('beta', { exact: true }).first()).toBeVisible()
  })

  test('rename table inline on detail panel', async ({ page }) => {
    await createFirstTable(page, 'old_name')
    await page.getByText('old_name', { exact: true }).first().click()
    await page.waitForTimeout(300)

    // Click title to start rename
    await page.locator('h3:has-text("old_name")').first().click()
    await page.waitForTimeout(200)

    // The rename uses a focused input with v-model bound to renameValue
    // It appears in the same spot; check for any visible focused input in the header
    const headerInput = page.locator('section input').first()
    await expect(headerInput).toBeVisible({ timeout: 3000 })
    const currentVal = await headerInput.inputValue()
    expect(currentVal).toBe('old_name')
    await headerInput.fill('new_name')
    await headerInput.press('Enter')
    await page.waitForTimeout(500)

    await expect(page.getByText('new_name', { exact: true }).first()).toBeVisible()
  })

  test('rename table inline on canvas via double-click', async ({ page }) => {
    await createFirstTable(page, 'canvas_name')
    await page.waitForTimeout(300)

    // Double-click the table name on the canvas
    const tableNode = page.locator('span:has-text("canvas_name")').last()
    await tableNode.dblclick()
    await page.waitForTimeout(300)

    // The rename uses an input with v-model inside the table node header
    const renameInput = page.locator('div[class*="absolute"] input')
    if (await renameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await renameInput.fill('renamed')
      await renameInput.press('Enter')
    } else {
      // Fallback: maybe the v-model input uses a different wrapper
      const inputs = page.locator('input[value="canvas_name"]')
      if (await inputs.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await inputs.first().fill('renamed')
        await inputs.first().press('Enter')
      }
    }
    await page.waitForTimeout(500)

    await expect(page.getByText('renamed', { exact: true }).first()).toBeVisible()
  })
})
