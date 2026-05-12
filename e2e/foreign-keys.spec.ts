import { test, expect } from '@playwright/test'
import { createFirstTable } from './helpers'

test.describe('Foreign Keys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('create FK between two tables with ON DELETE/ON UPDATE actions', async ({ page }) => {
    await createFirstTable(page, 'customers')
    // Add PK "id"
    await page.getByText('customers', { exact: true }).first().click()
    await page.waitForTimeout(300)
    await page.locator('button:has-text("Add column")').click()
    await page.waitForTimeout(300)
    await page.locator('input[aria-label^="Column name"]').first().fill('id')
    await page.locator('button[aria-label$="is primary key"]').first().click()
    await page.waitForTimeout(200)

    // Create "orders" table
    await page.locator('button:has-text("New Entity")').click()
    await page.waitForTimeout(400)
    await page.locator('input[placeholder="e.g. user_profiles"]').fill('orders')
    await page.locator('button:has-text("Create")').click()
    await page.waitForTimeout(500)

    // Add "customer_id" column
    await page.getByText('orders', { exact: true }).first().click()
    await page.waitForTimeout(300)
    await page.locator('button:has-text("Add column")').click()
    await page.waitForTimeout(300)
    await page.locator('input[aria-label^="Column name"]').first().fill('customer_id')
    await page.waitForTimeout(200)

    // Switch to Foreign Keys tab
    await page.locator('button:has-text("Foreign Keys")').first().click()
    await page.waitForTimeout(500)

    // === Create FK form: uses <select> elements in "Establish Link" section ===
    const selects = page.locator('select')

    // Source Column: first select in the create form
    await selects.nth(0).selectOption({ label: 'customer_id' })
    await page.waitForTimeout(200)

    // Target Table: second select
    await selects.nth(1).selectOption({ label: 'customers' })
    await page.waitForTimeout(300)

    // Target Reference: third select (populated after target table chosen)
    await selects.nth(2).selectOption({ label: 'id (PK)' })
    await page.waitForTimeout(200)

    // On Delete: fourth select
    await selects.nth(3).selectOption('CASCADE')
    await page.waitForTimeout(200)

    // On Update: fifth select
    await selects.nth(4).selectOption('SET NULL')
    await page.waitForTimeout(200)

    // Submit
    await page.locator('button:has-text("Link Attributes")').click()
    await page.waitForTimeout(500)

    // Verify FK is saved by checking export
    await page.locator('button:has-text("Export Schema")').click()
    await page.waitForTimeout(500)
    const sql = await page.locator('textarea[aria-label="Generated SQL Code"]').inputValue()
    expect(sql).toContain('FOREIGN KEY (customer_id) REFERENCES customers (id)')
    expect(sql).toContain('ON DELETE CASCADE')
    expect(sql).toContain('ON UPDATE SET NULL')
  })

  test('incoming relationships shown on target table', async ({ page }) => {
    await createFirstTable(page, 'users')
    // users: PK "id"
    await page.getByText('users', { exact: true }).first().click()
    await page.waitForTimeout(300)
    await page.locator('button:has-text("Add column")').click()
    await page.waitForTimeout(300)
    await page.locator('input[aria-label^="Column name"]').first().fill('id')
    await page.locator('button[aria-label$="is primary key"]').first().click()
    await page.waitForTimeout(200)

    // "posts" table with FK to users
    await page.locator('button:has-text("New Entity")').click()
    await page.waitForTimeout(400)
    await page.locator('input[placeholder="e.g. user_profiles"]').fill('posts')
    await page.locator('button:has-text("Create")').click()
    await page.waitForTimeout(500)
    await page.getByText('posts', { exact: true }).first().click()
    await page.waitForTimeout(300)
    await page.locator('button:has-text("Add column")').click()
    await page.waitForTimeout(300)
    await page.locator('input[aria-label^="Column name"]').first().fill('author_id')
    await page.waitForTimeout(200)

    // Add PK to posts too
    await page.locator('button:has-text("Add column")').click()
    await page.waitForTimeout(300)
    await page.locator('input[aria-label^="Column name"]').last().fill('post_id')
    await page.locator('button[aria-label$="is primary key"]').last().click()
    await page.waitForTimeout(200)

    // Switch to FK tab, create FK via selects
    await page.locator('button:has-text("Foreign Keys")').first().click()
    await page.waitForTimeout(500)

    const selects = page.locator('select')
    await selects.nth(0).selectOption({ label: 'author_id' })
    await page.waitForTimeout(200)
    await selects.nth(1).selectOption({ label: 'users' })
    await page.waitForTimeout(300)
    await selects.nth(2).selectOption({ label: 'id (PK)' })
    await page.waitForTimeout(200)
    await page.locator('button:has-text("Link Attributes")').click()
    await page.waitForTimeout(500)

    // Select "users" and check incoming
    await page.getByText('users', { exact: true }).first().click()
    await page.waitForTimeout(300)
    await page.locator('button:has-text("Foreign Keys")').first().click()
    await page.waitForTimeout(500)

    // Incoming FKs section should show posts → users reference
    // The incoming FK display has separate spans: "posts." and "author_id"
    await expect(page.locator('text="posts."').first()).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text="author_id"').last()).toBeVisible({ timeout: 3000 })
  })
})
