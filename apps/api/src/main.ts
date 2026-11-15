import "reflect-metadata";
import { StandardSchemaValidationPipe, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  app.enableCors({ origin: webOrigin, credentials: true });
  app.enableCsrfProtection({ trustedOrigins: [webOrigin] });
  app.useGlobalPipes(
    new StandardSchemaValidationPipe(),
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  await app.listen(Number(process.env.API_PORT ?? 4000), "0.0.0.0");
}

void bootstrap();
