import { simulate } from "../server/combat.ts";
const team=[{id:"yuji",stars:1,col:3,row:3},{id:"kirito",stars:1,col:2,row:3},{id:"sinon",stars:1,col:3,row:1},{id:"gojo",stars:2,col:4,row:2}];
let w=[0,0,0];
for(let s=0;s<60;s++){const r=simulate(team,team,s);w[r.winner===-1?2:r.winner]++;}
console.log("side0 wins, side1 wins, draws:",w);
