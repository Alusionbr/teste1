/*
 * LETRA DO KARAOKÊ — música do convite da Angélica.
 * Cada linha tem "t" = segundo em que ela começa na música.
 * Início dos blocos (exatos): 0:00, 0:10, 0:24, 0:42 e 0:54.
 * Tempos das linhas dentro de cada bloco são aproximados (divisão em partes iguais).
 * Para ajustar: mude o número "t" da linha (em segundos). Use "t" em TODAS as linhas.
 * Se "linhas" ficar vazio, a seção do karaokê some do convite.
 */
window.CONVITE_LETRA = {
  titulo: 'A noite da Angélica',
  artista: '',
  linhas: [
    // Intro
    { t: 0,    texto: 'Atenção, pessoal, preparem-se para a festa!' },
    { t: 5,    texto: 'Aumenta o som, que a noite de hoje é toda da Angélica!' },
    // Refrão
    { t: 10,   texto: 'Happy Birthday, Happy Birthday, Angélica, vamos celebrar!' },
    { t: 13.5, texto: 'Happy Birthday, Happy Birthday, a noite vai brilhar!' },
    { t: 17,   texto: 'Happy Birthday pra você, a festa é pura emoção,' },
    { t: 20.5, texto: 'Angélica, dona da noite e do nosso coração!' },
    // Verso (informações do convite)
    { t: 24,   texto: 'Você é meu convidado especial para comemorar comigo essa data!' },
    { t: 27,   texto: 'Será uma noite de boa comida, risadas e muita companhia, não tem coisa mais exata.' },
    { t: 30,   texto: 'No dia 27/10, das 18h às 22h, a festa vai acontecer,' },
    { t: 33,   texto: 'Lá no Restaurante Nordestino Dos Sertões, com muito sabor pra você!' },
    { t: 36,   texto: 'Fica na Estrada de Jacarepaguá, 7636, na Freguesia,' },
    { t: 39,   texto: 'O valor do rodízio adulto é R$ 69,90 pra aproveitar com energia!' },
    // Refrão
    { t: 42,   texto: 'Happy Birthday, Happy Birthday, Angélica, vamos celebrar!' },
    { t: 45,   texto: 'Happy Birthday, Happy Birthday, a noite vai brilhar!' },
    { t: 48,   texto: 'Happy Birthday pra você, a festa é pura emoção,' },
    { t: 51,   texto: 'Angélica, dona da noite e do nosso coração!' },
    // Finalização
    { t: 54,   texto: 'As crianças também vêm: de 05 a 09 anos pagam R$ 34,90,' },
    { t: 58,   texto: 'E de 0 a 4 anos não pagam nada, mas avise no ato da reserva, combinado?' },
    { t: 62,   texto: 'Será uma noite incrível, conto com a sua presença para valer!' },
    { t: 66,   texto: 'Espero por você!' }
  ]
};
