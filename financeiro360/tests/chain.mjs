// Aplica TODAS as migrações do app da casa na ordem dos nomes, como o banco real receberia.
// Isso garante que as migrações novas funcionam sobre o que já existe (parcelas congeladas,
// alinhamento de fatura, lembretes, categorias, etc.) e não só sobre a primeira versão.
import { readdirSync, readFileSync } from 'node:fs';
const dir = new URL('../supabase/migrations/', import.meta.url);
// O cofre antigo é de outro objeto do projeto e não faz parte do banco da casa.
export const chain = () => readdirSync(dir).filter((f) => f.endsWith('.sql') && !f.includes('user_vault')).sort();
export const migration = (file) => readFileSync(new URL(file, dir), 'utf8');
