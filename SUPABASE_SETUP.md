# 🔧 Guia: Restaurar Conexão Supabase

## ❌ Problema

O projeto Supabase `feiaibvnudmuydjfimsu` não existe ou foi deletado.

## ✅ Solução

### 1. Acessar Supabase Dashboard

- Vá para https://supabase.com/dashboard
- Faça login com sua conta

### 2. Verificar/Criar Projeto

Se o projeto não existir:

1. Clique em **"+ New project"**
2. Preencha:
   - **Name**: `fabric-analyzer`
   - **Password**: (gere uma senha forte)
   - **Region**: Escolha a mais próxima (ex: South America - São Paulo)
3. Clique **"Create new project"**

### 3. Copiar Credenciais

Após criar/acessar o projeto:

1. Vá para **Settings → API**
2. Copie:
   - **Project URL** (ex: `https://xyzabc123.supabase.co`)
   - **Anon Public Key** (chave pública)
3. Cole em `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL="https://SEU_URL_AQUI.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="SEU_ANON_KEY_AQUI"
```

### 4. Criar Tabelas (Opcional)

Se precisar das tabelas do sistema, rode os migrations:

```bash
cd supabase
supabase db pull  # Ou execute manualmente os SQL em migrations/
```

### 5. Teste

Após atualizar `.env.local`:

```bash
npm run build     # Verificar build
npm run dev       # Iniciar app
```

---

## 🧪 Para Testar Conectividade

```bash
node -e "
const url = 'https://SEU_URL.supabase.co';
const key = 'SEU_KEY';
fetch(url + '/rest/v1/', {
  headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
})
  .then(r => console.log('✓ Conectado:', r.status))
  .catch(e => console.log('✗ Erro:', e.message))
"
```

---

**Próximo passo:** Atualize `.env.local` com suas novas credenciais Supabase!
