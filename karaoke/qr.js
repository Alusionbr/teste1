"use strict";
/*
 * Gerador de QR code em JavaScript puro (sem biblioteca), para o convite da
 * sala. Só o necessário: modo byte, correção de erro nível M, versões 1 a 10
 * (até 213 bytes — sobra para o link da sala, que tem ~70).
 *
 * Segue a norma ISO/IEC 18004: Reed-Solomon em GF(256) com o polinômio 0x11D,
 * padrões de posição, alinhamento e tempo, informação de formato com BCH
 * (0x537, máscara 0x5412), informação de versão (0x1F25) a partir da 7, e a
 * máscara de menor penalidade entre as 8. Conferido em tests/qr.test.js com
 * um leitor independente.
 */
const QR=(()=>{
  // Nível M, versões 1..10: códigos de correção por bloco e número de blocos.
  const ECC_POR_BLOCO=[10,16,26,18,24,16,18,22,22,26];
  const BLOCOS=[1,1,1,2,2,4,4,4,5,5];
  const ALINHAMENTO=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];

  function modulosDeDados(v){
    let r=(16*v+128)*v+64;
    if(v>=2){const n=Math.floor(v/7)+2;r-=(25*n-10)*n-55;if(v>=7)r-=36}
    return r;
  }
  const totalCodigos=v=>Math.floor(modulosDeDados(v)/8);
  const codigosDeDados=v=>totalCodigos(v)-ECC_POR_BLOCO[v-1]*BLOCOS[v-1];

  /* ----------------------------------------------------- Reed-Solomon */
  function mul(x,y){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);z^=((y>>>i)&1)*x}return z&0xff}
  function divisor(grau){
    const r=new Array(grau).fill(0);r[grau-1]=1;let raiz=1;
    for(let i=0;i<grau;i++){for(let j=0;j<grau;j++){r[j]=mul(r[j],raiz);if(j+1<grau)r[j]^=r[j+1]}raiz=mul(raiz,2)}
    return r;
  }
  function resto(dados,div){
    const r=new Array(div.length).fill(0);
    for(const b of dados){const f=b^r.shift();r.push(0);div.forEach((c,i)=>{r[i]^=mul(c,f)})}
    return r;
  }

  /* ------------------------------------------------------- dados */
  function codificar(bytes,v){
    const bits=[];
    const poe=(val,n)=>{for(let i=n-1;i>=0;i--)bits.push((val>>>i)&1)};
    poe(4,4);poe(bytes.length,v<10?8:16);bytes.forEach(b=>poe(b,8));
    const cap=codigosDeDados(v)*8;
    poe(0,Math.min(4,cap-bits.length));
    while(bits.length%8)bits.push(0);
    const dados=[];for(let i=0;i<bits.length;i+=8)dados.push(bits.slice(i,i+8).reduce((a,b)=>a<<1|b,0));
    for(let pad=0xec;dados.length<codigosDeDados(v);pad^=0xec^0x11)dados.push(pad);
    // Divide em blocos (os curtos primeiro), calcula a correção e intercala.
    const nb=BLOCOS[v-1],ecc=ECC_POR_BLOCO[v-1],total=codigosDeDados(v);
    const curto=Math.floor(total/nb),nCurtos=nb-total%nb;
    const blocos=[],correcoes=[],div=divisor(ecc);
    let k=0;
    for(let i=0;i<nb;i++){const len=curto+(i<nCurtos?0:1);const b=dados.slice(k,k+len);k+=len;blocos.push(b);correcoes.push(resto(b,div))}
    const saida=[];
    for(let i=0;i<=curto;i++)blocos.forEach(b=>{if(i<b.length)saida.push(b[i])});
    for(let i=0;i<ecc;i++)correcoes.forEach(c=>saida.push(c[i]));
    return saida;
  }

  /* ----------------------------------------------------- matriz */
  function gerar(texto){
    const bytes=[...new TextEncoder().encode(texto)];
    let v=1;while(v<=10&&codigosDeDados(v)<bytes.length+(v<10?2:3))v++;
    if(v>10)throw Error("Texto longo demais para o QR code.");
    const n=v*4+17;
    const mod=Array.from({length:n},()=>new Array(n).fill(false));
    const fixo=Array.from({length:n},()=>new Array(n).fill(false));
    const poe=(x,y,escuro)=>{mod[y][x]=escuro;fixo[y][x]=true};

    for(let i=0;i<n;i++){poe(6,i,i%2===0);poe(i,6,i%2===0)}
    const localizador=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy)),x=cx+dx,y=cy+dy;if(x>=0&&x<n&&y>=0&&y<n)poe(x,y,d!==2&&d!==4)}};
    localizador(3,3);localizador(n-4,3);localizador(3,n-4);
    const al=ALINHAMENTO[v-1],u=al.length-1;
    al.forEach((ay,i)=>al.forEach((ax,j)=>{
      if(i===0&&j===0||i===0&&j===u||i===u&&j===0)return;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)poe(ax+dx,ay+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
    }));
    formato(poe,n,0); // reserva as áreas de formato antes de poe os dados
    if(v>=7){
      let r=v;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1f25);
      const b=v<<12|r;
      for(let i=0;i<18;i++){const e=((b>>>i)&1)===1,a=n-11+i%3,c=Math.floor(i/3);poe(a,c,e);poe(c,a,e)}
    }
    // Dados em zigue-zague, de baixo para cima, de duas em duas colunas.
    const cw=codificar(bytes,v);let bit=0;
    for(let dir=n-1;dir>=1;dir-=2){
      if(dir===6)dir=5;
      for(let vert=0;vert<n;vert++)for(let j=0;j<2;j++){
        const x=dir-j,sobe=((dir+1)&2)===0,y=sobe?n-1-vert:vert;
        if(!fixo[y][x]&&bit<cw.length*8){mod[y][x]=((cw[bit>>>3]>>>(7-(bit&7)))&1)===1;bit++}
      }
    }
    // Escolhe a máscara de menor penalidade.
    let melhor=null,menor=Infinity;
    for(let m=0;m<8;m++){
      const t=mod.map(l=>l.slice());
      aplicarMascara(t,fixo,m,n);
      formato((x,y,e)=>{t[y][x]=e},n,m);
      const p=penalidade(t,n);
      if(p<menor){menor=p;melhor=t}
    }
    return melhor;
  }
  function formato(poe,n,mascara){
    const dados=0<<3|mascara; // nível M = 00
    let r=dados;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);
    const b=(dados<<10|r)^0x5412,bit=i=>((b>>>i)&1)===1;
    for(let i=0;i<=5;i++)poe(8,i,bit(i));
    poe(8,7,bit(6));poe(8,8,bit(7));poe(7,8,bit(8));
    for(let i=9;i<15;i++)poe(14-i,8,bit(i));
    for(let i=0;i<8;i++)poe(n-1-i,8,bit(i));
    for(let i=8;i<15;i++)poe(8,n-15+i,bit(i));
    poe(8,n-8,true);
  }
  function aplicarMascara(t,fixo,m,n){
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      if(fixo[y][x])continue;
      let inv;
      switch(m){
        case 0:inv=(x+y)%2===0;break;case 1:inv=y%2===0;break;case 2:inv=x%3===0;break;case 3:inv=(x+y)%3===0;break;
        case 4:inv=(Math.floor(x/3)+Math.floor(y/2))%2===0;break;case 5:inv=x*y%2+x*y%3===0;break;
        case 6:inv=(x*y%2+x*y%3)%2===0;break;default:inv=((x+y)%2+x*y%3)%2===0;
      }
      if(inv)t[y][x]=!t[y][x];
    }
  }
  function penalidade(t,n){
    let p=0,escuros=0;
    const linha=(get)=>{let run=1;for(let i=1;i<n;i++){if(get(i)===get(i-1)){run++;if(run===5)p+=3;else if(run>5)p++}else run=1}
      for(let i=0;i+10<n;i++){const s=[...Array(11)].map((_,k)=>get(i+k)?1:0).join("");if(s==="10111010000"||s==="00001011101")p+=40}};
    for(let y=0;y<n;y++)linha(i=>t[y][i]);
    for(let x=0;x<n;x++)linha(i=>t[i][x]);
    for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){const c=t[y][x];if(c===t[y][x+1]&&c===t[y+1][x]&&c===t[y+1][x+1])p+=3}
    t.forEach(l=>l.forEach(c=>{if(c)escuros++}));
    p+=Math.floor(Math.abs(escuros*20-n*n*10)/(n*n))*10;
    return p;
  }

  // Desenha no <canvas>, com a margem obrigatória de 4 módulos.
  function desenhar(canvas,texto){
    const m=gerar(texto),n=m.length,tam=n+8;
    const esc=Math.max(1,Math.floor(Math.min(canvas.width,canvas.height)/tam));
    canvas.width=canvas.height=tam*esc;
    const c=canvas.getContext("2d");
    c.fillStyle="#fff";c.fillRect(0,0,canvas.width,canvas.height);
    c.fillStyle="#000";
    m.forEach((l,y)=>l.forEach((on,x)=>{if(on)c.fillRect((x+4)*esc,(y+4)*esc,esc,esc)}));
  }
  return{gerar,desenhar};
})();
if(typeof module!=="undefined")module.exports=QR;
