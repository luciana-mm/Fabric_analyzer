# 🧬 Fabric Analyzer Interface

**Plataforma web de análise colorimétrica de tecidos com controle operacional e gerencial.**

> **⚠️ Em desenvolvimento** | Última revisão: 14 de maio de 2026

---

## 📚 Documentação Principal

### 🔍 Comece aqui:

1. **[EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)** — Visão geral de 5 minutos
   - Status do projeto (6/10)
   - Problemas críticos
   - Roadmap de execução
   - **👉 Leia primeiro se for tomar decisões**

2. **[IMPROVEMENTS.md](IMPROVEMENTS.md)** — Plano detalhado de correções
   - 13 items críticos (P0, P1, P2)
   - Código de exemplo completo
   - Duração de cada task
   - **👉 Leia para entender cada problema**

3. **[IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)** — Como implementar
   - Passo-a-passo com exemplos
   - Comandos terminais
   - Checklist de validação
   - **👉 Leia quando for codificar**

4. **[AGENTS.md](AGENTS.md)** — Instruções para agents/automação
   - Guia de desenvolvimento
   - Convenções do projeto

---

## 🚀 Quick Start

### Pré-requisitos
- Node.js 18+
- Bun 1.0+ (ou npm/yarn)
- Conta Supabase configurada

### Setup Local

```bash
# 1. Clonar
git clone <repo-url>
cd fabric-analyzer-interface

# 2. Instalar dependências
bun install

# 3. Configurar .env
cp .env.example .env.local
# Editar com sua Supabase URL e keys

# 4. Executar migrations
bunx supabase migration up

# 5. Rodar dev server
bun run dev

# 6. Abrir http://localhost:3000
```

---

## 📋 Scripts Disponíveis

```bash
bun run dev          # Dev server (port 3000)
bun run build        # Build produção
bun run start        # Rodar build
bun run lint         # ESLint
bun run test         # Vitest run
bun run test:watch   # Vitest watch mode

# Supabase
bunx supabase migration up      # Executar migrations
bunx supabase db push          # Push schema remoto

# Câmera (Python)
bun run camera:install         # Install deps
bun run camera:proxy           # Rodar proxy (port 8090)
```

---

## 📁 Estrutura do Projeto

```
fabric-analyzer-interface/
├── src/
│   ├── app/                    # Next.js 15 App Router (rotas)
│   │   ├── layout.tsx          # Root layout com Providers
│   │   ├── page.tsx            # Login
│   │   ├── painel/page.tsx      # Painel Operador
│   │   ├── gestor/page.tsx      # Painel Gestor
│   │   └── calibrar-luz/        # Calibração de luz
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── auth/               # Auth components
│   │   └── ...
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.tsx         # Auth context + hook
│   │   ├── useOperatorSystemConfig.ts
│   │   ├── useCameraPreview.ts
│   │   └── useDashboardData.ts
│   ├── lib/                    # Utilities
│   │   ├── systemConfig.ts     # Sistema de configuração
│   │   ├── utils.ts            # cn() helper
│   │   └── ...
│   ├── integrations/
│   │   └── supabase/           # Supabase client + types
│   ├── test/                   # Testes Vitest
│   └── index.css               # Tailwind
├── supabase/
│   ├── config.toml
│   └── migrations/             # SQL migrations
├── camera-proxy/               # Python proxy da câmera
├── public/                     # Static assets
├── IMPROVEMENTS.md             # ⭐ Plano de correções
├── IMPLEMENTATION_CHECKLIST.md # ⭐ Como implementar
├── EXECUTIVE_SUMMARY.md        # ⭐ Resumo executivo
├── AGENTS.md                   # Instruções agents
├── .env.example                # Template env vars
├── tsconfig.json               # TypeScript config
├── eslint.config.js            # ESLint rules
├── tailwind.config.ts          # Tailwind config
├── vitest.config.ts            # Vitest config
└── next.config.js              # Next.js config
```

---

## 🔐 Autenticação & Roles

### Tipos de Usuário
- **Operador**: Acesso a `/painel` — faz análises
- **Gestor**: Acesso a `/gestor` — vê dados de todos

### Session Management
- **Timeout**: 15 minutos de inatividade
- **Storage**: Supabase Auth (localStorage)
- **RLS**: Habilitado (veja [IMPROVEMENTS.md#p0-3](IMPROVEMENTS.md#p0-3-supabase-rls))

### Fluxo de Login
```
Usuário digita email/senha
  ↓
Supabase Auth valida
  ↓
Session salva (localStorage)
  ↓
useAuth busca role em user_roles
  ↓
ProtectedRoute redireciona ao painel correto
```

---

## 💾 Database

### Tabelas Principais
- **profiles** — Informações de usuário
- **user_roles** — Role (operador/gestor)
- **operator_configurations** — Config por operador
- **analyses** — Registros de análise de tecido
- **tissue_batches** — Lotes de tecido analisados

### RLS (Row-Level Security)
- ✅ Ativado em todas tabelas
- ✅ Operadores veem apenas suas análises
- ✅ Gestores veem dados de todos
- Para detalhes, ver [IMPROVEMENTS.md#p0-3](IMPROVEMENTS.md#p0-3-supabase-rls)

---

## 🛠️ Stack Tecnológico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Framework** | Next.js | 15.3 |
| **UI** | React | 18.3 |
| **Linguagem** | TypeScript | 5.8 |
| **Styling** | Tailwind CSS | 3.4 |
| **Componentes** | shadcn/ui | Latest |
| **State Management** | TanStack Query | 5.83 |
| **Backend** | Supabase | Latest |
| **Auth** | Supabase Auth | JWT |
| **Database** | PostgreSQL | 14.5 |
| **Testes** | Vitest | 3.2 |
| **Linter** | ESLint | 9.32 |
| **Package Manager** | Bun | 1.0+ |

---

## 🚀 Deployment

### Desenvolvimento
```bash
bun run dev
# Acessar http://localhost:3000
```

### Staging/Produção
```bash
bun run build
npm start
```

### Variáveis de Ambiente
Criar `.env.local` com (veja `.env.example`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_CAMERA_PROXY_URL=
```

### CI/CD Recomendado
```yaml
# .github/workflows/build.yml
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run lint
      - run: npm run build
      - run: npm run test
```

---

## 📊 Status do Projeto

### Saúde Geral: 6/10 ⚠️

| Aspecto | Score | Status |
|---------|-------|--------|
| Arquitetura | 7/10 | ✅ Bom |
| Segurança | 7/10 | ⚠️ Precisa RLS |
| Testes | 2/10 | 🔴 **CRÍTICO** |
| Performance | 6/10 | ⚠️ Otimizável |
| Documentação | 4/10 | ⚠️ Incompleta |
| Type Safety | 5/10 | ⚠️ Strict=false |

### Problemas Críticos (P0)
- [ ] TypeScript strict mode — [IMPROVEMENTS.md#p0-1](IMPROVEMENTS.md#p0-1-typescript-strict-mode)
- [ ] ESLint strict — [IMPROVEMENTS.md#p0-2](IMPROVEMENTS.md#p0-2-eslint-strict)
- [ ] RLS no Supabase — [IMPROVEMENTS.md#p0-3](IMPROVEMENTS.md#p0-3-supabase-rls)
- [ ] Remove Pages Router — [IMPROVEMENTS.md#p0-4](IMPROVEMENTS.md#p0-4-remove-pages-router)

**Recomendação**: Resolver antes de produção. Tempo estimado: ~30 horas. Ver [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) para roadmap.

---

## 🧪 Testes

### Executar Testes
```bash
npm run test              # Uma vez
npm run test:watch       # Watch mode
npm run test -- --ui     # UI mode
```

### Cobertura
```bash
npm run test -- --coverage
```

### Arquivo de Setup
- `src/test/setup.ts` — Configuração Vitest + DOM mocks

---

## 🐛 Debugging

### Dev Tools
```bash
# Enable React DevTools
npm run dev

# Abrir DevTools (F12)
# - React tab
# - Network tab (Supabase requests)
# - Console (erros/warnings)
```

### Logs Úteis
```typescript
// useAuth.tsx — vê retry logic
console.log("[Auth] Fetching role...");

// useCameraPreview.ts — vê health checks
console.log("[Camera] Attempting connection...");
```

### Troubleshooting
| Problema | Solução |
|----------|---------|
| Camera offline | Rodar `bun run camera:proxy` |
| Supabase timeout | Verificar conexão de internet |
| Build errors | Deletar `.next/` e rebuild |
| ESLint errors | Rodar `npm run lint -- --fix` |

---

## 📖 Recursos Adicionais

### Documentação Externa
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [TanStack Query](https://tanstack.com/query/latest)

### Guias Internos
- [AGENTS.md](AGENTS.md) — Instruções para agentes
- [IMPROVEMENTS.md](IMPROVEMENTS.md) — Plano de correções (IMPORTANTE!)
- [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) — Como implementar

---

## 👥 Contribuindo

### Antes de fazer commit
```bash
npm run lint -- --fix    # Auto-fix linting
npm run test             # Rodar testes
npm run build            # Validar build
```

### Criando PR
1. Branch: `feat/feature-name` ou `fix/bug-name`
2. Escrever descrição clara
3. Referência a issues/tasks
4. Aguardar code review

### Convenções
- **Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`, `test:`
- **Branches**: `feat/nome`, `fix/nome`, `chore/nome`
- **Components**: PascalCase (`UserCard.tsx`)
- **Hooks**: camelCase com `use` prefix (`useUserData.ts`)
- **Utilities**: camelCase (`formatDate.ts`)

---

## 📞 Suporte

### Dúvidas?
1. Revisar [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)
2. Procurar em [IMPROVEMENTS.md](IMPROVEMENTS.md)
3. Consultar [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)
4. Procurar no Google (com contexto)
5. Pedir code review em PR

---

## 📄 Licença

[Adicionar licença aqui se houver]

---

## 🎯 Próximos Passos

**Para novos desenvolvedores**:
1. Ler este README (✓ feito!)
2. Ler [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) (5 min)
3. Rodar `bun run dev` (verificar setup)
4. Revisar [IMPROVEMENTS.md](IMPROVEMENTS.md) (plano de ação)

**Para líderes técnicos**:
1. Revisar [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) (status)
2. Planejar sprints usando [IMPROVEMENTS.md](IMPROVEMENTS.md)
3. Atribuir tasks de [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md#-roadmap-recomendado)

---

**Última atualização**: 14 de maio de 2026  
**Status**: 🟡 Em desenvolvimento | Aguardando correções P0  
**Documentação**: ✅ Completa
