"""Publica o dados.json (retrato de exibição) no ramo de dados do GitHub, SEM novo deploy do site.

O site (GitHub Pages) é publicado a partir da `main`. Este script NÃO toca na `main`: ele grava só o
arquivo `simulador-pratica/dados.json` no ramo `dados-simulador` (criado vazio na primeira vez, sem o
resto do repositório). A página publicada lê esse arquivo direto de raw.githubusercontent.com e se atualiza
sozinha, sem commit na `main` e sem acionar o deploy dos outros projetos.

Usa a CLI `gh` já autenticada na máquina (conta do usuário). Não lê banco, não acessa conta financeira e
não envia ordem. Só publica o que está em dados.json (dados fictícios da simulação + carteiras públicas
acompanhadas). Use depois de atualizar_dados.py, quando o usuário tiver autorizado a publicação.

  python publicar_github.py            # publica (se houver mudança)
  python publicar_github.py --dry-run  # só valida e mostra o que faria; não chama o GitHub

Códigos de saída: 0 publicado ou sem mudanças; 1 recusado/falha (nada alterado no GitHub, ou erro descrito).
"""
import argparse
import base64
import datetime as dt
import json
import pathlib
import subprocess
import sys

AQUI = pathlib.Path(__file__).resolve().parent
REPO = 'Alusionbr/teste1'
RAMO = 'dados-simulador'
CAMINHO = 'simulador-pratica/dados.json'
LIMITE_BYTES = 900_000
TABELAS = ('registros', 'traders', 'metricas', 'operacoes_publicas', 'altas')
LEIA_ME_RAMO = ('# Ramo de dados do Painel de prática\n\n'
                'Arquivo gerado automaticamente (`simulador-pratica/dados.json`): retrato de exibição de uma simulação '
                'fictícia. Não editar à mão. O site lê este arquivo; o código fica na `main`, pasta `simulador-pratica/`.\n')


class Falha(Exception):
    pass


def validar(texto):
    if len(texto.encode('utf-8')) > LIMITE_BYTES:
        raise Falha(f'dados.json maior que {LIMITE_BYTES} bytes; revise antes de publicar')
    try:
        p = json.loads(texto)
    except json.JSONDecodeError as e:
        raise Falha(f'dados.json inválido: {e}')
    if not isinstance(p, dict) or not p.get('gerado_em'):
        raise Falha('dados.json sem gerado_em')
    try:
        dt.datetime.fromisoformat(str(p['gerado_em']).replace('Z', '+00:00'))
    except ValueError:
        raise Falha('gerado_em inválido')
    t = p.get('tabelas')
    if not isinstance(t, dict) or any(not isinstance(t.get(n), list) for n in TABELAS):
        raise Falha('tabelas ausentes ou em formato inesperado')
    return p


def gh(args, corpo=None):
    try:
        r = subprocess.run(['gh', *args], input=json.dumps(corpo) if corpo is not None else None,
                           capture_output=True, text=True, encoding='utf-8')
    except FileNotFoundError:
        raise Falha('CLI `gh` não encontrada; instale e faça login (gh auth login)')
    return r.returncode, r.stdout, r.stderr


def api(metodo, rota, corpo=None):
    args = ['api', '-X', metodo, rota] + (['--input', '-'] if corpo is not None else [])
    codigo, saida, erro = gh(args, corpo)
    if codigo != 0:
        return codigo, None, (erro or saida).strip()
    return 0, (json.loads(saida) if saida.strip() else {}), ''


def garantir_ramo(repo, ramo, texto):
    codigo, _, erro = api('GET', f'repos/{repo}/git/ref/heads/{ramo}')
    if codigo == 0:
        return False
    if 'Not Found' not in erro and '404' not in erro:
        raise Falha(f'não consegui consultar o ramo {ramo}: {erro}')
    c, arvore, e = api('POST', f'repos/{repo}/git/trees', {'tree': [
        {'path': CAMINHO, 'mode': '100644', 'type': 'blob', 'content': texto},
        {'path': 'README.md', 'mode': '100644', 'type': 'blob', 'content': LEIA_ME_RAMO}]})
    if c:
        raise Falha(f'falha ao criar a árvore do ramo: {e}')
    c, commit, e = api('POST', f'repos/{repo}/git/commits', {'message': 'Cria o ramo de dados do Painel de prática', 'tree': arvore['sha'], 'parents': []})
    if c:
        raise Falha(f'falha ao criar o commit inicial: {e}')
    c, _, e = api('POST', f'repos/{repo}/git/refs', {'ref': f'refs/heads/{ramo}', 'sha': commit['sha']})
    if c:
        raise Falha(f'falha ao criar o ramo {ramo}: {e}')
    return True


def publicar(repo, ramo, texto):
    criado = garantir_ramo(repo, ramo, texto)
    if criado:
        return 'ramo criado já com o retrato atual'
    c, atual, e = api('GET', f'repos/{repo}/contents/{CAMINHO}?ref={ramo}')
    sha = None
    if c == 0:
        sha = atual.get('sha')
        if base64.b64decode(atual.get('content', '')).decode('utf-8') == texto:
            return 'sem mudanças (o GitHub já tem este retrato)'
    elif 'Not Found' not in e and '404' not in e:
        raise Falha(f'não consegui ler o arquivo atual: {e}')
    agora = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d %H:%MZ')
    corpo = {'message': f'Atualiza dados da simulação ({agora})', 'content': base64.b64encode(texto.encode('utf-8')).decode('ascii'), 'branch': ramo}
    if sha:
        corpo['sha'] = sha
    c, _, e = api('PUT', f'repos/{repo}/contents/{CAMINHO}', corpo)
    if c:
        raise Falha(f'falha ao gravar no GitHub: {e}')
    return 'publicado'


def main(argv=None):
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--repo', default=REPO)
    ap.add_argument('--ramo', default=RAMO)
    ap.add_argument('--arquivo', default=str(AQUI / 'dados.json'))
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args(argv)
    try:
        texto = pathlib.Path(args.arquivo).read_text(encoding='utf-8')
        p = validar(texto)
        resumo = ', '.join(f'{n}={len(p["tabelas"][n])}' for n in TABELAS)
        url = f'https://raw.githubusercontent.com/{args.repo}/{args.ramo}/{CAMINHO}'
        if args.dry_run:
            print(f'VÁLIDO (dry-run, nada enviado). Publicaria em {args.repo}, ramo {args.ramo}, arquivo {CAMINHO} '
                  f'({len(texto.encode("utf-8"))} bytes; {resumo}; gerado em {p["gerado_em"]}). Não toca na main.')
            return 0
        resultado = publicar(args.repo, args.ramo, texto)
    except (Falha, OSError) as e:
        print(f'FALHOU: {e}', file=sys.stderr)
        return 1
    print(f'{resultado}: {url} ({resumo}; gerado em {p["gerado_em"]})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
