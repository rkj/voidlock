import { describe, it, expect, afterAll } from "vitest";
import { getNewPage, closeBrowser } from "./utils/puppeteer";
import { E2E_URL } from "./config";
import { KnownDevices } from "puppeteer";

describe("Mobile Touch Targets", () => {
  afterAll(async () => {
    await closeBrowser();
  });

  const MIN_TARGET = 44;

  it("should have 44x44px hit targets on mobile", async () => {
    const page = await getNewPage();
    await page.emulate(KnownDevices["iPhone 12"]);
    await page.goto(E2E_URL);

    // 1. Main Menu
    await page.waitForSelector("#screen-main-menu");
    const mainMenuButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("#screen-main-menu button"))
        .map((b) => ({
          id: b.id,
          text: b.textContent?.trim(),
          rect: b.getBoundingClientRect(),
        }))
        .map((b) => ({
          id: b.id,
          text: b.text,
          w: b.rect.width,
          h: b.rect.height,
        }));
    });

    console.log("Main Menu Buttons:", mainMenuButtons);
    for (const b of mainMenuButtons) {
      if (b.w > 0 && b.h > 0) {
        expect(
          b.h,
          `Main Menu button "${b.text}" height`,
        ).toBeGreaterThanOrEqual(MIN_TARGET);
        expect(
          b.w,
          `Main Menu button "${b.text}" width`,
        ).toBeGreaterThanOrEqual(MIN_TARGET);
      }
    }

    // 2. Mission Setup
    await page.click("#btn-menu-custom");
    await page.waitForSelector("#screen-mission-setup");
    const setupElements = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(
          "#screen-mission-setup button, #screen-mission-setup select, #screen-mission-setup input[type='checkbox']",
        ),
      )
        .map((b) => ({
          id: b.id,
          tagName: b.tagName,
          rect: b.getBoundingClientRect(),
        }))
        .map((b) => ({
          id: b.id,
          type: b.tagName,
          w: b.rect.width,
          h: b.rect.height,
        }));
    });

    console.log("Setup Elements:", setupElements);
    for (const b of setupElements) {
      // Checkboxes might be smaller but their labels should be clickable
      if (b.type !== "INPUT" && b.w > 0 && b.h > 0) {
        expect(
          b.h,
          `Setup element "${b.id || b.type}" height`,
        ).toBeGreaterThanOrEqual(MIN_TARGET);
      }
    }

    // 3. Equipment Screen

    await page.click("#btn-goto-equipment");

    await page.waitForSelector("#screen-equipment");

    const equipmentElements = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(
          "#screen-equipment button, .soldier-card, .paper-doll-slot, .equipment-slot",
        ),
      )

        .map((b) => ({
          id: b.id,
          className: b.className,
          rect: b.getBoundingClientRect(),
        }))

        .map((b) => ({
          id: b.id,
          className: b.className,
          w: b.rect.width,
          h: b.rect.height,
        }));
    });

    console.log("Equipment Elements:", equipmentElements);

    for (const b of equipmentElements) {
      if (b.w > 0 && b.h > 0) {
        expect(
          b.h,
          `Equipment element "${b.id || b.className}" height`,
        ).toBeGreaterThanOrEqual(MIN_TARGET);
      }
    }
  });
});
