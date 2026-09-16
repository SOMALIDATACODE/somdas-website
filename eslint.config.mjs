import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "work/**",
    "runtime.d.ts",
    "next-env.d.ts",
  ]),
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/admin/fields.tsx", "app/admin/workspace.tsx", "lib/section-catalog.ts"],
    rules: {
      // These recursive CMS adapters intentionally traverse schema-validated JSON.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["app/editor/editor.tsx", "app/editor/page.tsx"],
    rules: {
      // Public pages are Worker-rendered, so these links intentionally bypass the Next router.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
