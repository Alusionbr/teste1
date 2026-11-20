"use strict";

const EstanteGrooves = (() => {
  // Each phrase has two bars. The number before the colon is the subdivision
  // (0–31); the second number is the strike strength, from 1 to 100.
  const patterns = tracks => Object.fromEntries(Object.entries(tracks).map(([id, phrase]) => [
    id, phrase.trim().split(/\s+/).map(hit => {
      const [step, strength = 78] = hit.split(":").map(Number);
      return [step, strength];
    })
  ]));

  return {
    xote: {
      description: "Triângulo aberto e abafado, resposta seca e grave de xote",
      feel: { swing: .035, human: .004, gain: .95 },
      parts: {
        intro: patterns({ xoteRim: "12:74 15:48 20:79 28:83", triangleMute: "0:43 4:51 8:42 12:56 16:55 20:52 24:61 28:58", triangle: "14:74 18:77 26:78", xoteDrum: "16:85 24:84" }),
        base: patterns({
          xoteDrum: "0:100 7:56 8:91 15:50 16:98 23:56 24:92 30:45",
          xoteRim: "4:83 12:88 20:83 28:89 31:42",
          triangleMute: "0:51 4:63 8:49 12:65 16:53 20:65 24:49 28:63",
          triangle: "2:87 6:68 10:86 14:68 18:87 22:65 26:86 30:73"
        }),
        full: patterns({
          xoteDrum: "0:100 6:50 8:94 15:55 16:100 22:51 24:94 29:52 31:44",
          xoteRim: "4:89 11:39 12:92 20:89 27:45 28:93 31:55",
          triangleMute: "0:54 3:35 4:63 8:54 12:69 16:55 19:38 20:65 24:52 28:65",
          triangle: "2:91 6:72 10:90 14:72 18:88 22:75 26:90 30:79",
          tambourine: "6:53 14:56 22:50 30:62"
        }),
        fill: patterns({ xoteDrum: "0:94 7:59 8:97 10:56 15:66", xoteRim: "4:82 9:49 11:60 12:84 13:52 14:80", triangleMute: "0:49 4:60 8:54 10:48 12:66", triangle: "2:83 6:69 14:88" }),
        break: patterns({ xoteDrum: "0:79 8:74 16:76 24:80", triangleMute: "4:47 12:46 20:48 28:47", triangle: "6:57 14:64 22:59 30:69" }),
        end: patterns({ xoteDrum: "0:95 8:87 14:66 16:100", xoteRim: "4:85 12:91 15:68 16:64", triangle: "2:75 10:80 16:89" })
      }
    },
    samba: {
      description: "Surdo marcado, pandeiro sincopado e frase de tamborim",
      feel: { swing: .075, human: .005, gain: .92 },
      parts: {
        intro: patterns({ surdo: "4:77 12:88 20:80 28:90", tambourine: "2:77 3:46 6:62 10:76 11:44 14:67 18:79 19:48 22:64 26:77 27:49 30:67", tamborim: "26:78 30:87" }),
        base: patterns({
          surdo: "0:55 4:97 8:54 12:100 16:58 20:96 24:56 28:100 31:40",
          tambourine: "0:62 2:91 3:51 4:66 6:77 7:48 8:62 10:92 11:54 12:72 14:77 15:53 16:62 18:92 19:51 20:70 22:74 23:48 24:63 26:92 27:52 28:71 30:79 31:53",
          tamborim: "0:79 3:58 6:85 10:78 12:89 19:70 22:85 24:87 27:64 30:89"
        }),
        full: patterns({
          surdo: "0:61 4:100 7:43 8:66 12:100 16:59 20:99 23:42 24:66 28:100 31:51",
          tambourine: "0:66 1:46 2:92 3:51 4:65 6:83 7:45 8:68 10:93 11:49 12:72 13:46 14:87 15:52 16:68 18:94 19:51 20:69 22:83 23:56 24:67 26:92 27:52 28:70 29:48 30:89 31:56",
          tamborim: "0:82 3:76 6:92 8:74 11:82 14:96 16:85 19:74 22:93 26:83 28:87 30:88 31:64",
          shaker: "2:46 6:55 10:51 14:57 18:47 22:51 26:47 30:57"
        }),
        fill: patterns({ surdo: "0:61 4:98 8:60 12:100 15:50", tambourine: "2:90 6:77 10:85 13:63 15:83", tamborim: "0:82 3:71 6:85 9:76 10:92 12:80 14:94 15:77" }),
        break: patterns({ surdo: "4:72 12:82 20:73 28:82", tambourine: "2:62 6:68 10:64 14:71 18:62 22:68 26:65 30:73" }),
        end: patterns({ surdo: "4:89 12:95 16:100", tambourine: "2:75 6:67 10:86 14:79 16:79", tamborim: "0:73 3:68 6:84 10:75 12:88 14:79 16:95" })
      }
    },
    pop: {
      description: "Aro seco, shaker leve e caixa mais aberta na variação",
      feel: { swing: .020, human: .004, laidBack: .009, gain: 1.46 },
      parts: {
        intro: patterns({ shaker: "2:77 6:70 10:79 14:73 18:80 22:72 26:80 30:72", rim: "12:75 20:76 28:84", kick: "16:84 24:75 31:53" }),
        base: patterns({ kick: "0:95 6:60 8:85 16:96 22:66 24:88 27:66", rim: "4:90 12:89 20:91 28:92", shaker: "0:52 2:84 4:49 6:68 8:54 10:81 12:49 14:69 16:52 18:83 20:50 22:67 24:56 26:86 28:50 30:69" }),
        full: patterns({ kick: "0:100 6:72 8:86 10:61 16:100 22:75 24:89 27:68", snare: "4:94 12:99 20:95 27:37 28:100", shaker: "0:61 2:86 4:62 6:82 8:59 10:91 12:68 14:81 16:59 18:88 20:63 22:85 24:61 26:91 28:67 30:83", hatOpen: "14:63 30:71" }),
        fill: patterns({ kick: "0:93 6:66 8:91 15:70", snare: "4:89 10:42 11:53 12:91 14:76", tom: "13:68 15:90", shaker: "2:80 6:72 10:79" }),
        break: patterns({ kick: "0:70 16:68", rim: "12:64 28:69", shaker: "2:65 6:54 10:64 14:57 18:66 22:54 26:65 30:58" }),
        end: patterns({ kick: "0:93 8:82 14:62 16:95", rim: "4:84 12:82", snare: "15:78 16:83", hatOpen: "16:67", shaker: "2:80 6:69 10:81 14:68" })
      }
    },
    rock: {
      description: "Bateria de garagem, pratos abertos e viradas nos tons",
      feel: { swing: 0, human: .003, laidBack: .005, gain: 1.18 },
      parts: {
        intro: patterns({ hat: "0:76 4:74 8:75 12:83 16:78 20:73 24:80 28:82", kick: "16:91 24:84", snare: "28:88 30:57 31:64" }),
        base: patterns({ kick: "0:100 2:65 8:93 10:69 16:100 19:72 24:92 26:72 31:50", snare: "4:98 12:100 20:98 28:100", hat: "0:87 2:61 4:78 6:62 8:89 10:63 12:77 14:66 16:88 18:61 20:78 22:64 24:90 26:62 28:78", hatOpen: "30:69" }),
        full: patterns({ kick: "0:100 2:73 6:72 8:96 10:71 16:100 18:74 22:76 24:97 26:76 27:60", snare: "4:99 12:100 20:99 27:42 28:100 31:48", crash: "0:88 16:64", hat: "2:75 6:76 10:78 14:76 18:75 22:79 26:76", hatOpen: "4:66 8:76 12:69 20:68 24:74 28:67 30:68" }),
        fill: patterns({ kick: "0:100 6:73 8:94 15:85", snare: "4:98 8:54 9:67 10:83", tom: "11:81 12:92 13:77 14:95 15:84", hat: "0:82 2:62 4:74 6:61", hatOpen: "8:71" }),
        break: patterns({ kick: "0:89 8:85 16:91 24:85", snare: "8:85 24:92", hat: "4:69 12:76 20:69 28:74", tom: "29:64 31:88" }),
        end: patterns({ kick: "0:100 8:90 14:84 16:100", snare: "4:94 12:98 15:86 16:90", crash: "16:94", hat: "2:73 6:75 10:74", tom: "13:76 14:90" })
      }
    },
    hiphop: {
      description: "Grave 808, caixa atrasada e chimbal com swing",
      feel: { swing: .23, human: .003, laidBack: .017, gain: .55 },
      parts: {
        intro: patterns({ hat808: "2:67 6:72 10:66 14:80 18:68 22:77 26:63 30:78 31:51", kick808: "16:93 23:69 27:79", snare808: "28:81" }),
        base: patterns({ kick808: "0:100 3:71 7:89 10:90 16:97 22:80 25:93 27:67 30:79", snare808: "4:95 12:100 20:95 28:100 31:37", hat808: "0:79 2:64 5:51 6:77 8:72 10:59 13:43 14:74 16:79 18:64 21:51 22:78 24:75 26:59 29:46 30:78" }),
        full: patterns({ kick808: "0:100 3:75 7:86 10:92 15:61 16:98 19:64 22:83 25:96 30:77", snare808: "4:97 11:42 12:100 20:96 28:100", hat808: "0:77 2:65 3:44 6:78 8:76 10:64 13:43 14:77 15:50 16:81 18:65 21:53 22:76 24:76 26:64 27:47 30:80 31:56", hatOpen: "10:40 26:44" }),
        fill: patterns({ kick808: "0:97 3:71 7:83 10:88", snare808: "4:96 12:92 14:62 15:77", hat808: "2:70 6:78 8:73 9:48 10:67 13:50 14:77 15:56" }),
        break: patterns({ kick808: "0:83 10:75 16:84 25:80", snare808: "12:79 28:83", hat808: "6:66 14:74 22:65 30:75" }),
        end: patterns({ kick808: "0:98 7:83 10:90 16:98", snare808: "4:90 12:97 15:64 16:79", hat808: "2:65 6:76 10:69 14:79" })
      }
    }
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = EstanteGrooves;
