import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
  Architecture invariants (see ARCHITECTURE.md). Each rule below turns one written rule into a lint
  error, so the structure cannot drift silently. If a rule blocks you, the fix is almost always to
  move the code to the layer that owns it, not to disable the rule.
*/

const ONE_ICON_LIBRARY = {
  name: "lucide-react",
  message: "Use @phosphor-icons/react. The design system has one icon library.",
};

const NO_UPWARD_RELATIVE_IMPORTS = {
  group: ["../../*"],
  message: "Import across folders with the @/ alias, e.g. @/components/ui/Card. Relative imports stay within a feature folder.",
};

const NO_IMPORTS_FROM_ROUTES = {
  group: ["@/app/*"],
  message: "Route folders are private to their URL. Move shared code to src/components, src/services, src/hooks or src/lib.",
};

/** Inside one area (e.g. src/app/doctor-dashboard) its own shared folders may be imported by alias; other areas may not. */
const onlyOwnArea = (area) => ({
  group: ["@/app/*", `!@/app/${area}`, `!@/app/${area}/**`],
  message: `Files in src/app/${area} may import only their own area (@/app/${area}/...). Move shared code to src/components, src/services, src/hooks or src/lib.`,
});

const ROUTE_AREAS = ["patient-dashboard", "doctor-dashboard", "admin", "sign-in", "onboarding", "consultation", "pricing"];

const ENV_ONLY_IN_LIB_AND_SERVICES = {
  group: ["@/config/env"],
  message: "Only src/lib and src/services read configuration. Pages call a service instead.",
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  // Everywhere: one icon set, alias imports across folders, no reaching into another route.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { paths: [ONE_ICON_LIBRARY], patterns: [NO_UPWARD_RELATIVE_IMPORTS, NO_IMPORTS_FROM_ROUTES, ENV_ONLY_IN_LIB_AND_SERVICES] }],
      // fetch lives only in src/lib/http/apiClient.ts; storage only in src/lib
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Call a function in src/services/ (which uses apiRequest). Only src/lib/http/apiClient.ts calls fetch." },
        { name: "localStorage", message: "Use src/lib/session/authSession.ts or another module in src/lib/." },
        { name: "sessionStorage", message: "Use a module in src/lib/." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "fetch", message: "Only src/lib/http/apiClient.ts calls fetch." },
        { object: "window", property: "localStorage", message: "Only src/lib/ touches storage." },
        { object: "window", property: "alert", message: "Use the toast (useToast) or an inline message. Never alert()." },
        { object: "window", property: "confirm", message: "Use a Sheet to confirm. Never confirm()." },
      ],
      "no-alert": "error",
      "no-console": ["error", { allow: ["error"] }],
    },
  },

  // A route area may import its own shared folders by alias (nested pages reach components/ or styles/).
  ...ROUTE_AREAS.map((area) => ({
    files: [`src/app/${area}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": ["error", { paths: [ONE_ICON_LIBRARY], patterns: [NO_UPWARD_RELATIVE_IMPORTS, onlyOwnArea(area), ENV_ONLY_IN_LIB_AND_SERVICES] }],
    },
  })),

  // A feature is a self-contained flow used by more than one area (e.g. lab booking in onboarding and
  // the dashboard): it may call services, but never imports a route folder.
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { paths: [ONE_ICON_LIBRARY], patterns: [NO_UPWARD_RELATIVE_IMPORTS, NO_IMPORTS_FROM_ROUTES, ENV_ONLY_IN_LIB_AND_SERVICES] }],
    },
  },

  // The lib layer owns fetch, storage and configuration.
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-properties": "off",
      "no-restricted-imports": ["error", { paths: [ONE_ICON_LIBRARY], patterns: [NO_UPWARD_RELATIVE_IMPORTS, NO_IMPORTS_FROM_ROUTES] }],
    },
  },

  // Services talk to the backend through apiRequest; they never render or import UI.
  {
    files: ["src/services/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            NO_UPWARD_RELATIVE_IMPORTS,
            NO_IMPORTS_FROM_ROUTES,
            { group: ["@/components/*", "react", "next/*"], message: "Services are plain TypeScript: no React, no components." },
          ],
        },
      ],
    },
  },

  // The UI kit is presentational: it never calls the backend.
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [ONE_ICON_LIBRARY],
          patterns: [
            NO_UPWARD_RELATIVE_IMPORTS,
            NO_IMPORTS_FROM_ROUTES,
            ENV_ONLY_IN_LIB_AND_SERVICES,
            { group: ["@/services/*", "@/features/*"], message: "Shared components receive data as props. The page (or a feature) calls the service." },
          ],
        },
      ],
    },
  },

  // The public landing page is frozen (see ARCHITECTURE.md) and keeps its original code.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/**", "src/components/landing/**", "supabase/**"]),
]);
