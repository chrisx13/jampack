import { Module } from '@nestjs/common';

// Le routage métier passe par tRPC (voir src/trpc). Ce module NestJS sert
// de conteneur d'injection pour les futurs services (auth, tâches planifiées, etc.).
@Module({})
export class AppModule {}
