# Acervo do site

`acervo.json` guarda letras dentro do próprio repositório. Elas entram na busca como mais uma fonte, aparecem com a etiqueta **acervo** e **funcionam offline**, porque o arquivo faz parte do cache do app.

Serve para o que as fontes públicas não têm: música autoral, regional, tradicional, hino, versão de igreja, arranjo próprio da banda. LRCLIB, Vagalume, Deezer e Apple só conhecem o que saiu comercialmente.

## Antes de acrescentar

Letra é obra protegida, dos autores e das editoras. Exibir o que uma API pública devolve (o que o Estante faz nas outras fontes) é diferente de **publicar** um acervo de letras numa página aberta na internet: isso é redistribuição e pode receber pedido de remoção.

O que costuma ser tranquilo aqui:

- **composições suas** — você é o autor;
- **domínio público** — no Brasil, 70 anos contados de 1º de janeiro do ano seguinte à morte do autor (art. 41). Em obra com mais de um autor, o prazo corre da morte do **último sobrevivente** (art. 42). Letra e música quase sempre têm autores diferentes: confira os dois antes de concluir;
- **tradicional de autoria desconhecida** (art. 45, II) — mas um arranjo ou harmonização assinada por alguém é obra derivada e continua protegida;
- **letras com licença que permita redistribuição** (Creative Commons compatível, autorização escrita da editora).

O que **não** entra aqui, por mais tentador que pareça:

- letra de música comercial de terceiro, mesmo com crédito ao autor — crédito não substitui autorização;
- **sua própria transcrição de uma música de terceiro**. Transcrever de ouvido não cria direito seu sobre a letra: a obra continua sendo do autor e a transcrição é derivada. Vale o mesmo para a cifra que você tirou.

Suas anotações de palco (roteiro, quem entra onde, tom, estrutura) são suas — desde que não venham acompanhadas do texto da letra alheia.

### Se a intenção é só ter as suas correções à mão

Aí o caminho é outro e já existe, sem publicar nada: salve a música no repertório, use **Editar letra** e **Exportar**. Fica no seu aparelho, e o arquivo exportado é seu. Uso pessoal e privado não é publicação.

Por esse motivo o acervo vem vazio: o que entra é decisão — e responsabilidade — de quem publica.

## Formato

```json
{
  "version": 1,
  "songs": [
    {
      "title": "Nome da música",
      "artist": "Quem canta ou compôs",
      "duration": 214,
      "lyrics": "C       G\nprimeira linha\n[Refrão]\nAm      F\noutra linha",
      "source": "Acervo"
    }
  ]
}
```

| Campo | Obrigatório | Para que serve |
|---|---|---|
| `title` | sim | é o que a busca compara; sem ele a entrada é ignorada |
| `artist` | não, mas ajuda | usado na busca e para casar com resultado de catálogo |
| `lyrics` | sim (ou `synced`) | texto puro; linha só com acordes vira cifra, `[Refrão]` vira seção |
| `synced` | não | letra `.lrc` com marcas `[00:12.30]`, habilita o modo Sincro |
| `duration` | não, mas ajuda | em segundos; alimenta a velocidade automática de rolagem |
| `source` | não | crédito exibido no rodapé da música (padrão: `Acervo`) |

Use `\n` para quebra de linha, como em qualquer JSON.

## Ao alterar

`acervo.json` está na lista `SHELL` do `sw.js`, então é servido pelo cache. Depois de editá-lo, **bumpe `APP_VERSION`** (`core.js`), `VERSION` (`sw.js`) e o `?v=` do `index.html` — senão os aparelhos que já abriram o site continuam com a versão antiga do acervo.
