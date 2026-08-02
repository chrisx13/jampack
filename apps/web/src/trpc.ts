import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@jampack/api';

export const trpc = createTRPCReact<AppRouter>();
