const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { uid, cookie, outputDir, downloadDir, processedFile } = require('./config');
const quality = process.argv[6] || 'highest';
const HEADERS = { Cookie: cookie, 'User-Agent': 'Mozilla/5.0' };
const delay = ms => new Promise(r => setTimeout(r, ms));
const loadProcessed = () => fs.existsSync(processedFile) ? new Set(JSON.parse(fs.readFileSync(processedFile))) : new Set();
const saveProcessed = s => fs.writeFileSync(processedFile, JSON.stringify([...s], null,2));
if(!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir,{recursive:true});
if(!fs.existsSync(outputDir)) fs.mkdirSync(outputDir,{recursive:true});
(async()=>{
  const [,,keywords='',users='',startDate='',endDate=''] = process.argv;
  const processed = loadProcessed();
  const items = [];
  for(let p=1;;p++){
    let url=`https://weibo.com/fav?page=${p}`;
    let res; try{res=await axios.get(url,{headers:HEADERS});}catch(e){break;}
    let $=cheerio.load(res.data);
    let cards=$('.WB_cardwrap'); if(!cards.length)break;
    for(let el of cards.toArray()){
      let mid=$(el).attr('mid'); if(!mid||processed.has(mid))continue;
      let text=$(el).find('.WB_text').text()||$(el).text();
      let date=$(el).find('.WB_from a').attr('title');
      let user=$(el).find('.WB_info a').first().text();
      if(keywords&& !keywords.split(',').some(k=>text.includes(k)))continue;
      if(users&& !users.split(',').some(u=>user.includes(u)))continue;
      if(startDate&& new Date(date)<new Date(startDate))continue;
      if(endDate&& new Date(date)>new Date(endDate))continue;
      let avatar=$(el).find('.WB_face img').attr('src')||'';
      let imgs=[];$(el).find('img[src]').each((_,i)=>{let s=$(i).attr('src');if(s){let big=s.replace(/\/(thumb|small|middle|bmiddle|wap720)\//,'/large/');imgs.push(big);}});
      let vids=[];$(el).find('video,source').each((_,v)=>{let s=$(v).attr('src');if(s)vids.push(s+'?quality='+quality);});
      let mediaHTML='';
      for(let img of imgs){let fn=path.basename(img);let dst=path.join(downloadDir,fn);await axios.get(img,{headers:HEADERS,responseType:'arraybuffer'}).then(r=>fs.writeFileSync(dst,r.data));mediaHTML+=`<img src="../download/${fn}" style="max-width:320px;">`;}
      for(let v of vids){let fn=path.basename(v).split('?')[0];let dst=path.join(downloadDir,fn);await axios.get(v,{headers:HEADERS,responseType:'arraybuffer'}).then(r=>fs.writeFileSync(dst,r.data));mediaHTML+=`<video src="../download/${fn}" controls style="max-width:480px;"></video>`;}
      items.push({avatar,user,date,text,mediaHTML});processed.add(mid);await delay(300);
    }
  }
  saveProcessed(processed);
  let grouped={};for(let it of items){let d=it.date.slice(0,10);grouped[d]=grouped[d]||[];grouped[d].push(it);}  
  let html="<h1>微博收藏备份</h1>";
  for(let d in grouped){html+=`<h2>${d}</h2>`;for(let it of grouped[d])html+=`<div style="border-bottom:1px solid #ccc;padding:8px;"><img src="${it.avatar}" style="width:40px;height:40px;border-radius:20px;vertical-align:middle;margin-right:8px;"><strong>${it.user}</strong> <small>${it.date}</small><p>${it.text}</p>${it.mediaHTML}</div>`;}
  fs.writeFileSync(path.join(outputDir,'index.html'),`<!DOCTYPE html><html><head><meta charset="utf-8"><title>备份</title></head><body>${html}</body></html>`);
})();