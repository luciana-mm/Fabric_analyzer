# 🗺️ Mapa de Ação — Code Review Fabric Analyzer

**Guia visual de priorização e fluxo de implementação**

---

## 📊 Matriz de Decisão (Use isto!)

```
        FÁCIL ────────→ DIFÍCIL
         │               │
    ALTO │    FAZER LOGO │    AVALIAR DEPOIS
    I    │    ├─ P0-2     │    ├─ P0-1 TS Strict
    M    │    ├─ P0-3 RLS │    ├─ P0-4 RemovePages
    P    │    ├─ P1-7     │    ├─ P1-8 Testes
    A    │    └─ P2-10    │    └─ P2-12 Zustand
    C    │                │
    T    │                │
    O    ├────────────────┤
         │                │
   BAIXO │ ACEITAR DÉBITO │ NEGLIGENCIAR
         │    ├─ P1-9     │    ├─ P2-13
         │    └─ P2-11    │    └─ (Nenhum P0)
         │                │
         └────────────────→

Legenda: P0 = Crítico | P1 = Alto | P2 = Médio
```

---

## 🎯 Fluxo de Implementação Recomendado

```
SEMANA 1: SEGURANÇA        SEMANA 2: DADOS        SEMANA 3: TESTES       SEMANA 4: VALIDAÇÃO
┌─────────────────┐       ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ P0-3 RLS (2h)   │       │ P1-5 Retry (2h) │    │ P1-8 Testes (4h)│    │ Validar tudo    │
├─────────────────┤       ├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ P0-2 ESLint(2h) │  →    │ P1-6 QueryOpt(2h)│   │ P2-10 README(1h)│ →  │ Deploy Staging  │
├─────────────────┤       ├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ P0-1 TS(4h)     │       │ P1-7 Index(1h)  │    │ P2-11 .env(0.5h)│    │ Smoke tests     │
├─────────────────┤       ├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ P0-4 Pages(3h)  │       │ P1-9 Imgs(2h)   │    │ P2-12 Zustand  │    │ Performance OK  │
│                 │       │                 │    │        (2h)     │    │                 │
│ Total: 11h      │       │ Total: 7h       │    │                 │    │ Total: 4h       │
│ Budget: 1.5d    │       │ Budget: 1d      │    │ Total: 7.5h     │    │ Budget: 0.5d    │
│                 │       │                 │    │ Budget: 1d      │    │                 │
└─────────────────┘       └─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🚀 Checklist de Decisão

### Pergunta 1: Pode esperar?
```
Todos os P0 items?
├─ NÃO → Urgente!
└─ SIM → OK para depois

P0 = NÃO PODE ESPERAR ⚠️
P1 = Importante (semanas)
P2 = Nice-to-have (meses)
```

### Pergunta 2: Qual fazer primeiro?
```
Tempo disponível?
├─ < 3h    → P0-2 ESLint + P0-3 RLS
├─ 3-6h    → P0-1 TS Strict
├─ 6-10h   → P0-4 RemovePages
└─ > 10h   → Toda semana 1

START: P0-3 RLS (mais fácil + crítico)
```

### Pergunta 3: Time ou solo?
```
P0-1 TS Strict   → Time (merge conflicts)
P0-2 ESLint      → Solo (independent)
P0-3 RLS         → 1-2 pessoas
P0-4 RemovePages → Solo (1 pessoa)

P1-5 Retry       → Solo
P1-6 Query Opt   → Solo (+ 1 review)
P1-8 Testes      → 1-2 pessoas
```

---

## 📌 Dependency Graph

```
                    ┌─────────────────┐
                    │   P0-1: TS      │
                    │   Strict Mode   │
                    └────────┬────────┘
                             │
             ┌───────────────┼───────────────┐
             │               │               │
      ┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
      │ P0-2: ESLint│ │ P0-3: RLS   │ │ P0-4: Pages│
      │  (Depends)  │ │ (Independent)│ │(Depends TS)│
      └──────┬──────┘ └──────┬──────┘ └─────┬──────┘
             │               │              │
             └───────────────┼──────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼──────┐      ┌─────▼──────┐      ┌─────▼─────┐
   │ P1-5:Retry│      │ P1-6:Query │      │ P1-8:Tests│
   │  (Optional)      │ Optimization       │(Depends TS)
   └────┬──────┘      └─────┬──────┘      └─────┬─────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                      ┌──────▼──────┐
                      │Deploy Ready!│
                      └─────────────┘

Legend: 
→ = Depende de (esperar)
⊣ = Independente (fazer em paralelo)
```

---

## 💡 Estratégia por Perfil

### 👨‍💼 Se você é líder/PM:
```
1. Revisar EXECUTIVE_SUMMARY.md (5 min)
2. Apresentar timeline para stakeholders
   └─ Semana 1: P0 items (segurança)
   └─ Semana 2: P1 items (dados)
   └─ Semana 3: P2 items (qualidade)
3. Alocar 1 dev em tempo integral
4. Criar backlog com IMPROVEMENTS.md
5. Review PR diariamente
```

### 👨‍💻 Se você é dev sênior:
```
1. Fazer P0-3 RLS (2h) + P0-2 ESLint (2h)
   └─ Paralelizar enquanto aprende o codebase
2. Revisar P0-1 TS Strict (4h) + P0-4 Pages (3h)
   └─ Code review mentees
3. Ajudar com P1-8 Testes
4. Documentar padrões em AGENTS.md
```

### 👶 Se você é dev júnior:
```
1. Ler IMPROVEMENTS.md completamente
2. Fazer IMPLEMENTATION_CHECKLIST.md passo-a-passo
3. Começar com P0-2 ESLint (mais simples)
4. Pedir review antes de merge
5. Documentar learnings
```

---

## ⏱️ Estimativa de Tempo (Realista)

```
TASK            OTIMISTA  REALISTA  PESSIMISTA
P0-1 TS         3h        4h        8h      ⚠️ Muitos erros
P0-2 ESLint     1h        2h        3h
P0-3 RLS        2h        2h        4h      (SQL novo?)
P0-4 Pages      2h        3h        5h      (Muitos imports)
─────────────────────────────────────────
Subtotal P0:    8h        11h       20h     

P1-5 Retry      2h        2h        3h
P1-6 Query      1h        2h        3h      (SQL novo?)
P1-7 Index      1h        1h        2h
P1-8 Testes     3h        4h        6h      (Aprox)
P1-9 Imagens    1h        2h        3h
─────────────────────────────────────────
Subtotal P1:    8h        11h       17h

P2-10 README    1h        1h        1h
P2-11 .env      0.5h      0.5h      1h
P2-12 Zustand   2h        3h        5h      (Refactor)
P2-13 ErrorBnd  1h        1h        2h
─────────────────────────────────────────
Subtotal P2:    4.5h      5.5h      9h

═════════════════════════════════════════
TOTAL:          20.5h     27.5h     46h

Recomendado: Budgetar 30h (margem de segurança)
```

---

## 🎯 Métricas de Sucesso

### Após semana 1 (P0):
```
✅ npm run build — sem erros TS
✅ npm run lint — sem violations
✅ Supabase RLS — policies ativas
✅ Pages Router — removido completamente
✅ Zero security issues no scan
```

### Após semana 2 (P1):
```
✅ npm run test — cobertura 20%+
✅ Auth — com retry logic
✅ Queries — usando aggregation
✅ Índices — criados e testados
✅ Build time — < 35s
```

### Após semana 3 (P2):
```
✅ README — documentado
✅ .env.example — present
✅ Zustand — state refatorado
✅ Error Boundary — implementado
✅ Dev experience — notavelmente melhor
```

### Após semana 4 (Validação):
```
✅ Staging — deploy OK
✅ Smoke tests — 100% passing
✅ Performance — benchmarks OK
✅ Security audit — sem issues
✅ Ready para produção ✅
```

---

## 🚨 Red Flags a Evitar

| Flag | Risco | Como evitar |
|------|-------|------------|
| Fazer P0-1 sozinho em 2h | Bugs introduzidos | Budgetar 4-5h, pair programming |
| Skip P0-3 RLS | LGPD violation | NÃO PODE PULAR |
| Mesclar sem CI/CD | Regressões | Setup GitHub Actions |
| Testes sem coverage | Falsa sensação segurança | Aiming 30%+ desta semana |
| Documentar depois | Tech debt perpetuado | Doc enquanto faz |

---

## ✅ Validação Antes de Merge

```bash
# Checklist pré-merge
npm run lint              # ESLint OK?
npm run build             # Build OK?
npm run test              # Testes OK?
npm run test -- --ui      # Visual OK?

# Supabase (se aplicável)
bunx supabase migration list   # Migrations OK?

# Git
git status                # Nada uncommitted?
git log --oneline         # Commit message clear?
git diff HEAD~1           # Review changes?

# Se tudo ✅ → Criar PR
```

---

## 📞 Escalação

**Se travar por > 1h:**

1. ✅ Revisar exemplo em IMPLEMENTATION_CHECKLIST.md
2. ✅ Procurar erro no Slack/Google (com contexto)
3. ✅ Pedir pair programming
4. ✅ Documentar solução para team

**Problemas comuns:**

| Erro | Solução |
|------|---------|
| "Type X is not assignable to..." | Ver P0-1 exemplos em IMPROVEMENTS.md |
| "RLS policy not showing" | Usar SQL direto, não dashboard |
| "Cannot find module" | Check path alias em tsconfig.json |
| "Migration fails" | Run `bunx supabase db reset` (dev only) |

---

## 🎓 Aprendizado

### Recursos para cada task:

- **TypeScript Strict**: [TS Handbook](https://www.typescriptlang.org/docs/) + error messages
- **ESLint**: [ESLint Rules](https://eslint.org/docs/rules/) + `--fix` auto-correct
- **RLS**: [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- **Queries**: PostgreSQL docs + EXPLAIN ANALYZE
- **Testes**: Vitest docs + Testing Library

### Documentos internos:
- IMPROVEMENTS.md — Explicação detalhada
- IMPLEMENTATION_CHECKLIST.md — Passo-a-passo
- AGENTS.md — Convenções do projeto

---

## 🚀 Conclusão

```
Start here:
1. EXECUTIVE_SUMMARY.md (5 min read)
2. IMPLEMENTATION_CHECKLIST.md (pick P0-3)
3. CODE! 💪

Celebrate after:
- P0 items done → 🎉 "Now secure"
- P1 items done → 🎉 "Now fast"
- P2 items done → 🎉 "Now professional"
- Deploy ready → 🚀 "Now production!"
```

---

**Documento criado**: 14 de maio de 2026  
**Atualizar**: Após cada semana com progresso real  
**Responsável**: Tech Lead + Team
