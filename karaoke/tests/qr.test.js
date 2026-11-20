"use strict";
/*
 * Confere o QR code lendo de volta a matriz com um leitor escrito à parte
 * (aqui no teste): formato com BCH válido, máscara desfeita, palavras de
 * código extraídas em zigue-zague, síndromes Reed-Solomon zeradas em todos os
 * blocos e o texto recuperado igual ao original.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const QR=require("../qr.js");

const EXP=new Array(512),LOG=new Array(256);
(()=>{let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d}for(let i=255;i<512;i++)EXP[i]=EXP[i-255]})();
const gmul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;

function formatoValido(bits15){
  for(let d=0;d<32;d++){let r=d;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);if((((d<<10)|r)^0x5412)===bits15)return d}
  return -1;
}
function areasFixas(v,n){
  const f=Array.from({length:n},()=>new Array(n).fill(false));
  const marca=(x0,y0,w,h)=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)if(x>=0&&y>=0&&x<n&&y<n)f[y][x]=true};
  marca(0,0,9,9);marca(n-8,0,8,9);marca(0,n-8,9,8);
  for(let i=0;i<n;i++){f[6][i]=true;f[i][6]=true}
  const al=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]][v-1];
  const u=al.length-1;
  al.forEach((a,i)=>al.forEach((b,j)=>{if(i===0&&j===0||i===0&&j===u||i===u&&j===0)return;marca(b-2,a-2,5,5)}));
  if(v>=7){marca(n-11,0,3,6);marca(0,n-11,6,3)}
  return f;
}
function ler(m){
  const n=m.length,v=(n-17)/4;
  let bits=0;
  const pos=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  pos.forEach(([x,y],i)=>{if(m[y][x])bits|=1<<i});
  const d=formatoValido(bits);
  assert.ok(d>=0,"formato com BCH inválido");
  assert.equal(d>>3,0,"nível de correção deveria ser M");
  const mascara=d&7,f=areasFixas(v,n);
  const inv=(x,y)=>[(x+y)%2===0,y%2===0,x%3===0,(x+y)%3===0,(Math.floor(x/3)+Math.floor(y/2))%2===0,x*y%2+x*y%3===0,(x*y%2+x*y%3)%2===0,((x+y)%2+x*y%3)%2===0][mascara];
  const fluxo=[];
  let subindo=true;
  for(let col=n-1;col>0;col-=2){
    if(col===6)col--;
    for(let k=0;k<n;k++){const y=subindo?n-1-k:k;for(const x of [col,col-1])if(!f[y][x])fluxo.push(m[y][x]!==inv(x,y)?1:0)}
    subindo=!subindo;
  }
  const cw=[];for(let i=0;i+8<=fluxo.length;i+=8)cw.push(fluxo.slice(i,i+8).reduce((a,b)=>a<<1|b,0));
  const ecc=[10,16,26,18,24,16,18,22,22,26][v-1],nb=[1,1,1,2,2,4,4,4,5,5][v-1];
  const total=Math.floor(cw.length),dados=total-ecc*nb,curto=Math.floor(dados/nb),nCurtos=nb-dados%nb;
  const blocos=Array.from({length:nb},(_,i)=>({d:[],e:[],len:curto+(i<nCurtos?0:1)}));
  let k=0;
  for(let i=0;i<=curto;i++)blocos.forEach(b=>{if(i<b.len)b.d.push(cw[k++])});
  for(let i=0;i<ecc;i++)blocos.forEach(b=>b.e.push(cw[k++]));
  blocos.forEach((b,bi)=>{
    const c=[...b.d,...b.e];
    for(let r=0;r<ecc;r++){let s=0;for(const x of c)s=gmul(s,EXP[r])^x;assert.equal(s,0,`síndrome ${r} do bloco ${bi} não zerou`)}
  });
  const todos=blocos.flatMap(b=>b.d);
  const bitsD=todos.flatMap(b=>[...Array(8)].map((_,i)=>(b>>>(7-i))&1));
  const le=(p,nn)=>bitsD.slice(p,p+nn).reduce((a,b)=>a<<1|b,0);
  assert.equal(le(0,4),4,"modo deveria ser byte");
  const cl=v<10?8:16,len=le(4,cl);
  const out=[];for(let i=0;i<len;i++)out.push(le(4+cl+i*8,8));
  return new TextDecoder().decode(new Uint8Array(out));
}

for(const texto of ["oi","https://alusionbr.github.io/teste1/karaoke/controle.html?sala=ABC234","Karaokê em Casa 🎤 ção","x".repeat(150),"z".repeat(213)]){
  test(`QR lê de volta: ${texto.slice(0,30)}… (${texto.length} caracteres)`,()=>{
    const m=QR.gerar(texto);
    assert.equal(ler(m),texto);
  });
}
test("QR recusa texto grande demais",()=>{assert.throws(()=>QR.gerar("a".repeat(300)))});
test("localizadores nos três cantos",()=>{
  const m=QR.gerar("teste"),n=m.length;
  for(const [x,y] of [[0,0],[n-7,0],[0,n-7]]){assert.equal(m[y][x],true);assert.equal(m[y+1][x+1],false);assert.equal(m[y+3][x+3],true)}
});
