import { QueryClient, isServer } from '@tanstack/react-query';

// One QueryClient per browser session; a fresh one per server request. Never new-up
// inline in render (that throws away the cache every render and breaks hydration).
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
