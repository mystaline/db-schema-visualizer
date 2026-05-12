import { test, expect } from '@playwright/test'
import { createFirstTable } from './helpers'

test.describe('Indexes & Constraints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('add constraint with auto-generated name', async ({ page }) => {
    await createFirstTable(page, 'products')
    await page.getByText('products', { exact: true }).first().click()
    await page.waitForTimeout(300)

    // Add column "price"
    await page.locator('button:has-text("Add column")').click()
    await page.waitForTimeout(300)
    await page.locator('input[aria-label^="Column name"]').first().fill('price')
    await page.waitForTimeout(200)

    // Switch to Constraints tab
    await page.locator('button:has-text("Constraints")').first().click()
    await page.waitForTimeout(300)

    // Add constraint
    await page.locator('textarea[placeholder*="status"]').fill('price > 0')
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Lock Logic Integrity")').click()
    await page.waitForTimeout(500)

    await expect(page.locator('text=chk_products_price0')).toBeVisible({ timeout: 3000 })
  })

  test('add index on column and verify in SQL export', async ({ page }) => {
    await createFirstTable(page, 'users')
    await page.getByText('users', { exact: true }).first().click()
    await page.waitForTimeout(300)

    // Add column "email"
    await page.locator('button:has-text("Add column")').click()
    await page.waitForTimeout(300)
    await page.locator('input[aria-label^="Column name"]').first().fill('email')
    await page.waitForTimeout(200)

    // Switch to Indexes tab
    await page.locator('button:has-text("Indexes")').first().click()
    await page.waitForTimeout(300)

    // Add column to index
    await page.locator('button:has-text("+ email")').click()
    await page.waitForTimeout(500)

    // Make it unique
    const uniqueCheckbox = page.locator('input[type="checkbox"]')
    if (await uniqueCheckbox.isVisible()) {
      await uniqueCheckbox.click()
    }
    await page.waitForTimeout(200)

    // Submit
    await page.locator('button:has-text("Register Index Optimizer")').click()
    await page.waitForTimeout(500)

    await expect(page.locator('text=unq_users_email')).toBeVisible({ timeout: 3000 })

    // Verify in SQL export
    await page.locator('button:has-text("Export Schema")').click()
    await page.waitForTimeout(500)
    const sql = await page.locator('textarea[aria-label="Generated SQL Code"]').inputValue()
    expect(sql).toContain('CREATE UNIQUE INDEX')
    expect(sql).toContain('unq_users_email')
  })

  test('rename column cascades to index and constraint names', async ({ page }) => {
    await createFirstTable(page, 'products')
    await page.getByText('products', { exact: true }).first().click()
    await page.waitForTimeout(300)

    await page.locator('button:has-text("Add column")').click()
    await page.waitForTimeout(300)
    const colInput = page.locator('input[aria-label^="Column name"]').first()
    await colInput.fill('price')
    await page.waitForTimeout(200)

    // Set type to numeric
    await page.locator('button:has-text("varchar")').first().click()
    await page.waitForTimeout(200)
    await page.locator('input[placeholder="Search or type custom..."]').fill('numeric')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)

    // Add constraint
    await page.locator('button:has-text("Constraints")').first().click()
    await page.waitForTimeout(300)
    await page.locator('textarea[placeholder*="status"]').fill('price > 0')
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Lock Logic Integrity")').click()
    await page.waitForTimeout(500)

    // Add index
    await page.locator('button:has-text("Indexes")').first().click()
    await page.waitForTimeout(300)
    await page.locator('button:has-text("+ price")').click()
    await page.waitForTimeout(500)
    await page.locator('button:has-text("Register Index Optimizer")').click()
    await page.waitForTimeout(500)

    // Rename column
    await page.locator('button:has-text("Columns")').first().click()
    await page.waitForTimeout(300)
    await page.locator('input[aria-label^="Column name"]').first().click()
    await page.locator('input[aria-label^="Column name"]').first().fill('unit_price')
    await page.waitForTimeout(500)

    // Verify constraint name cascaded
    await page.locator('button:has-text("Constraints")').first().click()
    await page.waitForTimeout(500)
    await expect(page.locator('text=chk_products_unit_price')).toBeVisible({ timeout: 3000 })

    // Verify index name cascaded
    await page.locator('button:has-text("Indexes")').first().click()
    await page.waitForTimeout(500)
    await expect(page.locator('text=idx_products_unit_price')).toBeVisible({ timeout: 3000 })
  })
})
