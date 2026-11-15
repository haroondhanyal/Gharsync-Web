import "reflect-metadata";
import dotenv from "dotenv";
import { StandardSchemaValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

dotenv.config({ path: ["../../.env", ".env"] });

async function bootstrap() {
  const { AppModule } = await import("./app.module.js");
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  app.enableCors({ origin: webOrigin, credentials: true });
  app.enableCsrfProtection({ trustedOrigins: [webOrigin] });
  app.useGlobalPipes(
    new StandardSchemaValidationPipe(),
  );
  await app.listen(Number(process.env.API_PORT ?? 4000), "0.0.0.0");
}

void bootstrap();
