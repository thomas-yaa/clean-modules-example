// This is our custom server, written in Typescript, and is responsible for
// binding to a port and configuring Next.js and our code to response to
// requests. This is the only module we directly compile to JavaScript.
//
// NOTE: Trying to use any of the rest of our Typescript won't work because of
// necessary differences between tsconfig.json and tsconfig.server.json. Using
// ts-node fails because it does not support path maps, e.g. @/common.
import express from "express";
import { MikroORM, RequestContext } from "@mikro-orm/core";
import type { PostgreSqlDriver } from "@mikro-orm/postgresql"; // or any other driver package
import next from "next";
import pino from "pino";
import pinoHttp, { Options } from "pino-http";
import { loadEnvConfig } from "@next/env";
import url from "url";
import config from "./mikro-orm.config";
import Context from "node-execution-context";

const dev = process.env.NODE_ENV !== "production";

loadEnvConfig(process.cwd(), dev, pino());

const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "localhost";
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const pinoOptions: Options = {
  autoLogging: false,
  useLevel: dev ? "info" : "error",
};

app
  .prepare()
  .then(() => {
    const clientUrl = url.parse(process.env.DATABASE_URI!);
    console.debug(`Initializing database connection to ${clientUrl.hostname}`);
    return MikroORM.init<PostgreSqlDriver>(config);
  })
  .then((orm: MikroORM<PostgreSqlDriver>) => {
    console.debug("Database connection initialized");
    console.debug("Configuring Next.js/express request contexts");
    const server = express();

    server.use(pinoHttp(pinoOptions));

    server.use((req, _res, next) => {
      return Context.run(next, {
        requestId: req.id,
        log: req.log,
      });
    });
    server.use((_req, _res, next) => {
      RequestContext.create(orm.em, next);
    });

    server.all("*", (req, res) => handle(req, res));
    server.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
