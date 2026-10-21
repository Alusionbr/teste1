/*
 * Karaokê — A noite da Angélica
 * Relógio em segundos, relativo ao início do áudio hospedado (~66,66 s).
 * 00:02–00:60: tempos revistos com reconhecimento de palavras em trechos do áudio.
 * Encerramento (após 60 s): marcações aproximadas, pois não houve
 * transcrição confiável desse trecho. Não são timestamps palavra a palavra.
 * Alterar apenas os valores t, mantendo a ordem crescente.
 */
window.CONVITE_LETRA = {
  titulo: 'A noite da Angélica',
  artista: '',
  linhas: [
    // Introdução
    { t: 2.6,  texto: 'Atenção, pessoal, preparem-se para a festa!' },
    { t: 5.7,  texto: 'Aumenta o som, que a noite de hoje é toda da Angélica!' },
    // Primeiro refrão
    { t: 10.8, texto: 'Happy Birthday, Happy Birthday, Angélica, vamos celebrar!' },
    { t: 14.2, texto: 'Happy Birthday, Happy Birthday, a noite vai brilhar!' },
    { t: 18.7, texto: 'Happy Birthday pra você, a festa é pura emoção,' },
    { t: 21.2, texto: 'Angélica, dona da noite e do nosso coração!' },
    // Informações do convite
    { t: 24.3, texto: 'Você é meu convidado especial para comemorar comigo essa data!' },
    { t: 28.4, texto: 'Será uma noite de boa comida, risadas e muita companhia, não tem coisa mais exata.' },
    { t: 31.7, texto: 'No dia 27/10, das 18h às 22h, a festa vai acontecer,' },
    { t: 33.5, texto: 'Lá no Restaurante Nordestino Dos Sertões, com muito sabor pra você!' },
    { t: 35.3, texto: 'Fica na Estrada de Jacarepaguá, 7636, na Freguesia,' },
    { t: 36.7, texto: 'O valor do rodízio adulto é R$ 69,90 pra aproveitar com energia!' },
    // Segundo refrão
    { t: 41.0, texto: 'Happy Birthday, Happy Birthday, Angélica, vamos celebrar!' },
    { t: 46.2, texto: 'Happy Birthday, Happy Birthday, a noite vai brilhar!' },
    { t: 49.8, texto: 'Happy Birthday pra você, a festa é pura emoção,' },
    { t: 53.3, texto: 'Angélica, dona da noite e do nosso coração!' },
    // Encerramento; as últimas marcações seguem aproximadas
    { t: 55.6, texto: 'As crianças também vêm: de 05 a 09 anos pagam R$ 34,90,' },
    { t: 59.8, texto: 'E de 0 a 4 anos não pagam nada, mas avise no ato da reserva, combinado?' },
    { t: 62.7, texto: 'Será uma noite incrível, conto com a sua presença para valer!' },
    { t: 65.0, texto: 'Espero por você!' }
  ]
};
