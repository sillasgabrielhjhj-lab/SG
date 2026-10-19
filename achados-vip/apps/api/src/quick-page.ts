/** Página única do "Gerar post" (mini servidor). Sem dependências externas. */
export const QUICK_HTML = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Achados VIP – Gerar post</title><link rel="stylesheet" href="/app.css"></head>
<body><main>
<h1>Achados VIP <small>Gerar post</small></h1>
<section id="login" hidden><p>Digite a senha para entrar.</p>
<form id="loginForm"><input id="pw" type="password" placeholder="Senha" autocomplete="current-password" required><button class="primary">Entrar</button></form><p id="loginErr" class="err"></p></section>
<section id="tool" hidden>
<p class="muted">Cole o seu link de afiliado. O seu link vai no texto exatamente como você colou.</p>
<form id="form">
<label>Link de afiliado<input id="url" type="url" placeholder="https://meli.la/…" required></label>
<details id="manual"><summary>Preencher/corrigir manualmente</summary>
<label>Título do produto<input id="title" maxlength="300"></label>
<div class="row"><label>Preço atual (R$)<input id="price" inputmode="decimal" placeholder="49,90"></label>
<label>Preço original (R$) <em>opcional</em><input id="orig" inputmode="decimal" placeholder="99,90"></label></div>
<p class="muted">Informe o preço original só se for o preço anterior REAL: ele gera o “De/Por” e o % OFF.</p>
<label>Cupom <em>opcional</em><input id="coupon" maxlength="60"></label></details>
<div class="row"><button class="primary" id="go">Gerar post</button><button type="button" id="clear">Limpar</button><button type="button" id="logout">Sair</button></div>
</form><p id="err" class="err"></p><div id="warns"></div>
<div id="result" hidden>
<div id="imgBox" class="imgbox"><img id="img" alt="Produto" referrerpolicy="no-referrer"><a id="dl" class="btn">Baixar imagem</a></div>
<label>Texto para o WhatsApp <span class="muted">(pode editar)</span><textarea id="text" rows="12"></textarea></label>
<div class="row"><button class="primary" id="copy">Copiar texto</button><button id="copyTg">Copiar versão Telegram</button></div>
</div></section></main><script src="/app.js"></script></body></html>`;

export const QUICK_CSS = `*{box-sizing:border-box}body{margin:0;font:16px/1.45 system-ui,sans-serif;background:#f8fafc;color:#0f172a}
main{max-width:720px;margin:0 auto;padding:16px}h1{font-size:22px;margin:8px 0 16px}h1 small{font-weight:400;color:#64748b;margin-left:8px;font-size:15px}
label{display:block;margin:12px 0;font-weight:600;font-size:14px}label em{font-weight:400;color:#64748b}
input,textarea{display:block;width:100%;margin-top:4px;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;background:#fff}
textarea{font-size:15px}button,.btn{padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font:inherit;cursor:pointer;text-decoration:none;color:inherit;display:inline-block}
button.primary{background:#4f46e5;border-color:#4f46e5;color:#fff}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.row label{flex:1;min-width:150px}
.muted{color:#64748b;font-size:14px}.err{color:#b91c1c}.warn{background:#fef9c3;border:1px solid #fde047;padding:8px 10px;border-radius:8px;margin:8px 0;font-size:14px}
.imgbox{display:flex;gap:12px;align-items:flex-start;margin:12px 0}.imgbox img{width:140px;height:140px;object-fit:contain;background:#fff;border:1px solid #e2e8f0;border-radius:8px}
details{margin:8px 0}summary{cursor:pointer;color:#4f46e5;font-weight:600}@media(prefers-color-scheme:dark){body{background:#0f172a;color:#e2e8f0}input,textarea,button,.btn{background:#1e293b;color:#e2e8f0;border-color:#334155}button.primary{background:#6366f1;border-color:#6366f1}.warn{background:#422006;border-color:#854d0e}}`;

export const QUICK_JS = `(()=>{
const $=id=>document.getElementById(id);const H={'content-type':'application/json','x-requested-with':'fetch'};
let tg='';
async function call(path,opts){const r=await fetch(path,{credentials:'same-origin',...opts});let j=null;try{j=await r.json()}catch{}
if(r.status===401&&path!=='/login'){show(false);throw new Error('Sessão expirada. Entre de novo.')}
if(!r.ok)throw new Error((j&&j.error&&j.error.message)||'Erro '+r.status);return j}
function show(auth){$('login').hidden=auth;$('tool').hidden=!auth}
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginErr').textContent='';
try{await call('/login',{method:'POST',headers:H,body:JSON.stringify({password:$('pw').value})});$('pw').value='';show(true)}catch(x){$('loginErr').textContent=x.message}};
$('logout').onclick=async()=>{await call('/logout',{method:'POST',headers:H}).catch(()=>{});show(false)};
function clear(){['url','title','price','orig','coupon'].forEach(i=>$(i).value='');$('result').hidden=true;$('err').textContent='';$('warns').innerHTML=''}
$('clear').onclick=clear;
$('form').onsubmit=async e=>{e.preventDefault();$('err').textContent='';$('warns').innerHTML='';$('go').disabled=true;
const b={url:$('url').value.trim()};const t=$('title').value.trim(),p=$('price').value.trim(),o=$('orig').value.trim(),c=$('coupon').value.trim();
if(t)b.title=t;if(p)b.price=p;if(o)b.originalPrice=o;if(c)b.couponCode=c;
try{const r=await call('/preview',{method:'POST',headers:H,body:JSON.stringify(b)});
(r.warnings||[]).forEach(w=>{const d=document.createElement('div');d.className='warn';d.textContent=w;$('warns').appendChild(d)});
if(!r.ok){$('manual').open=true;$('result').hidden=true;
$('err').textContent='Não consegui ler '+r.needsInput.map(n=>n==='price'?'o preço':'o título').join(' e ')+' da página. Preencha abaixo e gere de novo.';return}
if(!t&&r.title)$('title').value=r.title;if(!p&&r.priceCents)$('price').value=(r.priceCents/100).toFixed(2).replace('.',',');
$('text').value=r.whatsapp;tg=r.telegram||'';$('copyTg').hidden=!tg;
$('imgBox').hidden=!r.imageUrl;if(r.imageUrl){$('img').src=r.imageUrl;$('dl').href='/image?download=1&url='+encodeURIComponent(r.imageUrl)}
$('result').hidden=false}catch(x){$('err').textContent=x.message}finally{$('go').disabled=false}};
async function copy(s,btn){try{await navigator.clipboard.writeText(s)}catch{const a=document.createElement('textarea');a.value=s;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove()}
const o=btn.textContent;btn.textContent='Copiado!';setTimeout(()=>btn.textContent=o,1500)}
$('copy').onclick=e=>{e.preventDefault();copy($('text').value,$('copy'))};$('copyTg').onclick=e=>{e.preventDefault();copy(tg,$('copyTg'))};
call('/me').then(()=>show(true)).catch(()=>show(false));
})();`;
