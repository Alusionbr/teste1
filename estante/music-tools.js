"use strict";
function parseLRC(text){
  const out=[];
  for(const line of text.split("\n")){
    const a=line.indexOf("["),b=line.indexOf("]");if(a!==0||b<2)continue;
    const stamp=line.slice(1,b),parts=stamp.split(":");if(parts.length!==2)continue;
    const t=Number(parts[0])*60+Number(parts[1]);if(Number.isNaN(t))continue;
    out.push({t,text:line.slice(b+1).trim()});
  }
  return out.sort((a,b)=>a.t-b.t);
}
function hasLRC(text){const first=text.trim().split("\n")[0]||"";return first.startsWith("[")&&first.includes(":")&&first.includes("]")}
function classify(line){
  const text=line.trim();if(!text)return{text:"",type:"blank"};
  if((text.startsWith("[")&&text.endsWith("]"))||(text.startsWith("(")&&text.endsWith(")")))return{text:text.slice(1,-1),type:"section"};
  const parts=text.split(" ").filter(Boolean);if(parts.length<=14&&parts.every(x=>CHORD.test(x)))return{text,type:"chord"};
  return{text:line,type:"lyric"};
}
function moveNote(note,n,flat){let i=SHARP.indexOf(note);if(i<0)i=FLAT.indexOf(note);if(i<0)return note;return(flat?FLAT:SHARP)[((i+n)%12+12)%12]}
function shiftRoot(chord,n){if(!chord||!"ABCDEFG".includes(chord[0]))return chord;let len=1;if(chord[1]==="#"||chord[1]==="b")len=2;const root=chord.slice(0,len),rest=chord.slice(len),flat=root.includes("b");return moveNote(root,n,flat)+rest}
function transposeChord(chord,n){const slash=chord.indexOf("/");if(slash<0)return shiftRoot(chord,n);return shiftRoot(chord.slice(0,slash),n)+"/"+shiftRoot(chord.slice(slash+1),n)}
function transposeLine(line,n){if(!n)return line;return line.split(" ").map(x=>CHORD.test(x)?transposeChord(x,n):x).join(" ")}
