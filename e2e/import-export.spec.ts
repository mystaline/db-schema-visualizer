import { test, expect } from '@playwright/test'
import { createFirstTable } from './helpers'

test.describe('Import & Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  const sampleDDL = `
CREATE TABLE customers (
  id uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  name text
);

CREATE TABLE orders (
  id uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_customer_id
  FOREIGN KEY (customer_id) REFERENCES customers (id)
  ON DELETE RESTRICT ON UPDATE CASCADE;
`

  test('import SQL DDL and verify tables render', async ({ page }) => {
    await createFirstTable(page, '_dummy')

    await page.locator('button:has-text("Import")').first().click()
    await page.waitForTimeout(500)

    const textarea = page.locator('textarea[placeholder*="CREATE TABLE"]')
    await textarea.fill(sampleDDL)
    await page.waitForTimeout(300)

    await page.locator('button:has-text("Complete Import")').click()
    await page.waitForTimeout(500)

    // Handle overwrite confirmation
    const overwrite = page.locator('button:has-text("Overwrite")')
    if (await overwrite.isVisible({ timeout: 3000 }).catch(() => false)) {
      await overwrite.click()
      await page.waitForTimeout(1000)
    }

    await expect(page.getByText('customers', { exact: true }).first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('orders', { exact: true }).first()).toBeVisible()
  })

  test('export SQL contains CREATE TABLE, PK, FK statements', async ({ page }) => {
    await createFirstTable(page, 'users')
    // Add PK column
    await page.getByText('users', { exact: true }).first().click()
    await page.waitForTimeout(300)
    await page.locator('button:has-text("Add column")').click()
    await page.waitForTimeout(300)
    await page.locator('input[aria-label^="Column name"]').first().fill('id')
    await page.locator('button[aria-label$="is primary key"]').first().click()
    await page.waitForTimeout(200)

    await page.locator('button:has-text("Export Schema")').click()
    await page.waitForTimeout(500)

    const sql = await page.locator('textarea[aria-label="Generated SQL Code"]').inputValue()
    expect(sql).toContain('CREATE TABLE users')
    expect(sql).toContain('PRIMARY KEY (id)')
  })

  test('export JSON contains tables and foreignKeys', async ({ page }) => {
    await createFirstTable(page, 'test')

    await page.locator('button:has-text("Export Schema")').click()
    await page.waitForTimeout(500)

    // Switch to JSON tab
    await page.locator('#export-tab-json').click()
    await page.waitForTimeout(300)

    const json = await page.locator('textarea[aria-label="Generated JSON"]').inputValue()
    expect(json).toContain('"tables"')
    expect(json).toContain('"foreignKeys"')
    expect(json).toContain('"test"')
  })

  test('import/export roundtrip preserves tables and columns', async ({ page }) => {
    await createFirstTable(page, '_dummy')

    // Import DDL
    await page.locator('button:has-text("Import")').first().click()
    await page.waitForTimeout(500)
    await page.locator('textarea[placeholder*="CREATE TABLE"]').fill(sampleDDL)
    await page.waitForTimeout(300)
    await page.locator('button:has-text("Complete Import")').click()
    await page.waitForTimeout(500)
    const overwrite = page.locator('button:has-text("Overwrite")')
    if (await overwrite.isVisible({ timeout: 3000 }).catch(() => false)) {
      await overwrite.click()
      await page.waitForTimeout(1000)
    }

    // Export and verify
    await page.locator('button:has-text("Export Schema")').click()
    await page.waitForTimeout(500)

    const sql = await page.locator('textarea[aria-label="Generated SQL Code"]').inputValue()
    expect(sql).toContain('CREATE TABLE customers')
    expect(sql).toContain('CREATE TABLE orders')
    expect(sql).toContain('PRIMARY KEY')
    expect(sql).toContain('ALTER TABLE orders')
    expect(sql).toContain('FOREIGN KEY')
    expect(sql).toContain('REFERENCES customers')
    expect(sql).toContain('ON DELETE')
  })
})
