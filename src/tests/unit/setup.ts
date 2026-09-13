import "@testing-library/jest-dom";

/*
 * jsdom nao implementa matchMedia nem ResizeObserver. O bloco shadcn/ui
 * "sidebar" (hook use-mobile) depende de window.matchMedia, e primitivas
 * Radix (ex.: Tooltip usado pelos itens da Sidebar) podem depender de
 * ResizeObserver. Sem esses polyfills os testes de componentes que usam
 * esse bloco quebram por causa do ambiente, nao da logica da Sidebar.
 */
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }) as unknown as MediaQueryList;
}

if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {
      // no-op in jsdom
    }
    unobserve() {
      // no-op in jsdom
    }
    disconnect() {
      // no-op in jsdom
    }
  };
}
