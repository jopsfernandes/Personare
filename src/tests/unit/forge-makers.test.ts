import { expect, test } from "vitest";
import config from "../../../forge.config";
import pkg from "../../../package.json";

/*
 * Spec: docs/specs/linux-appimage-release.md
 * O release precisa trazer um AppImage para usuarios de Linux.
 */

const APPIMAGE_MAKER = "@reforged/maker-appimage";

function findAppImageMaker() {
  return config.makers?.find(
    (maker) => "name" in maker && maker.name === APPIMAGE_MAKER
  );
}

test("forge.config.ts declares the AppImage maker", () => {
  expect(findAppImageMaker()).toBeDefined();
});

test("AppImage maker only runs on Linux", () => {
  // The maker reports itself as supported everywhere, so without this the
  // Windows publish job would try (and fail) to build an AppImage.
  expect(findAppImageMaker()).toMatchObject({ platforms: ["linux"] });
});

test("AppImage maker launches the executable named after productName", () => {
  expect(findAppImageMaker()).toMatchObject({
    config: { options: { bin: pkg.productName } },
  });
});
