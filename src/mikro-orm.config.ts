import { TsMorphMetadataProvider } from "@mikro-orm/reflection";
import { loadEnvConfig } from "@next/env";

// NOTE: this module is imported by server.ts, our custom server, which has a
// limitation that anything the server imports, directly or indirectly, cannot
// use our @/ imports
import { ENTITIES } from "./entities";

loadEnvConfig(process.cwd());

export default {
  type: "postgresql",
  entities: ENTITIES,
  clientUrl: process.env.DATABASE_URI!,
  debug: process.env.DEBUG_SQL !== undefined,
  metadataProvider: TsMorphMetadataProvider,
  cache: {
    options: {
      cacheDir: "./.mikro-orm.cache/",
    },
  },
  migrations: {
    path: undefined,
    pathTs: "./migrations",
    disableForeignKeys: false,
  },
} as const;
