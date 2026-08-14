# Acervo do site

`acervo.json` guarda letras dentro do próprio repositório. Elas entram na busca como mais uma fonte, aparecem com a etiqueta **acervo** e **funcionam offline**, porque o arquivo faz parte do cache do app.

Serve para o que as fontes públicas não têm: música autoral, regional, tradicional, hino, versão de igreja, arranjo próprio da banda. LRCLIB, Vagalume, Deezer e Apple só conhecem o que saiu comercialmente.

## Antes de acrescentar

Letra é obra protegida, dos autores e das editoras. Exibir o que uma API pública devolve (o que o Estante faz nas outras fontes) é diferente de **publicar** um acervo de letras numa página aberta na internet: isso é redistribuição e pode receber pedido de remoção.

O que costuma ser tranquilo aqui:

- composições suas;
- domínio público e tradicionais (o prazo varia por país — no Brasil, 70 anos após a morte do autor);
- letras com licença que permita redistribuição;
- suas próprias anotações de arranjo, roteiro, cifra e estrutura.

Se a intenção for só ter as suas correções à mão sem publicar nada, o caminho é outro e já existe: salve a música no repertório, use **Editar letra** e **Exportar**. Isso fica no seu aparelho, não no site.

Por esse motivo o acervo vem vazio: o que entra é decisão de quem publica.

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
