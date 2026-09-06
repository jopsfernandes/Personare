import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { describe, expect, it, vi } from "vitest";
import ProgramsDataTable, {
  type Program,
} from "@/components/programs-data-table";
import "@/localization/i18n";

/**
 * RED phase (Issue #8, Spec Driven TDD): src/components/programs-data-table
 * does not exist yet. Every test below is expected to fail until Torno
 * (Developer) implements it.
 *
 * Contract exercised here (criterio de aceite 8: "renderizacao da Data
 * Table -- mostra os programas, botoes de acao presentes"):
 * - `programs` prop: rows rendered, one per program, showing its name.
 * - `onEdit(program)`: called when a row's edit action is triggered.
 * - `onRequestDelete(program)`: called when a row's delete action is
 *   triggered (naming signals it only *requests* the deletion -- the
 *   actual soft-delete confirmation/AlertDialog, per criterio 4, is the
 *   caller's responsibility, not the table's).
 * - `onNavigateToModules(program)`: called when a row's "view modules"
 *   action is triggered (criterio 5).
 * - Action labels come from i18next keys `editProgramAction`,
 *   `deleteProgramAction` and `viewModulesAction` (criterio 6: no
 *   hardcoded UI text) -- read through `i18n.t` so this test does not
 *   hardcode copy, only the key names Torno must add translations for.
 * - An empty `programs` list renders the `programsTableEmptyMessage` key.
 */

const PROGRAMS: Program[] = [
  {
    createdAt: new Date("2026-01-01"),
    id: "11111111-1111-1111-1111-111111111111",
    name: "Bacharelado II",
    updatedAt: new Date("2026-01-01"),
  },
  {
    createdAt: new Date("2026-02-01"),
    id: "22222222-2222-2222-2222-222222222222",
    name: "Pos I",
    updatedAt: new Date("2026-02-01"),
  },
];

function renderTable(programs: Program[] = PROGRAMS) {
  const onEdit = vi.fn();
  const onRequestDelete = vi.fn();
  const onNavigateToModules = vi.fn();

  render(
    <ProgramsDataTable
      onEdit={onEdit}
      onNavigateToModules={onNavigateToModules}
      onRequestDelete={onRequestDelete}
      programs={programs}
    />
  );

  return { onEdit, onNavigateToModules, onRequestDelete };
}

describe("ProgramsDataTable", () => {
  it("renders a row for each program with its name", () => {
    renderTable();

    expect(screen.getByText("Bacharelado II")).toBeInTheDocument();
    expect(screen.getByText("Pos I")).toBeInTheDocument();
  });

  it("renders the empty-state message when there are no programs", () => {
    renderTable([]);

    expect(
      screen.getByText(i18n.t("programsTableEmptyMessage"))
    ).toBeInTheDocument();
  });

  it("renders an edit, a delete and a view-modules action for every program", () => {
    renderTable();

    expect(
      screen.getAllByRole("button", { name: i18n.t("editProgramAction") })
    ).toHaveLength(PROGRAMS.length);
    expect(
      screen.getAllByRole("button", { name: i18n.t("deleteProgramAction") })
    ).toHaveLength(PROGRAMS.length);
    expect(
      screen.getAllByRole("button", { name: i18n.t("viewModulesAction") })
    ).toHaveLength(PROGRAMS.length);
  });

  it("calls onEdit with the corresponding program when its edit action is triggered", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderTable();

    const editButtons = screen.getAllByRole("button", {
      name: i18n.t("editProgramAction"),
    });
    await user.click(editButtons[1]);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(PROGRAMS[1]);
  });

  it("calls onRequestDelete with the corresponding program when its delete action is triggered", async () => {
    const user = userEvent.setup();
    const { onRequestDelete } = renderTable();

    const deleteButtons = screen.getAllByRole("button", {
      name: i18n.t("deleteProgramAction"),
    });
    await user.click(deleteButtons[0]);

    expect(onRequestDelete).toHaveBeenCalledTimes(1);
    expect(onRequestDelete).toHaveBeenCalledWith(PROGRAMS[0]);
  });

  it("calls onNavigateToModules with the corresponding program when its view-modules action is triggered", async () => {
    const user = userEvent.setup();
    const { onNavigateToModules } = renderTable();

    const viewModulesButtons = screen.getAllByRole("button", {
      name: i18n.t("viewModulesAction"),
    });
    await user.click(viewModulesButtons[0]);

    expect(onNavigateToModules).toHaveBeenCalledTimes(1);
    expect(onNavigateToModules).toHaveBeenCalledWith(PROGRAMS[0]);
  });
});

describe("Programs screen i18n keys (Issue #8)", () => {
  const REQUIRED_KEYS = [
    "editProgramAction",
    "deleteProgramAction",
    "viewModulesAction",
    "programsTableEmptyMessage",
  ];

  it.each(["en", "pt-BR"] as const)(
    "defines every ProgramsDataTable key for the %s locale",
    (locale) => {
      const bundle = i18n.getResourceBundle(locale, "translation") ?? {};

      for (const key of REQUIRED_KEYS) {
        expect(bundle).toHaveProperty(key);
      }
    }
  );
});
