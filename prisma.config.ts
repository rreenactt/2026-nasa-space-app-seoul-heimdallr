import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // Multi-file schema: pointing at the directory reads every .prisma file under it.
  // (Pointing at a file reads only that file, and the other models silently drop out.)
  schema: "prisma",
  migrations: {
    // Must sit at the same level as schema.prisma (the datasource block).
    path: "prisma/migrations",
  },
  datasource: {
    // CLI-only connection (migrate and others): Neon's direct connection (host without `-pooler`), not the
    // pooled one, because migrations need a session that PgBouncer's transaction mode does not keep.
    // The `env()` helper throws when unset, which would also break `prisma generate` (postinstall) in hosted
    // builds without DIRECT_URL, so read process.env directly.
    url: process.env["DIRECT_URL"],
  },
});
