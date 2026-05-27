#!/usr/bin/env node

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log("🔍 Verificando configuração Supabase...\n");

// Check env vars
if (!supabaseUrl) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL não configurada");
  process.exit(1);
}
if (!supabaseKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY não configurada");
  process.exit(1);
}

console.log("✓ Variáveis de ambiente configuradas:");
console.log(`  URL: ${supabaseUrl}`);
console.log(`  Key: ${supabaseKey.substring(0, 20)}...`);

// Test fetch
console.log("\n📡 Testando conexão com Supabase...");

fetch(`${supabaseUrl}/rest/v1/`, {
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  },
})
  .then((res) => {
    console.log(`✓ Conexão bem-sucedida (HTTP ${res.status})`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`❌ Erro de conexão: ${err.message}`);
    process.exit(1);
  });
