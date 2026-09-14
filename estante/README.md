# Estante V2

Aplicativo local e estático para preparar repertórios e tocar letras e cifras no palco. A V2 separa a experiência em **Preparar → Tocar**, mantém até dez repertórios ativos e usa a identidade de cada ocorrência da música para impedir que um arranjo altere outro.

## Uso

1. Abra **Início** e crie um repertório.
2. Busque ou cole uma letra e adicione ao repertório.
3. Ajuste tom, capotraste, notas e acompanhamento na preparação.
4. Toque em **Tocar** para abrir o palco escuro, com letra grande, A−, A+, Anterior e Próxima sempre acessíveis.

As letras salvas e o aplicativo funcionam offline depois que o núcleo é armazenado. Catálogos, buscas remotas e vídeos continuam dependendo de rede. O acompanhamento com YouTube é opcional; se ele falhar, a cifra, a rolagem manual e a letra sincronizada interna continuam disponíveis.

## Dados V4

O documento canônico fica no IndexedDB `estante`, versão 1, nas stores `documents`, `backups`, `drafts` e `meta`. O documento usa `schemaVersion: 4`, revisão monotônica e IDs estáveis de repertório e de entrada. Título e artista são usados para busca, nunca como chave de gravação.

O `localStorage` continua guardando preferências pequenas e permanece como origem de leitura para os formatos antigos:

- `estante:v3:setlists`
- `estante:v2:setlist`
- `estante:repertorio`

A primeira abertura grava documento, backup e marcador na mesma transação. As chaves antigas permanecem intactas e não recebem escrita dupla. JSON quebrado, armazenamento indisponível ou documento inválido colocam os dados em recuperação e preservam a evidência para exportação. Repertórios acima do limite de dez ficam em **Dados antigos preservados** e podem ser baixados ou ativados quando houver espaço.

Gravações são serializadas e conferem a revisão dentro da transação. Conflitos entre abas e falhas de quota não mostram sucesso; a interface oferece nova tentativa e exportação das alterações pendentes. O editor salva rascunhos após 300 ms e uma versão vazia não substitui a letra utilizável.

## Mídia e sincronização

A API oficial do YouTube é carregada somente depois que o usuário ativa mídia. O player permanece visível e acessível. A interface não tenta detectar anúncios por duração e não avança a fila automaticamente.

```txt
tempoLetra = tempoMidia - videoOffset - audioDelay / 1000
tempoMidia = tempoLinha + videoOffset + audioDelay / 1000
```

`videoOffset` pertence à música; `audioDelay` pertence ao aparelho. O parser também aceita `[offset:+/-ms]` do arquivo LRC, aplicado uma única vez aos timestamps.

## Offline e atualização

O service worker instala HTML, CSS e módulos críticos como um conjunto. Se qualquer arquivo crítico falhar, a nova versão não ativa. O worker novo aguarda ação do usuário, conclui gravações pendentes e nunca recarrega durante o palco. Recursos externos não entram no cache do Estante.

## Arquivos principais

| Arquivo | Responsabilidade |
|---|---|
| `storage.js` | IndexedDB, revisões, transações, rascunhos e falhas de gravação |
| `migration.js` | validação e transformação pura dos formatos antigos |
| `setlists.js` | limite, IDs, CRUD, ordem e recuperação |
| `player.js` | sessão, abertura protegida por token e leitor |
| `youtube-adapter.js` | carregamento sob demanda da API oficial |
| `karaoke.js` | estados de mídia, relógio e fallback |
| `ui.js` / `styles.css` | Início, Meus Repertórios, Busca e palco responsivo |
| `sw.js` / `offline.js` | núcleo offline e atualização segura |

## Desenvolvimento

Sirva a pasta por HTTP para que IndexedDB e service worker usem a mesma origem:

```bash
python3 -m http.server 8080
```

Abra `http://localhost:8080`. Rode as regressões com:

```bash
node --test tests/*.test.cjs
```

Ao alterar arquivos do núcleo, atualize de forma coerente `APP_VERSION` em `core.js`, `VERSION` em `sw.js` e os parâmetros `?v=` de `index.html`. Consulte `checklist-manual.md` antes de publicar.

## Limites de validação

A suíte automatizada usa DOM, armazenamento, relógio e API simulados. iOS e Android físicos, VoiceOver, TalkBack, Bluetooth, pedaleira, anúncios e reprodução externa real continuam exigindo validação manual antes de uma declaração de compatibilidade.
