import { defineConfig, globalIgnores } from "eslint/config";
import { builtinRules } from "eslint/use-at-your-own-risk";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const ALL_SOURCES = ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"];
const ROUTE_FILES = ["app/**/route.{ts,tsx,js,jsx,mjs,cjs,mts,cts}"];

// Each project check is the built-in no-restricted-syntax under its own name. A config block replaces a
// rule's whole setting for the files it matches, so one rule per concern lets a block change one concern
// without restating the others.
const restrictedSyntax = builtinRules.get("no-restricted-syntax");
const project = {
  rules: {
    "dynamic-imports": restrictedSyntax,
    "db-usage": restrictedSyntax,
    "entry-exports": restrictedSyntax,
  },
};

/** import() / require() of a module matching `source`, with a string or template literal. */
const dynamicImports = (source) => [
  `ImportExpression[source.value=/${source}/]`,
  `ImportExpression[source.quasis.0.value.cooked=/${source}/]`,
  `CallExpression[callee.name="require"][arguments.0.value=/${source}/]`,
  `CallExpression[callee.name="require"][arguments.0.quasis.0.value.cooked=/${source}/]`,
];
const withMessage = (message) => (selector) => ({ selector, message });

// Server resource boundary: modules matched by the end of the import path, so aliased and relative paths
// are both caught. `source` is the same match as a regex for import() / require() (`\x2F` stands for `/`
// inside an esquery selector).
const RESTRICTED = {
  db: {
    group: ["**/db"],
    source: String.raw`\x2Fdb$`,
    message:
      "Use the database only in the data access layer (data/). Call a data/ function, which authenticates and authorizes.",
  },
  prismaValues: {
    // Every generated Prisma module except the browser build.
    group: ["@/prisma/*", "!@/prisma/browser", "**/generated/prisma/*", "!**/generated/prisma/browser"],
    source: String.raw`(^@|\x2Fgenerated)\x2Fprisma\x2F(?!browser$)`,
    allowTypeImports: true,
    message:
      "Import Prisma Client values only in data/, lib/db.ts, and lib/server/. Use `import type` for types and `@/prisma/browser` for Decimal and enums.",
  },
  serverEnv: {
    group: ["**/env.server"],
    source: String.raw`\x2Fenv\.server$`,
    message: "Read server secrets only in data/ and server-only modules in lib/.",
  },
};

// Server-only modules that server code may import anywhere, but that code shared with the browser (domains/)
// must not, so a client component can import any domain module.
const SERVER_ONLY = {
  group: [
    "server-only",
    "next/headers",
    "next/server",
    "**/data/*",
    "**/lib/server/*",
  ],
  source: String.raw`^(server-only|next\x2Fheaders|next\x2Fserver)$|\x2F(data\x2F.+|lib\x2Fserver\x2F.+)$`,
  allowTypeImports: true,
  message:
    "domains/ is shared by server and browser code, so it imports no server-only module. Put server logic in data/.",
};

/** The boundary for files that may import only the named modules of RESTRICTED: every other one is blocked. */
const boundary = (...allowed) =>
  restrict(Object.entries(RESTRICTED).filter(([name]) => !allowed.includes(name)).map(([, entry]) => entry));

/** Blocks the given modules, by static import and by import() / require(). */
function restrict(entries) {
  return {
    "@typescript-eslint/no-restricted-imports": [
      "error",
      {
        patterns: entries.map(({ group, regex, allowTypeImports, message }) => ({
          ...(group ? { group } : { regex }),
          allowTypeImports,
          message,
        })),
      },
    ],
    // A severity with no options would inherit an earlier block's options, so an empty list turns the rule off.
    "project/dynamic-imports":
      entries.length === 0
        ? "off"
        : ["error", ...entries.flatMap(({ source, message }) => dynamicImports(source).map(withMessage(message)))],
  };
}

// data/ may query through db but never hand it out: db is imported under its own name and used only as
// `db.<model>` / `db.$...`, so it cannot be re-exported, returned, or passed on.
const DB_USAGE = [
  `:matches(ExportNamedDeclaration, ExportAllDeclaration)[source.value=/${RESTRICTED.db.source}/]`,
  `ImportDeclaration[source.value=/${RESTRICTED.db.source}/] > :matches(ImportNamespaceSpecifier, ImportSpecifier[local.name!="db"])`,
  `Identifier[name="db"]:not(.object):not(ImportSpecifier > Identifier)`,
].map(withMessage(RESTRICTED.db.message));

// Entry points: every exported Server Action and Route Handler goes through its error handler, so the
// Problem mapping and error reporting cannot be skipped. An export the rule cannot see through (a plain
// function, an alias, a re-export) is rejected rather than trusted.
const ACTION_FILE = `Program:has(> ExpressionStatement[directive="use server"])`;
const ACTION_EXPORTS = [
  `${ACTION_FILE} > ExportNamedDeclaration[exportKind!="type"]:not(:has(> VariableDeclaration))`,
  `${ACTION_FILE} > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator:not([init.type="CallExpression"][init.callee.name="withActionErrorHandler"])`,
  `${ACTION_FILE} > :matches(ExportDefaultDeclaration, ExportAllDeclaration)`,
].map(
  withMessage(
    'A "use server" file exports only actions, each as `export const name = withActionErrorHandler(...)` from @/lib/server/error-handlers.',
  ),
);
const HTTP_METHOD = "/^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/";
const ROUTE_EXPORTS = [
  `ExportNamedDeclaration > FunctionDeclaration[id.name=${HTTP_METHOD}]`,
  `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name=${HTTP_METHOD}]:not([init.type="CallExpression"][init.callee.name="withRouteErrorHandler"])`,
  `ExportSpecifier[exported.name=${HTTP_METHOD}]`,
  ":matches(ExportDefaultDeclaration, ExportAllDeclaration)",
].map(
  withMessage(
    "Export each Route Handler as `export const METHOD = withRouteErrorHandler(...)` from @/lib/server/error-handlers.",
  ),
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Prisma Client (`prisma generate`).
    "app/generated/**",
  ]),
  {
    // Vendored shadcn/ui output. These files are regenerated by the shadcn CLI
    // whenever a component is added or updated, so any inline eslint-disable
    // comment would be overwritten. Keep the exemptions here instead, and keep
    // them narrow so real issues in our own code still surface.
    name: "shadcn/ui generated",
    files: ["components/ui/**", "hooks/use-mobile.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // The checks every file gets (JS too: allowJs in tsconfig). Later blocks match narrower paths and
    // change or add checks for them.
    name: "project checks",
    files: ALL_SOURCES,
    plugins: { project },
    rules: {
      ...boundary(),
      "project/entry-exports": ["error", ...ACTION_EXPORTS],
    },
  },
  // Server resource boundary: the database and server secrets are reached only through the data
  // access layer (data/). Each block names what its paths may import; a later block wins for the same file.
  { name: "server boundary: lib", files: ["lib/**"], rules: boundary("serverEnv") },
  { name: "server boundary: lib/server", files: ["lib/server/**"], rules: boundary("serverEnv", "prismaValues") },
  { name: "server boundary: lib/db", files: ["lib/db.ts"], rules: boundary(...Object.keys(RESTRICTED)) },
  {
    // The Prisma Client module's own test runs queries against the test database.
    name: "server boundary: Prisma Client test",
    files: ["lib/db.vitest.test.ts"],
    rules: boundary("db", "prismaValues"),
  },
  {
    // The server env module's own test loads it with test values; it reads no real secret.
    name: "server boundary: server env test",
    files: ["config/env.server.vitest.test.ts"],
    rules: boundary("serverEnv"),
  },
  {
    // Domain code shared by server and browser: problem types, input schemas, constants.
    name: "server boundary: domains",
    files: ["domains/**"],
    rules: restrict([...Object.values(RESTRICTED), SERVER_ONLY]),
  },
  {
    // data/ functions only ever export authorized results (DTOs).
    name: "server boundary: data access layer",
    files: ["data/**"],
    rules: {
      ...boundary("db", "prismaValues", "serverEnv"),
      "project/db-usage": ["error", ...DB_USAGE],
    },
  },
  {
    name: "entry points: route handlers",
    files: ROUTE_FILES,
    rules: {
      "project/entry-exports": ["error", ...ACTION_EXPORTS, ...ROUTE_EXPORTS],
    },
  },
]);

export default eslintConfig;
