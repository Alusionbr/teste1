# Checklist manual — Estante V2

Registre navegador, aparelho, versão do app e resultado. Use perfil de teste, sem dados reais.

## Dados e recuperação

- [ ] Migrar formatos v2 e v3 preserva repertórios, letras, LRC, tom, capo, notas, duração, links e vídeo.
- [ ] JSON legado quebrado permanece intacto e aparece como dado preservado para download.
- [ ] Onze ou mais repertórios mantêm dez ativos e o restante acessível em recuperação.
- [ ] Criar, duplicar e importar no limite de dez explica o bloqueio sem substituir nada.
- [ ] Duas abas em revisão antiga mostram conflito e não sobrescrevem silenciosamente.
- [ ] Quota cheia mostra erro, permite tentar novamente e exportar alterações.
- [ ] Fechar e reabrir o editor recupera rascunho; rascunho vazio não apaga letra válida.

## Preparação

- [ ] Primeiro uso: Novo Repertório → nome → adicionar música → tocar, sem termos técnicos.
- [ ] Trocar repertório fora do palco encerra o leitor anterior.
- [ ] Mesma música em dois repertórios mantém tom, capo, notas e letra independentes.
- [ ] Remover música e repertório oferece Desfazer.
- [ ] Importação mostra resumo antes de adicionar ou substituir.
- [ ] Exportar e reimportar V4 preserva as contagens e a ordem; importação antiga continua aceita.

## Palco

- [ ] Em 320×568, 390×844, 768×1024 e 1366×768 não há rolagem horizontal para A−, A+, Anterior e Próxima.
- [ ] Palco permanece escuro quando a preparação está clara.
- [ ] Anterior na primeira e Próxima na última ficam desabilitados e não reiniciam a música.
- [ ] A− e A+ mantêm a linha atual visível e respeitam 20–72 px.
- [ ] Continuar retoma a música correta com áudio pausado.
- [ ] Zoom de 200%, teclado virtual, retrato, paisagem e safe areas mantêm as ações essenciais.

## Acompanhamento e mídia

- [ ] Manual, Rolar e Sincro nunca disputam a posição da letra.
- [ ] LRC com `[offset:]` aplica o sinal uma vez; seek de ida e volta retorna ao mesmo tempo.
- [ ] API indisponível, autoplay bloqueado, vídeo removido e perda de rede mantêm cifra e navegação.
- [ ] Música seguinte sem vídeo sai da mídia e libera Rolar/Sincro.
- [ ] Fim de mídia não avança sozinho; evento antigo não troca a música atual.
- [ ] Validar separadamente anúncio real, buffering, seek e atraso Bluetooth em dispositivo físico.

## PWA e acessibilidade

- [ ] Primeira carga online e recarga offline abrem interface e letras salvas.
- [ ] Recurso crítico ausente impede ativação nova; arquivos de versões diferentes não se misturam.
- [ ] Atualização durante o palco aguarda a saída e uma ação explícita.
- [ ] Teclado, Escape, foco após diálogos, nomes acessíveis, estados disabled e redução de movimento funcionam.
- [ ] Medir contraste nas combinações usadas e validar VoiceOver/TalkBack em aparelhos físicos.

## Compreensão

Se houver cinco pessoas leigas disponíveis, pedir sem instrução: criar repertório, adicionar música, entrar no palco e aumentar a letra. Meta proposta: ao menos quatro completam cada tarefa. Se não realizado, registrar como pendente.
