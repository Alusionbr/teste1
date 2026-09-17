# Baseline de regressão

Referência: `ee2efad13a39eadee70fd1c9a9b18e5636e3efc5` (`3.12.0`). Os ensaios usam dados sintéticos.

| Caso | Comportamento no baseline | Critério V4 |
|---|---|---|
| B01 | Abrir a entrada de A, trocar o repertório visível para B com o mesmo título/artista e mudar o tom para 3 fazia A=3 e B=3. | A entrada proprietária fica 3; B permanece 7. |
| B02 | JSON inválido em `estante:v3:setlists` virava fallback gravável; legado `{}` chegava a `.map`. | A string original permanece intacta, a recuperação é oferecida e nenhum `.map` recebe tipo inválido. |

A suíte `data-v4.test.cjs` codifica os critérios corrigidos e também cobre abortar transação, limite 10/20, IDs duplicados, protocolo de URL, offset LRC e relógio de mídia.
