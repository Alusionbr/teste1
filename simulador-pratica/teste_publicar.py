"""Testes do publicador (sem rede e sem GitHub): validação e --dry-run. Rodar: python -I teste_publicar.py"""
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

AQUI = pathlib.Path(__file__).resolve().parent
SCRIPT = str(AQUI / 'publicar_github.py')


def rodar(*args):
    return subprocess.run([sys.executable, '-I', SCRIPT, *args], capture_output=True, text=True, encoding='utf-8')


class Publicar(unittest.TestCase):
    def setUp(self):
        self._t = tempfile.TemporaryDirectory()
        self.dir = pathlib.Path(self._t.name)

    def tearDown(self):
        self._t.cleanup()

    def arquivo(self, conteudo):
        p = self.dir / 'dados.json'
        p.write_text(conteudo if isinstance(conteudo, str) else json.dumps(conteudo), encoding='utf-8')
        return str(p)

    def valido(self):
        return {'gerado_em': '2026-11-13T23:00:00Z', 'tabelas': {n: [] for n in ('registros', 'traders', 'metricas', 'operacoes_publicas', 'altas')}}

    def test_dry_run_valido_nao_chama_github_e_nao_toca_na_main(self):
        r = rodar('--dry-run', '--arquivo', self.arquivo(self.valido()))
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('dry-run', r.stdout)
        self.assertIn('Não toca na main', r.stdout)

    def test_recusa_json_quebrado_sem_gerado_em_e_tabelas_faltando(self):
        self.assertEqual(rodar('--dry-run', '--arquivo', self.arquivo('{quebrado')).returncode, 1)
        v = self.valido(); del v['gerado_em']
        self.assertEqual(rodar('--dry-run', '--arquivo', self.arquivo(v)).returncode, 1)
        v = self.valido(); del v['tabelas']['altas']
        r = rodar('--dry-run', '--arquivo', self.arquivo(v))
        self.assertEqual(r.returncode, 1); self.assertIn('tabelas', r.stderr)

    def test_recusa_arquivo_grande_demais_e_inexistente(self):
        v = self.valido(); v['tabelas']['registros'] = ['x' * 1000] * 1000
        r = rodar('--dry-run', '--arquivo', self.arquivo(v))
        self.assertEqual(r.returncode, 1); self.assertIn('maior que', r.stderr)
        self.assertEqual(rodar('--dry-run', '--arquivo', str(self.dir / 'nao-existe.json')).returncode, 1)

    def test_dados_reais_desta_pasta_sao_validos(self):
        r = rodar('--dry-run')
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_so_escreve_no_ramo_de_dados(self):
        fonte = pathlib.Path(SCRIPT).read_text(encoding='utf-8')
        self.assertIn("RAMO = 'dados-simulador'", fonte)
        self.assertNotIn('heads/main', fonte)
        self.assertNotIn("'main'", fonte)


if __name__ == '__main__':
    unittest.main(verbosity=2)
