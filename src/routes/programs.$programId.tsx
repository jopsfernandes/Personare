// biome-ignore-all lint/style/useFilenamingConvention: TanStack Router file-based routing requires the "$paramName" filename convention for dynamic route segments.
import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Pathless layout: TanStack Router's flat-file convention nests
 * `programs.$programId.modules.$moduleId.tsx` under this route (its
 * filename is a prefix match), so this component must render an
 * `<Outlet />` for that child route to ever mount. The actual Modules
 * list UI lives in the sibling index route, `programs.$programId.index.tsx`
 * (`/programs/$programId/`), which renders through this Outlet too.
 */
export const Route = createFileRoute("/programs/$programId")({
  component: Outlet,
});
