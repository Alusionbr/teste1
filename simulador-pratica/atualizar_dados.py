"""Monta dados.json e dados.js (retrato de exibição) a partir de resultados de consultas do banco OpenBot.

Este script NÃO acessa o banco, nem SQLite, nem a rede, nem conta real. Ele só lê o que você
entregar (arquivos ou entrada padrão) e escreve dados.json / dados.js na pasta de saída.
Quem consulta o banco é a rotina/agente, com as ferramentas OpenBot (openbot.query_data).

MODO RECOMENDADO (rotina OpenBot): --stdin --mesclar
  python atualizar_dados.py --stdin --mesclar <<'EOF'
  {"contagem": {"ordens": 12}}
  {"tabela": "registros", "columns": [...], "rows": [[...]], "truncated": false}
  {"tabela": "traders",   "columns": [...], "rows": [[...]], "truncated": false}
  EOF
Cada linha é um objeto JSON (NDJSON): ou o retorno de query_data copiado como está com a chave
"tabela" acrescentada, ou {"tabela": "...", "resultado": <retorno de query_data>}. Também vale um único
documento JSON com uma lista desses objetos. A mesma tabela pode aparecer várias vezes (páginas);
as linhas são unidas pela chave. Veja o LEIA-ME.md para as consultas exatas.

Tabelas aceitas: registros, traders, metricas, operacoes, altas.
Regras de segurança (qualquer falha = nada é gravado, código de saída 1):
  - resultado com "truncated": true, ou com 500 linhas sem "truncated": false, é recusado (paginar por id);
  - "contagem.ordens" (número de compras+vendas no banco) é obrigatória ao informar registros e precisa
    bater com o pacote final; sem ela não há como provar que nenhuma compra/venda ficou de fora
    (use --sem-contagem só conscientemente);
  - o saldo é reconstruído: venda sem posição ou caixa negativo indica compra/venda faltando;
  - chave repetida com conteúdo diferente, campo obrigatório ausente ou número inválido são recusados.
--mesclar junta com o dados.json atual (nunca perde compras/vendas antigas); sem ele, as tabelas
informadas substituem as atuais. Tabelas não informadas são mantidas.

MODO POR ARQUIVOS (antigo, mantido): --registros reg.json --traders tr.json ... (um JSON por tabela).
Códigos de saída: 0 ok; 1 recusado (dados inválidos/incompletos); 2 uso incorreto.
"""
import argparse
import datetime as dt
import json
import math
import os
import pathlib
import sys

AQUI = pathlib.Path(__file__).resolve().parent
LIMITE_CONSULTA = 500          # teto de linhas por resultado de query_data
SALDO_INICIAL = 1000.0
EPS = 1e-8

# nome no pacote -> (argumento de arquivo, colunas obrigatórias)
TABELAS = {
    'registros': ('registros', ('chave', 'mercado', 'tipo', 'instante_utc')),
    'traders': ('traders', ('endereco', 'plataforma')),
    'metricas': ('metricas', ('endereco', 'instante_utc')),
    'operacoes_publicas': ('operacoes', ('chave', 'endereco', 'instante_utc', 'ativo')),
    'altas': ('altas', ('chave', 'instante_utc', 'par')),
}
ALIAS = {'registros': 'registros', 'traders': 'traders', 'metricas': 'metricas',
         'operacoes': 'operacoes_publicas', 'operacoes_publicas': 'operacoes_publicas', 'altas': 'altas'}


class Recusa(Exception):
    """Dado inválido ou incompleto: nada deve ser gravado."""


# ---------------------------------------------------------------- leitura

def linhas_de_resultado(obj, onde):
    """Retorno de query_data ({columns, rows, truncated}) ou lista de objetos -> lista de dicts."""
    if isinstance(obj, dict) and 'columns' in obj and 'rows' in obj:
        cols, rows = obj['columns'], obj['rows']
        if not isinstance(cols, list) or not isinstance(rows, list):
            raise Recusa(f'{onde}: columns/rows em formato inesperado')
        if obj.get('truncated') is True:
            raise Recusa(f'{onde}: resultado truncado (truncated=true). Pagine a consulta por id '
                         f'(WHERE id > ? ORDER BY id LIMIT {LIMITE_CONSULTA}) e envie cada página.')
        if len(rows) >= LIMITE_CONSULTA and obj.get('truncated') is not False:
            raise Recusa(f'{onde}: {len(rows)} linhas sem "truncated": false; pode haver mais. Pagine por id.')
        for i, r in enumerate(rows, 1):
            if not isinstance(r, list) or len(r) != len(cols):
                raise Recusa(f'{onde}: linha {i} não tem o mesmo número de colunas do cabeçalho')
        return [dict(zip(cols, r)) for r in rows]
    if isinstance(obj, list) and all(isinstance(x, dict) for x in obj):
        return obj
    raise Recusa(f'{onde}: formato não reconhecido (use o retorno de query_data ou uma lista de objetos)')


def ler_stdin_utf8():
    """Lê a entrada padrão como UTF-8 (no Windows o padrão do console corromperia os acentos)."""
    bruto = sys.stdin.buffer.read()
    try:
        return bruto.decode('utf-8-sig')
    except UnicodeDecodeError as e:
        raise Recusa(f'a entrada não é UTF-8 válido ({e.reason} na posição {e.start}); '
                     f'envie o texto em UTF-8 para não corromper acentos')


def itens_do_texto(texto):
    t = texto.strip()
    if not t:
        raise Recusa('entrada vazia')
    try:
        obj = json.loads(t)
    except json.JSONDecodeError:
        itens = []
        for n, linha in enumerate(t.splitlines(), 1):
            linha = linha.strip()
            if not linha:
                continue
            try:
                itens.append(json.loads(linha))
            except json.JSONDecodeError as e:
                raise Recusa(f'entrada, linha {n}: JSON inválido ({e.msg}); '
                             f'cada linha precisa ser um objeto JSON completo')
        return itens
    if isinstance(obj, list):
        return obj
    if isinstance(obj, dict) and isinstance(obj.get('resultados'), list):
        itens = list(obj['resultados'])
        if 'contagem' in obj:
            itens.append({'contagem': obj['contagem']})
        return itens
    return [obj]


def validar_campos(nome, linhas, onde):
    obrigatorias = TABELAS[nome][1]
    for i, linha in enumerate(linhas, 1):
        faltando = [c for c in obrigatorias if linha.get(c) in (None, '')]
        if faltando:
            raise Recusa(f'{onde}: linha {i} sem {", ".join(faltando)}')


def identidade(nome, linha):
    if nome == 'traders':
        return linha['endereco']
    if nome == 'metricas':
        return linha.get('chave') or (linha['endereco'], linha['instante_utc'])
    return linha['chave']


def conjuntos_do_stdin(itens):
    """Itens NDJSON -> ({tabela: {identidade: linha}}, contagens). Une páginas da mesma tabela."""
    conjuntos, contagens = {}, {}
    for i, item in enumerate(itens, 1):
        if not isinstance(item, dict):
            raise Recusa(f'item {i}: esperado um objeto JSON')
        if 'contagem' in item:
            if not isinstance(item['contagem'], dict):
                raise Recusa(f'item {i}: "contagem" precisa ser um objeto, ex.: {{"ordens": 12}}')
            contagens.update(item['contagem'])
            continue
        nome = ALIAS.get(item.get('tabela'))
        if not nome:
            raise Recusa(f'item {i}: "tabela" ausente ou desconhecida ({item.get("tabela")!r}); '
                         f'use registros, traders, metricas, operacoes ou altas')
        onde = f'item {i} ({item["tabela"]})'
        origem = item['resultado'] if 'resultado' in item else item
        linhas = linhas_de_resultado(origem, onde)
        validar_campos(nome, linhas, onde)
        destino = conjuntos.setdefault(nome, {})
        for linha in linhas:
            k = identidade(nome, linha)
            if k in destino and any(c in destino[k] and destino[k][c] != v for c, v in linha.items()):
                raise Recusa(f'{onde}: {k!r} aparece duas vezes com conteúdo diferente '
                             f'(páginas sobrepostas ou dado alterado durante a leitura)')
            destino[k] = {**destino.get(k, {}), **linha}
    return conjuntos, contagens


def carregar_arquivo(caminho):
    with open(caminho, 'r', encoding='utf-8') as arq:
        return linhas_de_resultado(json.load(arq), str(caminho))


def ler_pacote_existente(caminho):
    if not caminho.exists():
        return None
    try:
        p = json.loads(caminho.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as e:
        raise Recusa(f'{caminho.name} atual ilegível ({e}); corrija ou remova antes de atualizar')
    if not isinstance(p, dict) or not isinstance(p.get('tabelas'), dict):
        raise Recusa(f'{caminho.name} atual com formato inesperado')
    return p


def ultimos_ids(pacote):
    """Maior 'id' do banco já presente em cada tabela do pacote atual (0 se não houver)."""
    def maior(linhas):
        ids = [l['id'] for l in linhas if isinstance(l.get('id'), int) and not isinstance(l.get('id'), bool)]
        return max(ids) if ids else 0
    t = (pacote or {}).get('tabelas', {})
    reg = t.get('registros', [])
    return {'registros': maior(reg),
            'ordens': maior([l for l in reg if l.get('tipo') in ('compra', 'venda')]),
            'traders': maior(t.get('traders', [])),
            'metricas': maior(t.get('metricas', [])),
            'operacoes': maior(t.get('operacoes_publicas', [])),
            'altas': maior(t.get('altas', []))}


# ---------------------------------------------------------------- verificação

def epoch(texto, onde):
    try:
        t = dt.datetime.fromisoformat(str(texto).replace('Z', '+00:00'))
    except ValueError:
        raise Recusa(f'{onde}: instante_utc inválido ({texto!r})')
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    return t.timestamp()


def numero(valor, campo, chave):
    try:
        n = float(valor)
    except (TypeError, ValueError):
        raise Recusa(f'registro {chave!r}: {campo} não é número')
    if not math.isfinite(n):
        raise Recusa(f'registro {chave!r}: {campo} não é finito')
    return n


def checar_saldo(registros):
    """Mesma contabilidade do motor oficial; venda sem posição ou caixa negativo => faltam ordens."""
    for mercado in sorted({r['mercado'] for r in registros}):
        ordens = [r for r in registros if r['mercado'] == mercado and r['tipo'] in ('compra', 'venda')]
        ordens.sort(key=lambda r: (epoch(r['instante_utc'], r['chave']), r['chave']))
        caixa, pos = SALDO_INICIAL, {}
        for r in ordens:
            p = pos.setdefault(r['ativo'], {'qtd': 0.0, 'custo': 0.0})
            qtd = numero(r.get('quantidade'), 'quantidade', r['chave'])
            bruto = numero(r.get('valor_brl'), 'valor_brl', r['chave'])
            taxa = numero(r.get('taxa_brl'), 'taxa_brl', r['chave'])
            if r['tipo'] == 'compra':
                caixa -= bruto + taxa
                p['qtd'] += qtd
                p['custo'] += bruto + taxa
            else:
                if p['qtd'] <= 0 or qtd > p['qtd'] + EPS:
                    raise Recusa(f'saldo de {mercado}: venda de {r["ativo"]} sem posição suficiente ({r["chave"]!r}); '
                                 f'provavelmente falta uma compra no pacote')
                p['custo'] *= max(0.0, 1 - qtd / p['qtd'])
                p['qtd'] = max(0.0, p['qtd'] - qtd)
                caixa += bruto - taxa
        if caixa < -0.01:
            raise Recusa(f'saldo de {mercado}: caixa negativo ({caixa:.2f}); histórico incompleto ou inconsistente')


def contar_ordens(registros):
    return sum(1 for r in registros if r['tipo'] in ('compra', 'venda'))


def conferir_contagens(tabelas, contagens, exige_ordens):
    totais = {'ordens': contar_ordens(tabelas['registros']), 'registros': len(tabelas['registros']),
              'traders': len(tabelas['traders']), 'metricas': len(tabelas['metricas']),
              'operacoes': len(tabelas['operacoes_publicas']), 'altas': len(tabelas['altas'])}
    for k, esperado in contagens.items():
        if k not in totais:
            raise Recusa(f'contagem desconhecida: {k!r} (use ordens, registros, traders, metricas, operacoes, altas)')
        if isinstance(esperado, bool) or not isinstance(esperado, int) or esperado < 0:
            raise Recusa(f'contagem.{k} precisa ser um inteiro não negativo (recebido {esperado!r})')
        if esperado != totais[k]:
            raise Recusa(f'contagem.{k}: o banco informa {esperado}, o pacote final tem {totais[k]}. '
                         f'Falta alguma página ou linha; nada foi gravado.')
    if exige_ordens and 'ordens' not in contagens:
        raise Recusa('falta {"contagem": {"ordens": N}} (N = compras+vendas no banco): sem ela não há como provar '
                     'que todas as compras/vendas necessárias ao saldo vieram. Use --sem-contagem só se aceitar o risco.')
    return totais


# ---------------------------------------------------------------- gravação

def gravar(saida, pacote):
    try:
        texto = json.dumps(pacote, ensure_ascii=False, indent=1, allow_nan=False)
    except ValueError as e:
        raise Recusa(f'pacote com número inválido (NaN/infinito): {e}')
    saida.mkdir(parents=True, exist_ok=True)
    alvos = [(saida / 'dados.json', texto + '\n'), (saida / 'dados.js', 'window.DADOS = ' + texto + ';\n')]
    tmps = []
    try:
        for alvo, conteudo in alvos:           # primeiro escreve tudo em temporários...
            tmp = alvo.with_name(alvo.name + '.tmp')
            tmp.write_text(conteudo, encoding='utf-8')
            tmps.append((tmp, alvo))
        for tmp, alvo in tmps:                 # ...depois troca (os.replace é atômico por arquivo)
            os.replace(tmp, alvo)
        tmps = []
    finally:
        for tmp, _ in tmps:
            try:
                tmp.unlink()
            except OSError:
                pass


def ordenar(nome, linhas):
    return sorted(linhas, key=lambda l: (str(l.get('instante_utc') or l.get('selecionado_utc') or ''), str(identidade(nome, l))))


def montar(args):
    saida = pathlib.Path(args.saida)
    existente = ler_pacote_existente(saida / 'dados.json')
    tabelas = {nome: [] for nome in TABELAS}
    modo = 'arquivos'
    informadas, contagens = {}, {}

    if args.stdin:
        modo = 'stdin'
        conjuntos, contagens = conjuntos_do_stdin(itens_do_texto(ler_stdin_utf8()))
        informadas = {nome: list(d.values()) for nome, d in conjuntos.items()}
        base = existente
    else:
        base = None
        if args.partir_de:
            base = json.loads(pathlib.Path(args.partir_de).read_text(encoding='utf-8'))
        elif args.mesclar:
            base = existente
        for nome, (arg, _) in TABELAS.items():
            caminho = getattr(args, arg)
            if caminho:
                linhas = carregar_arquivo(caminho)
                validar_campos(nome, linhas, caminho)
                informadas[nome] = linhas

    if base:
        for nome in TABELAS:
            tabelas[nome] = list(base.get('tabelas', {}).get(nome, []))
    if not informadas and not base:
        raise Recusa('nada informado: envie ao menos uma tabela (veja --help)')

    for nome, novas in informadas.items():
        if args.mesclar:
            atual = {identidade(nome, l): l for l in tabelas[nome]}
            for l in novas:
                k = identidade(nome, l)
                atual[k] = {**atual.get(k, {}), **l}   # a versão nova prevalece
            tabelas[nome] = list(atual.values())
        else:
            tabelas[nome] = list(novas)
    for nome in TABELAS:
        tabelas[nome] = ordenar(nome, tabelas[nome])
        validar_campos(nome, tabelas[nome], f'pacote final ({nome})')
        vistos = set()
        for l in tabelas[nome]:
            k = identidade(nome, l)
            if k in vistos:
                raise Recusa(f'pacote final ({nome}): chave repetida {k!r}')
            vistos.add(k)

    checar_saldo(tabelas['registros'])
    exige = modo == 'stdin' and 'registros' in informadas and not args.sem_contagem
    totais = conferir_contagens(tabelas, contagens, exige)

    pacote = {
        'gerado_em': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'fonte': 'banco compartilhado do OpenBot (consulta somente leitura; fonte oficial)',
        'conferencia': {'modo': modo, 'ordens_no_pacote': totais['ordens'],
                        'ordens_conferidas_com_o_banco': 'ordens' in contagens,
                        'tabelas_recebidas': sorted(informadas)},
        'tabelas': tabelas,
    }
    return saida, pacote, informadas, totais


def main(argv=None):
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for nome, (arg, _) in TABELAS.items():
        ap.add_argument('--' + arg, help=f'(modo por arquivos) JSON da consulta de {nome}')
    ap.add_argument('--stdin', action='store_true', help='lê os resultados das consultas da entrada padrão (NDJSON)')
    ap.add_argument('--mesclar', action='store_true', help='une com o dados.json atual em vez de substituir as tabelas informadas')
    ap.add_argument('--sem-contagem', action='store_true', help='não exige contagem.ordens (não prova completude)')
    ap.add_argument('--dry-run', action='store_true', help='valida e resume, sem gravar')
    ap.add_argument('--partir-de', help='(modo por arquivos) dados.json anterior para reaproveitar tabelas não informadas')
    ap.add_argument('--saida', default=str(AQUI), help='pasta de saída (padrão: esta pasta)')
    ap.add_argument('--ultimo-id', action='store_true',
                    help='imprime (JSON) o maior id já presente em cada tabela do dados.json atual, para buscar só o que é novo')
    args = ap.parse_args(argv)

    if args.ultimo_id:
        try:
            print(json.dumps(ultimos_ids(ler_pacote_existente(pathlib.Path(args.saida) / 'dados.json')), ensure_ascii=False))
        except Recusa as e:
            print(f'RECUSADO: {e}', file=sys.stderr)
            return 1
        return 0

    usa_arquivos = any(getattr(args, a) for a, _ in TABELAS.values())
    if args.stdin and (usa_arquivos or args.partir_de):
        print('Use --stdin OU arquivos (--registros ...), não os dois.', file=sys.stderr)
        return 2
    if not args.stdin and not usa_arquivos and not args.partir_de:
        print('Nada informado: use --stdin ou passe ao menos uma tabela (veja --help).', file=sys.stderr)
        return 2
    try:
        saida, pacote, informadas, totais = montar(args)
        resumo = ', '.join(f'{n}={len(v)}' for n, v in pacote['tabelas'].items())
        mantidas = [n for n in TABELAS if n not in informadas]
        if args.dry_run:
            print(f'VÁLIDO (dry-run, nada gravado): {resumo}; compras/vendas={totais["ordens"]}')
            return 0
        gravar(saida, pacote)
    except Recusa as e:
        print(f'RECUSADO (nada foi gravado): {e}', file=sys.stderr)
        return 1
    except (OSError, json.JSONDecodeError) as e:
        print(f'RECUSADO (nada foi gravado): {e}', file=sys.stderr)
        return 1
    conf = 'conferidas com o banco' if pacote['conferencia']['ordens_conferidas_com_o_banco'] else 'SEM conferência de contagem'
    print(f'dados.json e dados.js gerados em {saida} ({resumo}); compras/vendas={totais["ordens"]} ({conf}); '
          f'recebidas={",".join(sorted(informadas)) or "-"}; mantidas={",".join(mantidas) or "-"}; {pacote["gerado_em"]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
