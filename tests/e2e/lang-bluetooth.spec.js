import { test, expect } from '@playwright/test';
import { createProfileAndGoHome } from './helpers.js';

test.describe('Language auto-detect', () => {
  test.describe('English browser', () => {
    test.use({ locale: 'en-GB' });
    test('UI switches to English and sets <html lang>', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('#go')).toContainText('Start');
      await createProfileAndGoHome(page, 'Lang');
      await expect(page.locator('.nav-btn[data-s="settings"] .lbl')).toHaveText('Settings');
    });
    test('explicit choice in settings overrides auto and persists', async ({ page }) => {
      await page.goto('/');
      await createProfileAndGoHome(page, 'Lang');
      await page.click('.nav-btn[data-s="settings"]');
      await page.locator('.st-sel').selectOption('fr');
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    });
  });
  test.describe('French browser', () => {
    test.use({ locale: 'fr-FR' });
    test('stays French', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
      await expect(page.locator('#go')).toContainText('Commencer');
    });
  });
});

test.describe('Bluetooth MIDI', () => {
  test('connects through Web Bluetooth and plays notes from BLE-MIDI packets', async ({ page }) => {
    await page.addInitScript(() => {
      const ch = new EventTarget();
      ch.startNotifications = async () => {};
      window.__bleEmit = bytes => { ch.value = new DataView(new Uint8Array(bytes).buffer); ch.dispatchEvent(new Event('characteristicvaluechanged')); };
      const dev = { name: 'Mock BLE Piano', addEventListener() {}, gatt: { disconnect() {}, connect: async () => ({ getPrimaryService: async () => ({ getCharacteristic: async () => ch }) }) } };
      Object.defineProperty(navigator, 'bluetooth', { value: { requestDevice: async () => dev }, configurable: true });
    });
    await page.goto('/');
    await createProfileAndGoHome(page, 'Ble');
    await page.click('#mpill');
    await expect(page.locator('#mpill')).toContainText('Mock BLE Piano');
    await page.click('.nav-btn[data-s="freeplay"]');
    await page.evaluate(() => window.__bleEmit([0x85, 0x91, 0x90, 60, 100]));   // header, timestamp, note-on C4
    const noteOn = page.locator('#fp [data-n="C4"]');
    await expect(noteOn).toHaveClass(/hit/);
    await page.evaluate(() => window.__bleEmit([0x85, 0x92, 0x80, 60, 0]));     // note-off
    await expect(noteOn).not.toHaveClass(/hit/);
  });
  test('pill shows an unsupported hint when neither Bluetooth nor Web MIDI exists', async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(navigator, 'bluetooth', { value: undefined }); Object.defineProperty(navigator, 'requestMIDIAccess', { value: undefined }); });
    await page.goto('/');
    await createProfileAndGoHome(page, 'NoBle');
    await expect(page.locator('#mpill')).toContainText(/Non supporté/);
  });
});
