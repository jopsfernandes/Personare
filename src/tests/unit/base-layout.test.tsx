import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import i18n from "i18next";
import { expect, test } from "vitest";
import BaseLayout from "@/layouts/base-layout";
import "@/localization/i18n";

/*
 * Spec: Issue #17 - Sidebar de navegacao.
 * Criterio 1: a Sidebar (bloco shadcn/ui) e renderizada no layout principal,
 * visivel em qualquer rota (aqui simulado com conteudo de rota arbitrario).
 * Criterio 5: a Sidebar e colapsavel via o controle padrao do bloco shadcn
 * (SidebarTrigger, cujo texto acessivel padrao e "Toggle Sidebar").
 */

const TOGGLE_SIDEBAR_NAME = /toggle sidebar/i;

function renderLayoutAt(initialPath: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <BaseLayout>
        <div data-testid="route-content">Route Content</div>
      </BaseLayout>
    ),
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    routeTree: rootRoute,
  });

  return render(<RouterProvider router={router} />);
}

test("renders the sidebar nav items alongside the routed content", async () => {
  renderLayoutAt("/");

  expect(await screen.findByTestId("route-content")).toBeInTheDocument();
  expect(
    await screen.findByRole("link", { name: i18n.t("navPrograms") })
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("link", { name: i18n.t("navCalendar") })
  ).toBeInTheDocument();
});

test("provides a control to collapse/expand the sidebar", async () => {
  renderLayoutAt("/");

  expect(
    await screen.findByRole("button", { name: TOGGLE_SIDEBAR_NAME })
  ).toBeInTheDocument();
});
