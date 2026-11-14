
function b64decode(s){
 const map='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; const tab={};for(let i=0;i<64;i++)tab[map[i]]=i;
 const z=s.replace(/\s+/g,''); const end=z.endsWith('==')?2:z.endsWith('=')?1:0;const out=new Uint8Array(Math.floor(z.length*3/4)-end);
 let j=0;for(let i=0;i<z.length;i+=4){const a=tab[z[i]],b=tab[z[i+1]],c=tab[z[i+2]]??0,d=tab[z[i+3]]??0;const v=(a<<18)|(b<<12)|(c<<6)|d;if(j<out.length)out[j++]=(v>>>16)&255;if(j<out.length)out[j++]=(v>>>8)&255;if(j<out.length)out[j++]=v&255;}return out;
}
function ungzip(src){
 let pos=0;const readByte=()=>src[pos++];if(readByte()!==31||readByte()!==139||readByte()!==8)throw Error('not gzip');const flags=readByte();pos+=6;
 if(flags&4){const n=readByte()|(readByte()<<8);pos+=n;} if(flags&8)while(src[pos++]);if(flags&16)while(src[pos++]);if(flags&2)pos+=2;
 let byte=pos,bit=0;
 function bits(n){let out=0;for(let i=0;i<n;i++){out|=((src[byte]>>>bit)&1)<<i;if(++bit===8){bit=0;byte++;}}return out;}
 function align(){if(bit){bit=0;byte++;}}
 function huffman(lengths){let max=Math.max(...lengths),counts=new Array(max+1).fill(0),next=new Array(max+1).fill(0),maps=new Array(max+1);for(const len of lengths)if(len)counts[len]++;let code=0;for(let len=1;len<=max;len++){code=(code+(counts[len-1]||0))<<1;next[len]=code;maps[len]=new Map();}for(let sym=0;sym<lengths.length;sym++){let len=lengths[sym];if(len)maps[len].set(next[len]++,sym);}return {max,maps};}
 function symbol(h){let code=0;for(let len=1;len<=h.max;len++){code=(code<<1)|bits(1);const v=h.maps[len].get(code);if(v!==undefined)return v;}throw Error('invalid huffman at '+byte+':'+bit);}
 const lb=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
 const le=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
 const db=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
 const de=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
 let output=new Uint8Array(1<<17),n=0;
 function push(v){if(n===output.length){const o=new Uint8Array(n*2);o.set(output);output=o;}output[n++]=v;}
 let last=0;do{ last=bits(1);const type=bits(2);
 if(type===0){align();const len=bits(16),nlen=bits(16);if((len^nlen)!==65535)throw Error('stored length mismatch');for(let i=0;i<len;i++)push(bits(8));continue;}
 let lit,dist;
 if(type===1){lit=huffman(Array.from({length:288},(_,i)=>i<=143?8:i<=255?9:i<=279?7:8));dist=huffman(new Array(32).fill(5));}
 else if(type===2){const hlit=bits(5)+257,hdist=bits(5)+1,hclen=bits(4)+4,order=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],clen=new Array(19).fill(0);
 for(let i=0;i<hclen;i++)clen[order[i]]=bits(3);const hcl=huffman(clen),lens=[];
 while(lens.length<hlit+hdist){const sym=symbol(hcl);if(sym<16)lens.push(sym);else if(sym===16){const count=bits(2)+3,prev=lens.at(-1);for(let k=0;k<count;k++)lens.push(prev);}else{const count=sym===17?bits(3)+3:bits(7)+11;for(let k=0;k<count;k++)lens.push(0);}}
 lit=huffman(lens.slice(0,hlit));dist=huffman(lens.slice(hlit)); } else throw Error('bad block');
 while(true){const sym=symbol(lit);if(sym<256){push(sym);continue;}if(sym===256)break;const ind=sym-257;if(ind<0||ind>=lb.length)throw Error('invalid length symbol');const len=lb[ind]+bits(le[ind]);const ds=symbol(dist);if(ds>=db.length)throw Error('bad distance symbol');const distance=db[ds]+bits(de[ds]);if(distance>n)throw Error('bad distance '+distance+' '+n);for(let j=0;j<len;j++)push(output[n-distance]);}
 }while(!last);return output.slice(0,n);
}
function utf8decode(bytes){let out=[],slice='';for(let i=0;i<bytes.length;){let b=bytes[i++],cp;if(b<128)cp=b;else if((b&224)===192)cp=((b&31)<<6)|(bytes[i++]&63);else if((b&240)===224)cp=((b&15)<<12)|((bytes[i++]&63)<<6)|(bytes[i++]&63);else if((b&248)===240)cp=((b&7)<<18)|((bytes[i++]&63)<<12)|((bytes[i++]&63)<<6)|(bytes[i++]&63);else throw Error('bad utf8');slice+=String.fromCodePoint(cp);if(slice.length>8192){out.push(slice);slice='';}}out.push(slice);return out.join('');}
module.exports={b64decode,ungzip,utf8decode};
