"""Testes do empacotador (modo --stdin). Rodar: python -I teste_atualizar.py
Sem rede e sem banco: usa pastas temporárias e o script como processo separado."""
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

AQUI = pathlib.Path(__file__).resolve().parent
SCRIPT = str(AQUI / 'atualizar_dados.py')
COLS_REG = ['chave', 'experimento', 'mercado', 'instante_utc', 'ativo', 'tipo', 'preco', 'quantidade',
            'valor_brl', 'taxa_brl', 'saldo_brl', 'patrimonio_brl', 'motivo', 'fonte']


def reg(chave, tipo, instante, ativo='BTCBRL', mercado='cripto', qtd=None, valor=None, taxa=None, patr=None):
    return [chave, 'x', mercado, instante, ativo, tipo, None, qtd, valor, taxa, None, patr, None, 'teste']


def pagina(tabela, cols, rows, truncated=False):
    return {'tabela': tabela, 'columns': cols, 'rows': rows, 'truncated': truncated}


def rodar(itens, *args, saida):
    texto = '\n'.join(json.dumps(i, ensure_ascii=False) for i in itens)
    return subprocess.run([sys.executable, '-I', SCRIPT, '--stdin', '--saida', str(saida), *args],
                          input=texto, capture_output=True, text=True, encoding='utf-8')


def ler(saida):
    return json.loads((pathlib.Path(saida) / 'dados.json').read_text(encoding='utf-8'))


class ModoStdin(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.saida = pathlib.Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    @unittest.skipUnless((AQUI / 'entrada').exists(), 'pasta entrada/ não faz parte da cópia publicada')
    def test_fluxo_basico_com_dados_reais_do_retrato(self):
        entrada = AQUI / 'entrada'
        itens = [{'contagem': {'ordens': 0, 'traders': 5}}]
        for tab, arq in [('registros', 'registros'), ('traders', 'traders'), ('metricas', 'metricas'),
                         ('operacoes', 'operacoes'), ('altas', 'altas')]:
            itens.append({'tabela': tab, **json.loads((entrada / f'{arq}.json').read_text(encoding='utf-8'))})
        r = rodar(itens, saida=self.saida)
        self.assertEqual(r.returncode, 0, r.stderr)
        p = ler(self.saida)
        self.assertEqual([len(p['tabelas'][n]) for n in ('registros', 'traders', 'metricas', 'operacoes_publicas', 'altas')], [9, 5, 5, 0, 0])
        self.assertTrue(p['conferencia']['ordens_conferidas_com_o_banco'])
        self.assertTrue((self.saida / 'dados.js').read_text(encoding='utf-8').startswith('window.DADOS = '))
        self.assertEqual(list(self.saida.glob('*.tmp')), [])

    def test_resultado_embrulhado_em_resultado(self):
        r = rodar([{'contagem': {'ordens': 0}},
                   {'tabela': 'registros', 'resultado': {'columns': COLS_REG, 'rows': [reg('a', 'patrimonio', '2026-11-13T21:00:00Z', patr=1000)], 'truncated': False}}],
                  saida=self.saida)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_paginacao_acima_de_500_ordens_preserva_todas(self):
        # 1200 ordens (600 compras + 600 vendas) em 3 páginas de 400; o saldo fecha em 1000
        ordens = []
        for i in range(600):
            ordens.append(reg(f'c{i:04d}', 'compra', f'2026-11-14T{i // 60:02d}:{i % 60:02d}:00Z', qtd=0.001, valor=1.0, taxa=0.001))
            ordens.append(reg(f'v{i:04d}', 'venda', f'2026-11-14T{i // 60:02d}:{i % 60:02d}:30Z', qtd=0.001, valor=1.0, taxa=0.001))
        paginas = [pagina('registros', COLS_REG, ordens[i:i + 400]) for i in range(0, 1200, 400)]
        r = rodar([{'contagem': {'ordens': 1200}}, *paginas], saida=self.saida)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(len(ler(self.saida)['tabelas']['registros']), 1200)

    def test_pagina_perdida_e_recusada_pela_contagem(self):
        ordens = [reg(f'c{i}', 'compra', f'2026-11-14T10:{i:02d}:00Z', qtd=0.001, valor=1.0, taxa=0.001) for i in range(10)]
        r = rodar([{'contagem': {'ordens': 12}}, pagina('registros', COLS_REG, ordens)], saida=self.saida)
        self.assertEqual(r.returncode, 1)
        self.assertIn('o banco informa 12', r.stderr)
        self.assertFalse((self.saida / 'dados.json').exists())

    def test_truncado_e_recusado(self):
        r = rodar([{'contagem': {'ordens': 0}}, pagina('registros', COLS_REG, [], truncated=True)], saida=self.saida)
        self.assertEqual(r.returncode, 1)
        self.assertIn('truncado', r.stderr)

    def test_500_linhas_sem_flag_e_recusado_mas_com_flag_false_passa(self):
        linhas = [reg(f'p{i:04d}', 'patrimonio', f'2026-11-14T{i // 60:02d}:{i % 60:02d}:00Z', patr=1000) for i in range(500)]
        sem = {'tabela': 'registros', 'columns': COLS_REG, 'rows': linhas}
        r = rodar([{'contagem': {'ordens': 0}}, sem], saida=self.saida)
        self.assertEqual(r.returncode, 1)
        self.assertIn('500 linhas', r.stderr)
        r2 = rodar([{'contagem': {'ordens': 0}}, pagina('registros', COLS_REG, linhas, truncated=False)], saida=self.saida)
        self.assertEqual(r2.returncode, 0, r2.stderr)

    def test_contagem_de_ordens_obrigatoria_com_registros(self):
        r = rodar([pagina('registros', COLS_REG, [reg('a', 'patrimonio', '2026-11-13T21:00:00Z', patr=1000)])], saida=self.saida)
        self.assertEqual(r.returncode, 1)
        self.assertIn('contagem', r.stderr)
        r2 = rodar([pagina('registros', COLS_REG, [reg('a', 'patrimonio', '2026-11-13T21:00:00Z', patr=1000)])], '--sem-contagem', saida=self.saida)
        self.assertEqual(r2.returncode, 0, r2.stderr)
        self.assertFalse(ler(self.saida)['conferencia']['ordens_conferidas_com_o_banco'])

    def test_venda_sem_compra_e_saldo_negativo_sao_recusados(self):
        venda = reg('v1', 'venda', '2026-11-14T10:00:00Z', qtd=0.5, valor=100, taxa=0.1)
        r = rodar([{'contagem': {'ordens': 1}}, pagina('registros', COLS_REG, [venda])], saida=self.saida)
        self.assertEqual(r.returncode, 1)
        self.assertIn('sem posição', r.stderr)
        compra = reg('c1', 'compra', '2026-11-14T10:00:00Z', qtd=1, valor=5000, taxa=5)
        r2 = rodar([{'contagem': {'ordens': 1}}, pagina('registros', COLS_REG, [compra])], saida=self.saida)
        self.assertEqual(r2.returncode, 1)
        self.assertIn('caixa negativo', r2.stderr)

    def test_chave_repetida_com_conteudo_diferente_e_recusada(self):
        a = reg('x', 'patrimonio', '2026-11-13T21:00:00Z', patr=1000)
        b = reg('x', 'patrimonio', '2026-11-13T21:00:00Z', patr=1234)
        r = rodar([{'contagem': {'ordens': 0}}, pagina('registros', COLS_REG, [a]), pagina('registros', COLS_REG, [b])], saida=self.saida)
        self.assertEqual(r.returncode, 1)
        self.assertIn('conteúdo diferente', r.stderr)
        r2 = rodar([{'contagem': {'ordens': 0}}, pagina('registros', COLS_REG, [a]), pagina('registros', COLS_REG, [a])], saida=self.saida)
        self.assertEqual(r2.returncode, 0, r2.stderr)  # repetida idêntica é tolerada

    def test_recusa_nao_toca_no_arquivo_existente(self):
        ok = rodar([{'contagem': {'ordens': 0}}, pagina('registros', COLS_REG, [reg('a', 'patrimonio', '2026-11-13T21:00:00Z', patr=1000)])], saida=self.saida)
        self.assertEqual(ok.returncode, 0, ok.stderr)
        antes = (self.saida / 'dados.json').read_bytes(), (self.saida / 'dados.js').read_bytes()
        ruim = rodar([{'contagem': {'ordens': 9}}, pagina('registros', COLS_REG, [reg('b', 'patrimonio', '2026-11-13T22:00:00Z', patr=1)])], '--mesclar', saida=self.saida)
        self.assertEqual(ruim.returncode, 1)
        self.assertEqual(antes, ((self.saida / 'dados.json').read_bytes(), (self.saida / 'dados.js').read_bytes()))
        self.assertEqual(list(self.saida.glob('*.tmp')), [])

    def test_mesclar_preserva_ordens_antigas_e_mantem_tabelas_nao_enviadas(self):
        c = reg('c1', 'compra', '2026-11-14T10:00:00Z', qtd=0.001, valor=100, taxa=0.1)
        tr = {'tabela': 'traders', 'columns': ['endereco', 'plataforma'], 'rows': [['0xabc', 'Hyperliquid']], 'truncated': False}
        r1 = rodar([{'contagem': {'ordens': 1}}, pagina('registros', COLS_REG, [c]), tr], saida=self.saida)
        self.assertEqual(r1.returncode, 0, r1.stderr)
        # rodada seguinte: só informa o patrimônio novo; a compra antiga vem do pacote atual
        novo = reg('p2', 'patrimonio', '2026-11-14T11:00:00Z', patr=1001)
        r2 = rodar([{'contagem': {'ordens': 1}}, pagina('registros', COLS_REG, [novo])], '--mesclar', saida=self.saida)
        self.assertEqual(r2.returncode, 0, r2.stderr)
        p = ler(self.saida)
        self.assertEqual(sorted(r['chave'] for r in p['tabelas']['registros']), ['c1', 'p2'])
        self.assertEqual(len(p['tabelas']['traders']), 1)  # não enviada: mantida
        # sem --mesclar, a tabela enviada SUBSTITUI e a contagem pega a compra perdida
        r3 = rodar([{'contagem': {'ordens': 1}}, pagina('registros', COLS_REG, [novo])], saida=self.saida)
        self.assertEqual(r3.returncode, 1)
        self.assertIn('o banco informa 1, o pacote final tem 0', r3.stderr)

    def test_ndjson_invalido_e_documento_unico_em_lista(self):
        r = subprocess.run([sys.executable, '-I', SCRIPT, '--stdin', '--saida', str(self.saida)],
                           input='{"contagem": {"ordens": 0}}\n{quebrado\n', capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(r.returncode, 1)
        self.assertIn('linha 2', r.stderr)
        doc = json.dumps([{'contagem': {'ordens': 0}}, pagina('registros', COLS_REG, [reg('a', 'patrimonio', '2026-11-13T21:00:00Z', patr=1000)])])
        r2 = subprocess.run([sys.executable, '-I', SCRIPT, '--stdin', '--saida', str(self.saida)], input=doc, capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(r2.returncode, 0, r2.stderr)

    def test_tabela_desconhecida_linha_curta_e_campo_faltando(self):
        r = rodar([{'tabela': 'sqlite_master', 'columns': ['a'], 'rows': []}], saida=self.saida)
        self.assertEqual(r.returncode, 1); self.assertIn('desconhecida', r.stderr)
        r2 = rodar([{'contagem': {'ordens': 0}}, pagina('registros', COLS_REG, [['so', 'duas']])], saida=self.saida)
        self.assertEqual(r2.returncode, 1); self.assertIn('número de colunas', r2.stderr)
        sem_tipo = reg('a', None, '2026-11-13T21:00:00Z')
        r3 = rodar([{'contagem': {'ordens': 0}}, pagina('registros', COLS_REG, [sem_tipo])], saida=self.saida)
        self.assertEqual(r3.returncode, 1); self.assertIn('sem tipo', r3.stderr)

    @unittest.skipUnless((AQUI / 'entrada').exists(), 'pasta entrada/ não faz parte da cópia publicada')
    def test_dry_run_nao_grava_e_modo_arquivos_continua(self):
        r = rodar([{'contagem': {'ordens': 0}}, pagina('registros', COLS_REG, [reg('a', 'patrimonio', '2026-11-13T21:00:00Z', patr=1000)])], '--dry-run', saida=self.saida)
        self.assertEqual(r.returncode, 0); self.assertIn('dry-run', r.stdout)
        self.assertFalse((self.saida / 'dados.json').exists())
        legado = subprocess.run([sys.executable, '-I', SCRIPT, '--registros', str(AQUI / 'entrada' / 'registros.json'), '--saida', str(self.saida)],
                                capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(legado.returncode, 0, legado.stderr)
        self.assertEqual(len(ler(self.saida)['tabelas']['registros']), 9)

    def test_nao_mistura_stdin_com_arquivos_e_sem_argumentos(self):
        r = subprocess.run([sys.executable, '-I', SCRIPT, '--stdin', '--registros', 'x.json'], input='', capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)
        r2 = subprocess.run([sys.executable, '-I', SCRIPT], capture_output=True, text=True)
        self.assertEqual(r2.returncode, 2)

    def test_ultimo_id_e_atualizacao_incremental(self):
        cols = ['id'] + COLS_REG[:0] + COLS_REG
        def com_id(i, linha):
            return [i] + linha
        sem = subprocess.run([sys.executable, '-I', SCRIPT, '--ultimo-id', '--saida', str(self.saida)], capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(sem.returncode, 0, sem.stderr)
        self.assertEqual(json.loads(sem.stdout)['registros'], 0)  # sem arquivo: tudo zero
        c = com_id(1, reg('c1', 'compra', '2026-11-14T10:00:00Z', qtd=0.001, valor=100, taxa=0.1))
        p1 = com_id(2, reg('p1', 'patrimonio', '2026-11-14T10:30:00Z', patr=1000))
        r1 = rodar([{'contagem': {'ordens': 1, 'registros': 2}}, pagina('registros', cols, [c, p1])], saida=self.saida)
        self.assertEqual(r1.returncode, 0, r1.stderr)
        u = subprocess.run([sys.executable, '-I', SCRIPT, '--ultimo-id', '--saida', str(self.saida)], capture_output=True, text=True, encoding='utf-8')
        ids = json.loads(u.stdout)
        self.assertEqual((ids['registros'], ids['ordens']), (2, 1))
        # rodada seguinte: só o que tem id > 2; a contagem do banco (3 registros, 1 ordem) fecha com o acumulado
        p2 = com_id(3, reg('p2', 'patrimonio', '2026-11-14T11:30:00Z', patr=1000))
        r2 = rodar([{'contagem': {'ordens': 1, 'registros': 3}}, pagina('registros', cols, [p2])], '--mesclar', saida=self.saida)
        self.assertEqual(r2.returncode, 0, r2.stderr)
        self.assertEqual(len(ler(self.saida)['tabelas']['registros']), 3)
        # se a rotina esquecer de enviar o novo, a contagem do banco denuncia
        r3 = rodar([{'contagem': {'ordens': 1, 'registros': 4}}, pagina('registros', cols, [])], '--mesclar', saida=self.saida)
        self.assertEqual(r3.returncode, 1)
        self.assertIn('contagem.registros', r3.stderr)

    def test_acentos_sobrevivem_ao_stdin_e_entrada_nao_utf8_e_recusada(self):
        motivo = 'médias diárias de 5 e 20 dias: aguardar · não é recomendação'
        linha = reg('acento', 'decisao', '2026-11-13T21:00:00Z', ativo='EURBRL', mercado='cambio')
        linha[COLS_REG.index('motivo')] = motivo
        r = rodar([{'contagem': {'ordens': 0}}, pagina('registros', COLS_REG, [linha])], saida=self.saida)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(ler(self.saida)['tabelas']['registros'][0]['motivo'], motivo)
        self.assertNotIn('Ã', (self.saida / 'dados.js').read_text(encoding='utf-8'))
        bruto = b'{"contagem": {"ordens": 0}}\n{"tabela": "altas", "columns": ["x"], "rows": [["' + 'é'.encode('latin-1') + b'"]]}'
        ruim = subprocess.run([sys.executable, '-I', SCRIPT, '--stdin', '--saida', str(self.saida)], input=bruto, capture_output=True)
        self.assertEqual(ruim.returncode, 1)
        self.assertIn('UTF-8', ruim.stderr.decode('utf-8', 'replace'))

    def test_script_nao_acessa_banco_nem_rede(self):
        fonte = pathlib.Path(SCRIPT).read_text(encoding='utf-8')
        for proibido in ('import sqlite3', 'sqlite3.', 'urllib', 'socket', 'requests', 'subprocess'):
            self.assertNotIn(proibido, fonte)


if __name__ == '__main__':
    unittest.main(verbosity=2)
