/* MY MONEY v1.2 : local-only statement and CSV parsing. No transaction data is transmitted. */
(function(root){
'use strict';
const MAX_AMOUNT=100000000;
const categories=[
 ['supermarket','スーパー・生鮮食品'],['dining','店舗外食'],['delivery','デリバリー・持ち帰り'],
 ['convenience','コンビニ'],['foodOnline','食品・飲料通販'],['drugstore','ドラッグストア'],
 ['water','宅配水'],['tobacco','タバコ'],['entertainment','私費交際費'],
 ['transport','交通費（要確認・集計対象外）'],['other','その他の私費'],['company','会社立替（除外）'],
 ['donation','ふるさと納税（別管理）'],['tax','税金（別管理）'],
 ['charge','楽天ペイ等チャージ'],['installment','分割・リボ（新規利用集計から除外）'],
 ['income','給与振込（実績）'],['unknown','要確認・未分類']
];
const labels=Object.fromEntries(categories);
const expenseKeys=new Set(['supermarket','dining','delivery','convenience','foodOnline','drugstore','water','tobacco','entertainment','other','charge']);
const excludedKeys=new Set(['company','donation','tax','installment','income','unknown','transport']);
function clean(s){return String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function normalize(s){return clean(s).toUpperCase().replace(/[\s\p{P}\p{S}]/gu,'');}
function dateFrom(s){s=clean(s).replace(/[年月]/g,'/').replace(/日/g,'').replace(/[.\-]/g,'/');let m=s.match(/^(20\d\d)\/(\d{1,2})\/(\d{1,2})/);if(!m)return null;let [_,y,mm,dd]=m;let dt=new Date(Date.UTC(+y,+mm-1,+dd));return dt.getUTCFullYear()===+y&&dt.getUTCMonth()===+mm-1&&dt.getUTCDate()===+dd?`${y}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`:null;}
function amt(s){let t=clean(s).replace(/[¥￥円,\s]/g,'').replace(/^\((.*)\)$/,'-$1');if(!/^[+\-]?\d+$/.test(t))return null;const n=Number(t);return Number.isSafeInteger(n)&&Math.abs(n)<=MAX_AMOUNT?n:null;}
function classify(merchant,amount,method=''){const s=normalize(merchant),m=normalize(method);if(/分割|リボ|キャッシング|REVO/.test(m))return {category:'installment',confidence:'high'};
 if(/楽天ペイ残高|楽天キャッシュ|PAYPAYチャージ|SUICAチャージ/.test(s))return {category:'charge',confidence:'high'};
 if(/ふるさと納税|FURUSATO|ふるなび|サトフル/.test(s)||/(?:都|道|府|県).+(?:市|町|村)$/.test(clean(merchant))||/^[^\s]+(?:市|町|村)$/.test(clean(merchant))&&/(?:県|北海道|市役所)/.test(s))return {category:'donation',confidence:'medium'};
 if(/ELTAX|地方税共同機構|固定資産税|自動車税|住民税/.test(s))return {category:'tax',confidence:'high'};
 if(/プレミアムウォーター|PREMIUMWATER/.test(s))return {category:'water',confidence:'high'};
 if(/楽天ペイ残高|チャージ|モバイルPASMO|モバイルスイカ|交通系IC/.test(s))return {category:'charge',confidence:'medium'};
 if(/UBER.*EATS|UBERJP.*EATS|出前館|DOORDASH|WOLT|MENU.*デリバリー/.test(s))return {category:'delivery',confidence:'high'};
 if(/ヤオコー|スーパー|ライフオオヨド|ライフ|コープみらい|コープ|角上魚類|カクジョウギョルイ|マルエツ|オーケー|オオゼキ|イオン|SEIYU|西友|業務スーパー|ロピア|ベルク|イトーヨーカドー/.test(s))return {category:'supermarket',confidence:'high'};
 if(/スギヤッキョク|スギヤツキヨク|スギ薬局|マツモトキヨシ|ウエルシア|サンドラッグ|ココカラファイン|ツルハ|ドラッグストア/.test(s))return {category:'drugstore',confidence:'high'};
 if(/セブンイレブン|7ELEVEN|ローソン|LAWSON|ファミリーマート|フアミリーマート|FAMILYMART|デイリーヤマザキ|デイリ-ヤマザキ|デイリヤマザキ|ミニストップ/.test(s))return {category:'convenience',confidence:'high'};
 if(/楽天24|楽天ドライブ|楽天ドライフ|OISIX|オイシックス|コープデリ|ネットスーパー/.test(s))return {category:'foodOnline',confidence:'medium'};
 if(/西武鉄道|セイブテツドウ|JRトウカイ|JR東海|パスモ|SUICA|タクシ|高速道路|ETCカード/.test(s))return {category:'transport',confidence:'medium'};
 if(/ランチ|レストラン|ラーメン|ラ-メン|マクドナルド|ケンタッキー|サイゼリヤ|ガスト|スシロー|くら寿司|はま寿司|モスバーガー|吉野家|すき家|ミスタードーナツ|スターバックス|ピザハット|ドミノピザ/.test(s))return {category:'dining',confidence:'medium'};
 return {category:'unknown',confidence:'low'};}
function parseCSV(text){const s=String(text||'').replace(/^\uFEFF/,'');if(!s.trim())throw Error('空のCSVです');const first=s.split(/\r?\n/,1)[0];const sep=(first.match(/\t/g)||[]).length>(first.match(/,/g)||[]).length?'\t':',';let out=[],row=[],field='',quoted=false;
 for(let i=0;i<s.length;i++){const ch=s[i];if(ch==='"'){if(quoted&&s[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(ch===sep&&!quoted){row.push(field);field='';}else if((ch==='\r'||ch==='\n')&&!quoted){if(ch==='\r'&&s[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))out.push(row);row=[];field='';}else field+=ch;}
 if(quoted)throw Error('CSVの引用符が閉じられていません');row.push(field);if(row.some(v=>v.trim()))out.push(row);return out;}
function findHeader(rows){for(let i=0;i<Math.min(12,rows.length);i++){const a=rows[i].map(normalize),hasDate=a.some(t=>/日付|利用日|取引日|DATE|入出金日/.test(t));const hasAmount=a.some(t=>/金額|AMOUNT|支払|入金|出金|取引額/.test(t));if(hasDate&&hasAmount)return i;}return -1;}
function indexFor(headers,patterns){return headers.findIndex(h=>patterns.some(p=>p.test(normalize(h))));}
function parseCardCSV(rows){const hi=findHeader(rows);if(hi<0)throw Error('「利用日・金額」などの見出しを見つけられませんでした。CSVの項目を確認してください。');const heads=rows[hi],idxDate=indexFor(heads,[/利用日/,/取引日/,/^日付$/,/^DATE$/,/入出金日/]),idxDesc=indexFor(heads,[/利用店名/,/利用先/,/加盟店/,/店名/,/内容/,/摘要/,/お取引内容/,/取引先/,/DESCRIPTION/]),idxMoney=indexFor(heads,[/利用金額/,/取引金額/,/ご利用金額/,/^金額$/,/AMOUNT/]),idxOut=indexFor(heads,[/^出金/,/支払金額/]),idxIn=indexFor(heads,[/^入金/]),idxMethod=indexFor(heads,[/支払方法/,/支払区分/,/PAYMENTTYPE/]),idxWho=indexFor(heads,[/利用者/,/名義/,/カード会員/]);
 if(idxDate<0||idxDesc<0||idxMoney<0&&idxOut<0&&idxIn<0)throw Error('利用日・利用先・金額の列が必要です');let entries=[],ignored=0,bank=idxIn>=0||idxOut>=0;
 for(let i=hi+1;i<rows.length;i++){const cols=rows[i],date=dateFrom(cols[idxDate]);if(!date){ignored++;continue;}const merchant=clean(cols[idxDesc]);if(!merchant){ignored++;continue;}let value=idxMoney>=0?amt(cols[idxMoney]):null,deposit=idxIn>=0?amt(cols[idxIn]):null,outgoing=idxOut>=0?amt(cols[idxOut]):null;
  if(bank){if(deposit!==null&&deposit>0){const cat=/給与|キュウヨ|給料|SALARY/.test(normalize(merchant))?'income':'unknown';entries.push({date,merchant,amount:deposit,method:'入金',cardholder:'',category:cat,confidence:cat==='income'?'medium':'low',sourceType:'bank'});}else if(outgoing!==null&&outgoing>0){ignored++;}else ignored++;continue;}
  if(value===null){ignored++;continue;}const method=idxMethod>=0?clean(cols[idxMethod]):'1回払い',cardholder=idxWho>=0?clean(cols[idxWho]):'';let cls=classify(merchant,value,method);if(value<0)cls={category:'unknown',confidence:'low'};entries.push({date,merchant,amount:value,method,cardholder,...cls,sourceType:'card'});}
 if(!entries.length)throw Error('取り込み可能な取引がありません。CSVの形式や文字コードを確認してください。');return {entries,ignored,type:bank?'bank':'card',bill:null};}
function parsePDFLines(lines){let statementMonth=null,billAmount=null,payDate=null,head=lines.slice(0,80).join('\n');const matched=head.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*ご請求金額/);if(matched)statementMonth=matched[1]+'-'+matched[2].padStart(2,'0');
 // Bill total follows the heading, sometimes on a separate text line.
 if(matched){const at=head.indexOf(matched[0]),part=head.slice(at+matched[0].length,at+matched[0].length+280);const q=part.match(/([\d,]+)\s*円/);if(q)billAmount=amt(q[1]);}
 let dm=head.match(/(?:お支払日[\s\S]{0,80})?(20\d{2}\/\d{2}\/\d{2})\s+口座振替/);if(dm)payDate=dateFrom(dm[1]);
 const entries=[];let ignored=0,skippedInstallments=0,failed=0;
 for(const raw of lines){const line=clean(raw);if(!/^20\d{2}\/\d{2}\/\d{2}\s+/.test(line))continue;
 // A statement line needs the member and method markers; ignore explanatory lines, payments and footers.
 const m=line.match(/^(20\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+(本人\s*\*?|家族\s*\*?|ETC\s*\*?)\s+(1\s*回払い|一括払い|分割\S*|リボ払い|キャッシング\S*|分割変更\S*)\s+([\d,]+)(?:\s|$)/);
 const etc=!m?line.match(/^(20\d{2}\/\d{2}\/\d{2})\s+(ETCカード売上)\s+(1\s*回払い)\s+([\d,]+)(?:\s|$)/):null;
 if(!m&&!etc){if(/分割変更|分割払い|リボ払い|キャッシング/.test(line))skippedInstallments++;ignored++;continue;}const date=dateFrom((m||etc)[1]),merchant=clean((m||etc)[2]),cardholder=m?m[3].replace(/\s+/g,''):'ETC',method=(m?m[4]:etc[3]).replace(/\s+/g,''),amount=amt(m?m[5]:etc[4]);if(!date||amount===null){failed++;continue;}
 const c=classify(merchant,amount,method);if(c.category==='installment')skippedInstallments++;
 entries.push({date,merchant,amount,method,cardholder,...c,sourceType:'card',billingMonth:statementMonth||null});
 }
 if(!entries.length)throw Error('明細行が抽出できませんでした。画像のみのPDFや、未対応のカード会社形式かもしれません。');
 return {type:'card',entries,ignored:ignored+failed,skippedInstallments,bill:billAmount!==null&&statementMonth?{month:statementMonth,amount:billAmount,payDate}:null};
}
// Offline text extraction for Rakuten/SVF statements with Shift-JIS (90ms-RKSJ-H).
// Only used on the recognized SVF format; never interprets other PDFs as valid.
function bytesToBinary(bytes){let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));return out;}
function unescapePDFLiteral(str){return str.replace(/\\([0-7]{1,3}|.)/gs,(_,v)=>/^[0-7]/.test(v)?String.fromCharCode(parseInt(v,8)):({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f'}[v]||v));}
async function readRakutenSVF(bytes){
 if(typeof DecompressionStream==='undefined')return null;
 const raw=bytesToBinary(bytes);
 if(!raw.includes('Created by SVF JavaPrint PDF Engine')||!raw.includes('90ms-RKSJ-H'))return null;
 const pageLines=[],decoder=new TextDecoder('shift_jis');let streamCount=0;
 const objects=raw.matchAll(/\b\d+\s+\d+\s+obj\b([\s\S]*?)endobj/g);
 for(const obj of objects){const body=obj[1];if(!/\/Filter\s*\/FlateDecode/.test(body))continue;
  const stream=body.match(/stream\r?\n([\s\S]*?)\r?\n?endstream/);if(!stream)continue;
  try{
   const compressed=Uint8Array.from(stream[1],c=>c.charCodeAt(0)&255);
   const response=new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate')));
   const content=bytesToBinary(new Uint8Array(await response.arrayBuffer()));
   const items=[];
   for(const block of content.matchAll(/\bBT\b([\s\S]*?)\bET\b/g)){
    const pos=block[1].match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Td/);
    const txt=block[1].match(/\(((?:\\[\s\S]|[^\\)])*)\)\s*Tj/);
    if(!pos||!txt)continue;
    const binary=unescapePDFLiteral(txt[1]);const chars=decoder.decode(Uint8Array.from(binary,c=>c.charCodeAt(0)&255)).trim();
    if(chars)items.push({x:Number(pos[1]),y:Number(pos[2]),str:chars});
   }
   if(!items.length)continue;
   const groups=[];
   for(const x of items){let group=groups.find(g=>Math.abs(g.y-x.y)<2.2);if(!group){group={y:x.y,items:[]};groups.push(group);}group.items.push(x);}
   groups.sort((a,b)=>b.y-a.y);
   for(const g of groups){g.items.sort((a,b)=>a.x-b.x);pageLines.push(g.items.map(x=>x.str).join(' '));}
   streamCount++;
  }catch(err){throw Error('楽天カードPDFの文字展開に失敗しました: '+(err.message||String(err)));}
 }
 if(!streamCount||!pageLines.some(x=>/ご利用明細|利用日/.test(x)))throw Error('楽天カードPDFの文字を抽出できませんでした。CSV明細もお試しください。');
 const parsed=parsePDFLines(pageLines);parsed.pdfPages=streamCount;parsed.reader='楽天カードPDF・端末内解析';return parsed;
}
async function loadPdfLibrary(){
 if(root.pdfjsLib)return root.pdfjsLib;
 const hosts=['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js','https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'];
 for(const url of hosts){try{
   await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.crossOrigin='anonymous';s.onload=()=>root.pdfjsLib?resolve():reject(Error('ライブラリの初期化に失敗'));s.onerror=()=>reject(Error('CDNに接続できません'));document.head.appendChild(s);});
   if(root.pdfjsLib)return root.pdfjsLib;
  }catch{}
 }
 throw Error('PDF解析プログラムを取得できません。接続を確認するか、楽天カードのCSV明細を選択してください。');
}
async function readPDF(file){
 if(typeof document==='undefined')throw Error('PDFはブラウザで読み込んでください');
 const data=new Uint8Array(await file.arrayBuffer());
 // Most Rakuten PDF statements made with SVF can be parsed without the internet.
 const local=await readRakutenSVF(data);if(local)return local;
 const lib=await loadPdfLibrary();
 // Disable workers to avoid worker CDN/version mismatches on PWA updates.
 let pdf;
 try{pdf=await lib.getDocument({data,disableWorker:true,useSystemFonts:true}).promise;}
 catch(e){throw Error('PDFを開けませんでした: '+(e.message||String(e)));}
 const lines=[];
 for(let p=1;p<=pdf.numPages;p++){const page=await pdf.getPage(p),content=await page.getTextContent(),groups=[];
  for(const item of content.items){const txt=String(item.str||'').trim();if(!txt)continue;const x=item.transform[4],y=item.transform[5];let group=groups.find(g=>Math.abs(g.y-y)<2.2);if(!group){group={y,items:[]};groups.push(group);}group.items.push({x,txt});}
  groups.sort((a,b)=>b.y-a.y);for(const g of groups){g.items.sort((a,b)=>a.x-b.x);lines.push(g.items.map(v=>v.txt).join(' '));}
 }
 const res=parsePDFLines(lines);res.pdfPages=pdf.numPages;res.reader='PDF.js文字抽出';return res;
}
async function readText(file){const data=await file.arrayBuffer();const bytes=new Uint8Array(data),isUtf8=(()=>{try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);return true;}catch{return false;}})();return new TextDecoder(isUtf8?'utf-8':'shift_jis').decode(bytes);}
async function parseFile(file){if(!file||file.size<=0)throw Error('空のファイルです');if(file.size>8*1024*1024)throw Error('ファイルの上限は8MBです');const name=file.name.toLowerCase();let result;if(name.endsWith('.pdf'))result=await readPDF(file);else if(name.endsWith('.csv')||name.endsWith('.tsv')||name.endsWith('.txt'))result=parseCardCSV(parseCSV(await readText(file)));else throw Error('対応形式はPDFとCSVです。Excelの明細はCSVとして保存してから選択してください。');
 const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());result.hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');result.filename=file.name;result.entries=result.entries.map((e,i)=>({...e,uid:result.hash.slice(0,20)+':'+i}));return result;}
function monthTotals(entries){const months={};for(const e of entries){const m=e.date.slice(0,7);const x=months[m]||(months[m]={month:m,spend:0,unknown:0,transactions:0,category:{},income:0,excluded:0});x.transactions++;const n=Number(e.amount)||0;if(e.category==='income')x.income+=n;else if(e.sourceType==='bank'){x.unknown++;}else if(expenseKeys.has(e.category)){x.spend+=n;x.category[e.category]=(x.category[e.category]||0)+n;}else if(e.category==='unknown')x.unknown++;else x.excluded+=n;}return Object.values(months).sort((a,b)=>b.month.localeCompare(a.month));}
root.MMYImporter={categories,labels,expenseKeys,excludedKeys,normalize,clean,dateFrom,amt,classify,parseCSV,parseCardCSV,parsePDFLines,readRakutenSVF,readText,parseFile,monthTotals};
if(typeof module!=='undefined'&&module.exports)module.exports=root.MMYImporter;
})(typeof window!=='undefined'?window:globalThis);
