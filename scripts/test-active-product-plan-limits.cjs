const fs=require('node:fs');const assert=require('node:assert/strict');
const migration=fs.readFileSync('supabase/migrations/20261104095000_delivery_product_plan_limits.sql','utf8');
assert.match(migration,/when 'NOVAES_BUSINESS' then 200/);assert.match(migration,/when 'NOVAES_PREMIUM' then 500/);
assert.match(migration,/for update;/);assert.match(migration,/tg_op = 'INSERT' and exists/);assert.match(migration,/old\.is_active = true/);
assert.match(migration,/PRODUCT_ACTIVE_LIMIT_REACHED/);assert.match(migration,/security definer/);
assert.match(migration,/revoke all on function/);
for(const name of ['src/panel/lib/promptGeneratorTemplates.ts','src/panel/lib/storeIntegrationPrompts.ts']){
 const t=fs.readFileSync(name,'utf8');assert.match(t,/PRODUCT_ACTIVE_LIMIT_REACHED/);
 assert.match(t,/201/);assert.match(t,/501/);
}
console.log('Limites oficiais Business/Premium e prompts validados.');
