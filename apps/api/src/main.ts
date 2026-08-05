import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as trpcExpress from '@trpc/server/adapters/express';
import { AppModule } from './app.module';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS restreint à l'origine du front en prod (WEB_ORIGIN = liste séparée par des virgules).
  // Sans variable définie (dev) → réflexion de l'origine, comme auparavant.
  const allowed = (process.env.WEB_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({ origin: allowed.length ? allowed : true, credentials: true });

  const server = app.getHttpAdapter().getInstance();
  server.disable('x-powered-by');
  // En-têtes de sécurité (défense en profondeur ; nginx en pose aussi côté navigateur).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'"); // API JSON : aucune ressource
    next();
  });

  server.use('/trpc', trpcExpress.createExpressMiddleware({ router: appRouter, createContext }));
  await app.listen(3000);
  console.log('API JAMPACK sur http://localhost:3000  (tRPC: /trpc)');
}
bootstrap();
