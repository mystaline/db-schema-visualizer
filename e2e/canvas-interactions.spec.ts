import { test, expect } from '@playwright/test'
import { createFirstTable } from './helpers'

test.describe('Canvas Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('zoom-in and zoom-out via HUD buttons', async ({ page }) => {
    await createFirstTable(page, 'test_table')

    // Zoom in (+) twice
    const allButtons = page.locator('button')
    let zoomInBtn: any = null
    for (let i = 0; i < (await allButtons.count()); i++) {
      if ((await allButtons.nth(i).textContent())?.trim() === '+') {
        zoomInBtn = allButtons.nth(i)
        break
      }
    }
    expect(zoomInBtn).toBeTruthy()
    await zoomInBtn!.click()
    await page.waitForTimeout(200)
    await zoomInBtn!.click()
    await page.waitForTimeout(200)

    // Verify zoom percentage > 100%
    const zoomHud = page.locator('button:has-text("%")')
    const zoomText = await zoomHud.textContent()
    const pct = parseInt((zoomText || '100%').replace('%', ''))
    expect(pct).toBeGreaterThan(100)

    // Fit reset
    await page.locator('button:has-text("Fit")').click()
    await page.waitForTimeout(200)
    const afterFit = await zoomHud.textContent()
    expect(afterFit).toContain('100%')
  })

  test('zoom with Ctrl+scroll wheel', async ({ page }) => {
    await createFirstTable(page, 'test_table')

    const canvas = page.locator('.bg-secondary-950').first()

    // Ctrl+scroll down (zoom out)
    await canvas.dispatchEvent('wheel', {
      deltaY: 100,
      ctrlKey: true,
    })
    await page.waitForTimeout(200)

    const zoomHud = page.locator('button:has-text("%")')
    const beforeFit = await zoomHud.textContent()
    const beforePct = parseInt((beforeFit || '100%').replace('%', ''))

    // Fit to reset
    await page.locator('button:has-text("Fit")').click()
    await page.waitForTimeout(200)
    const afterFit = await zoomHud.textContent()
    expect(afterFit).toContain('100%')
  })

  test('keyboard Delete removes selected table with confirmation', async ({ page }) => {
    await createFirstTable(page, 'doomed')

    await page.getByText('doomed', { exact: true }).first().click()
    await page.waitForTimeout(300)

    await page.keyboard.press('Delete')
    await page.waitForTimeout(500)

    await expect(page.locator('h2:has-text("Delete Table")')).toBeVisible({ timeout: 3000 })
    await page.locator('button.bg-danger-500').click()
    await page.waitForTimeout(500)

    // Table deleted — auto-opens create modal since canvas is empty
    // Verify the create modal is visible again
    await expect(page.locator('input[placeholder="e.g. user_profiles"]')).toBeVisible({ timeout: 3000 })
  })
})
