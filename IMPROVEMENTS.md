# 📋 Plano de Correções e Melhorias — Fabric Analyzer Interface

**Última atualização**: 14 de maio de 2026  
**Status**: Pronto para implementação  
**Prioridade Geral**: 6/10 (Crítico antes de produção)

---

## 📑 Índice

1. [P0 — Crítico](#p0--crítico)
2. [P1 — Alto](#p1--alto)
3. [P2 — Médio](#p2--médio)
4. [Checklist de Implementação](#-checklist-de-implementação)

---

## P0 — CRÍTICO

### 1. TypeScript: Ativar Strict Mode

**Arquivo**: `tsconfig.json`

**Problema**:
```json
{
  "strict": false,
  "strictNullChecks": false
}
```
- ❌ Permite `null`/`undefined` sem aviso
- ❌ Tipagem implícita de `any`
- ❌ Facilita bugs silenciosos em produção

**Solução**:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Impacto**: Haverá erros de compilação imediatos. Precisará corrigir:
- Tipos de retorno explícitos em funções
- `null` checks antes de acessar propriedades
- Tipos de catch blocks

**Tempo estimado**: 4-6 horas

---

### 2. ESLint: Ativar Validações Estritas

**Arquivo**: `eslint.config.js`

**Problema**:
```javascript
"@typescript-eslint/no-unused-vars": "off"  // ❌ Código morto
"react-refresh/only-export-components": ["warn", ...]  // ⚠️ Apenas warn
```

**Solução**:
```javascript
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".next"] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strict,
      ...tseslint.configs.stylistic,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "error",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-function-return-types": [
        "warn",
        { allowExpressions: true },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "no-console": [
        "warn",
        { allow: ["warn", "error", "info"] },
      ],
    },
  }
);
```

**Ações**:
- Adicionar husky + lint-staged para pre-commit
- Rodar `npm run lint` em CI/CD antes de merge

**Tempo estimado**: 2-3 horas

---

### 3. Supabase: Implementar Row-Level Security (RLS)

**Arquivo**: `supabase/migrations/` (nova migration)

**Problema**:
- ❌ Sem RLS, qualquer usuário logado pode acessar dados de outros
- ❌ Sem policies, dados são publicamente legíveis

**Solução** — Criar migration: `20260514_add_rls_policies.sql`

```sql
-- Enable RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tissue_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- PROFILES: Usuários veem apenas seu próprio perfil
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- OPERATOR_CONFIGURATIONS: Operadores veem/editam apenas sua config
CREATE POLICY "Operators can view their own config"
  ON operator_configurations FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'gestor'
    )
  );

CREATE POLICY "Operators can update their own config"
  ON operator_configurations FOR UPDATE
  USING (auth.uid() = user_id);

-- ANALYSES: Operadores veem suas análises; Gestores veem todas
CREATE POLICY "Users can view their own analyses"
  ON analyses FOR SELECT
  USING (
    operator_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'gestor'
    )
  );

CREATE POLICY "Operators can insert their own analyses"
  ON analyses FOR INSERT
  WITH CHECK (operator_user_id = auth.uid());

-- USER_ROLES: Apenas para leitura do próprio role
CREATE POLICY "Users can view their own role"
  ON user_roles FOR SELECT
  USING (user_id = auth.uid());

-- TISSUE_BATCHES: Gestores só leem, operadores não acessam diretamente
CREATE POLICY "Gestors can view tissue batches"
  ON tissue_batches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'gestor'
    )
  );
```

**Validação**:
```bash
# Testar RLS com token de usuário diferente
supabase functions deploy test-rls
```

**Tempo estimado**: 2-3 horas

---

### 4. Remover Pages Router Legacy

**Arquivos**: 
- `src/pages/` (TODO: deletar)
- `src/app/` (TODO: migrar tudo para cá)

**Problema**:
- ❌ Dois routers coexistem (confusão)
- ❌ `src/pages/Login.tsx` importado em `src/app/page.tsx`
- ❌ Duplicação de lógica

**Solução** — Migração passo-a-passo:

1. **Mover componentes críticos**:
```bash
# De src/pages/ para src/app/
- Login.tsx       → src/app/login/page.tsx
- Index.tsx       → src/app/painel/page.tsx (já existe, consolidar)
- Manager.tsx     → src/app/gestor/page.tsx (já existe, consolidar)
- CreateAccount.tsx → remover (signup integrado em login)
```

2. **Exemplo — Nova estrutura de login** (`src/app/login/page.tsx`):
```typescript
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoginForm />
    </div>
  );
}
```

3. **Deletar**:
- `src/pages/` (toda a pasta)
- Referências em `next.config.js` (se houver)

**Verificação**:
```bash
npm run build  # Não deve haver avisos sobre Pages Router
```

**Tempo estimado**: 3-4 horas

---

## P1 — ALTO

### 5. Autenticação: Adicionar Retry Logic e Error Handling

**Arquivo**: `src/hooks/useAuth.tsx`

**Problema**:
```typescript
const fetchRole = async (userId: string) => {
  try {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (error) {
      console.error("Erro ao buscar papel:", error);
      setRole(null);  // ❌ Sem retry
      return;
    }
    setRole((data?.role as AppRole) ?? null);
  } finally {
    setLoading(false);
  }
};
```

**Solução**:
```typescript
"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const ROLE_FETCH_MAX_RETRIES = 3;
const ROLE_FETCH_RETRY_DELAY_MS = 1000;

export type AppRole = "operador" | "gestor";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const fetchRoleWithRetry = async (userId: string, attempt: number = 1): Promise<void> => {
    try {
      const { data, error: fetchError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError) {
        if (attempt < ROLE_FETCH_MAX_RETRIES) {
          await new Promise((resolve) =>
            setTimeout(resolve, ROLE_FETCH_RETRY_DELAY_MS * attempt)
          );
          return fetchRoleWithRetry(userId, attempt + 1);
        }
        console.error(`Erro ao buscar role após ${attempt} tentativas:`, fetchError);
        setError("Falha ao carregar papel do usuário");
        setRole(null);
        return;
      }

      setRole((data?.role as AppRole) ?? null);
      setError(null);
    } catch (err) {
      console.error("Exceção ao buscar role:", err);
      if (attempt < ROLE_FETCH_MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, ROLE_FETCH_RETRY_DELAY_MS * attempt)
        );
        return fetchRoleWithRetry(userId, attempt + 1);
      }
      setError("Erro inesperado ao carregar papel");
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const {
          data: { session: existing },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          console.error("Erro ao carregar sessão:", sessionError);
          setError("Falha ao restaurar sessão");
          setLoading(false);
          return;
        }

        setSession(existing);
        setUser(existing?.user ?? null);

        if (existing?.user) {
          await fetchRoleWithRetry(existing.user.id);
        } else {
          setRole(null);
          setLoading(false);
        }
      } catch (err) {
        console.error("Erro crítico ao carregar sessão:", err);
        setError("Erro ao inicializar autenticação");
        setLoading(false);
      }
    };

    void loadSession();

    const { data: authData } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(true);
        setError(null);

        if (newSession?.user) {
          void fetchRoleWithRetry(newSession.user.id);
        } else {
          setRole(null);
          setLoading(false);
        }
      }
    );

    unsubscribeRef.current = () => {
      authData.subscription.unsubscribe();
    };

    return () => {
      mounted = false;
      unsubscribeRef.current?.();
    };
  }, []);

  // Inactivity timeout
  useEffect(() => {
    if (!user) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const triggerInactivitySignOut = async () => {
      try {
        unsubscribeRef.current?.();
        await supabase.auth.signOut();
        setRole(null);
        if (typeof window !== "undefined") {
          window.location.assign("/");
        }
      } catch (err) {
        console.error("Erro ao fazer logout por inatividade:", err);
        // Force redirect anyway
        if (typeof window !== "undefined") {
          window.location.assign("/");
        }
      }
    };

    const resetTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        void triggerInactivitySignOut();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    events.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [user]);

  const signOut = async () => {
    try {
      unsubscribeRef.current?.();
      await supabase.auth.signOut();
      setRole(null);
      setError(null);
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
      setError("Falha ao fazer logout");
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
```

**Tempo estimado**: 2-3 horas

---

### 6. Banco de Dados: Otimizar Queries com Agregação

**Arquivo**: `src/hooks/useDashboardData.ts`

**Problema**:
```typescript
// ❌ Carrega TODAS as análises em memória
const { data: allAnalyses } = await supabase
  .from("analyses")
  .select("*")
  .eq("operator_user_id", userId);

// Depois calcula stats em JavaScript
const totalSuccess = allAnalyses.filter((a) => a.result === "ok").length;
```

**Solução** — Usar SQL aggregation:

```typescript
// ✅ Agregação no backend
const { data: stats, error } = await supabase
  .from("analyses")
  .select(
    `
    COUNT(*) as total_verified,
    SUM(CASE WHEN result = 'ok' THEN 1 ELSE 0 END) as total_success,
    SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) as total_failure,
    AVG(processing_time_ms) as avg_time_ms
    `
  )
  .eq("operator_user_id", userId);

// Ou usar function Postgres para encapsular
const { data: stats } = await supabase.rpc("get_operator_stats", {
  p_user_id: userId,
});
```

**Criar Function Postgres**:
```sql
-- supabase/migrations/20260514_operator_stats_function.sql
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
    AVG(processing_time_ms) as avg_time_ms,
    ROUND(
      COUNT(*) FILTER (WHERE result = 'ok')::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      1
    ) as success_rate
  FROM analyses
  WHERE operator_user_id = p_user_id;
$$ LANGUAGE SQL STABLE;
```

**Tempo estimado**: 2-3 horas

---

### 7. Banco de Dados: Adicionar Índices

**Arquivo**: `supabase/migrations/` (nova migration)

**Problema**:
- ❌ Sem índices, queries de filtro são O(n) — slow em dados grandes

**Solução** — Criar migration: `20260514_add_indexes.sql`

```sql
-- Índices em chaves estrangeiras (mais common)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_operator_configurations_user_id ON operator_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_operator_user_id ON analyses(operator_user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_analyzed_at ON analyses(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_tissue_batches_code ON tissue_batches(tissue_code);

-- Índices compostos (multi-column queries)
CREATE INDEX IF NOT EXISTS idx_analyses_operator_result 
  ON analyses(operator_user_id, result);

CREATE INDEX IF NOT EXISTS idx_analyses_operator_date 
  ON analyses(operator_user_id, analyzed_at DESC);

-- Índices BRIN para séries temporais
CREATE INDEX IF NOT EXISTS idx_analyses_created_at_brin 
  ON analyses USING BRIN (analyzed_at);
```

**Validação**:
```sql
-- Ver índices criados
SELECT indexname FROM pg_indexes WHERE tablename = 'analyses';
```

**Tempo estimado**: 1 hora

---

### 8. Testes: Setup Mínimo de Cobertura

**Arquivos**: `src/test/`, `src/lib/systemConfig.test.ts`

**Problema**:
- ❌ Apenas teste dummy
- ❌ Zero testes de Auth, Hooks, Utils

**Solução** — Criar testes essenciais:

**a) Teste de `systemConfig.ts`** (`src/lib/systemConfig.test.ts`):
```typescript
import { describe, it, expect } from "vitest";
import {
  getSystemStep,
  isConfigurationComplete,
  isLightCalibrated,
  createTissueBatchCode,
  normalizeSystemStep,
  areConfigurationFieldsComplete,
} from "@/lib/systemConfig";

describe("systemConfig", () => {
  describe("getSystemStep", () => {
    it("should return CONFIG for null config", () => {
      expect(getSystemStep(null)).toBe("CONFIG");
    });

    it("should return CONFIG for undefined config", () => {
      expect(getSystemStep(undefined)).toBe("CONFIG");
    });

    it("should return systemStep from config", () => {
      expect(getSystemStep({ systemStep: "LIGHT" })).toBe("LIGHT");
      expect(getSystemStep({ systemStep: "READY" })).toBe("READY");
    });

    it("should normalize invalid systemStep to CONFIG", () => {
      expect(getSystemStep({ systemStep: "INVALID" as any })).toBe("CONFIG");
    });
  });

  describe("normalizeSystemStep", () => {
    it("should accept valid steps", () => {
      expect(normalizeSystemStep("CONFIG")).toBe("CONFIG");
      expect(normalizeSystemStep("LIGHT")).toBe("LIGHT");
      expect(normalizeSystemStep("READY")).toBe("READY");
    });

    it("should default to CONFIG for invalid", () => {
      expect(normalizeSystemStep("INVALID")).toBe("CONFIG");
      expect(normalizeSystemStep(null)).toBe("CONFIG");
      expect(normalizeSystemStep(undefined)).toBe("CONFIG");
    });
  });

  describe("isConfigurationComplete", () => {
    it("should return false for CONFIG step", () => {
      expect(isConfigurationComplete({ systemStep: "CONFIG" })).toBe(false);
    });

    it("should return true for LIGHT or READY", () => {
      expect(isConfigurationComplete({ systemStep: "LIGHT" })).toBe(true);
      expect(isConfigurationComplete({ systemStep: "READY" })).toBe(true);
    });
  });

  describe("isLightCalibrated", () => {
    it("should return true only for READY", () => {
      expect(isLightCalibrated({ systemStep: "READY" })).toBe(true);
      expect(isLightCalibrated({ systemStep: "CONFIG" })).toBe(false);
      expect(isLightCalibrated({ systemStep: "LIGHT" })).toBe(false);
    });
  });

  describe("areConfigurationFieldsComplete", () => {
    it("should return true only when all flags are true", () => {
      const complete = {
        deltaConfigured: true,
        analysisAreaConfigured: true,
        colorConfigured: true,
        ambientLightConfigured: true,
      };
      expect(areConfigurationFieldsComplete(complete as any)).toBe(true);
    });

    it("should return false if any flag is false", () => {
      const incomplete = {
        deltaConfigured: true,
        analysisAreaConfigured: false,
        colorConfigured: true,
        ambientLightConfigured: true,
      };
      expect(areConfigurationFieldsComplete(incomplete as any)).toBe(false);
    });
  });

  describe("createTissueBatchCode", () => {
    it("should create valid tissue batch code", () => {
      const code = createTissueBatchCode();
      expect(code).toMatch(/^TCD-\d{8}-\d{6}-[A-Z0-9]{4}$/);
    });

    it("should create unique codes", () => {
      const code1 = createTissueBatchCode();
      const code2 = createTissueBatchCode();
      // Very unlikely to be same (random part)
      expect(code1).not.toBe(code2);
    });
  });
});
```

**b) Teste de componente** (`src/components/CameraPreview.test.tsx`):
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CameraPreview } from "@/components/CameraPreview";

// Mock useCameraPreview
vi.mock("@/hooks/useCameraPreview", () => ({
  useCameraPreview: vi.fn(() => ({
    checkedOnce: true,
    status: "online",
    streamUrl: "http://localhost:8090/stream.mjpg",
    errorMessage: null,
    markStreamError: vi.fn(),
    retry: vi.fn(),
  })),
}));

describe("CameraPreview", () => {
  it("should render camera stream when online", () => {
    render(<CameraPreview />);
    const img = screen.getByAltText("Vídeo ao vivo da câmera");
    expect(img).toBeDefined();
    expect(img.src).toContain("stream.mjpg");
  });

  it("should render error message when offline", () => {
    vi.doMock("@/hooks/useCameraPreview", () => ({
      useCameraPreview: vi.fn(() => ({
        checkedOnce: true,
        status: "offline",
        streamUrl: "",
        errorMessage: "Câmera offline",
        markStreamError: vi.fn(),
        retry: vi.fn(),
      })),
    }));

    render(<CameraPreview />);
    expect(screen.getByText("Câmera offline")).toBeDefined();
  });
});
```

**c) Adicionar script de teste**:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Tempo estimado**: 3-4 horas

---

### 9. Otimizar Imagens: Usar Next.js Image Component

**Arquivo**: `src/pages/Login.tsx`, `src/pages/Index.tsx`, `src/pages/Manager.tsx`

**Problema**:
```typescript
<img
  src={gridBg.src}
  alt=""
  className="absolute inset-0 w-full h-full object-cover opacity-20"
/>
```
- ❌ Sem lazy loading
- ❌ Sem responsive sizes
- ❌ Sem format optimization (webp)

**Solução**:
```typescript
import Image from "next/image";
import gridBg from "@/assets/grid-bg.jpg";

// Antes
<img src={gridBg.src} alt="" className="..." />

// Depois
<Image
  src={gridBg}
  alt=""
  priority={true}  // Para hero image
  fill
  className="absolute inset-0 object-cover opacity-20"
  sizes="100vw"
  quality={85}
/>
```

**Tempo estimado**: 1-2 horas

---

## P2 — MÉDIO

### 10. Documentação: Criar README Completo

**Arquivo**: `README.md`

```markdown
# 🧬 Fabric Analyzer Interface

Plataforma web de análise colorimétrica de tecidos com controle operacional e gerencial.

## 🚀 Quick Start

### Pré-requisitos
- Node.js 18+
- Bun 1.0+ (ou npm)
- Conta Supabase

### Setup Local

```bash
# 1. Clonar repositório
git clone <repo>
cd fabric-analyzer-interface

# 2. Instalar dependências
bun install

# 3. Configurar variáveis de ambiente
cp .env.example .env.local

# 4. Rodar migrations do Supabase
bunx supabase migration up

# 5. Iniciar dev server
bun run dev

# 6. Abrir browser
open http://localhost:3000
```

## 📁 Estrutura do Projeto

```
src/
├── app/              # Next.js App Router (rotas)
│   ├── layout.tsx    # Root layout com providers
│   ├── page.tsx      # Login page
│   ├── painel/       # Operador dashboard
│   ├── gestor/       # Manager dashboard
│   └── calibrar-luz/ # Calibração
├── components/       # Componentes React reutilizáveis
│   ├── ui/          # shadcn/ui components
│   └── auth/        # Auth-related components
├── hooks/           # Custom React hooks
├── lib/             # Utilities (systemConfig, utils)
├── integrations/    # Supabase client + types
└── test/            # Testes Vitest
```

## 🔐 Autenticação

- **Provider**: Supabase Auth (Email/Password)
- **Roles**: `operador` | `gestor`
- **Session timeout**: 15 minutos de inatividade
- **RLS**: Habilitado (veja `IMPROVEMENTS.md` — item 3)

## 🛠️ Scripts

```bash
bun run dev          # Dev server (port 3000)
bun run build        # Produção build
bun run lint         # ESLint
bun run test         # Vitest
bun run test:watch   # Watch mode
bun run camera:install  # Install Python deps para câmera
bun run camera:proxy    # Iniciar proxy da câmera (port 8090)
```

## 📊 Database

**Migração**:
```bash
bunx supabase migration up
```

**Tabelas principais**:
- `profiles` — Info de usuário
- `operator_configurations` — Config por operador
- `analyses` — Registros de análise
- `tissue_batches` — Lotes de tecido
- `user_roles` — Papel do usuário

## 🌐 Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJxxx
NEXT_PUBLIC_CAMERA_PROXY_URL=http://127.0.0.1:8090
```

## 📝 Roadmap

- [ ] E2E tests (Playwright)
- [ ] Modo dark/light
- [ ] Export relatórios em PDF
- [ ] Análise em tempo real com WebSocket
- [ ] Mobile app (React Native)

## 📚 Documentos Relacionados

- [AGENTS.md](AGENTS.md) — Instruções para agents
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) — Guia de implementação
- [IMPROVEMENTS.md](IMPROVEMENTS.md) — Este plano de correções
```

**Tempo estimado**: 1 hora

---

### 11. Criar `.env.example`

**Arquivo**: `.env.example`

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJxxx...

# Câmera Proxy
NEXT_PUBLIC_CAMERA_PROXY_URL=http://127.0.0.1:8090

# Build
NODE_ENV=development
```

**Tempo estimado**: 15 minutos

---

### 12. Simplificar State Management com Zustand

**Arquivo**: `src/lib/configStore.ts` (novo)

**Problema**:
- `useOperatorSystemConfig` muito complexo
- Sincronização local ↔ Supabase com múltiplas fontes de verdade

**Solução** — Usar Zustand:

```typescript
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { SystemConfig, defaultSystemConfig } from "./systemConfig";

interface ConfigStore {
  config: SystemConfig;
  loading: boolean;
  error: string | null;
  setConfig: (config: SystemConfig) => void;
  updateConfig: (partial: Partial<SystemConfig>) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useConfigStore = create<ConfigStore>()(
  devtools(
    persist(
      (set) => ({
        config: defaultSystemConfig,
        loading: false,
        error: null,
        setConfig: (config) => set({ config }),
        updateConfig: (partial) =>
          set((state) => ({
            config: { ...state.config, ...partial },
          })),
        setError: (error) => set({ error }),
        setLoading: (loading) => set({ loading }),
        reset: () => set({ config: defaultSystemConfig, error: null }),
      }),
      {
        name: "fabric-config-store",
      }
    )
  )
);
```

**Tempo estimado**: 2-3 horas (refactor)

---

### 13. Adicionar Error Boundary

**Arquivo**: `src/components/ErrorBoundary.tsx` (novo)

```typescript
"use client";

import React, { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="font-sansserief text-lg text-foreground mb-2">
              Erro na Aplicação
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {this.state.error?.message ?? "Um erro inesperado ocorreu."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-sansserief text-sm"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Uso em layout**:
```typescript
// src/app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

**Tempo estimado**: 1-2 horas

---

## ✅ Checklist de Implementação

### Fase 1: Setup Crítico (Semana 1)
- [ ] **P0-1**: TS Strict Mode — tsconfig.json atualizado, erros resolvidos
- [ ] **P0-2**: ESLint — config atualizado, pre-commit hook instalado
- [ ] **P0-3**: RLS Supabase — migration criada, policies testadas
- [ ] **P0-4**: Pages Router removido — estrutura App Router consolidada

### Fase 2: Segurança & Dados (Semana 2)
- [ ] **P1-5**: Retry Logic — useAuth.tsx com retry exponencial
- [ ] **P1-6**: Query Optimization — aggregations implementadas
- [ ] **P1-7**: Índices DB — migration com índices criada
- [ ] **P1-3**: RLS Validação — testes de permission

### Fase 3: Qualidade (Semana 3)
- [ ] **P1-8**: Testes — setup Vitest, testes iniciais escritos
- [ ] **P1-9**: Imagens — Next.js Image component implementado
- [ ] **P2-10**: README — documentação completa
- [ ] **P2-11**: .env.example — variáveis documentadas

### Fase 4: Refactor & Polish (Semana 4)
- [ ] **P2-12**: Zustand — state management simplificado
- [ ] **P2-13**: Error Boundary — error handling robusto
- [ ] **Validação**: `npm run build && npm run lint && npm run test`
- [ ] **Deploy**: Build prod testado locally

---

## 🎯 Resumo de Impacto

| Item | Esforço | Impacto | Urgência |
|------|---------|--------|----------|
| TS Strict | 4h | Alto | P0 |
| RLS | 2h | Crítico | P0 |
| ESLint | 2h | Médio | P0 |
| Remove Pages Router | 3h | Médio | P0 |
| Retry Logic | 2h | Alto | P1 |
| Query Optimization | 2h | Alto | P1 |
| Índices DB | 1h | Alto | P1 |
| Testes | 4h | Alto | P1 |
| Imagens | 2h | Médio | P1 |
| README | 1h | Médio | P2 |
| **Total** | **~24h** | **Muito Alto** | **Antes de Prod** |

---

## 📞 Próximos Passos

1. ✅ Revisar este documento com time
2. ✅ Priorizar items por sprint
3. ✅ Criar branches por item (e.g., `feat/ts-strict`)
4. ✅ Executar com CI/CD
5. ✅ Code review antes de merge
6. ✅ Deploy para staging após Fase 2

---

**Documento criado**: 14 de maio de 2026  
**Status**: Pronto para execução  
**Responsável**: Code Review Team
