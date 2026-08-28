"use strict";
/*
 * Ferramentas de ensaio de coral.
 *
 * O Estante nasceu para um músico só, com uma pedaleira. Coral é outra coisa:
 * várias pessoas lendo o MESMO texto ao mesmo tempo, cada uma com uma parte
 * diferente, e repetindo um trecho até acertar. Duas ferramentas cobrem isso,
 * e as duas funcionam sem rede — que é o que importa, porque ensaio de coral
 * costuma acontecer em salão de igreja, onde o sinal não chega.
 *
 * 1. NAIPE. `classify()` (library.js) já transforma qualquer [Texto] em seção:
 *    [Sopranos] já é uma seção hoje, inclusive dentro de .lrc. Não há parser
 *    novo aqui — só a distinção entre uma seção que diz QUEM CANTA e uma que
 *    diz QUE PARTE É (refrão, ponte, final).
 *
 * 2. LAÇO. Repetir a seção em que você está, do marcador até o próximo. É a
 *    forma do pedido real no ensaio ("de novo, do refrão") e por isso não
 *    exige marcar começo e fim.
 */

/* ------------------------------------------------------------------ naipes */
/*
 * Seção que NÃO é naipe: diz que parte da música é, não quem canta. Cai aqui
 * também [Solo], [Todos] e [Coro] — quem lê continua acompanhando, então
 * esmaecer seria esconder o que a pessoa precisa ver para saber quando entra.
 */
const SECAO_ESTRUTURAL=/^(refrao|estribilho|ponte|bridge|final|fim|coda|intro|introducao|solo|solista|instrumental|interludio|verso|estrofe|parte|primeira parte|segunda parte|todos|tutti|geral|coro|unissono|chorus)\b/;
// Famílias de voz. A chave é o que compara: "Contraltos" e "Contralto 2" são
// a mesma voz para quem está lendo.
const NAIPES=[
  {chave:"soprano",   re:/\bsopranos?\b/},
  {chave:"mezzo",     re:/\b(mezzos?|meio sopranos?)\b/},
  {chave:"contralto", re:/\b(contraltos?|altos?)\b/},
  {chave:"tenor",     re:/\b(tenor|tenores)\b/},
  {chave:"baixo",     re:/\b(baixos?|baritonos?)\b/}
];
const ORDINAIS={primeira:"1",segunda:"2",terceira:"3",quarta:"4"};

/*
 * Que voz canta esta seção? "" quando a seção é estrutural, desconhecida ou
 * vazia — e "" quer dizer "todo mundo lê", que é o comportamento de sempre.
 * Devolver um naipe para uma seção qualquer seria pior que não devolver nada:
 * esmaeceria metade do hino por causa de um [Coral Feminino] escrito à mão.
 */
function naipeDe(texto){
  const f=fold(texto);
  if(!f||SECAO_ESTRUTURAL.test(f))return "";
  for(const n of NAIPES)if(n.re.test(f))return n.chave;
  // "1ª Voz", "voz 2", "primeira voz" — fold() já tirou o ª e a acentuação.
  const v=f.match(/(?:voz(?:es)?\s*([1-4])|([1-4])\s*a?\s*voz|(primeira|segunda|terceira|quarta)\s*voz)/);
  if(v)return "voz "+(v[1]||v[2]||ORDINAIS[v[3]]);
  // A voz digitada pelo próprio usuário vale mesmo fora do vocabulário: é o
  // nome que a casa usa. Só ela, para não transformar seção qualquer em naipe.
  const minha=fold(state.naipe);
  if(minha&&f===minha)return minha;
  return "";
}
// A voz de quem está lendo, na mesma forma canônica das seções.
function meuNaipe(){return state.naipe?(naipeDe(state.naipe)||fold(state.naipe)):""}

/*
 * Cada linha herda o naipe da última seção acima dela. Seção estrutural zera a
 * herança: depois de [Refrão] a letra volta a ser de todos, que é como um
 * hinário se comporta.
 */
function marcarNaipes(){
  let atual="";
  state.lines.forEach(l=>{
    if(l.type==="section")atual=naipeDe(l.text);
    l.naipe=atual;
  });
}
function musicaTemNaipes(){return state.lines.some(l=>l.type==="section"&&l.naipe)}

/*
 * Realce: as outras vozes ficam ESMAECIDAS, não escondidas. Cantor precisa
 * enxergar o que a outra voz faz para saber quando entra — sumir com o texto
 * quebraria o sentido do hino e a contagem dos compassos.
 */
function aplicarNaipe(){
  marcarNaipes();
  const meu=meuNaipe(),realce=!!meu&&state.soMinhaVoz&&musicaTemNaipes();
  document.body.classList.toggle("realceNaipe",realce);
  const nodes=$("paper").children;
  state.lines.forEach((l,i)=>{
    const n=nodes[i];if(!n)return;
    n.dataset.naipe=l.naipe||"";
    n.classList.toggle("outraVoz",realce&&!!l.naipe&&l.naipe!==meu);
    n.classList.toggle("minhaVoz",realce&&l.naipe===meu);
  });
}
function setNaipe(voz){
  state.naipe=String(voz||"").slice(0,24);
  if(state.naipe)state.soMinhaVoz=true;
  updatePrefs();atualizarEnsaio();
}
function toggleMinhaVoz(){state.soMinhaVoz=!state.soMinhaVoz;updatePrefs();atualizarEnsaio()}
// Redesenha o que depende do naipe sem redesenhar a letra: trocar de voz no
// meio do ensaio não pode fazer o texto piscar.
function atualizarEnsaio(){aplicarNaipe();renderSectionBar()}

/* -------------------------------------------------------------------- laço */
/*
 * O laço é do momento, não do repertório: não é salvo em lugar nenhum. Sair da
 * música, apertar Esc ou trocar de modo desliga.
 */
let loopEsperaAte=0;

function linhaVisivel(){
  // Com letra temporizada, quem sabe onde a música está é o relógio; sem ela,
  // a posição da rolagem.
  if(state.lrc.length&&lastActive>=0)return lastActive;
  const topo=$("paperViewport").scrollTop+8,nodes=$("paper").children;
  let i=0;
  for(let k=0;k<nodes.length;k++){if(nodes[k].offsetTop<=topo)i=k;else break}
  return i;
}
function secaoAtual(){
  const i=linhaVisivel();
  for(let k=i;k>=0;k--)if(state.lines[k]&&state.lines[k].type==="section")return k;
  return state.lines.findIndex(l=>l.type==="section");
}
// Fim do trecho: a última linha antes da próxima seção.
function fimDaSecao(de){
  for(let k=de+1;k<state.lines.length;k++)if(state.lines[k].type==="section")return k-1;
  return state.lines.length-1;
}
function topoDaLinha(i){const n=$("paper").children[i];return n?Math.max(0,n.offsetTop-16):0}

function ligarLoop(de){
  if(de<0||!state.lines[de])return;
  state.loop={de,ate:fimDaSecao(de),voltas:0};
  loopEsperaAte=0;
  renderSectionBar();
  notify(`Repetindo "${esc(state.lines[de].text)}". Toque em ⟳ para parar.`,true);
}
function pararLoop(){
  if(!state.loop)return;
  state.loop=null;renderSectionBar();
}
function toggleLoop(){
  if(state.loop)return pararLoop();
  if(!state.lines.some(l=>l.type==="section"))
    return notify("Esta música não tem seções para repetir. Escreva [Refrão] ou [Sopranos] numa linha da letra, em Editar letra.");
  ligarLoop(secaoAtual());
}

/*
 * Uma volta só por volta.
 *
 * No karaokê o seekTo não é instantâneo: o vídeo leva alguns quadros para
 * chegar lá, e nesse intervalo o tempo lido continua além do fim do trecho.
 * Sem esta espera, o contador subiria dezenas de vezes por repetição e o app
 * mandaria um seek por quadro.
 */
function contarVolta(){
  if(!state.loop)return;
  state.loop.voltas++;
  loopEsperaAte=performance.now()+700;
  renderSectionBar();
}
function loopEsperando(){return performance.now()<loopEsperaAte}

// Rolagem. Devolve true quando cuidou do quadro — o tick() usa isso para não
// chamar atScrollEnd() e desligar a rolagem num trecho que termina na última
// linha da letra.
function loopRolagem(){
  if(!state.loop)return false;
  if(loopEsperando())return true;
  const vp=$("paperViewport"),nodes=$("paper").children,fim=nodes[state.loop.ate];
  if(!fim)return false;
  const base=topoDaLinha(state.loop.de);
  const alvo=Math.max(base,fim.offsetTop+fim.offsetHeight-vp.clientHeight+24);
  // Trecho que cabe inteiro na tela não tem o que rolar: segura a posição em
  // vez de voltar ao topo a cada quadro, contando voltas que não existiram.
  if(alvo-base<8){vp.scrollTop=base;return true}
  if(vp.scrollTop<alvo)return false;
  vp.scrollTop=base;contarVolta();return true;
}
// Sincronia e karaokê COM .lrc: seekSync já sabe mandar o comando ao vídeo em
// vez de mexer no relógio interno quando o karaokê está ligado.
function loopSincronia(i){
  if(!state.loop||i<=state.loop.ate)return false;
  if(loopEsperando())return true;
  seekSync(state.loop.de);contarVolta();return true;
}
/*
 * Karaokê SEM .lrc: converte linha em tempo pela mesma proporção que
 * karaokeScrollPosition() usa ao contrário. É aproximado, e não tem como não
 * ser — sem letra temporizada o app nunca soube em que segundo cada verso cai.
 * Serve para o ensaio: erra alguns segundos, não a seção.
 */
function tempoDaLinha(i){
  const dur=Number(state.current&&state.current.duration)||0,dist=scrollDistance();
  if(dur<=LEAD_IN||dist<=0)return 0;
  const nodes=$("paper").children;
  const px=i>=nodes.length?dist:topoDaLinha(i);
  return LEAD_IN+(Math.max(0,Math.min(px,dist))/dist)*(dur-LEAD_IN);
}
function loopKaraoke(t){
  if(!state.loop)return false;
  if(loopEsperando())return true;
  const fim=tempoDaLinha(state.loop.ate+1);
  if(!fim||t<fim)return false;
  karaokeSeek(tempoDaLinha(state.loop.de));contarVolta();return true;
}
