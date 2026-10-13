import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const base = 'https://www.adocebrigaderia.com.br';
const local = fs.readFileSync('dist/index.html', 'utf8');
const entry = local.match(/src="([^"]+\/index-[^"]+\.js)"/)[1];
const response = await fetch(base + '/operacao', {headers: {'cache-control':'no-cache'}});
assert.equal(response.status, 200);
assert.ok((await response.text()).includes(entry), 'HTML deve servir o build validado');
const assets = [entry, ...fs.readdirSync('dist/assets').filter(n => /^(AccessApp-|OperationCosts-|index-).+\.css$/.test(n) || /^(AccessApp-|OperationCosts-).+\.js$/.test(n)).map(n => '/assets/'+n), '/site/adoce-logo-thermal.png'];
const results = [];
for (const path of assets) {
  const remote = await fetch(base+path, {headers:{'cache-control':'no-cache'}});
  assert.equal(remote.status, 200, path);
  const bytes = Buffer.from(await remote.arrayBuffer());
  assert.ok(bytes.equals(fs.readFileSync('dist'+path)), 'Conteudo diferente: '+path);
  results.push({path, sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
}
fs.writeFileSync('entregas/publicacao-desktop-20261011.json', JSON.stringify({verifiedAt:new Date().toISOString(),domain:base,assets:results},null,2));
console.log('Dominio oficial confirmado: HTML e '+results.length+' recursos iguais ao build validado.');
