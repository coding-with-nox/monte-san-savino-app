import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const logLevel = process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug");

export const logger = pino({
  level: logLevel,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }),
  redact: {
    paths: [
      "password",
      "passwordHash",
      "authorization",
      "headers.authorization",
      "body.password",
      "body.refreshToken",
      "body.code_verifier",
      "accessToken",
      "refreshToken",
      "token",
      "secret",
      "cookie",
    ],
    censor: "[Redacted]",
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

export type Logger = typeof logger;
