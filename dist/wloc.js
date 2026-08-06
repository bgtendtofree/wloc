/* wloc.js — Apple WLOC 定位修改 (Shadowrocket)
 * 拦截 gs-loc(-cn).apple.com/clls/wloc 响应, 替换其中 protobuf 的经纬度/精度。
 * 源码即发布物, 无构建步骤。中部为 vendor 的 pako inflate (MIT, nodeca), 用于 gzip 响应解压。
 */

// ==================== 运行环境 ====================
// Shadowrocket/Egern/Surge/Loon/Stash/QX 均提供 $persistentStore 与 $done;
// Node 仅用于本地自检 (test/)。
const ENV = typeof process !== "undefined" && process?.versions?.node ? "Node" : "Proxy";

// ==================== 日志 ====================
const Log = {
  level: 3, // 0 off, 1 error, 2 warn, 3 info, 4 debug
  groups: [],
  set logLevel(v) {
    const map = { off: 0, error: 1, warn: 2, warning: 2, info: 3, debug: 4, all: 5 };
    this.level = typeof v === "number" ? v : (map[String(v).toLowerCase()] ?? 2);
  },
  print(...args) {
    if (this.level === 0) return;
    let lines = args.flatMap((a) => {
      if (typeof a === "object") return [JSON.stringify(a)];
      if (typeof a === "bigint" || typeof a === "number" || typeof a === "boolean") return [a.toString()];
      return String(a).split(/\r?\n/);
    });
    for (const g of this.groups) {
      lines = lines.map((l) => `  ${l}`);
      lines.unshift(` ${g}:`);
    }
    console.log(["", ...lines].join("\n"));
  },
  log(...a) { this.print(...a); },
  info(...a) { if (this.level >= 3) this.print(...a.map((x) => ` ${x}`)); },
  warn(...a) { if (this.level >= 2) this.print(...a.map((x) => ` ${x}`)); },
  error(...a) { if (this.level >= 1) this.print(...a.map((x) => ` ${x}`)); },
  debug(...a) { if (this.level >= 4) this.print(...a.map((x) => ` ${x}`)); },
  group(name) { this.groups.unshift(name); },
  groupEnd() { this.groups.shift(); },
};

// ==================== 持久化存储 ====================
// 真机: $persistentStore; Node: box.dat (仅供测试)
const Store = {
  get(key, fallback = null) {
    let v = ENV === "Node" ? readBox()[key] : $persistentStore.read(key);
    try { v = JSON.parse(v); } catch {}
    return v ?? fallback;
  },
  set(key, value) {
    const s = typeof value === "object" ? JSON.stringify(value) : String(value);
    if (ENV === "Node") {
      const box = readBox();
      box[key] = s;
      writeBox(box);
      return true;
    }
    return $persistentStore.write(s, key);
  },
};

function readBox() {
  try {
    return JSON.parse(require("fs").readFileSync("box.dat", "utf8"));
  } catch {
    return {};
  }
}
function writeBox(box) {
  require("fs").writeFileSync("box.dat", JSON.stringify(box));
}

// ==================== 模块参数解析 ====================
function parseArgs(input) {
  const out = {};
  if (typeof input !== "string" || !input) return out;
  for (const pair of input.replace(/^\?/, "").split("&")) {
    if (!pair) continue;
    const [k = "", v = ""] = pair.split("=", 2);
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
    } catch {}
  }
  return out;
}

// ==================== 结束 ====================
function done(result = {}) {
  Log.log(" 执行结束!");
  if (ENV === "Node") process.exit(1);
  if (typeof $done === "function") $done(result);
}

// ==================== vendor: pako inflate (MIT, nodeca) ====================
// 以下 21KB 为第三方 zlib 解压库, 原样保留, 勿手改。出口: ungzip()
function s(e){let t=e.length;for(;--t>=0;)e[t]=0}s(new Array(576));s(new Array(60));s(new Array(512));s(new Array(256));s(new Array(29));s(new Array(30));var l=(e,t,a,r)=>{let n=65535&e,i=e>>>16&65535,o=0;for(;0!==a;){o=a>2e3?2e3:a,a-=o;do{n=n+t[r++]|0,i=i+n|0}while(--o);n%=65521,i%=65521}return n|i<<16};const c=new Uint32Array((()=>{let e,t=[];for(var a=0;a<256;a++){e=a;for(var r=0;r<8;r++)e=1&e?3988292384^e>>>1:e>>>1;t[a]=e}return t})());var d=(e,t,a,r)=>{const n=c,i=r+a;e^=-1;for(let a=r;a<i;a++)e=e>>>8^n[255&(e^t[a])];return-1^e},f={2:"need dictionary",1:"stream end",0:"","-1":"file error","-2":"stream error","-3":"data error","-4":"insufficient memory","-5":"buffer error","-6":"incompatible version"},u={Z_NO_FLUSH:0,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_MEM_ERROR:-4,Z_BUF_ERROR:-5,Z_DEFLATED:8};const h=(e,t)=>Object.prototype.hasOwnProperty.call(e,t);var w=function(e){const t=Array.prototype.slice.call(arguments,1);for(;t.length;){const a=t.shift();if(a){if("object"!=typeof a)throw new TypeError(a+"must be non-object");for(const t in a)h(a,t)&&(e[t]=a[t])}}return e},g=e=>{let t=0;for(let a=0,r=e.length;a<r;a++)t+=e[a].length;const a=new Uint8Array(t);for(let t=0,r=0,n=e.length;t<n;t++){let n=e[t];a.set(n,r),r+=n.length}return a};let p=!0;try{String.fromCharCode.apply(null,new Uint8Array(1))}catch(e){p=!1}const b=new Uint8Array(256);for(let e=0;e<256;e++)b[e]=e>=252?6:e>=248?5:e>=240?4:e>=224?3:e>=192?2:1;b[254]=b[255]=1;var y=e=>{if("function"==typeof TextEncoder&&TextEncoder.prototype.encode)return(new TextEncoder).encode(e);let t,a,r,n,i,o=e.length,s=0;for(n=0;n<o;n++)a=e.charCodeAt(n),55296==(64512&a)&&n+1<o&&(r=e.charCodeAt(n+1),56320==(64512&r)&&(a=65536+(a-55296<<10)+(r-56320),n++)),s+=a<128?1:a<2048?2:a<65536?3:4;for(t=new Uint8Array(s),i=0,n=0;i<s;n++)a=e.charCodeAt(n),55296==(64512&a)&&n+1<o&&(r=e.charCodeAt(n+1),56320==(64512&r)&&(a=65536+(a-55296<<10)+(r-56320),n++)),a<128?t[i++]=a:a<2048?(t[i++]=192|a>>>6,t[i++]=128|63&a):a<65536?(t[i++]=224|a>>>12,t[i++]=128|a>>>6&63,t[i++]=128|63&a):(t[i++]=240|a>>>18,t[i++]=128|a>>>12&63,t[i++]=128|a>>>6&63,t[i++]=128|63&a);return t},m=(e,t)=>{const a=t||e.length;if("function"==typeof TextDecoder&&TextDecoder.prototype.decode)return(new TextDecoder).decode(e.subarray(0,t));let r,n;const i=new Array(2*a);for(n=0,r=0;r<a;){let t=e[r++];if(t<128){i[n++]=t;continue}let o=b[t];if(o>4)i[n++]=65533,r+=o-1;else{for(t&=2===o?31:3===o?15:7;o>1&&r<a;)t=t<<6|63&e[r++],o--;o>1?i[n++]=65533:t<65536?i[n++]=t:(t-=65536,i[n++]=55296|t>>10&1023,i[n++]=56320|1023&t)}}return((e,t)=>{if(t<65534&&e.subarray&&p)return String.fromCharCode.apply(null,e.length===t?e:e.subarray(0,t));let a="";for(let r=0;r<t;r++)a+=String.fromCharCode(e[r]);return a})(i,n)},k=(e,t)=>{(t=t||e.length)>e.length&&(t=e.length);let a=t-1;for(;a>=0&&128==(192&e[a]);)a--;return a<0||0===a?t:a+b[e[a]]>t?a:t};var v=function(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=2,this.adler=0};const _=16209;var x=function(e,t){let a,r,n,i,o,s,l,c,d,f,u,h,w,g,p,b,y,m,k,v,x,E,A,$;const S=e.state;a=e.next_in,A=e.input,r=a+(e.avail_in-5),n=e.next_out,$=e.output,i=n-(t-e.avail_out),o=n+(e.avail_out-257),s=S.dmax,l=S.wsize,c=S.whave,d=S.wnext,f=S.window,u=S.hold,h=S.bits,w=S.lencode,g=S.distcode,p=(1<<S.lenbits)-1,b=(1<<S.distbits)-1;e:do{h<15&&(u+=A[a++]<<h,h+=8,u+=A[a++]<<h,h+=8),y=w[u&p];t:for(;;){if(m=y>>>24,u>>>=m,h-=m,m=y>>>16&255,0===m)$[n++]=65535&y;else{if(!(16&m)){if(64&m){if(32&m){S.mode=16191;break e}e.msg="invalid literal/length code",S.mode=_;break e}y=w[(65535&y)+(u&(1<<m)-1)];continue t}for(k=65535&y,m&=15,m&&(h<m&&(u+=A[a++]<<h,h+=8),k+=u&(1<<m)-1,u>>>=m,h-=m),h<15&&(u+=A[a++]<<h,h+=8,u+=A[a++]<<h,h+=8),y=g[u&b];;){if(m=y>>>24,u>>>=m,h-=m,m=y>>>16&255,16&m){if(v=65535&y,m&=15,h<m&&(u+=A[a++]<<h,h+=8,h<m&&(u+=A[a++]<<h,h+=8)),v+=u&(1<<m)-1,v>s){e.msg="invalid distance too far back",S.mode=_;break e}if(u>>>=m,h-=m,m=n-i,v>m){if(m=v-m,m>c&&S.sane){e.msg="invalid distance too far back",S.mode=_;break e}if(x=0,E=f,0===d){if(x+=l-m,m<k){k-=m;do{$[n++]=f[x++]}while(--m);x=n-v,E=$}}else if(d<m){if(x+=l+d-m,m-=d,m<k){k-=m;do{$[n++]=f[x++]}while(--m);if(x=0,d<k){m=d,k-=m;do{$[n++]=f[x++]}while(--m);x=n-v,E=$}}}else if(x+=d-m,m<k){k-=m;do{$[n++]=f[x++]}while(--m);x=n-v,E=$}for(;k>2;)$[n++]=E[x++],$[n++]=E[x++],$[n++]=E[x++],k-=3;k&&($[n++]=E[x++],k>1&&($[n++]=E[x++]))}else{x=n-v;do{$[n++]=$[x++],$[n++]=$[x++],$[n++]=$[x++],k-=3}while(k>2);k&&($[n++]=$[x++],k>1&&($[n++]=$[x++]))}break}if(64&m){e.msg="invalid distance code",S.mode=_;break e}y=g[(65535&y)+(u&(1<<m)-1)]}}break}}while(a<r&&n<o);k=h>>3,a-=k,h-=k<<3,u&=(1<<h)-1,e.next_in=a,e.next_out=n,e.avail_in=a<r?r-a+5:5-(a-r),e.avail_out=n<o?o-n+257:257-(n-o),S.hold=u,S.bits=h};const E=15,A=new Uint16Array([3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0]),$=new Uint8Array([16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,199,75]),S=new Uint16Array([1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0]),R=new Uint8Array([16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64]);var T=(e,t,a,r,n,i,o,s)=>{const l=s.bits;let c,d,f,u,h,w,g=0,p=0,b=0,y=0,m=0,k=0,v=0,_=0,x=0,T=0,O=null;const N=new Uint16Array(16),j=new Uint16Array(16);let L,B,F,C=null;for(g=0;g<=E;g++)N[g]=0;for(p=0;p<r;p++)N[t[a+p]]++;for(m=l,y=E;y>=1&&0===N[y];y--);if(m>y&&(m=y),0===y)return n[i++]=20971520,n[i++]=20971520,s.bits=1,0;for(b=1;b<y&&0===N[b];b++);for(m<b&&(m=b),_=1,g=1;g<=E;g++)if(_<<=1,_-=N[g],_<0)return-1;if(_>0&&(0===e||1!==y))return-1;for(j[1]=0,g=1;g<E;g++)j[g+1]=j[g]+N[g];for(p=0;p<r;p++)0!==t[a+p]&&(o[j[t[a+p]]++]=p);if(0===e?(O=C=o,w=20):1===e?(O=A,C=$,w=257):(O=S,C=R,w=0),T=0,p=0,g=b,h=i,k=m,v=0,f=-1,x=1<<m,u=x-1,1===e&&x>852||2===e&&x>592)return 1;for(;;){L=g-v,o[p]+1<w?(B=0,F=o[p]):o[p]>=w?(B=C[o[p]-w],F=O[o[p]-w]):(B=96,F=0),c=1<<g-v,d=1<<k,b=d;do{d-=c,n[h+(T>>v)+d]=L<<24|B<<16|F}while(0!==d);for(c=1<<g-1;T&c;)c>>=1;if(0!==c?(T&=c-1,T+=c):T=0,p++,0===--N[g]){if(g===y)break;g=t[a+o[p]]}if(g>m&&(T&u)!==f){for(0===v&&(v=m),h+=b,k=g-v,_=1<<k;k+v<y&&(_-=N[k+v],!(_<=0));)k++,_<<=1;if(x+=1<<k,1===e&&x>852||2===e&&x>592)return 1;f=T&u,n[f]=m<<24|k<<16|h-i}}return 0!==T&&(n[h+T]=g-v<<24|64<<16),s.bits=m,0};const{Z_FINISH:O,Z_BLOCK:N,Z_TREES:j,Z_OK:L,Z_STREAM_END:B,Z_NEED_DICT:F,Z_STREAM_ERROR:C,Z_DATA_ERROR:U,Z_MEM_ERROR:I,Z_BUF_ERROR:M,Z_DEFLATED:D}=u,Z=16180,P=16190,z=16191,q=16192,H=16194,W=16199,K=16200,X=16206,Q=16209,V=e=>(e>>>24&255)+(e>>>8&65280)+((65280&e)<<8)+((255&e)<<24);function J(){this.strm=null,this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new Uint16Array(320),this.work=new Uint16Array(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}const G=e=>{if(!e)return 1;const t=e.state;return!t||t.strm!==e||t.mode<Z||t.mode>16211?1:0},Y=e=>{if(G(e))return C;const t=e.state;return e.total_in=e.total_out=t.total=0,e.msg="",t.wrap&&(e.adler=1&t.wrap),t.mode=Z,t.last=0,t.havedict=0,t.flags=-1,t.dmax=32768,t.head=null,t.hold=0,t.bits=0,t.lencode=t.lendyn=new Int32Array(852),t.distcode=t.distdyn=new Int32Array(592),t.sane=1,t.back=-1,L},ee=e=>{if(G(e))return C;const t=e.state;return t.wsize=0,t.whave=0,t.wnext=0,Y(e)},te=(e,t)=>{let a;if(G(e))return C;const r=e.state;return t<0?(a=0,t=-t):(a=5+(t>>4),t<48&&(t&=15)),t&&(t<8||t>15)?C:(null!==r.window&&r.wbits!==t&&(r.window=null),r.wrap=a,r.wbits=t,ee(e))},ae=(e,t)=>{if(!e)return C;const a=new J;e.state=a,a.strm=e,a.window=null,a.mode=Z;const r=te(e,t);return r!==L&&(e.state=null),r};let re,ne,ie=!0;const oe=e=>{if(ie){re=new Int32Array(512),ne=new Int32Array(32);let t=0;for(;t<144;)e.lens[t++]=8;for(;t<256;)e.lens[t++]=9;for(;t<280;)e.lens[t++]=7;for(;t<288;)e.lens[t++]=8;for(T(1,e.lens,0,288,re,0,e.work,{bits:9}),t=0;t<32;)e.lens[t++]=5;T(2,e.lens,0,32,ne,0,e.work,{bits:5}),ie=!1}e.lencode=re,e.lenbits=9,e.distcode=ne,e.distbits=5},se=(e,t,a,r)=>{let n;const i=e.state;return null===i.window&&(i.window=new Uint8Array(1<<i.wbits)),0===i.wsize&&(i.wsize=1<<i.wbits,i.wnext=0,i.whave=0),r>=i.wsize?(i.window.set(t.subarray(a-i.wsize,a),0),i.wnext=0,i.whave=i.wsize):(n=i.wsize-i.wnext,n>r&&(n=r),i.window.set(t.subarray(a-r,a-r+n),i.wnext),(r-=n)?(i.window.set(t.subarray(a-r,a),0),i.wnext=r,i.whave=i.wsize):(i.wnext+=n,i.wnext===i.wsize&&(i.wnext=0),i.whave<i.wsize&&(i.whave+=n))),0};var le={inflateReset:ee,inflateReset2:te,inflateResetKeep:Y,inflateInit:e=>ae(e,15),inflateInit2:ae,inflate:(e,t)=>{let a,r,n,i,o,s,c,f,u,h,w,g,p,b,y,m,k,v,_,E,A,$,S=0;const R=new Uint8Array(4);let J,Y;const ee=new Uint8Array([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]);if(G(e)||!e.output||!e.input&&0!==e.avail_in)return C;a=e.state,a.mode===z&&(a.mode=q),o=e.next_out,n=e.output,c=e.avail_out,i=e.next_in,r=e.input,s=e.avail_in,f=a.hold,u=a.bits,h=s,w=c,$=L;e:for(;;)switch(a.mode){case Z:if(0===a.wrap){a.mode=q;break}for(;u<16;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}if(2&a.wrap&&35615===f){0===a.wbits&&(a.wbits=15),a.check=0,R[0]=255&f,R[1]=f>>>8&255,a.check=d(a.check,R,2,0),f=0,u=0,a.mode=16181;break}if(a.head&&(a.head.done=!1),!(1&a.wrap)||(((255&f)<<8)+(f>>8))%31){e.msg="incorrect header check",a.mode=Q;break}if((15&f)!==D){e.msg="unknown compression method",a.mode=Q;break}if(f>>>=4,u-=4,A=8+(15&f),0===a.wbits&&(a.wbits=A),A>15||A>a.wbits){e.msg="invalid window size",a.mode=Q;break}a.dmax=1<<a.wbits,a.flags=0,e.adler=a.check=1,a.mode=512&f?16189:z,f=0,u=0;break;case 16181:for(;u<16;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}if(a.flags=f,(255&a.flags)!==D){e.msg="unknown compression method",a.mode=Q;break}if(57344&a.flags){e.msg="unknown header flags set",a.mode=Q;break}a.head&&(a.head.text=f>>8&1),512&a.flags&&4&a.wrap&&(R[0]=255&f,R[1]=f>>>8&255,a.check=d(a.check,R,2,0)),f=0,u=0,a.mode=16182;case 16182:for(;u<32;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}a.head&&(a.head.time=f),512&a.flags&&4&a.wrap&&(R[0]=255&f,R[1]=f>>>8&255,R[2]=f>>>16&255,R[3]=f>>>24&255,a.check=d(a.check,R,4,0)),f=0,u=0,a.mode=16183;case 16183:for(;u<16;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}a.head&&(a.head.xflags=255&f,a.head.os=f>>8),512&a.flags&&4&a.wrap&&(R[0]=255&f,R[1]=f>>>8&255,a.check=d(a.check,R,2,0)),f=0,u=0,a.mode=16184;case 16184:if(1024&a.flags){for(;u<16;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}a.length=f,a.head&&(a.head.extra_len=f),512&a.flags&&4&a.wrap&&(R[0]=255&f,R[1]=f>>>8&255,a.check=d(a.check,R,2,0)),f=0,u=0}else a.head&&(a.head.extra=null);a.mode=16185;case 16185:if(1024&a.flags&&(g=a.length,g>s&&(g=s),g&&(a.head&&(A=a.head.extra_len-a.length,a.head.extra||(a.head.extra=new Uint8Array(a.head.extra_len)),a.head.extra.set(r.subarray(i,i+g),A)),512&a.flags&&4&a.wrap&&(a.check=d(a.check,r,g,i)),s-=g,i+=g,a.length-=g),a.length))break e;a.length=0,a.mode=16186;case 16186:if(2048&a.flags){if(0===s)break e;g=0;do{A=r[i+g++],a.head&&A&&a.length<65536&&(a.head.name+=String.fromCharCode(A))}while(A&&g<s);if(512&a.flags&&4&a.wrap&&(a.check=d(a.check,r,g,i)),s-=g,i+=g,A)break e}else a.head&&(a.head.name=null);a.length=0,a.mode=16187;case 16187:if(4096&a.flags){if(0===s)break e;g=0;do{A=r[i+g++],a.head&&A&&a.length<65536&&(a.head.comment+=String.fromCharCode(A))}while(A&&g<s);if(512&a.flags&&4&a.wrap&&(a.check=d(a.check,r,g,i)),s-=g,i+=g,A)break e}else a.head&&(a.head.comment=null);a.mode=16188;case 16188:if(512&a.flags){for(;u<16;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}if(4&a.wrap&&f!==(65535&a.check)){e.msg="header crc mismatch",a.mode=Q;break}f=0,u=0}a.head&&(a.head.hcrc=a.flags>>9&1,a.head.done=!0),e.adler=a.check=0,a.mode=z;break;case 16189:for(;u<32;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}e.adler=a.check=V(f),f=0,u=0,a.mode=P;case P:if(0===a.havedict)return e.next_out=o,e.avail_out=c,e.next_in=i,e.avail_in=s,a.hold=f,a.bits=u,F;e.adler=a.check=1,a.mode=z;case z:if(t===N||t===j)break e;case q:if(a.last){f>>>=7&u,u-=7&u,a.mode=X;break}for(;u<3;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}switch(a.last=1&f,f>>>=1,u-=1,3&f){case 0:a.mode=16193;break;case 1:if(oe(a),a.mode=W,t===j){f>>>=2,u-=2;break e}break;case 2:a.mode=16196;break;case 3:e.msg="invalid block type",a.mode=Q}f>>>=2,u-=2;break;case 16193:for(f>>>=7&u,u-=7&u;u<32;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}if((65535&f)!=(f>>>16^65535)){e.msg="invalid stored block lengths",a.mode=Q;break}if(a.length=65535&f,f=0,u=0,a.mode=H,t===j)break e;case H:a.mode=16195;case 16195:if(g=a.length,g){if(g>s&&(g=s),g>c&&(g=c),0===g)break e;n.set(r.subarray(i,i+g),o),s-=g,i+=g,c-=g,o+=g,a.length-=g;break}a.mode=z;break;case 16196:for(;u<14;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}if(a.nlen=257+(31&f),f>>>=5,u-=5,a.ndist=1+(31&f),f>>>=5,u-=5,a.ncode=4+(15&f),f>>>=4,u-=4,a.nlen>286||a.ndist>30){e.msg="too many length or distance symbols",a.mode=Q;break}a.have=0,a.mode=16197;case 16197:for(;a.have<a.ncode;){for(;u<3;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}a.lens[ee[a.have++]]=7&f,f>>>=3,u-=3}for(;a.have<19;)a.lens[ee[a.have++]]=0;if(a.lencode=a.lendyn,a.lenbits=7,J={bits:a.lenbits},$=T(0,a.lens,0,19,a.lencode,0,a.work,J),a.lenbits=J.bits,$){e.msg="invalid code lengths set",a.mode=Q;break}a.have=0,a.mode=16198;case 16198:for(;a.have<a.nlen+a.ndist;){for(;S=a.lencode[f&(1<<a.lenbits)-1],y=S>>>24,m=S>>>16&255,k=65535&S,!(y<=u);){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}if(k<16)f>>>=y,u-=y,a.lens[a.have++]=k;else{if(16===k){for(Y=y+2;u<Y;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}if(f>>>=y,u-=y,0===a.have){e.msg="invalid bit length repeat",a.mode=Q;break}A=a.lens[a.have-1],g=3+(3&f),f>>>=2,u-=2}else if(17===k){for(Y=y+3;u<Y;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}f>>>=y,u-=y,A=0,g=3+(7&f),f>>>=3,u-=3}else{for(Y=y+7;u<Y;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}f>>>=y,u-=y,A=0,g=11+(127&f),f>>>=7,u-=7}if(a.have+g>a.nlen+a.ndist){e.msg="invalid bit length repeat",a.mode=Q;break}for(;g--;)a.lens[a.have++]=A}}if(a.mode===Q)break;if(0===a.lens[256]){e.msg="invalid code -- missing end-of-block",a.mode=Q;break}if(a.lenbits=9,J={bits:a.lenbits},$=T(1,a.lens,0,a.nlen,a.lencode,0,a.work,J),a.lenbits=J.bits,$){e.msg="invalid literal/lengths set",a.mode=Q;break}if(a.distbits=6,a.distcode=a.distdyn,J={bits:a.distbits},$=T(2,a.lens,a.nlen,a.ndist,a.distcode,0,a.work,J),a.distbits=J.bits,$){e.msg="invalid distances set",a.mode=Q;break}if(a.mode=W,t===j)break e;case W:a.mode=K;case K:if(s>=6&&c>=258){e.next_out=o,e.avail_out=c,e.next_in=i,e.avail_in=s,a.hold=f,a.bits=u,x(e,w),o=e.next_out,n=e.output,c=e.avail_out,i=e.next_in,r=e.input,s=e.avail_in,f=a.hold,u=a.bits,a.mode===z&&(a.back=-1);break}for(a.back=0;S=a.lencode[f&(1<<a.lenbits)-1],y=S>>>24,m=S>>>16&255,k=65535&S,!(y<=u);){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}if(m&&!(240&m)){for(v=y,_=m,E=k;S=a.lencode[E+((f&(1<<v+_)-1)>>v)],y=S>>>24,m=S>>>16&255,k=65535&S,!(v+y<=u);){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}f>>>=v,u-=v,a.back+=v}if(f>>>=y,u-=y,a.back+=y,a.length=k,0===m){a.mode=16205;break}if(32&m){a.back=-1,a.mode=z;break}if(64&m){e.msg="invalid literal/length code",a.mode=Q;break}a.extra=15&m,a.mode=16201;case 16201:if(a.extra){for(Y=a.extra;u<Y;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}a.length+=f&(1<<a.extra)-1,f>>>=a.extra,u-=a.extra,a.back+=a.extra}a.was=a.length,a.mode=16202;case 16202:for(;S=a.distcode[f&(1<<a.distbits)-1],y=S>>>24,m=S>>>16&255,k=65535&S,!(y<=u);){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}if(!(240&m)){for(v=y,_=m,E=k;S=a.distcode[E+((f&(1<<v+_)-1)>>v)],y=S>>>24,m=S>>>16&255,k=65535&S,!(v+y<=u);){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}f>>>=v,u-=v,a.back+=v}if(f>>>=y,u-=y,a.back+=y,64&m){e.msg="invalid distance code",a.mode=Q;break}a.offset=k,a.extra=15&m,a.mode=16203;case 16203:if(a.extra){for(Y=a.extra;u<Y;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}a.offset+=f&(1<<a.extra)-1,f>>>=a.extra,u-=a.extra,a.back+=a.extra}if(a.offset>a.dmax){e.msg="invalid distance too far back",a.mode=Q;break}a.mode=16204;case 16204:if(0===c)break e;if(g=w-c,a.offset>g){if(g=a.offset-g,g>a.whave&&a.sane){e.msg="invalid distance too far back",a.mode=Q;break}g>a.wnext?(g-=a.wnext,p=a.wsize-g):p=a.wnext-g,g>a.length&&(g=a.length),b=a.window}else b=n,p=o-a.offset,g=a.length;g>c&&(g=c),c-=g,a.length-=g;do{n[o++]=b[p++]}while(--g);0===a.length&&(a.mode=K);break;case 16205:if(0===c)break e;n[o++]=a.length,c--,a.mode=K;break;case X:if(a.wrap){for(;u<32;){if(0===s)break e;s--,f|=r[i++]<<u,u+=8}if(w-=c,e.total_out+=w,a.total+=w,4&a.wrap&&w&&(e.adler=a.check=a.flags?d(a.check,n,w,o-w):l(a.check,n,w,o-w)),w=c,4&a.wrap&&(a.flags?f:V(f))!==a.check){e.msg="incorrect data check",a.mode=Q;break}f=0,u=0}a.mode=16207;case 16207:if(a.wrap&&a.flags){for(;u<32;){if(0===s)break e;s--,f+=r[i++]<<u,u+=8}if(4&a.wrap&&f!==(4294967295&a.total)){e.msg="incorrect length check",a.mode=Q;break}f=0,u=0}a.mode=16208;case 16208:$=B;break e;case Q:$=U;break e;case 16210:return I;default:return C}return e.next_out=o,e.avail_out=c,e.next_in=i,e.avail_in=s,a.hold=f,a.bits=u,(a.wsize||w!==e.avail_out&&a.mode<Q&&(a.mode<X||t!==O))&&se(e,e.output,e.next_out,w-e.avail_out),h-=e.avail_in,w-=e.avail_out,e.total_in+=h,e.total_out+=w,a.total+=w,4&a.wrap&&w&&(e.adler=a.check=a.flags?d(a.check,n,w,e.next_out-w):l(a.check,n,w,e.next_out-w)),e.data_type=a.bits+(a.last?64:0)+(a.mode===z?128:0)+(a.mode===W||a.mode===H?256:0),(0===h&&0===w||t===O)&&$===L&&($=M),$},inflateEnd:e=>{if(G(e))return C;let t=e.state;return t.window&&(t.window=null),e.state=null,L},inflateGetHeader:(e,t)=>{if(G(e))return C;const a=e.state;return 2&a.wrap?(a.head=t,t.done=!1,L):C},inflateSetDictionary:(e,t)=>{const a=t.length;let r,n,i;return G(e)?C:(r=e.state,0!==r.wrap&&r.mode!==P?C:r.mode===P&&(n=1,n=l(n,t,a,0),n!==r.check)?U:(i=se(e,t,a,a),i?(r.mode=16210,I):(r.havedict=1,L)))},inflateInfo:"pako inflate (from Nodeca project)"};var ce=function(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name="",this.comment="",this.hcrc=0,this.done=!1};const de=Object.prototype.toString,{Z_NO_FLUSH:fe,Z_FINISH:ue,Z_OK:he,Z_STREAM_END:we,Z_NEED_DICT:ge,Z_STREAM_ERROR:pe,Z_DATA_ERROR:be,Z_MEM_ERROR:ye,Z_BUF_ERROR:me}=u,ke={chunkSize:65536,windowBits:15,to:""};function ve(e){this.options=w({},ke,e||{});const t=this.options;t.raw&&t.windowBits>=0&&t.windowBits<16&&(t.windowBits=-t.windowBits,0===t.windowBits&&(t.windowBits=-15)),!(t.windowBits>=0&&t.windowBits<16)||e&&e.windowBits||(t.windowBits+=32),t.windowBits>15&&t.windowBits<48&&(15&t.windowBits||(t.windowBits|=15)),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new v,this.strm.avail_out=0;let a=le.inflateInit2(this.strm,t.windowBits);if(a!==he)throw new Error(f[a]);if(this.header=new ce,le.inflateGetHeader(this.strm,this.header),t.dictionary&&("string"==typeof t.dictionary?t.dictionary=y(t.dictionary):"[object ArrayBuffer]"===de.call(t.dictionary)&&(t.dictionary=new Uint8Array(t.dictionary)),t.raw&&(a=le.inflateSetDictionary(this.strm,t.dictionary),a!==he)))throw new Error(f[a])}ve.prototype.push=function(e,t){const a=this.strm,r=this.options.chunkSize,n=this.options.dictionary;let i,o,s;if(this.ended)return!1;for(o=t===~~t?t:!0===t?ue:fe,"[object ArrayBuffer]"===de.call(e)?a.input=new Uint8Array(e):a.input=e,a.next_in=0,a.avail_in=a.input.length;;){for(0===a.avail_out&&(a.output=new Uint8Array(r),a.next_out=0,a.avail_out=r),i=le.inflate(a,o),i===ge&&n&&(i=le.inflateSetDictionary(a,n),i===he?i=le.inflate(a,o):i===be&&(i=ge));a.avail_in>0&&i===we&&2&a.state.wrap&&0!==a.state.flags&&0!==a.input[a.next_in];)le.inflateReset(a),i=le.inflate(a,o);switch(i){case pe:case be:case ge:case ye:return this.onEnd(i),this.ended=!0,!1}if(s=a.avail_out,a.next_out&&(0===a.avail_out||i===we||o>0))if("string"===this.options.to){let e=k(a.output,a.next_out),t=a.next_out-e,n=m(a.output,e);a.next_out=t,a.avail_out=r-t,t&&a.output.set(a.output.subarray(e,e+t),0),this.onData(n)}else this.onData(a.output.length===a.next_out?a.output:a.output.subarray(0,a.next_out)),a.avail_out=0,a.next_out=0;if(i!==he&&i!==me||0!==s){if(i===we)return i=le.inflateEnd(this.strm),this.onEnd(i),this.ended=!0,!0;if(0===a.avail_in){if(o===ue)return i=le.inflateEnd(this.strm),this.onEnd(i===he?me:i),this.ended=!0,!1;break}}}return!0},ve.prototype.onData=function(e){this.chunks.push(e)},ve.prototype.onEnd=function(e){e===he&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=g(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg};var _e={ungzip:function(e,t){const a=new ve(t);if(a.push(e,!0),a.err)throw a.msg||f[a.err];return a.result}};const{ungzip:xe}=_e;var Ee=xe;
// ==================== vendor 结束 ====================
const ungzip = Ee; // vendor 导出: ungzip(Uint8Array) -> Uint8Array

// ==================== protobuf 编解码 ====================
function readVarint(data, offset) {
  let result = 0;
  let factor = 1;
  let shift = 0;
  while (offset < data.length) {
    const b = 255 & data[offset++];
    if (shift < 56) result += (127 & b) * factor;
    if (!(128 & b)) return [result, offset];
    factor *= 128;
    shift += 7;
    if (shift >= 70) throw new Error("varint too long at " + offset);
  }
  throw new Error("truncated varint");
}

function writeVarint(value) {
  let v = Math.floor(value);
  if (v >= 0) {
    const out = [];
    for (; v >= 128; ) {
      out.push((v % 128) | 128);
      v = Math.floor(v / 128);
    }
    out.push(v);
    return out;
  }
  // 负数 (西/南半球坐标): 10 字节 varint, 64 位二进制补码
  const bytes = new Array(8).fill(0);
  let r = -v;
  for (let i = 0; i < 8; i++) {
    bytes[i] = 255 & r;
    r = Math.floor(r / 256);
  }
  let carry = 1;
  for (let i = 0; i < 8; i++) {
    const t = (255 & ~bytes[i]) + carry;
    bytes[i] = 255 & t;
    carry = t >> 8;
  }
  const out = [];
  for (let i = 0; i < 10; i++) {
    let t = 0;
    for (let j = 0; j < 7; j++) {
      const n = 7 * i + j;
      if (n < 64) t |= ((bytes[n >> 3] >> (7 & n)) & 1) << j;
    }
    if (i < 9) t |= 128;
    out.push(t);
  }
  return out;
}

function concat(parts) {
  const out = [];
  for (const p of parts) for (const b of p) out.push(255 & b);
  return out;
}

function parseFields(data) {
  const fields = [];
  let offset = 0;
  while (offset < data.length) {
    const start = offset;
    const [tag, next] = readVarint(data, offset);
    offset = next;
    const fieldNo = Math.floor(tag / 8);
    const wireType = tag & 7;
    if (fieldNo === 0) throw new Error("invalid protobuf field 0 at " + start);
    let value;
    if (wireType === 0) {
      const [v, n] = readVarint(data, offset);
      value = v;
      offset = n;
    } else if (wireType === 1) {
      value = data.slice(offset, offset + 8);
      offset += 8;
    } else if (wireType === 2) {
      const [len, n] = readVarint(data, offset);
      offset = n;
      value = data.slice(offset, offset + len);
      offset += len;
    } else if (wireType === 5) {
      value = data.slice(offset, offset + 4);
      offset += 4;
    } else {
      throw new Error("unsupported wire type " + wireType);
    }
    fields.push({ fieldNo, wireType, value, raw: data.slice(start, offset) });
  }
  return fields;
}

function encodeField(fieldNo, wireType, value) {
  const head = writeVarint(fieldNo * 8 + wireType);
  if (wireType === 0) return concat([head, writeVarint(value)]);
  if (wireType === 1 || wireType === 5) return concat([head, value]);
  if (wireType === 2) return concat([head, writeVarint(value.length), value]);
  throw new Error("cannot encode wire type " + wireType);
}

// ==================== WLOC patch ====================
// 消息结构 (逆向自 CoreLocationProtobuf):
//   位置: field 1=纬度*1e8, field 2=经度*1e8, field 3=精度(米)
//   WiFi 条目: field 1=BSSID(MAC 字符串), field 2=位置子消息
//   基站条目: field 5=位置子消息
//   顶层: field 2=WiFi 条目, field 22/24=基站条目
// 原则: 最小 patch — 只动经纬度/精度, 其余字段原样保留。

function patchLocationMessage(data, target, stats) {
  const fields = parseFields(data);
  const hasLat = fields.some((f) => f.fieldNo === 1 && f.wireType === 0);
  const hasLon = fields.some((f) => f.fieldNo === 2 && f.wireType === 0);
  if (!hasLat || !hasLon) return data;
  const parts = fields.map((f) => {
    if (f.fieldNo === 1 && f.wireType === 0) return encodeField(1, 0, Math.round(1e8 * target.latitude));
    if (f.fieldNo === 2 && f.wireType === 0) return encodeField(2, 0, Math.round(1e8 * target.longitude));
    // field 3 仅在小值时可确认是 accuracy; 巨大值(如 72057594037927940)是别的语义, 不动 — iOS 27 实测
    if (f.fieldNo === 3 && f.wireType === 0 && f.value < 1e5) {
      stats.accOrig ??= f.value;
      return encodeField(3, 0, target.accuracy);
    }
    return f.raw;
  });
  stats.locations += 1;
  return concat(parts);
}

function patchWifiMessage(data, target, stats) {
  const fields = parseFields(data);
  const looksLikeWifi = fields.some((f) => {
    if (f.fieldNo !== 1 || f.wireType !== 2) return false;
    const s = Array.from(f.value, (b) => String.fromCharCode(255 & b)).join("");
    return /^[0-9a-fA-F]{1,2}(:[0-9a-fA-F]{1,2}){5}$/.test(s);
  });
  if (!looksLikeWifi) return data;
  let changed = false;
  const parts = fields.map((f) => {
    if (f.fieldNo === 2 && f.wireType === 2) {
      try {
        const patched = patchLocationMessage(f.value, target, stats);
        if (patched.length !== f.value.length || patched.join(",") !== f.value.join(",")) changed = true;
        return encodeField(f.fieldNo, f.wireType, patched);
      } catch {
        stats.skipped += 1;
        return f.raw;
      }
    }
    return f.raw;
  });
  if (changed) stats.wifi += 1;
  return concat(parts);
}

function patchCellMessage(data, target, stats) {
  const fields = parseFields(data);
  let changed = false;
  const parts = fields.map((f) => {
    if (f.fieldNo === 5 && f.wireType === 2) {
      try {
        const patched = patchLocationMessage(f.value, target, stats);
        if (patched.length !== f.value.length || patched.join(",") !== f.value.join(",")) changed = true;
        return encodeField(f.fieldNo, f.wireType, patched);
      } catch {
        stats.skipped += 1;
        return f.raw;
      }
    }
    return f.raw;
  });
  if (changed) stats.cell += 1;
  return concat(parts);
}

function patchOuterMessage(data, target, stats) {
  const fields = parseFields(data);
  const parts = fields.map((f) => {
    if (f.wireType !== 2) return f.raw;
    if (f.fieldNo === 2) return encodeField(f.fieldNo, f.wireType, patchWifiMessage(f.value, target, stats));
    if (f.fieldNo === 22 || f.fieldNo === 24) return encodeField(f.fieldNo, f.wireType, patchCellMessage(f.value, target, stats));
    return f.raw;
  });
  return concat(parts);
}

// ==================== 帧定位与重打包 ====================
// 响应体: N 字节头 + 2 字节大端长度 + protobuf payload (+ 可能的尾部)
// 头部结构随版本变化, 故按候选偏移逐个尝试, 失败回滚统计再试下一个。

const snapshotStats = (s) => ({ wifi: s.wifi | 0, cell: s.cell | 0, locations: s.locations | 0, skipped: s.skipped | 0, accOrig: s.accOrig });
const restoreStats = (s, snap) => Object.assign(s, snap);

function statsDelta(a, b) {
  return a.locations - b.locations + (a.wifi - b.wifi) + (a.cell - b.cell);
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function patchFrameAt(body, base, target, stats) {
  if (body.length < base + 10) throw new Error("body too short: " + body.length + ", base=" + base);
  const payloadLen = ((255 & body[base + 8]) << 8) | (255 & body[base + 9]);
  if (payloadLen <= 0) throw new Error("invalid empty frame length at " + base);
  if (payloadLen + base + 10 > body.length) throw new Error("invalid frame length " + payloadLen + " at " + base + " for " + body.length);
  const head = body.slice(0, base + 8);
  const payload = body.slice(base + 10, base + 10 + payloadLen);
  const tail = body.slice(base + 10 + payloadLen);
  const before = snapshotStats(stats);
  const patched = patchOuterMessage(payload, target, stats);
  if (patched.length > 65535) throw new Error("patched payload too large: " + patched.length);
  if (statsDelta(stats, before) <= 0 || bytesEqual(payload, patched)) {
    restoreStats(stats, before);
    throw new Error("frame parsed but no patchable wloc payload at " + base);
  }
  return concat([head, [(patched.length >> 8) & 255, 255 & patched.length], patched, tail]);
}

function patchBody(body, target) {
  const stats = { wifi: 0, cell: 0, locations: 0, skipped: 0 };
  if (body.length < 10) throw new Error("body too short: " + body.length);

  // 候选偏移: 常见帧头长度优先, 再全扫
  const offsets = [0, 2, 4, 6, 8, 10, 12, 14, 16];
  const maxOffset = Math.min(96, Math.max(0, body.length - 10));
  for (let o = 0; o <= maxOffset; o++) if (!offsets.includes(o)) offsets.push(o);

  const errors = [];
  for (const base of offsets) {
    const snap = snapshotStats(stats);
    try {
      const data = patchFrameAt(body, base, target, stats);
      Log.info(`[wloc] patched at offset=${base} locations=${stats.locations} wifi=${stats.wifi} cell=${stats.cell} skipped=${stats.skipped}`);
      return { data, stats };
    } catch (e) {
      restoreStats(stats, snap);
      if (errors.length < 6) errors.push("@" + base + ":" + (e?.message || String(e)));
    }
  }

  // 兜底: 不做帧解析, 直接从每个偏移当裸 protobuf 扫
  const rawErrors = [];
  const rawMax = Math.min(256, body.length);
  for (let i = 0; i <= rawMax; i++) {
    const snap = snapshotStats(stats);
    try {
      const payload = body.slice(i);
      const patched = patchOuterMessage(payload, target, stats);
      if (statsDelta(stats, snap) > 0 && !bytesEqual(payload, patched)) {
        Log.info(`[wloc] patched via raw fallback locations=${stats.locations} wifi=${stats.wifi} cell=${stats.cell} skipped=${stats.skipped}`);
        return { data: concat([body.slice(0, i), patched]), stats };
      }
      restoreStats(stats, snap);
    } catch (e) {
      restoreStats(stats, snap);
      if (rawErrors.length < 6) rawErrors.push("raw@" + i + ":" + (e?.message || String(e)));
    }
  }

  throw new Error("no patchable wloc payload found; " + [...errors, "raw:" + rawErrors.join(" | ")].join(" | "));
}

// ==================== 响应处理 ====================
const isGzip = (b) => b.length >= 2 && b[0] === 31 && b[1] === 139;

function toByteArray(body) {
  if (!body) return [];
  if (body instanceof ArrayBuffer) return Array.prototype.slice.call(new Uint8Array(body));
  if (ArrayBuffer.isView?.(body)) return Array.prototype.slice.call(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
  if (typeof body.length === "number" && typeof body !== "string") {
    const out = [];
    for (let i = 0; i < body.length; i++) out.push(255 & body[i]);
    return out;
  }
  if (typeof body === "string") {
    const out = [];
    for (let i = 0; i < body.length; i++) out.push(255 & body.charCodeAt(i));
    return out;
  }
  return [];
}

async function handleResponse(request, response, settings) {
  const url = request.url || "";
  const seq = settings.seq ?? "-";
  Log.group(`[wloc] #${seq} Response ${url}`);
  Log.info(`[wloc] #${seq} ${new Date().toISOString()} method=${request.method || "?"} url=${url}`);
  try {
    const bytes = toByteArray(response.bodyBytes || response.rawBody || response.body);
    if (!bytes.length) {
      Log.warn(`[wloc] #${seq} 无二进制 body，跳过`);
      return response;
    }
    // 超短响应是 Apple 的"无数据"应答, 本身不含位置, 直接透传 (不算 patch 失败)
    if (bytes.length < 12) {
      Log.info(`[wloc] #${seq} 空响应(${bytes.length}B) 无位置数据，透传`);
      return response;
    }
    Log.debug(`[wloc] input length=${bytes.length} gzip=${isGzip(bytes)}`);
    if (settings.longitude == null || settings.latitude == null) {
      Log.info(`[wloc] #${seq} 透传模式：未设置坐标，不修改响应（恢复真实定位）`);
      return response;
    }
    let data = bytes;
    if (isGzip(bytes)) data = Array.from(ungzip(new Uint8Array(bytes)));
    const { data: patched, stats } = patchBody(data, settings);
    const out = new Uint8Array(patched);
    response.body = out;
    response.bodyBytes = out;
    response.rawBody = out;
    if (response.headers) {
      delete response.headers["Content-Encoding"];
      delete response.headers["content-encoding"];
      delete response.headers["Transfer-Encoding"];
      delete response.headers["transfer-encoding"];
      response.headers["Content-Length"] = String(out.length);
    }
    response.status = 200;
    response.statusCode = 200;
    Log.info(
      `[wloc] #${settings.seq} PATCH ok 目标: ${settings.longitude},${settings.latitude} accuracy ${stats.accOrig ?? "?"}→${settings.accuracy} locations=${stats.locations} wifi=${stats.wifi} cell=${stats.cell} skipped=${stats.skipped} bytes=${out.length}`,
    );
    return response;
  } catch (e) {
    Log.error(`[wloc] #${seq} PATCH fail: ${e.message || e}`);
    return response;
  } finally {
    Log.groupEnd();
  }
}

// ==================== 配置 ====================
// 优先级: 快捷指令/接口储存 ($persistentStore) > 模块参数 > 默认值
const DEFAULTS = { longitude: null, latitude: null, accuracy: 25, logLevel: "info" };

function loadSettings() {
  const args = parseArgs(globalThis.$argument);
  const saved = Store.get("wloc_settings");
  const s = { ...DEFAULTS };
  if (args.longitude) s.longitude = parseFloat(args.longitude);
  if (args.latitude) s.latitude = parseFloat(args.latitude);
  if (args.accuracy) s.accuracy = parseInt(args.accuracy, 10);
  if (args.logLevel) s.logLevel = args.logLevel;
  if (saved && typeof saved === "object") {
    if (saved.longitude) s.longitude = parseFloat(saved.longitude);
    if (saved.latitude) s.latitude = parseFloat(saved.latitude);
    if (saved.accuracy) s.accuracy = parseInt(saved.accuracy, 10);
    Log.info(`[settings] 使用已保存坐标: ${s.longitude},${s.latitude}`);
  } else if (s.longitude === 113.94114 && s.latitude === 22.544577) {
    // 哨兵: 持久化为空且模块参数未改动 = 用户没设过坐标, 透传
    s.longitude = null;
    s.latitude = null;
    Log.info("[settings] 透传模式：持久化数据为空且为默认参数，不修改定位");
    return s;
  }
  if (s.longitude == null || s.latitude == null) Log.info("[settings] 透传模式：未设置坐标，将不修改定位响应");
  else Log.debug(`[settings] lon=${s.longitude} lat=${s.latitude} acc=${s.accuracy}`);
  return s;
}

// ==================== 入口 ====================
let result;
(async () => {
  const response = typeof $response !== "undefined" ? $response : undefined;
  if (!response) {
    Log.warn("[wloc] 非响应模式，跳过");
    return;
  }
  const settings = loadSettings();
  settings.seq = Store.get("wloc_seq", 0) + 1; // 跨请求持久化序号, 用于对齐日志与定位回跳时刻
  Store.set("wloc_seq", settings.seq);
  Log.logLevel = settings.logLevel;
  result = await handleResponse($request, response, settings);
})()
  .catch((e) => Log.error(e))
  .finally(() => {
    if (typeof result === "object") {
      if (result.headers?.["Content-Encoding"]) result.headers["Content-Encoding"] = "identity";
      if (result.headers?.["content-encoding"]) result.headers["content-encoding"] = "identity";
      done({ response: result });
    } else {
      done({});
    }
  });
