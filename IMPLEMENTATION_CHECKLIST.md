# 🛠️ Guia Prático de Implementação — Code Review Corrections

**Documento complementar a IMPROVEMENTS.md com exemplos passo-a-passo**

---

## 📋 Tabela Rápida de Referência

| Problema | Arquivo | Solução Rápida | Exemplo |
|----------|---------|---|---------|
| `strict: false` | `tsconfig.json` | Mudar para `true` | [Ver P0-1](#p0-1-typescript-strict-mode) |
| RLS não ativado | Supabase | Criar migration SQL | [Ver P0-3](#p0-3-supabase-rls) |
| ESLint permissivo | `eslint.config.js` | Ativar no-unused-vars | [Ver P0-2](#p0-2-eslint-strict) |
| Pages Router legacy | `src/pages/` | Deletar folder | [Ver P0-4](#p0-4-remove-pages-router) |
| Sem retry auth | `useAuth.tsx` | Add fetchRoleWithRetry | [Ver P1-5](#p1-5-auth-retry) |
| Queries N+1 | `useDashboardData.ts` | Usar aggregation SQL | [Ver P1-6](#p1-6-query-optimization) |
| Sem testes | `src/test/` | Criar test files | [Ver P1-8](#p1-8-tests-setup) |

---

## 🔧 IMPLEMENTAÇÃO PASSO-A-PASSO

### P0-1: TypeScript Strict Mode

**Duração**: ~4 horas  
**Passos**:

**1. Atualizar `tsconfig.json`:**

```bash
cd c:\Users\unesc\Documents\keven\fabric-analyzer-interface
```

**Arquivo**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "noImplicitAny": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**2. Verificar erros**:
```bash
npm run build
# Irá listar todos os erros de tipo
```

**3. Corrigir erros encontrados** — Exemplos comuns:

**Erro 1: Null checking**
```typescript
// ❌ Erro: Property 'role' does not exist on type 'null'
setRole((data?.role as AppRole) ?? null);

// ✅ Corrigido:
if (data && 'role' in data) {
  setRole(data.role as AppRole);
} else {
  setRole(null);
}
```

**Erro 2: Function return types**
```typescript
// ❌ Erro: Function lacks ending return statement
const fetchRole = async (userId: string) => {
  try {
    // ...
  } catch (err) {
    console.error(err);
    // ❌ Falta return no catch
  }
};

// ✅ Corrigido:
const fetchRole = async (userId: string): Promise<void> => {
  try {
    // ...
  } catch (err) {
    console.error(err);
    return;
  }
};
```

**4. Validar build final**:
```bash
npm run build
npm run lint
# Sem erros ✅
```

---

### P0-2: ESLint Strict

**Duração**: ~2 horas

**Arquivo**: `eslint.config.js`

**Antes**:
```javascript
rules: {
  "@typescript-eslint/no-unused-vars": "off",  // ❌
}
```

**Depois**:
```javascript
"@typescript-eslint/no-unused-vars": [
  "error",
  {
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^_",
    caughtErrorsIgnorePattern: "^_",
  },
],
```

**Instalare husky + lint-staged**:
```bash
npm install --save-dev husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

**Criar `.lintstagedrc.json`**:
```json
{
  "**/*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ]
}
```

**Validar**:
```bash
npm run lint
# Sem erros ou warnings
```

---

### P0-3: Supabase RLS

**Duração**: ~2-3 horas

**Criar migration**:
```bash
bunx supabase migration create add_rls_policies
```

**Arquivo gerado**: `supabase/migrations/20260514_add_rls_policies.sql`

```sql
-- 1. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tissue_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 2. PROFILES policy
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. OPERATOR_CONFIGURATIONS policy
CREATE POLICY "Operators view own config or gestors view all"
  ON operator_configurations FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'
    )
  );

CREATE POLICY "Operators update own config"
  ON operator_configurations FOR UPDATE
  USING (auth.uid() = user_id);

-- 4. ANALYSES policy
CREATE POLICY "Users view own analyses or gestors view all"
  ON analyses FOR SELECT
  USING (
    operator_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'
    )
  );

CREATE POLICY "Operators insert own analyses"
  ON analyses FOR INSERT
  WITH CHECK (operator_user_id = auth.uid());

-- 5. USER_ROLES policy
CREATE POLICY "Users view own role"
  ON user_roles FOR SELECT
  USING (user_id = auth.uid());

-- 6. TISSUE_BATCHES policy
CREATE POLICY "Gestors view tissue batches"
  ON tissue_batches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'
    )
  );
```

**Executar migration**:
```bash
bunx supabase migration up
```

**Testar RLS** (no dashboard Supabase):
```sql
-- Como operador (user_id = xyz)
SELECT * FROM analyses;  -- Vê apenas suas análises ✅

-- Como outro operador
SELECT * FROM analyses;  -- Vê vazio ✅

-- Como gestor
SELECT * FROM analyses;  -- Vê todas ✅
```

---

### P0-4: Remove Pages Router

**Duração**: ~3-4 horas

**Estrutura antes**:
```
src/
  pages/
    Login.tsx         ← REMOVER
    Index.tsx         ← REMOVER
    Manager.tsx       ← REMOVER
  app/
    page.tsx          (importa Login.tsx) ❌
    painel/
      page.tsx        (importa Index.tsx) ⚠️
    gestor/
      page.tsx        (importa Manager.tsx) ⚠️
```

**Passo 1: Consolidar `src/app/page.tsx` (Login)**

**Antes** (`src/app/page.tsx`):
```typescript
export { default } from "@/pages/Login";
```

**Depois** (`src/app/page.tsx`):
```typescript
import LoginForm from "@/components/auth/LoginForm";

export const metadata = {
  title: "Login — Meta Classificador",
};

export default function LoginPage() {
  return <LoginForm />;
}
```

**Passo 2: Consolidar `src/app/painel/page.tsx` (Operador)**

**Antes** (`src/app/painel/page.tsx`):
```typescript
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "@/pages/Index";

export default function PainelPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <Index />
    </ProtectedRoute>
  );
}
```

**Depois** (`src/app/painel/page.tsx`):
```typescript
import { ProtectedRoute } from "@/components/ProtectedRoute";
import OperatorDashboard from "@/components/dashboard/OperatorDashboard";

export const metadata = {
  title: "Painel do Operador — Meta Classificador",
};

export default function PainelPage() {
  return (
    <ProtectedRoute requireRole="operador">
      <OperatorDashboard />
    </ProtectedRoute>
  );
}
```

**Passo 3: Mover componentes**

```bash
# Criar novo component
mkdir -p src/components/dashboard

# Mover e renomear
mv src/pages/Index.tsx src/components/dashboard/OperatorDashboard.tsx
mv src/pages/Manager.tsx src/components/dashboard/ManagerDashboard.tsx

# Remover folder pages
rm -rf src/pages/
```

**Passo 4: Atualizar imports em `next.config.js` (se houver)**

```javascript
// ❌ Remover página legada se houver:
// pageExtensions: ['page.tsx', 'page.ts'],
```

**Passo 5: Validar**

```bash
npm run build
# Sem warnings sobre Pages Router ✅

# Testar links
npm run dev
# Acessar http://localhost:3000 → Login deve funcionar
```

---

### P1-5: Auth Retry Logic

**Duração**: ~2-3 horas

**Arquivo**: `src/hooks/useAuth.tsx`

**Apenas seção de retry**:

```typescript
const ROLE_FETCH_MAX_RETRIES = 3;
const ROLE_FETCH_RETRY_DELAY_MS = 1000;

const fetchRoleWithRetry = async (
  userId: string,
  attempt: number = 1
): Promise<void> => {
  try {
    const { data, error: fetchError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      if (attempt < ROLE_FETCH_MAX_RETRIES) {
        // Retry com backoff exponencial
        await new Promise((resolve) =>
          setTimeout(resolve, ROLE_FETCH_RETRY_DELAY_MS * attempt)
        );
        return fetchRoleWithRetry(userId, attempt + 1);
      }
      console.error(`Falha após ${attempt} tentativas:`, fetchError);
      setRole(null);
      return;
    }

    setRole((data?.role as AppRole) ?? null);
  } catch (err) {
    if (attempt < ROLE_FETCH_MAX_RETRIES) {
      await new Promise((resolve) =>
        setTimeout(resolve, ROLE_FETCH_RETRY_DELAY_MS * attempt)
      );
      return fetchRoleWithRetry(userId, attempt + 1);
    }
    console.error("Erro ao buscar role:", err);
    setRole(null);
  } finally {
    setLoading(false);
  }
};
```

**Testar**:
```typescript
// Desabilitar internet momentaneamente → Verá retry happening ✅
```

---

### P1-6: Query Optimization

**Duração**: ~2-3 horas

**Arquivo**: `supabase/migrations/20260514_operator_stats.sql`

```sql
CREATE OR REPLACE FUNCTION get_operator_stats(p_user_id UUID)
RETURNS TABLE (
  total_verified BIGINT,
  total_success BIGINT,
  total_failure BIGINT,
  avg_time_ms NUMERIC,
  success_rate NUMERIC
) AS $$
  SELECT
    COUNT(*) as total_verified,
    COUNT(*) FILTER (WHERE result = 'ok') as total_success,
    COUNT(*) FILTER (WHERE result = 'fail') as total_failure,
    COALESCE(AVG(processing_time_ms), 0) as avg_time_ms,
    ROUND(
      COUNT(*) FILTER (WHERE result = 'ok')::NUMERIC / 
      NULLIF(COUNT(*), 0) * 100,
      1
    ) as success_rate
  FROM analyses
  WHERE operator_user_id = p_user_id;
$$ LANGUAGE SQL STABLE;
```

**Usar em hook** (`src/hooks/useDashboardData.ts`):

```typescript
// ❌ Antes
const { data: allAnalyses } = await supabase
  .from("analyses")
  .select("*")
  .eq("operator_user_id", userId);

// ✅ Depois
const { data: stats } = await supabase.rpc("get_operator_stats", {
  p_user_id: userId,
});

const { totalVerified, totalSuccess, totalFailure, avgTimeMs, successRate } =
  stats?.[0] ?? {};
```

---

### P1-7: Adicionar Índices

**Duração**: ~1 hora

**Arquivo**: `supabase/migrations/20260514_add_indexes.sql`

```sql
-- Índices simples
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_operator_configurations_user_id 
  ON operator_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_operator_user_id 
  ON analyses(operator_user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- Índices compostos (multi-column)
CREATE INDEX IF NOT EXISTS idx_analyses_operator_result
  ON analyses(operator_user_id, result);

CREATE INDEX IF NOT EXISTS idx_analyses_operator_date
  ON analyses(operator_user_id, analyzed_at DESC);

-- Índices BRIN (série temporal)
CREATE INDEX IF NOT EXISTS idx_analyses_created_at_brin
  ON analyses USING BRIN (analyzed_at);
```

**Executar**:
```bash
bunx supabase migration up
```

**Verificar**:
```bash
bunx supabase db push
# Log deve mostrar índices criados
```

---

### P1-8: Tests Setup

**Duração**: ~3-4 horas

**1. Instalar dependências**:
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

**2. Criar `src/lib/systemConfig.test.ts`** (veja arquivo IMPROVEMENTS.md — P1-8 section)

**3. Executar testes**:
```bash
npm run test
# Deve rodar e passar ✅
```

**4. Watch mode**:
```bash
npm run test:watch
# Rerun automaticamente ao salvar ✅
```

**5. Coverage**:
```bash
npm install --save-dev @vitest/coverage-v8
npm run test -- --coverage
```

---

### P1-9: Otimizar Imagens

**Duração**: ~1-2 horas

**Instalar package** (já incluído no Next.js):
```bash
# Sem necessidade, vem com next
```

**Converter uso**:

**Antes** (`src/pages/Login.tsx`):
```typescript
import gridBg from "@/assets/grid-bg.jpg";

<img
  src={gridBg.src}
  alt=""
  className="absolute inset-0 w-full h-full object-cover opacity-20"
/>
```

**Depois** (`src/app/page.tsx`):
```typescript
import Image from "next/image";
import gridBg from "@/assets/grid-bg.jpg";

<Image
  src={gridBg}
  alt="Grid background"
  fill
  priority
  className="absolute inset-0 object-cover opacity-20"
  sizes="100vw"
  quality={85}
/>
```

**Benefícios**:
- ✅ Lazy loading automático
- ✅ Responsive images
- ✅ WebP format
- ✅ Size optimization

---

### P2-10: README Documentation

**Duração**: ~1 hora

Veja arquivo completo em `IMPROVEMENTS.md` — P2-10 section

**Criar** `README.md` com:
- Quick start
- Estrutura do projeto
- Scripts disponíveis
- Database info
- Environment variables

---

## 📊 Progresso Visual

```
┌─────────────────────────────────────────────┐
│          IMPLEMENTAÇÃO POR FASE             │
├─────────────────────────────────────────────┤
│ Fase 1: Setup Crítico       ████░░░░░░░ 40% │
│ Fase 2: Segurança & Dados   ░░░░░░░░░░░  0% │
│ Fase 3: Qualidade           ░░░░░░░░░░░  0% │
│ Fase 4: Refactor            ░░░░░░░░░░░  0% │
│                                              │
│ Total:                       ████░░░░░░░ 10% │
└─────────────────────────────────────────────┘
```

---

## 🚀 Comandos de Execução Rápida

### Build e validação
```bash
# Checar tudo
npm run build && npm run lint && npm run test

# Dev mode com watch
npm run dev &
npm run test:watch

# Deploy staging
npm run build
# Upload para server
```

### Supabase
```bash
# Push migrations
bunx supabase migration up

# Listar migrations
bunx supabase migration list

# Reset DB (dev only!)
bunx supabase migration reset
```

---

## 📝 Checklist de Validação

Após cada correção, validar com:

- [ ] Build sem erros: `npm run build` ✅
- [ ] Lint sem erros: `npm run lint` ✅
- [ ] Testes passando: `npm run test` ✅
- [ ] Dev mode funciona: `npm run dev` ✅
- [ ] Sem console errors/warnings

---

## 💡 Dicas de Implementação

1. **Criar branch para cada item**:
   ```bash
   git checkout -b feat/p0-1-typescript-strict
   ```

2. **Commit incrementais**:
   ```bash
   git add tsconfig.json
   git commit -m "chore: enable typescript strict mode"
   ```

3. **PR com description clara**:
   - Referência a IMPROVEMENTS.md item
   - Evidência de testes
   - Screenshots se aplicável

4. **Depois do merge**:
   - Delete branch local
   - Atualizar checklist em IMPROVEMENTS.md

---

## ⚡ Próximos Passos

1. ✅ Ler IMPROVEMENTS.md completo
2. ✅ Priorizar por sprint (recomendado: 1 item P0 por semana)
3. ✅ Criar branches
4. ✅ Implementar seguindo exemplos acima
5. ✅ Testar rigorosamente
6. ✅ Code review
7. ✅ Merge para main
8. ✅ Deploy

---

**Última atualização**: 14 de maio de 2026  
**Status**: Pronto para execução  
**Documentado**: Sim ✅
