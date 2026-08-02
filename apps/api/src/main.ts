import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as trpcExpress from '@trpc/server/adapters/express';
import { AppModule } from './app.module';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  const server = app.getHttpAdapter().getInstance();
  server.use('/trpc', trpcExpress.createExpressMiddleware({ router: appRouter, createContext }));
  await app.listen(3000);
  console.log('API JAMPACK sur http://localhost:3000  (tRPC: /trpc)');
}
bootstrap();
