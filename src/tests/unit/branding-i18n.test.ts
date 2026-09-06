import i18n from "i18next";
import { expect, test } from "vitest";
import "@/localization/i18n";

/*
 * Criterio de aceite 3 (Issue #1 - Rebranding):
 * src/localization/i18n.ts deve expor appName = 'Personare' em todos os
 * idiomas configurados, com madeBy ajustado para o autor/organizacao correta
 * (sem referencias a LuanRoger).
 */

test("appName is 'Personare' for the en locale", () => {
  const bundle = i18n.getResourceBundle("en", "translation");

  expect(bundle.appName).toBe("Personare");
});

test("appName is 'Personare' for the pt-BR locale", () => {
  const bundle = i18n.getResourceBundle("pt-BR", "translation");

  expect(bundle.appName).toBe("Personare");
});

test("madeBy no longer references LuanRoger in any configured locale", () => {
  for (const locale of ["en", "pt-BR"]) {
    const bundle = i18n.getResourceBundle(locale, "translation");

    expect(bundle.madeBy.toLowerCase()).not.toContain("luanroger");
  }
});
