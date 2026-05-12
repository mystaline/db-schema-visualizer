import type { Page } from '@playwright/test'

/** Use the auto-opened CreateTableModal to create the first table on a fresh canvas. */
export async function createFirstTable(page: Page, name: string) {
  await page.waitForTimeout(1500)
  // Dismiss "What's New" modal if present
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
  await input.fill(name)
  await input.press('Enter')
  await page.waitForTimeout(500)
}
