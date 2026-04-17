# Agent Instructions

- Responda de forma direta e objetiva.
- Antes de alterar algo maior, leia a arquitetura existente em [src/App.tsx](src/App.tsx), [src/hooks/useAuth.tsx](src/hooks/useAuth.tsx), [src/components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx), [src/pages/Login.tsx](src/pages/Login.tsx), [src/pages/Index.tsx](src/pages/Index.tsx) e [src/pages/Manager.tsx](src/pages/Manager.tsx).
- Use [README.md](README.md) apenas como ponto de partida; ele está mínimo e não deve ser duplicado aqui.
- Scripts principais: `npm run dev`, `npm run build`, `npm run lint`, `npm run test`, `npm run test:watch`.
- O app é uma SPA React + Vite com TypeScript, Tailwind, shadcn/ui, React Router, TanStack Query e Supabase; preserve esse stack ao evoluir funcionalidades.
- Autenticação e autorização passam por [src/hooks/useAuth.tsx](src/hooks/useAuth.tsx) e [src/components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx); não recrie essa lógica em páginas ou componentes.
- As rotas principais são `/` para login, `/painel` para operador e `/gestor` para gestor; mantenha essas convenções ao adicionar navegação.
- Componentes visuais seguem Tailwind + shadcn/ui e costumam usar o helper `cn` de [src/lib/utils.ts](src/lib/utils.ts); evite CSS novo quando uma classe utilitária resolver.
- Dados e tipos do Supabase ficam em [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts) e [src/integrations/supabase/types.ts](src/integrations/supabase/types.ts); prefira reutilizar esses pontos.
- Para mudanças em testes, siga o setup de Vitest existente e confira `test/**/*.ts` e `test/**/*.tsx` antes de criar convenções novas.
- Não mexa em arquivos gerados ou em componentes de UI compartilhados sem necessidade clara; prefira mudanças locais e mínimas.
