// --- game.js ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// MOB SPRITE LOADER (color-key background removal)
window.MOB_SPRITES = window.MOB_SPRITES || {};
function loadMobSprite(key, url, opts){
    opts = opts || {};
    // support .ctx manifest files which can reference a PNG or embed a dataURL
    try{
        if(typeof url === 'string' && url.toLowerCase().endsWith('.ctx')){
            fetch(url).then(r=>r.json()).then(cfg=>{
                if(cfg && cfg.src){
                    // resolve to the referenced image
                    loadMobSprite(key, cfg.src, opts);
                }else if(cfg && cfg.dataURL){
                    const img = new Image(); img.crossOrigin = 'anonymous';
                    img.onload = ()=>{ try{ processSpriteImage(key, img, opts); }catch(e){ console.warn('sprite process failed', e); } };
                    img.onerror = ()=>{ console.warn('failed to load dataURL sprite', url); };
                    img.src = cfg.dataURL;
                }else{
                    console.warn('invalid .ctx manifest', url);
                }
            }).catch(e=>{ console.warn('failed to fetch .ctx', url, e); });
            return;
        }
    }catch(e){ /* ignore fetch/init errors and fall through to image load */ }

    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = ()=>{ processSpriteImage(key, img, opts); };
    img.onerror = ()=>{
        console.warn('failed to load sprite', url);
        try{
            // Attempt a simple fallback: try alternate extension once (png <-> svg)
            if(!opts._triedFallback){ opts._triedFallback = true;
                if(typeof url === 'string'){
                    if(url.toLowerCase().endsWith('.png')){ loadMobSprite(key, url.replace(/\.png$/i, '.svg'), opts); return; }
                    if(url.toLowerCase().endsWith('.svg')){ loadMobSprite(key, url.replace(/\.svg$/i, '.png'), opts); return; }
                }
            }
        }catch(e){}
        // Final fallback: create a tiny placeholder offscreen canvas so draw code still works
        try{
            const w = 48, h = 24;
            const oc = document.createElement('canvas'); oc.width = w; oc.height = h; const octx = oc.getContext('2d');
            octx.fillStyle = '#FF00FF'; octx.fillRect(0,0,w,h);
            octx.fillStyle = '#222'; octx.fillRect(4,4,w-8,h-8);
            window.MOB_SPRITES[key] = { img: null, canvas: oc, w: w, h: h, loaded: true, placeholder: true };
        }catch(e){ }
    };
    img.src = url;
}

// helper to turn a loaded Image into a color-keyed offscreen canvas entry
function processSpriteImage(key, img, opts){
    try{
        const w = img.width, h = img.height;
        const oc = document.createElement('canvas'); oc.width = w; oc.height = h;
        let octx;
        try{ octx = oc.getContext('2d', { willReadFrequently: true }); }catch(e){ octx = oc.getContext('2d'); }
        octx.drawImage(img,0,0);
        try{
            const id = octx.getImageData(0,0,1,1).data; // top-left pixel as background
            const br = id[0], bg = id[1], bb = id[2];
            const data = octx.getImageData(0,0,w,h);
            for(let i=0;i<data.data.length;i+=4){
                const r = data.data[i], g = data.data[i+1], b = data.data[i+2];
                const tol = (opts && opts.tolerance) ? opts.tolerance : 32;
                if(Math.abs(r-br)<tol && Math.abs(g-bg)<tol && Math.abs(b-bb)<tol){ data.data[i+3] = 0; }
            }
            octx.putImageData(data,0,0);
        }catch(e){}
        window.MOB_SPRITES[key] = { img, canvas: oc, w: w, h: h, loaded: true };
    }catch(e){ console.warn('sprite load failed', e); }
}

function drawHornet(ctx, x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // ---- BODY ----
    ctx.fillStyle = '#f6d365';
    ctx.strokeStyle = '#e0b84f';
    ctx.lineWidth = 3;

    // Body path
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // ---- STRIPES UNDER BODY (CLIPPED) ----
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#2b2b2b';
    [-10, 0, 10].forEach(px => {
        ctx.beginPath();
        ctx.rect(px - 3, -14, 6, 28); // slightly taller so it fully fills body
        ctx.fill();
    });

    ctx.restore();

    // ---- STINGER ----
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.moveTo(22, -4);
    ctx.lineTo(36, 0);
    ctx.lineTo(22, 4);
    ctx.closePath();
    ctx.fill();

    // ---- ANTENNAS (moved closer to head / more centered) ----
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 1.5;

    // left antenna (upper)
    ctx.beginPath();
    ctx.moveTo(-18, -6);
    ctx.quadraticCurveTo(-26, -18, -36, -14);
    ctx.stroke();

    // left antenna (lower)
    ctx.beginPath();
    ctx.moveTo(-18, 6);
    ctx.quadraticCurveTo(-26, 18, -36, 14);
    ctx.stroke();

    ctx.restore();
}

function drawHornetMissile(ctx, x, y, rotation = 0, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);

    // ---- MISSILE BODY (black tall triangle) ----
    ctx.fillStyle = '#111'; // dark/black body
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.2;

    const nose = 18;
    const back = 6;
    const height = 10; // half-height
    ctx.beginPath();
    ctx.moveTo(nose, 0);
    ctx.lineTo(-back, -height);
    ctx.lineTo(-back, height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}
// try loading a default mandible sprite - prefer SVG (transparent via magenta key).
// If the SVG fails, the loader's onerror will attempt a PNG fallback automatically.
try{ loadMobSprite('mandible', 'assets/mandible.svg', { tolerance: 40 }); }catch(e){}

// Prefer hornet SVG first (available in assets). PNG fallback is handled by the loader on error.
try{ loadMobSprite('hornet', 'assets/hornet.svg', { tolerance: 40 }); }catch(e){}


// Run equip hooks for all currently equipped items (best-effort idempotent sync)
function runEquipHooks(){
    try{
        for(let i=0;i<10;i++){
            if(player.equipped[i] && player.equipped[i].type) applyOnEquip(i, false);
            if(player.swap[i] && player.swap[i].type) applyOnEquip(i, true);
        }
    }catch(e){}
}

let CENTER_X = canvas.width/2;
let CENTER_Y = canvas.height/2;
let viewWidth = canvas.width;
let viewHeight = canvas.height;

/* =========================
   CANVAS SCALE & COLLISION FIX
   ========================= */
// FORCE 1:1 coordinate system (NO CSS scaling)
function resizeCanvas(){
    const scale = window.devicePixelRatio || 1;
    // Match canvas resolution to displayed size
    let rect = canvas.getBoundingClientRect();
    // If the canvas has no layout size (hidden or not yet in DOM), fallback to window size
    if(!rect.width || !rect.height){
        rect = { width: window.innerWidth || 800, height: window.innerHeight || 600, left: 0, top: 0 };
    }
    canvas.width  = Math.floor(rect.width  * scale);
    canvas.height = Math.floor(rect.height * scale);
    // apply transform so drawing uses CSS pixels
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // update center variables (in CSS pixels)
    CENTER_X = rect.width/2;
    CENTER_Y = rect.height/2;
    viewWidth = rect.width;
    viewHeight = rect.height;
    // ensure the element's CSS size matches the logical view
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
}
// Run once and on resize
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let keys = {};
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

// collision debug toggle
window.COLLISION_DEBUG = false;
// verbose collision logs (disable to avoid console spam)
window.COLLISION_LOGS = false;

// small throttled logger to avoid console spam for repeated collision messages
window._lastLogTimes = window._lastLogTimes || {};
function throttleLog(key, fn, minMs = 250){
    try{
        const now = Date.now();
        const last = window._lastLogTimes[key] || 0;
        if(now - last > minMs){ fn(); window._lastLogTimes[key] = now; }
    }catch(e){ /* ignore logging failures */ }
}

// control mode: 'keyboard' or 'mouse'
let controlMode = localStorage.getItem('controlMode') || 'keyboard';
window.setControlMode = function(mode){ controlMode = mode; localStorage.setItem('controlMode', mode); };

// show hitboxes toggle
let showHitboxes = (localStorage.getItem('showHitboxes') === '1');
window.setShowHitboxes = function(v){ showHitboxes = !!v; localStorage.setItem('showHitboxes', showHitboxes ? '1' : '0'); };

// Keyboard toggles for UI (will call DOM modal toggles)
document.addEventListener("keydown", e => {
    if(typeof e.key === 'string'){
        const k = e.key.toLowerCase();
        if(k === 'x' && window.toggleInventory) window.toggleInventory();
        if(k === 'c' && window.toggleCraft) window.toggleCraft();
        if(k === 'v' && window.toggleSeen) window.toggleSeen();
    }
});

// --- PLAYER ---
let player = { x:CENTER_X, y:CENTER_Y, radius:15, speed:4, health:100, maxHealth:100, petals:10, petalsDistance:30, inventory:[], equipped:Array(10).fill(null), cooldowns:{}, mass: 10, vx:0, vy:0 };
// separate swap row storage (user-visible second row)
player.swap = Array(10).fill(null);
// godmode flag
player.godmode = false;
// store default and expanded distances for smooth transitions
player.petalsDistanceDefault = 30;
player.petalsDistanceExpanded = 80;
// track seen mobs and allow inventory stacking by type+rarity
player.seenMobs = {};
let petals = [];
function refreshPetals(){
    petals = [];
    for(let i=0;i<player.petals;i++){
        petals.push({angle:(Math.PI*2/player.petals)*i,radius:6, slotIndex: i});
    }
}

// Passive effects for equipped petals (per-slot cooldowns)
function applyPassiveEffects(){
    const now = Date.now();
    for(let i=0;i<player.equipped.length;i++){
        const slot = player.equipped[i]; if(!slot) continue;
        const type = slot.type;
        const key = 'passive_' + i;
        if(type === 'Rose'){
            // small heal every 1000ms
            if(!player.cooldowns[key] || now - player.cooldowns[key] >= 1000){ player.health = Math.min(player.maxHealth, player.health + 2); player.cooldowns[key] = now; }
        } else if(type === 'Pollen'){
            // aura damage to nearby mobs every 600ms
            if(!player.cooldowns[key] || now - player.cooldowns[key] >= 600){
                mobs.forEach(mob=>{ const d=Math.hypot(mob.x-player.x,mob.y-player.y); if(d < player.petalsDistance+20) mob.health -= 2; });
                player.cooldowns[key] = now;
            }
        }
    }
}
refreshPetals();
// track last time player was hit for i-frames
player.lastHitTime = 0;

// --- GAME STATE ---
let mobs=[];
let drops=[];
let projectiles=[];
let currentWave=1;
let isDead=false;
let spaceHeld = false;
let mouseHeld = false;
let animationId = null;
let nextEquipIndex = 0;

// ---- GLOBAL COOLDOWNS ----
const PETAL_HIT_COOLDOWN = 350; // ms between petal hits per mob
const PLAYER_IFRAME_TIME = 500; // ms of invincibility after hit

// --- ITEMS ---
const ITEM_TYPES={
    Rose:{name:"Rose",heal:15,cooldown:1000,useTime:1000, mass:0.2},
    Light:{name:"Light",damage:5,cooldown:700,useTime:700, mass:0.3},
    Stinger:{name:"Stinger",damage:20,cooldown:5000,useTime:5000, mass:0.7},
    Pollen:{name:"Pollen",damage:3,cooldown:1200,useTime:300, mass:0.25},
    Missile:{name:"Missile",damage:10,cooldown:1200,useTime:400, mass:1.0}
};

function spawnDrop(name,x,y, rarity){
    rarity = rarity || 'Common';
    const icon = getPetalIconURL(name, rarity, 40);
    const drop = { x, y, radius:18, type: name, stack: 1, rarity: rarity, iconURL: icon, _imgLoaded: false, _img: null };
    // lazy image cache
    try{
        const img = new Image(); img.onload = ()=>{ drop._imgLoaded = true; drop._img = img; };
        img.src = icon;
    }catch(e){}
    drops.push(drop);
}

function spawnMobDrops(mob){
    // data-driven drops if CONFIG available
    try{
        if(typeof window !== 'undefined' && window.ZEPHYRAX_CONFIG){
            const tpl = window.ZEPHYRAX_CONFIG.mobs.find(m=>m.id===mob.type || m.name===mob.name);
            if(tpl && tpl.drops && tpl.drops.length>0){
                tpl.drops.forEach((d,idx)=> spawnDrop(d, mob.x + (idx*22) - (tpl.drops.length*10), mob.y + (idx*8), mob.rarity || mob.rarityName || 'Common'));
                return;
            }
        }
    }catch(e){}
    // fallback
    switch(mob.type){
        case "Ladybug": spawnDrop("Rose",mob.x,mob.y); spawnDrop("Light",mob.x+15,mob.y+15); break;
        case "Bee": spawnDrop("Stinger",mob.x,mob.y); spawnDrop("Pollen",mob.x+15,mob.y+15); break;
        case "Hornet": spawnDrop("Missile",mob.x,mob.y); break;
    }
}

// helper to add inventory entries (type,rarity,stack)
function addToInventory(type,rarity,amount){
    amount = amount || 1;
    let found = player.inventory.find(it=>it.type===type && it.rarity===rarity);
    if(found) found.stack += amount; else player.inventory.push({type,rarity,stack:amount});
    try{ savePlayerState(); }catch(e){}
}

// ----- Petal definitions loader and equip hooks -----
window.PETAL_DEFS = {};
window.PETAL_HOOKS = window.PETAL_HOOKS || {};
function loadPetalDefs(){
    // try fetching JSON definitions; if failure, fallback to empty
    fetch('data/petals.json').then(r=>r.json()).then(list=>{
        list.forEach(p=>{ window.PETAL_DEFS[p.name || p.id] = p; window.PETAL_DEFS[p.id || p.name] = p; });
        // also index by lowercase
        list.forEach(p=>{ if(p.name) window.PETAL_DEFS[p.name.toLowerCase()] = p; if(p.id) window.PETAL_DEFS[p.id.toLowerCase()] = p; });
    }).catch(()=>{
        // ignore failures; game will still function with textual names
    });
    // Also seed from embedded config if present (runs immediately)
    try{
        if(window.ZEPHYRAX_CONFIG && Array.isArray(window.ZEPHYRAX_CONFIG.petals)){
            window.ZEPHYL_PETALS = window.ZEPHYRAX_CONFIG.petals;
            window.ZEPHYRAX_CONFIG.petals.forEach(p=>{
                if(!p) return;
                const keyName = p.name || p.id;
                if(keyName){ window.PETAL_DEFS[keyName] = p; window.PETAL_DEFS[(p.id||keyName)] = p; window.PETAL_DEFS[keyName.toLowerCase()] = p; if(p.id) window.PETAL_DEFS[p.id.toLowerCase()] = p; }
            });
        }
    }catch(e){}
}
loadPetalDefs();

// Simple SVG icon generator for petals (data URL cache)
const PETAL_ICON_CACHE = {};
function getPetalIconURL(type, rarity, size=40){
    const key = `${type}|${rarity}|${size}`;
    if(PETAL_ICON_CACHE[key]) return PETAL_ICON_CACHE[key];
    const def = window.PETAL_DEFS[type] || window.PETAL_DEFS[(type||'').toLowerCase()] || {};
    const fill = def.color || RARITY_COLOR[rarity] || '#d0d0d0';
    const stroke = '#111';
    const t = (type||'').toLowerCase();
    let shape = 'circle';
    if(t.includes('leaf') || t.includes('leafy') || t.includes('peas') || t.includes('clover')) shape = 'leaf';
    else if(t.includes('stinger') || t.includes('thorn') || t.includes('spike')) shape = 'spike';
    else if(t.includes('honey') || t.includes('wax') || t.includes('bee')) shape = 'hex';
    else if(t.includes('glass') || t.includes('rock') || t.includes('stone')) shape = 'diamond';
    else if(t.includes('rose') || t.includes('flower') || t.includes('basil')) shape = 'flower';
    else if(t.includes('light') || t.includes('glow')) shape = 'glow';

    const w = size, h = size;
    let svg = '';
    if(shape === 'circle' || shape === 'glow'){
        const g = shape==='glow' ? `<radialGradient id='g'><stop offset='0%' stop-color='${fill}' stop-opacity='1'/><stop offset='80%' stop-color='${fill}' stop-opacity='0.55'/></radialGradient>` : '';
        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${g}<rect width='100%' height='100%' fill='transparent'/>${shape==='glow'?`<circle cx='${w/2}' cy='${h/2}' r='${w*0.38}' fill='url(#g)' stroke='${stroke}' stroke-width='1'/>`:`<circle cx='${w/2}' cy='${h/2}' r='${w*0.36}' fill='${fill}' stroke='${stroke}' stroke-width='1'/>`}<text x='50%' y='55%' font-size='12' text-anchor='middle' fill='#ffffff' font-family='Arial' font-weight='700'>${(type||'')[0]||''}</text></svg>`;
    } else if(shape === 'hex'){
        const cx=w/2, cy=h/2, r=w*0.34; const pts=[]; for(let i=0;i<6;i++){ const a = Math.PI/3 * i - Math.PI/6; pts.push((cx+Math.cos(a)*r).toFixed(2)+','+(cy+Math.sin(a)*r).toFixed(2)); }
        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><polygon points='${pts.join(' ')}' fill='${fill}' stroke='${stroke}' stroke-width='1'/><text x='50%' y='58%' font-size='12' text-anchor='middle' fill='#fff' font-family='Arial' font-weight='700'>${(type||'')[0]||''}</text></svg>`;
    } else if(shape === 'diamond'){
        const pts = `${w/2},${h*0.15} ${w*0.85},${h/2} ${w/2},${h*0.85} ${w*0.15},${h/2}`;
        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><polygon points='${pts}' fill='${fill}' stroke='${stroke}' stroke-width='1'/></svg>`;
    } else if(shape === 'leaf'){
        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><path d='M${w*0.2},${h*0.6} C${w*0.25},${h*0.2} ${w*0.6},${h*0.2} ${w*0.8},${h*0.35} C${w*0.65},${h*0.65} ${w*0.35},${h*0.9} ${w*0.2},${h*0.6} Z' fill='${fill}' stroke='${stroke}' stroke-width='1'/></svg>`;
    } else if(shape === 'flower'){
        // simple 5-petal flower
        const cx=w/2, cy=h/2; svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>`;
        for(let i=0;i<5;i++){ const a = (Math.PI*2/5)*i; const px=cx+Math.cos(a)*(w*0.26); const py=cy+Math.sin(a)*(h*0.26); svg += `<ellipse cx='${px}' cy='${py}' rx='${w*0.16}' ry='${h*0.12}' fill='${fill}' stroke='${stroke}' stroke-width='0.6' transform='rotate(${(a*180/Math.PI)} ${px} ${py})'/>`; }
        svg += `<circle cx='${cx}' cy='${cy}' r='${w*0.12}' fill='#fff'/>`;
        svg += `</svg>`;
    } else if(shape === 'spike'){
        // star-like
        const cx=w/2, cy=h/2; let pts=''; for(let i=0;i<8;i++){ const r = (i%2==0)?w*0.38:w*0.16; const a = (Math.PI*2/8)*i - Math.PI/2; pts += (cx+Math.cos(a)*r).toFixed(2)+','+(cy+Math.sin(a)*r).toFixed(2)+' '; }
        svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><polygon points='${pts.trim()}' fill='${fill}' stroke='${stroke}' stroke-width='0.8'/></svg>`;
    }
    const data = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    PETAL_ICON_CACHE[key] = data;
    return data;
}

// Create a floating tooltip element for petal stats/descriptions
function ensurePetalTooltip(){
    if(window._petalTooltipCreated) return;
    window._petalTooltipCreated = true;
    function make(){
        const el = document.createElement('div');
        el.id = 'petalTooltip';
        el.style.position = 'fixed';
        el.style.pointerEvents = 'none';
        el.style.zIndex = 99999;
        el.style.padding = '8px 10px';
        el.style.background = 'rgba(12,12,16,0.94)';
        el.style.color = 'white';
        el.style.borderRadius = '8px';
        el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
        el.style.fontSize = '13px';
        el.style.lineHeight = '1.2';
        el.style.maxWidth = '320px';
        el.style.display = 'none';
        document.body.appendChild(el);
        window._petalTooltipEl = el;
    }
    if(document.body) make(); else document.addEventListener('DOMContentLoaded', make);

    let currentTarget = null;
    document.addEventListener('pointerover', function(ev){
        try{
            const t = ev.target.closest && ev.target.closest('[data-type]');
            if(!t) return;
            const type = t.dataset.type;
            if(!type) return;
            currentTarget = t;
            const rarity = t.dataset.rarity || 'Common';
            const def = window.PETAL_DEFS && (window.PETAL_DEFS[type] || window.PETAL_DEFS[type.toLowerCase()]) ? (window.PETAL_DEFS[type] || window.PETAL_DEFS[type.toLowerCase()]) : null;
            const title = def && (def.name || def.id) ? (def.name || def.id) : (type || 'Unknown');
            const desc = def && def.description ? def.description : '';
            const bp = def && (def.basePower || def.power) ? (`<div style="margin-top:6px;color:#ddd;font-size:12px">Power: <strong style='color:#fff'>${def.basePower || def.power}</strong></div>`) : '';
            const typ = def && def.type ? (`<div style="margin-top:4px;color:#ccc;font-size:12px">Type: ${def.type}</div>`) : '';
            const rarityColor = RARITY_COLOR[rarity] || '#ddd';
            const html = `<div style="font-weight:700;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between"><div>${title}</div><div style='font-size:11px;padding:2px 6px;border-radius:6px;background:${rarityColor};color:${contrastColor(rarityColor)}'>${rarity}</div></div><div style="color:#ddd;font-size:13px">${desc}</div>${typ}${bp}`;
            if(window._petalTooltipEl){ window._petalTooltipEl.innerHTML = html; window._petalTooltipEl.style.display = 'block'; }
        }catch(e){}
    });

    document.addEventListener('pointermove', function(ev){
        try{
            if(!window._petalTooltipEl || !currentTarget) return;
            const pad = 12;
            let x = ev.clientX + pad;
            let y = ev.clientY + pad;
            const w = window._petalTooltipEl.offsetWidth;
            const h = window._petalTooltipEl.offsetHeight;
            if(x + w > window.innerWidth) x = Math.max(8, ev.clientX - w - pad);
            if(y + h > window.innerHeight) y = Math.max(8, ev.clientY - h - pad);
            window._petalTooltipEl.style.left = x + 'px'; window._petalTooltipEl.style.top = y + 'px';
        }catch(e){}
    });

    document.addEventListener('pointerout', function(ev){
        try{
            const left = ev.target.closest && ev.target.closest('[data-type]');
            if(!left) return;
            if(window._petalTooltipEl){ window._petalTooltipEl.style.display = 'none'; }
            currentTarget = null;
        }catch(e){}
    });
}
ensurePetalTooltip();

function applyOnEquip(slotIndex, isSwap){
    const arr = isSwap ? player.swap : player.equipped;
    const s = arr[slotIndex];
    if(!s || !s.type) return;
    const def = window.PETAL_DEFS[s.type] || window.PETAL_DEFS[(s.type||'').toLowerCase()];
    if(def && def.onEquip && typeof window.PETAL_HOOKS[def.onEquip] === 'function'){
        try{ window.PETAL_HOOKS[def.onEquip](slotIndex, s); }catch(e){}
    }
}

function applyOnUnequip(slotIndex, isSwap){
    const arr = isSwap ? player.swap : player.equipped;
    const s = arr[slotIndex];
    if(!s) return;
    const def = window.PETAL_DEFS[s.type] || window.PETAL_DEFS[(s.type||'').toLowerCase()];
    if(def && def.onUnequip && typeof window.PETAL_HOOKS[def.onUnequip] === 'function'){
        try{ window.PETAL_HOOKS[def.onUnequip](slotIndex, s); }catch(e){}
    }
}

function savePlayerState(){
    try{
        const state = { inventory: player.inventory, equipped: player.equipped, swap: player.swap };
        localStorage.setItem('zephyrax_player_state', JSON.stringify(state));
    }catch(e){}
}
function loadPlayerState(){
    try{
        const raw = localStorage.getItem('zephyrax_player_state');
        if(!raw) return;
        const state = JSON.parse(raw);
        if(state.inventory && Array.isArray(state.inventory)) player.inventory = state.inventory;
        if(state.equipped && Array.isArray(state.equipped)) player.equipped = state.equipped;
        if(state.swap && Array.isArray(state.swap)) player.swap = state.swap;
    }catch(e){}
}
loadPlayerState();

// The rest of the game code follows (spawnWave, projectiles, movement, rendering, gameLoop, startGame)
// For brevity the rest is already present earlier — ensure file ends cleanly.

// Update the viewport hotbar DOM to reflect `player.equipped` and `player.swap`.
function updateHotbarUI(){
    const root = document.getElementById('HOTBAR_ROOT');
    if(!root) return;
    const main = root.querySelector('#hotbarMain');
    const swap = root.querySelector('#hotbarSwap');
    if(main){
        for(let i=0;i<10;i++){
            const el = main.children[i];
            const s = player.equipped[i];
            if(!el) continue;
            el.innerHTML = '';
            if(s && s.type && !s.empty){
                const def = (window.PETAL_DEFS && (window.PETAL_DEFS[s.type] || window.PETAL_DEFS[(s.type||'').toLowerCase()])) || null;
                const label = def && (def.name||def.id) ? (def.name||def.id) : s.type;
                    const icon = document.createElement('img'); icon.src = getPetalIconURL(s.type, s.rarity||'Common', 28); icon.style.width='28px'; icon.style.height='28px'; icon.style.display='block'; icon.style.margin='2px auto 0'; icon.style.borderRadius='6px';
                    try{ icon.style.background = RARITY_COLOR[s.rarity||'Common'] || '#ddd'; }catch(e){}
                    el.appendChild(icon);
                    const lbl = document.createElement('div'); lbl.style.fontSize='11px'; lbl.style.textAlign='center'; lbl.textContent = label; el.appendChild(lbl);
                    el.title = def && def.description ? `${label} - ${def.description}` : `${s.type} (${s.rarity||'Common'})`;
                    // expose data attributes for tooltip delegation
                    try{ if(def && (def.id || def.name)) el.dataset.type = def.id || def.name; else el.dataset.type = s.type; el.dataset.rarity = s.rarity || 'Common'; }catch(e){}
                // color by rarity when available
                try{ const rarityColors = { Common:'#d8f4d8', Unusual:'#fff7c2', Rare:'#2b4b9a', Epic:'#cdb3ff', Legendary:'#ffb3b3' }; el.style.borderColor = rarityColors[s.rarity||'Common'] || ''; }catch(e){}
            }
        }
    }
    if(swap){
        for(let i=0;i<10;i++){
            const el = swap.children[i];
            const s = player.swap[i];
            if(!el) continue;
            el.innerHTML = '';
            if(s && s.type && !s.empty){
                const def = (window.PETAL_DEFS && (window.PETAL_DEFS[s.type] || window.PETAL_DEFS[(s.type||'').toLowerCase()])) || null;
                const label = def && (def.name||def.id) ? (def.name||def.id) : s.type;
                const icon = document.createElement('img'); icon.src = getPetalIconURL(s.type, s.rarity||'Common', 24); icon.style.width='24px'; icon.style.height='24px'; icon.style.display='block'; icon.style.margin='2px auto 0'; icon.style.borderRadius='6px';
                try{ icon.style.background = RARITY_COLOR[s.rarity||'Common'] || '#ddd'; }catch(e){}
                el.appendChild(icon);
                const lbl = document.createElement('div'); lbl.style.fontSize='10px'; lbl.style.textAlign='center'; lbl.textContent = label; el.appendChild(lbl);
                el.title = def && def.description ? `${label} - ${def.description}` : `${s.type} (${s.rarity||'Common'})`;
                try{ if(def && (def.id || def.name)) el.dataset.type = def.id || def.name; else el.dataset.type = s.type; el.dataset.rarity = s.rarity || 'Common'; }catch(e){}
                try{ const rarityColors = { Common:'#d8f4d8', Unusual:'#fff7c2', Rare:'#2b4b9a', Epic:'#cdb3ff', Legendary:'#ffb3b3' }; el.style.borderColor = rarityColors[s.rarity||'Common'] || ''; }catch(e){}
            }
        }
    }
}

// Keybinds: pressing 1-9 or 0 will swap the main <-> swap slot at that index
document.addEventListener('keydown', function(ev){
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    const key = ev.key;
    if(!key) return;
    let idx = null;
    if(key === '0') idx = 10; else if(/^[1-9]$/.test(key)) idx = parseInt(key,10);
    if(!idx) return;
    // 1-based to 0-based index
    const i = idx - 1;
    // swap main <-> swap
    const a = player.equipped[i];
    const b = player.swap[i];
    player.equipped[i] = b;
    player.swap[i] = a;
    try{ savePlayerState(); }catch(e){}
    refreshPetals(); updateHotbarUI(); if(window.renderInventory) window.renderInventory();
    try{ if(typeof runEquipHooks === 'function') runEquipHooks(); }catch(e){}
});

// Attach drag/drop & click handlers to the hotbar when it appears in the DOM.
function attachHotbarListeners(){
    const root = document.getElementById('HOTBAR_ROOT');
    if(!root) return;
    // ensure we only attach once
    if(root._listenersAttached) return; root._listenersAttached = true;

    root.addEventListener('dragover', function(ev){ ev.preventDefault(); });
    root.addEventListener('drop', function(ev){
        ev.preventDefault();
        try{
            const txt = ev.dataTransfer.getData('text/plain');
            if(!txt) return;
            const payload = JSON.parse(txt);
            const slot = ev.target.closest('.hotbar-slot');
            if(!slot) return;
            const isSwap = slot.hasAttribute('data-hot-swap');
            const idx = parseInt(isSwap ? slot.getAttribute('data-hot-swap') : slot.getAttribute('data-hot'), 10) - 1;
            if(Number.isNaN(idx) || idx < 0) return;

            // If dragging from another hotbar slot -> swap/move between slots
            if(payload && payload.fromHot){
                const srcIndex = payload.index;
                const srcIsSwap = !!payload.isSwap;
                if(typeof srcIndex !== 'number') return;
                // get references
                const srcArr = srcIsSwap ? player.swap : player.equipped;
                const dstArr = isSwap ? player.swap : player.equipped;
                // perform swap
                const tmp = dstArr[idx];
                dstArr[idx] = srcArr[srcIndex];
                srcArr[srcIndex] = tmp;
                try{ savePlayerState(); }catch(e){}
                refreshPetals(); updateHotbarUI(); if(window.renderInventory) window.renderInventory();
                try{ if(typeof runEquipHooks === 'function') runEquipHooks(); }catch(e){}
                return;
            }

            // Otherwise, payload is an inventory item -> equip into target
            const invIdx = player.inventory.findIndex(it=> it.type === payload.type && (it.rarity||'Common') === (payload.rarity||'Common'));
            if(invIdx === -1) return;
            if(isSwap){ player.swap[idx] = { type: payload.type, rarity: payload.rarity||'Common', stack: 1, empty:false }; }
            else { player.equipped[idx] = { type: payload.type, rarity: payload.rarity||'Common', stack: 1, empty:false }; }
            player.inventory[invIdx].stack--; if(player.inventory[invIdx].stack <= 0) player.inventory.splice(invIdx,1);
            try{ savePlayerState(); }catch(e){}
            try{ applyOnEquip(idx, isSwap); }catch(e){}
            refreshPetals(); updateHotbarUI(); if(window.renderInventory) window.renderInventory();
            try{ if(typeof runEquipHooks === 'function') runEquipHooks(); }catch(e){}
        }catch(e){}
    });

    // ensure each hotbar-slot is draggable and sends a source payload when dragged
    const slotEls = Array.from(root.querySelectorAll('.hotbar-slot'));
    slotEls.forEach(slot => {
        try{ slot.draggable = true; }catch(e){}
        slot.addEventListener('dragstart', function(ev){
            const isSwap = slot.hasAttribute('data-hot-swap');
            const idx = parseInt(isSwap ? slot.getAttribute('data-hot-swap') : slot.getAttribute('data-hot'), 10) - 1;
            if(Number.isNaN(idx) || idx < 0) return;
            const payload = { fromHot: true, index: idx, isSwap: !!isSwap };
            try{ ev.dataTransfer.setData('text/plain', JSON.stringify(payload)); }catch(e){}
        });
    });

    // click handler on hotbar slots: swap the clicked slot with its paired slot (main <-> swap)
    root.addEventListener('click', function(ev){
        const slot = ev.target.closest('.hotbar-slot');
        if(!slot) return;
        const isSwap = slot.hasAttribute('data-hot-swap');
        const idx = parseInt(isSwap ? slot.getAttribute('data-hot-swap') : slot.getAttribute('data-hot'), 10) - 1;
        if(Number.isNaN(idx) || idx < 0) return;

        // determine source and destination arrays
        const srcArr = isSwap ? player.swap : player.equipped;
        const dstArr = isSwap ? player.equipped : player.swap; // paired slot

        // perform swap/move: always swap values (can be null)
        const tmp = dstArr[idx];
        dstArr[idx] = srcArr[idx];
        srcArr[idx] = tmp;

        try{ savePlayerState(); }catch(e){}
        refreshPetals(); updateHotbarUI(); if(window.renderInventory) window.renderInventory();
        try{ if(typeof runEquipHooks === 'function') runEquipHooks(); }catch(e){}
    });
}

// poll for hotbar root and attach listeners (runs until attached)
const _hotbarPoll = setInterval(()=>{ try{ attachHotbarListeners(); updateHotbarUI(); if(document.getElementById('HOTBAR_ROOT') && document.getElementById('HOTBAR_ROOT')._listenersAttached){ clearInterval(_hotbarPoll); } }catch(e){} }, 200);

// craft UI removed: replaced by simple `#craftPanel` in index.html

// doCraftAction removed

// Update preview, chance display, and craft button enabled state
// updateCraftUI removed

// small transient toast inside craft modal
// showCraftToast removed

function renderSeen(){
    const out = document.getElementById('seenContent'); if(!out) return; out.innerHTML='';
    const keys = Object.keys(player.seenMobs||{});
    if(keys.length===0) out.innerHTML = '<div style="opacity:0.6">No mobs yet</div>';
    keys.forEach(k=>{
        const m = player.seenMobs[k];
        const el = document.createElement('div'); el.style.border='1px solid #ddd'; el.style.padding='6px'; el.style.borderRadius='6px'; el.style.background='#fff';
        el.innerHTML = `<div style="font-weight:700">${m.name}</div><div style="font-size:12px">Killed: ${m.count}</div>`;
        out.appendChild(el);
    });
}

// Inventory helpers used by crafting
function getInventoryCount(type, rarity){ rarity = rarity || 'Common'; let c = 0; player.inventory.forEach(it=>{ if(it.type===type && (it.rarity||'Common')===rarity) c += (it.stack||1); }); return c; }
function removeFromInventory(type, rarity, amount){ rarity = rarity || 'Common'; let toRemove = amount; for(let i=player.inventory.length-1;i>=0 && toRemove>0;i--){ const it = player.inventory[i]; if(it.type===type && (it.rarity||'Common')===rarity){ const take = Math.min(it.stack||1, toRemove); it.stack = (it.stack||1) - take; toRemove -= take; if(it.stack <= 0) player.inventory.splice(i,1); } } return amount - toRemove; }
function removeFromInventory(type, rarity, amount){ rarity = rarity || 'Common'; let toRemove = amount; for(let i=player.inventory.length-1;i>=0 && toRemove>0;i--){ const it = player.inventory[i]; if(it.type===type && (it.rarity||'Common')===rarity){ const take = Math.min(it.stack||1, toRemove); it.stack = (it.stack||1) - take; toRemove -= take; if(it.stack <= 0) player.inventory.splice(i,1); } } try{ savePlayerState(); }catch(e){} return amount - toRemove; }
function nextRarity(r){ const idx = RARITY_NAMES.indexOf(r||'Common'); if(idx<0) return null; return RARITY_NAMES[Math.min(RARITY_NAMES.length-1, idx+1)]; }

// expose inventory/seen renderers
// Minimal inventory renderer to avoid runtime errors when UI calls it early.
function renderInventory(){
    try{
        const grid = document.getElementById('invGrid');
        if(!grid) return;
        grid.innerHTML = '';
        if(!player.inventory || player.inventory.length === 0){ grid.innerHTML = '<div style="opacity:0.6">No items</div>'; return; }
        player.inventory.forEach((it, idx)=>{
            const d = document.createElement('div'); d.className = 'inv-item';
            d.style.display = 'flex'; d.style.flexDirection = 'column'; d.style.alignItems = 'center'; d.style.justifyContent = 'center';
            const icon = document.createElement('img');
            try{ icon.src = getPetalIconURL(it.type, it.rarity || 'Common', 34); }catch(e){ icon.src = ''; }
            icon.style.width = '34px'; icon.style.height = '34px'; icon.style.borderRadius = '6px';
            const lbl = document.createElement('div'); lbl.style.fontSize = '11px'; lbl.style.marginTop = '4px'; lbl.textContent = `${it.type} x${it.stack||1}`;
            d.appendChild(icon); d.appendChild(lbl);
            d.dataset.type = it.type; d.dataset.rarity = it.rarity || 'Common';
            d.addEventListener('click', ()=>{
                // quick-equip into first empty slot
                const empty = player.equipped.findIndex(s=>!s);
                if(empty !== -1){ player.equipped[empty] = { type: it.type, rarity: it.rarity || 'Common', stack: 1 }; it.stack = (it.stack||1) - 1; if(it.stack <= 0) player.inventory.splice(player.inventory.indexOf(it),1); try{ savePlayerState(); }catch(e){} refreshPetals(); if(window.updateHotbarUI) updateHotbarUI(); renderInventory(); }
            });
            grid.appendChild(d);
        });
    }catch(e){ console.warn('renderInventory failed', e); }
}
window.renderInventory = renderInventory;
window.renderSeen = renderSeen;
// Toggle the simple craft panel (replaces previous craft modal)
window.toggleCraft = function(){ const el = document.getElementById('craftPanel'); if(!el) return; el.hidden = !el.hidden; };

function onDeath(){
    // show main screen so player can equip/unequip before restarting
    const ss = document.getElementById('startScreen'); if(ss) ss.style.display='flex';
    // hide canvas to show main menu clearly
    if(canvas) canvas.style.display = 'none';
    // allow opening inventory/craft/seen while dead (toggles already available)
    if(window.renderInventory) window.renderInventory();
    // show HUD when back on main/start screen
    try{ setHUDVisible(true); }catch(e){}
}

// spacebar / mouse hold to expand petals
document.addEventListener('keydown', e=>{ if(e.code === 'Space') spaceHeld = true; });
document.addEventListener('keyup', e=>{ if(e.code === 'Space') spaceHeld = false; });
document.addEventListener('mousedown', e=>{ if(e.button === 0) mouseHeld = true; });
document.addEventListener('mouseup', e=>{ if(e.button === 0) mouseHeld = false; });

// wire modal toggles to render
window.toggleInventory = function(){ const el=document.getElementById('inventoryModal'); if(!el) return; const vis = (el.style.display==='block'); if(!vis) renderInventory(); el.style.display = vis?'none':'block'; };
window.toggleCraft = function(){ const el=document.getElementById('craftModal'); if(!el) return; const vis = (el.style.display==='block'); if(!vis) renderCraft(); el.style.display = vis?'none':'block'; };
window.toggleSeen = function(){ const el=document.getElementById('seenModal'); if(!el) return; const vis = (el.style.display==='block'); if(!vis) renderSeen(); el.style.display = vis?'none':'block'; };

// Show/hide HUD (settings and quick buttons) when entering/exiting gameplay
function setHUDVisible(visible){
    const selectors = [
        '#settingsBtn','#settingsButton','#topSettingsBtn','.settings','.settings-btn','.gear-button',
        '#cornerButtons','#quickButtons','.quick-buttons','.quick-button','.quickBtn',
        '#inventoryButton','#craftButton','#seenButton','#btnX','#btnC','#btnV'
    ];
    const list = document.querySelectorAll(selectors.join(','));
    list.forEach(el=>{ try{ el.style.display = visible ? '' : 'none'; }catch(e){} });
}


// --- RESPAWN ---
document.addEventListener("keydown", e=>{
    if(isDead && e.key==="Enter"){
        try{
            // reuse existing start routine to fully restart the loop and UI
            if(typeof window.startGame === 'function'){
                window.startGame();
            } else {
                isDead=false;
                player.health=player.maxHealth;
                player.x=CENTER_X; player.y=CENTER_Y;
                mobs=[]; drops=[]; projectiles=[];
                spawnWave(currentWave);
                try{ gameLoop(); }catch(e){}
            }
        }catch(e){ console.warn('respawn failed', e); }
    }
});

// --- DRAW FUNCTIONS ---
function drawPlayer(){
    ctx.fillStyle = 'pink';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2); ctx.fill();
    if(showHitboxes){ ctx.strokeStyle='red'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(player.x,player.y,player.radius,0,Math.PI*2); ctx.stroke(); }
}
// draw player hit flash
const PLAYER_HIT_FLASH_MS = 300;
function drawPlayerHit(){
    if(player._hitFlash && Date.now() - player._hitFlash < PLAYER_HIT_FLASH_MS){
        ctx.strokeStyle = 'red'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(player.x,player.y,player.radius+4,0,Math.PI*2); ctx.stroke();
    }
}
function drawPetals(){
    // draw passive petals around the player (visual only, no DOM dependency)
    for(let i=0;i<petals.length;i++){
        const p = petals[i];
        const px = player.x + Math.cos(p.angle) * player.petalsDistance;
        const py = player.y + Math.sin(p.angle) * player.petalsDistance;
        ctx.save();
        ctx.beginPath(); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.95; ctx.arc(px, py, p.radius || 6, 0, Math.PI*2); ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.stroke();
        ctx.restore();
    }
}
function drawMobs(){
    mobs.forEach(mob=>{
        // angle from mob to player for facing
        const angleToPlayer = Math.atan2((player.y || CENTER_Y) - (mob.y || 0), (player.x || CENTER_X) - (mob.x || 0)) || 0;
        // segmented centipede rendering (segments array)
        if(mob && mob.segments && Array.isArray(mob.segments) && mob.segments.length){
            const segs = mob.segments;
            // draw from tail to head for proper overlap
            for(let si = segs.length - 1; si >= 0; si--){
                const s = segs[si];
                const col = (si===0) ? '#7d5a3c' : (si%2===0 ? '#7d5a3c' : '#5a3b2a');
                ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.radius, s.radius*0.78, 0, 0, Math.PI*2); ctx.fill();
                // segment border
                ctx.lineWidth = 1; ctx.strokeStyle = '#2b2b2b'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.radius, s.radius*0.78, 0, 0, Math.PI*2); ctx.stroke();
                // small damage flash
                if(s._impulse && Date.now() % 300 < 120){ ctx.fillStyle = 'rgba(255,120,120,0.25)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.radius*1.05, s.radius*0.9, 0, 0, Math.PI*2); ctx.fill(); }
                ctx.restore();
            }
            // draw head name + rarity + healthbar above head
            const head = segs[0];
            // head promotion flash
            if(mob._headPromoteUntil && Date.now() < mob._headPromoteUntil){ ctx.save(); ctx.strokeStyle = 'rgba(255,200,80,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(head.x, head.y, head.radius*1.25, head.radius*1.0, 0, 0, Math.PI*2); ctx.stroke(); ctx.restore(); }
            const rarity = mob.rarityName || mob.rarity || 'Common';
            const rcolor = RARITY_COLOR[rarity] || '#000';
            const hpRatio = Math.max(0, Math.min(1, (head.hp || 0) / (head.maxHp || 1)));
            const barWidth = Math.max(44, Math.round((head.radius || 8) * 2.6));
            const barHeight = 8; const bx = Math.round(head.x - barWidth/2); const by = Math.round(head.y + head.radius + 8);
            ctx.beginPath(); roundRectPath(ctx, bx-1, by-1, barWidth+2, barHeight+2, 4); ctx.fillStyle = '#222'; ctx.fill(); ctx.strokeStyle='black'; ctx.lineWidth=1; ctx.stroke();
            ctx.beginPath(); roundRectPath(ctx, bx, by, Math.max(2, Math.round(barWidth * hpRatio)), barHeight, 4); ctx.fillStyle = '#3fc34f'; ctx.fill();
            ctx.font = '12px Arial'; ctx.textBaseline = 'middle'; const nameX = bx - 8; const nameY = by + Math.round(barHeight/2);
            ctx.textAlign = 'right'; ctx.lineWidth = 3; ctx.strokeStyle = contrastColor(RARITY_COLOR[rarity] || '#000'); ctx.strokeText(mob.name || 'Centipede', nameX, nameY);
            ctx.fillStyle = rcolor; ctx.fillText(mob.name || 'Centipede', nameX, nameY);
            const rarityX = bx + barWidth + 8; const rarityY = nameY; ctx.textAlign='left'; ctx.lineWidth=3; ctx.strokeStyle = contrastColor(RARITY_COLOR[rarity] || '#000'); ctx.strokeText(rarity, rarityX, rarityY); ctx.fillStyle = rcolor; ctx.fillText(rarity, rarityX, rarityY);
            // draw mob projectiles if any
            if(mob.projectiles && mob.projectiles.length){ mob.projectiles.forEach(p=>{
                if(p.type === 'Missile'){
                    const angle = Math.atan2(p.dy || 0, p.dx || 1);
                    const sc = Math.max(0.5, (p.radius || 5) / 6);
                    drawHornetMissile(ctx, p.x, p.y, angle, sc);
                } else {
                    ctx.fillStyle = '#f7d86b'; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.fill();
                }
            }); }
            return;
        }

        // sprite-based mobs (draw custom sprite and optional mandible animation)
        if(mob.spriteKey && window.MOB_SPRITES && window.MOB_SPRITES[mob.spriteKey] && window.MOB_SPRITES[mob.spriteKey].loaded){
            try{
                const s = window.MOB_SPRITES[mob.spriteKey];
                const drawW = mob.radius * 2;
                const drawH = drawW * (s.h / s.w);
                ctx.save();
                // use interpolated display angle when available for smooth facing
                const dispAngle = (typeof mob._displayAngle !== 'undefined') ? mob._displayAngle : angleToPlayer;
                const flip = Math.cos(dispAngle) < 0;
                ctx.translate(mob.x, mob.y); ctx.rotate(dispAngle);
                if(flip) ctx.scale(-1,1);
                ctx.drawImage(s.canvas, -drawW/2, -drawH/2, drawW, drawH);
                ctx.restore();

                // mandible animation for 'mandible' key (curvy, rounded mandibles that open when moving)
                if(mob.spriteKey === 'mandible'){
                    const phase = (mob._mandiblePhase || 0) + (Date.now()/160);
                    const open = Math.abs(Math.sin(phase)) * (Math.max(4, mob.radius*0.4));
                    const baseX = mob.x + (flip ? -mob.radius*0.48 : mob.radius*0.48);
                    const frontY = mob.y + (mob.radius*0.04);
                    const gap = Math.max(4, mob.radius * 0.2);
                    const mandibleLen = Math.max(8, mob.radius * 0.9);
                    const mandibleW = Math.max(3, mob.radius * 0.28);
                    // left mandible
                    const leftBase = baseX - gap;
                    const leftEnd = leftBase + (flip ? -mandibleLen - open : mandibleLen + open);
                    ctx.fillStyle = '#2b2b2b'; ctx.strokeStyle = '#111'; ctx.lineWidth = 0.8;
                    ctx.beginPath();
                    ctx.moveTo(leftBase, frontY - mandibleW);
                    ctx.quadraticCurveTo((leftBase + leftEnd) * 0.5, frontY - mandibleW - (open*0.18), leftEnd, frontY - mandibleW*0.25);
                    ctx.lineTo(leftEnd, frontY + mandibleW*0.25);
                    ctx.quadraticCurveTo((leftBase + leftEnd) * 0.5, frontY + mandibleW + (open*0.18), leftBase, frontY + mandibleW);
                    ctx.closePath(); ctx.fill(); ctx.stroke();
                    // right mandible
                    const rightBase = baseX + gap;
                    const rightEnd = rightBase + (flip ? -mandibleLen - open : mandibleLen + open);
                    ctx.beginPath();
                    ctx.moveTo(rightBase, frontY - mandibleW);
                    ctx.quadraticCurveTo((rightBase + rightEnd) * 0.5, frontY - mandibleW - (open*0.18), rightEnd, frontY - mandibleW*0.25);
                    ctx.lineTo(rightEnd, frontY + mandibleW*0.25);
                    ctx.quadraticCurveTo((rightBase + rightEnd) * 0.5, frontY + mandibleW + (open*0.18), rightBase, frontY + mandibleW);
                    ctx.closePath(); ctx.fill(); ctx.stroke();
                    return;
                } else {
                    // Generic sprite-based mob: draw HP/name/rarity above the sprite (use same block as centipede head)
                    const head = mob;
                    const rarity = mob.rarityName || mob.rarity || 'Common';
                    const rcolor = RARITY_COLOR[rarity] || '#000';
                    const hpRatio = Math.max(0, Math.min(1, (head.health || 0) / (head.maxHealth || 1)));
                    const barWidth = Math.max(44, Math.round((head.radius || 8) * 2.6));
                    const barHeight = 8; const bx = Math.round(head.x - barWidth/2); const by = Math.round(head.y + head.radius + 8);
                    ctx.beginPath(); roundRectPath(ctx, bx-1, by-1, barWidth+2, barHeight+2, 4); ctx.fillStyle = '#222'; ctx.fill(); ctx.strokeStyle='black'; ctx.lineWidth=1; ctx.stroke();
                    ctx.beginPath(); roundRectPath(ctx, bx, by, Math.max(2, Math.round(barWidth * hpRatio)), barHeight, 4); ctx.fillStyle = '#3fc34f'; ctx.fill();
                    ctx.font = '12px Arial'; ctx.textBaseline = 'middle'; const nameX = bx - 8; const nameY = by + Math.round(barHeight/2);
                    ctx.textAlign = 'right'; ctx.lineWidth = 3; ctx.strokeStyle = contrastColor(RARITY_COLOR[rarity] || '#000'); ctx.strokeText(mob.name || 'Mob', nameX, nameY);
                    ctx.fillStyle = rcolor; ctx.fillText(mob.name || 'Mob', nameX, nameY);
                    const rarityX = bx + barWidth + 8; const rarityY = nameY; ctx.textAlign='left'; ctx.lineWidth=3; ctx.strokeStyle = contrastColor(RARITY_COLOR[rarity] || '#000'); ctx.strokeText(rarity, rarityX, rarityY); ctx.fillStyle = rcolor; ctx.fillText(rarity, rarityX, rarityY);
                    // draw mob projectiles if any
                    if(mob.projectiles && mob.projectiles.length){ mob.projectiles.forEach(p=>{
                        if(p.type === 'Missile'){
                            const angle = Math.atan2(p.dy || 0, p.dx || 1);
                            const sc = Math.max(0.5, (p.radius || 5) / 6);
                            drawHornetMissile(ctx, p.x, p.y, angle, sc);
                        } else {
                            ctx.fillStyle = '#f7d86b'; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.fill();
                        }
                    }); }
                    return;
                }
            }catch(e){}
        }

        // body + species-specific visuals
        if((mob.type||'').toLowerCase() === 'hornet'){
                // Hornet behavior: face away by default, briefly turn to face player when shooting
                try{
                    ctx.save();
                        ctx.translate(mob.x, mob.y);
                        const isTurning = mob._turnUntil && mob._turnUntil > Date.now();
                        const facingAngle = isTurning ? angleToPlayer : (angleToPlayer + Math.PI);
                        // rotate using display angle so body rotation matches smooth facing
                        const display = (typeof mob._displayAngle === 'number') ? mob._displayAngle : facingAngle;
                        ctx.rotate(display);
                        const scale = Math.max(0.4, mob.radius / 12);
                        // drawHornet expects coordinates relative to current transform
                        drawHornet(ctx, 0, 0, scale);
                    }finally{ ctx.restore(); }
                // draw HP / name / rarity below (then return to avoid duplicate bars)
                const rarity = mob.rarityName || mob.rarity || 'Common';
                const rcolor = RARITY_COLOR[rarity] || '#000';
                const hpRatio = Math.max(0, Math.min(1, (mob.health || 0) / (mob.maxHealth || 1)));
                const barWidth = Math.max(44, Math.round((mob.radius || 8) * 2.6));
                const barHeight = 8; const bx = Math.round(mob.x - barWidth/2); const by = Math.round(mob.y + mob.radius + 8);
                ctx.beginPath(); roundRectPath(ctx, bx-1, by-1, barWidth+2, barHeight+2, 4); ctx.fillStyle = '#222'; ctx.fill(); ctx.strokeStyle='black'; ctx.lineWidth=1; ctx.stroke();
                ctx.beginPath(); roundRectPath(ctx, bx, by, Math.max(2, Math.round(barWidth * hpRatio)), barHeight, 4); ctx.fillStyle = '#3fc34f'; ctx.fill();
                ctx.font = '12px Arial'; ctx.textBaseline = 'middle'; const nameX = bx - 8; const nameY = by + Math.round(barHeight/2);
                ctx.textAlign = 'right'; ctx.lineWidth = 3; ctx.strokeStyle = contrastColor(RARITY_COLOR[rarity] || '#000'); ctx.strokeText(mob.name || 'Hornet', nameX, nameY);
                ctx.fillStyle = rcolor; ctx.fillText(mob.name || 'Hornet', nameX, nameY);
                const rarityX = bx + barWidth + 8; const rarityY = nameY; ctx.textAlign='left'; ctx.lineWidth=3; ctx.strokeStyle = contrastColor(RARITY_COLOR[rarity] || '#000'); ctx.strokeText(rarity, rarityX, rarityY); ctx.fillStyle = rcolor; ctx.fillText(rarity, rarityX, rarityY);
                return;
        } else {
            const t = (mob.type || mob.name || '').toString().toLowerCase();
            ctx.save();
            if(t.includes('ant') && (t.includes('baby') || t.includes('baby-ant'))){
                // Baby Ant: tiny segmented gray ant
                ctx.translate(mob.x, mob.y); ctx.rotate(angleToPlayer);
                ctx.fillStyle = '#777';
                for(let i=0;i<3;i++){ ctx.beginPath(); ctx.ellipse(-mob.radius + i*(mob.radius*0.8), 0, mob.radius*0.55, mob.radius*0.45, 0, 0, Math.PI*2); ctx.fill(); }
                ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mob.radius*0.4, -mob.radius*0.6); ctx.quadraticCurveTo(mob.radius*0.9, -mob.radius*1.2, mob.radius*1.2, -mob.radius*1.6); ctx.stroke();
            } else if(t.includes('queen')){
                // Queen Ant: larger with pronounced abdomen
                ctx.translate(mob.x, mob.y); ctx.rotate(angleToPlayer);
                ctx.fillStyle = '#8b5e3c';
                ctx.beginPath(); ctx.ellipse(0, 0, mob.radius*1.6, mob.radius*1.2, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#5a3b2a'; ctx.beginPath(); ctx.ellipse(-mob.radius*0.8, 0, mob.radius*1.1, mob.radius*0.9, 0, 0, Math.PI*2); ctx.fill();
            } else if(t.includes('soldier')){
                ctx.translate(mob.x, mob.y); ctx.rotate(angleToPlayer);
                ctx.fillStyle = '#6b4b3a'; ctx.beginPath(); ctx.ellipse(0,0,mob.radius,mob.radius*0.8,0,0,Math.PI*2); ctx.fill();
                ctx.fillStyle='#3b2b1f'; ctx.fillRect(-mob.radius*0.9, -mob.radius*0.2, mob.radius*0.8, mob.radius*0.4);
            } else if(t.includes('bee') && t.includes('bumble') ){ // bumblebee
                ctx.translate(mob.x, mob.y); ctx.rotate(angleToPlayer);
                // draw stripes first (clipped to body ellipse)
                ctx.save();
                ctx.beginPath(); ctx.ellipse(0,0,mob.radius*1.2,mob.radius*0.95,0,0,Math.PI*2); ctx.clip();
                ctx.fillStyle = '#211f1f';
                for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.ellipse(-mob.radius*0.15 + i*(mob.radius*0.45), 0, mob.radius*0.42, mob.radius*0.36, 0, 0, Math.PI*2); ctx.fill(); }
                ctx.restore();
                // soft radial outer layer drawn on top so stripes sit underneath
                const bg = ctx.createRadialGradient(0, -mob.radius*0.1, mob.radius*0.1, 0, 0, mob.radius*1.1);
                bg.addColorStop(0, '#fff3e6'); bg.addColorStop(0.4, '#ffd28a'); bg.addColorStop(1, 'rgba(255,184,107,0.92)'); ctx.fillStyle = bg;
                ctx.beginPath(); ctx.ellipse(0,0,mob.radius*1.2,mob.radius*0.95,0,0,Math.PI*2); ctx.fill();
                // subtle outer stroke
                ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0,0,mob.radius*1.2,mob.radius*0.95,0,0,Math.PI*2); ctx.stroke();
                // wing highlight
                ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-mob.radius*0.1, -mob.radius*0.9, mob.radius*0.6, mob.radius*0.3, 0, 0, Math.PI*2); ctx.fill();
            } else if(t.includes('bee')){
                ctx.translate(mob.x, mob.y); ctx.rotate(angleToPlayer);
                // draw stripes first, clipped to the body shape
                ctx.save(); ctx.beginPath(); ctx.ellipse(0,0,mob.radius,mob.radius*0.8,0,0,Math.PI*2); ctx.clip();
                ctx.fillStyle = '#1b1b1b'; for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.ellipse(-mob.radius*0.06 + i*(mob.radius*0.34),0,mob.radius*0.28,mob.radius*0.22,0,0,Math.PI*2); ctx.fill(); }
                ctx.restore();
                // outer body layer drawn on top so stripes sit underneath
                ctx.fillStyle = '#f7d86b'; ctx.beginPath(); ctx.ellipse(0,0,mob.radius,mob.radius*0.8,0,0,Math.PI*2); ctx.fill();
                // wing highlight
                ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-mob.radius*0.25,-mob.radius*0.6,mob.radius*0.55,mob.radius*0.25,0,0,Math.PI*2); ctx.fill();
            } else if(t.includes('centipede')){
                // draw segmented body along a small curve
                ctx.translate(mob.x, mob.y); ctx.rotate(angleToPlayer);
                const seg = Math.max(6, Math.floor((mob.radius*2)/4));
                for(let i=0;i<8;i++){ const ox = -mob.radius + i*(mob.radius*0.6); ctx.fillStyle = (i%2===0)?'#7d5a3c':'#5a3b2a'; ctx.beginPath(); ctx.ellipse(ox, 0, mob.radius*0.5, mob.radius*0.38, 0, 0, Math.PI*2); ctx.fill(); }
            } else if(t.includes('spider')){
                // round body with legs
                ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(mob.x, mob.y, mob.radius, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle='#111'; ctx.lineWidth=2; for(let i=0;i<8;i++){ const a = (Math.PI*2/8)*i; ctx.beginPath(); ctx.moveTo(mob.x + Math.cos(a)*mob.radius, mob.y + Math.sin(a)*mob.radius); ctx.lineTo(mob.x + Math.cos(a)*(mob.radius*1.8), mob.y + Math.sin(a)*(mob.radius*1.8)); ctx.stroke(); }
            } else if(t.includes('dandelion')){
                ctx.save(); ctx.translate(mob.x, mob.y);
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0,0,mob.radius,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle='rgba(200,200,200,0.4)'; for(let i=0;i<14;i++){ ctx.beginPath(); const a = (Math.PI*2/14)*i; ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*(mob.radius*1.6), Math.sin(a)*(mob.radius*1.6)); ctx.stroke(); }
                ctx.restore();
            } else if(t.includes('rock')){
                ctx.fillStyle = '#9e9e9e'; ctx.beginPath(); ctx.ellipse(mob.x, mob.y, mob.radius*1.1, mob.radius*0.9, -0.2, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle='#7a7a7a'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(mob.x, mob.y, mob.radius*1.1, mob.radius*0.9, -0.2, 0, Math.PI*2); ctx.stroke();
            } else if(t.includes('snail')){
                // body and shell spiral
                ctx.translate(mob.x, mob.y);
                ctx.fillStyle='#b77'; ctx.beginPath(); ctx.ellipse(-mob.radius*0.4, 0, mob.radius*0.9, mob.radius*0.6, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle='#9f6'; ctx.beginPath(); ctx.arc(mob.radius*0.5, 0, mob.radius*0.8, 0, Math.PI*2); ctx.fill();
            } else if(t.includes('ladybug')){
                ctx.translate(mob.x, mob.y);
                ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.ellipse(0,0,mob.radius,mob.radius*0.8,0,0,Math.PI*2); ctx.fill();
                ctx.fillStyle='#111'; for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(-mob.radius*0.2 + i*(mob.radius*0.35), 0, mob.radius*0.18, 0, Math.PI*2); ctx.fill(); }
            } else {
                // fallback simple circle
                ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(mob.x,mob.y,mob.radius,0,Math.PI*2); ctx.fill();
            }
            ctx.restore();
        }

        const rarity = mob.rarityName || mob.rarity || 'Common';
        const rcolor = RARITY_COLOR[rarity] || '#000';
        const hpRatio = Math.max(0, Math.min(1, (mob.health || 0) / (mob.maxHealth || 1)));
        const barWidth = Math.max(44, Math.round((mob.radius || 8) * 2.6));
        const barHeight = 8; const bx = Math.round(mob.x - barWidth/2); const by = Math.round(mob.y - mob.radius - 14);
        ctx.beginPath(); roundRectPath(ctx, bx-1, by-1, barWidth+2, barHeight+2, 4); ctx.fillStyle = '#222'; ctx.fill(); ctx.strokeStyle='black'; ctx.lineWidth=1; ctx.stroke();
        ctx.beginPath(); roundRectPath(ctx, bx, by, Math.max(2, Math.round(barWidth * hpRatio)), barHeight, 4); ctx.fillStyle = '#3fc34f'; ctx.fill();
        ctx.font = '12px Arial'; ctx.textBaseline = 'middle'; const nameX = bx - 8; const nameY = by + Math.round(barHeight/2);
        ctx.textAlign = 'right'; ctx.lineWidth = 3; ctx.strokeStyle = contrastColor(RARITY_COLOR[rarity] || '#000'); ctx.strokeText(mob.name || '', nameX, nameY);
        ctx.fillStyle = rcolor; ctx.fillText(mob.name || '', nameX, nameY);
        const rarityX = bx + barWidth + 8; const rarityY = nameY; ctx.textAlign='left'; ctx.lineWidth=3; ctx.strokeStyle = contrastColor(RARITY_COLOR[rarity] || '#000'); ctx.strokeText(rarity, rarityX, rarityY); ctx.fillStyle = rcolor; ctx.fillText(rarity, rarityX, rarityY);
        // draw mob projectiles if any
        if(mob.projectiles && mob.projectiles.length){ mob.projectiles.forEach(p=>{
            if(p.type === 'Missile'){
                const angle = Math.atan2(p.dy || 0, p.dx || 1);
                const sc = Math.max(0.5, (p.radius || 5) / 6);
                drawHornetMissile(ctx, p.x, p.y, angle, sc);
            } else {
                ctx.fillStyle = (p.type==='Missile')?'grey':'#f7d86b'; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius,0,Math.PI*2); ctx.fill();
            }
        }); }
        // hit flash outline when recently damaged
        if(mob._hitFlash && Date.now() - mob._hitFlash < 300){ ctx.strokeStyle='red'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(mob.x,mob.y,mob.radius+3,0,Math.PI*2); ctx.stroke(); }
        // collision debug highlight
        if(mob._debug){ ctx.strokeStyle='magenta'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(mob.x,mob.y,mob.radius+6,0,Math.PI*2); ctx.stroke(); ctx.fillStyle='magenta'; ctx.font='12px monospace'; ctx.fillText('COLLIDE', mob.x, mob.y - mob.radius - 10); }
    });
}
function drawDrops(){
    drops.forEach(drop=>{
        try{
            const w = 48, h = 56;
            const x = Math.round(drop.x - w/2);
            const y = Math.round(drop.y - h/2);
            const bg = RARITY_COLOR[drop.rarity] || '#ddd';
            // box background
            ctx.save(); ctx.beginPath(); roundRectPath(ctx, x, y, w, h-14, 8); ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#333'; ctx.stroke();
            // draw petal icon if loaded (cached per-drop)
            if(drop._img && drop._imgLoaded){
                const imgW = w - 12; const imgH = Math.max(20, h - 34);
                ctx.drawImage(drop._img, x + 6, y + 6, imgW, imgH);
            } else if(drop.iconURL){
                // try lazy load once more
                if(!drop._img){ const img = new Image(); img.onload = ()=>{ drop._imgLoaded = true; drop._img = img; }; img.src = drop.iconURL; drop._img = img; }
                // placeholder circle
                ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.arc(x + w/2, y + (h-14)/2, Math.min(18, (w-12)/2), 0, Math.PI*2); ctx.fill();
            }
            // name under icon
            ctx.fillStyle = '#111'; ctx.font = '12px Arial'; ctx.textAlign = 'center'; ctx.fillText(drop.type, x + w/2, y + h - 6);
            if(showHitboxes){ ctx.strokeStyle='red'; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h-14); }
            ctx.restore();
        }catch(e){ /* ignore drawing errors */ }
    });
}
// Override drawUI: show biome title and wave bar centered
function drawUI(){
    const biome = window.currentBiome || 'Garden';
    ctx.save(); ctx.textAlign = 'center'; ctx.font = '28px Arial'; ctx.fillStyle = '#ffffff'; ctx.fillText(biome, CENTER_X, 36);
    const barW = 340; const barH = 18; const bx = CENTER_X - barW/2; const by = 56;
    ctx.beginPath(); roundRectPath(ctx, bx, by, barW, barH, 10); ctx.fillStyle = '#000'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.stroke();
    // fill representing remaining spawn progress (inverse of mobs present)
    const expected = Math.max(1, 8 + Math.floor(currentWave * 1.6));
    const prog = Math.max(0, Math.min(1, 1 - (mobs.length / expected)));
    ctx.beginPath(); roundRectPath(ctx, bx+2, by+2, Math.max(6, (barW-4)* prog), barH-4, 8); ctx.fillStyle = '#7ee07a'; ctx.fill();
    ctx.font = '14px Arial'; ctx.fillStyle = '#fff'; ctx.fillText('Wave ' + currentWave, CENTER_X, by + barH/2 + 4);
    // HP left-top
    ctx.textAlign = 'left'; ctx.font = '14px Arial'; ctx.fillStyle = '#fff'; ctx.fillText('HP: '+Math.floor(player.health), 12, 22);
    ctx.restore();
}

// Debug overlay: shows counts, coordinates, and a crosshair for the player
function drawDebugOverlay(){
    if(typeof DEBUG_SHOW === 'undefined') DEBUG_SHOW = true;
    if(!DEBUG_SHOW) return;
    const pad = 8;
    const w = 260, h = 88;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); roundRectPath(ctx, pad-4, 30-12, w, h, 6);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('player: ' + player.x.toFixed(1) + ', ' + player.y.toFixed(1), pad, 40);
    ctx.fillText('view: ' + viewWidth.toFixed(0) + ' x ' + viewHeight.toFixed(0), pad, 58);
    ctx.fillText('mobs: ' + mobs.length + ' proj: ' + projectiles.length + ' drops: ' + drops.length, pad, 76);
    ctx.fillText('wave: ' + currentWave + (isDead? ' (DEAD)':'') , pad, 94);

    // draw crosshair at player position
    ctx.lineWidth = 2; ctx.strokeStyle = 'red'; ctx.beginPath();
    ctx.moveTo(player.x - 14, player.y - 14); ctx.lineTo(player.x + 14, player.y + 14);
    ctx.moveTo(player.x + 14, player.y - 14); ctx.lineTo(player.x - 14, player.y + 14);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
    // DOM overlay removed; keep diagnostics visible via console logs when needed
}

// Huge flashing center marker to guarantee the player is visible during debugging
function drawHugeCenterMarker(){
    if(typeof DEBUG_FORCE_CENTER === 'undefined' || !DEBUG_FORCE_CENTER) return;
    const t = Date.now();
    const on = Math.floor(t/300) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = on ? 0.95 : 0.45;
    ctx.fillStyle = 'rgba(255,255,0,0.9)';
    ctx.beginPath(); ctx.arc(CENTER_X, CENTER_Y, Math.max(32, Math.min(viewWidth, viewHeight) * 0.08), 0, Math.PI*2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = 'black'; ctx.beginPath(); ctx.arc(CENTER_X, CENTER_Y, Math.max(36, Math.min(viewWidth, viewHeight) * 0.08 + 4), 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = 'black'; ctx.font = '18px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PLAYER', CENTER_X, CENTER_Y);
    ctx.restore();
}

// --- DEATH OVERLAY ---
function drawDeathOverlay(){
    ctx.fillStyle="rgba(100,100,100,0.6)";
    ctx.fillRect(0,0,viewWidth,viewHeight);
    // Player dead face
    ctx.fillStyle="pink";
    ctx.beginPath(); ctx.arc(CENTER_X,CENTER_Y,player.radius,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="black";
    ctx.font="20px Arial";
    ctx.fillText("x_x",CENTER_X-15,CENTER_Y-5);
    ctx.fillText("☹",CENTER_X-10,CENTER_Y+15);
    ctx.font="16px Arial";
    ctx.fillText("Press Enter to respawn",CENTER_X-80,CENTER_Y+50);
}

// --- GAME LOOP ---
function gameLoop(){
    ctx.fillStyle="#3CB043"; // green background
    ctx.fillRect(0,0,viewWidth,viewHeight);

    movePlayer(); moveMobs(); updatePetals(); updatePetalDistance(); updateProjectiles(); checkCollisions();
    applyPassiveEffects();
    drawPlayer(); drawPlayerHit(); drawPetals(); drawMobs(); drawDrops(); drawProjectiles(); drawUI();
    // debug overlay to help locate player and coordinate issues (non-intrusive)
    if(typeof DEBUG_SHOW !== 'undefined' && DEBUG_SHOW) drawDebugOverlay();

    if(isDead) drawDeathOverlay();

    if(!isDead){
        animationId = requestAnimationFrame(gameLoop);
    } else {
        animationId = null;
    }
}

// (toggle functions defined earlier wire rendering when opening)

// Start the game loop and spawn the first wave. Called from the start screen Play button.
window.startGame = function(){
    console.log('DEBUG startGame: begin');
    try{ window.currentBiome = 'Garden'; }catch(e){}
    // hide start screen if present
    try{
        const ss = document.getElementById('startScreen'); if(ss){ ss.style.display='none'; console.log('DEBUG startGame: hid start screen'); }
    }catch(e){ console.warn('startGame: could not hide start screen', e); }

    // show canvas (index.html will do this too, but double-safe)
    try{ canvas.style.display = 'block'; console.log('DEBUG startGame: canvas shown'); }catch(e){ console.warn('startGame: canvas show failed', e); }

    // attempt to lock page scroll and make canvas fill viewport, but don't fail initialization on error
    try{
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.style.margin = '0';
        canvas.style.position = 'fixed'; canvas.style.left = '0'; canvas.style.top = '0';
        canvas.style.width = '100vw'; canvas.style.height = '100vh';
        console.log('DEBUG startGame: applied fullscreen CSS');
    }catch(e){ console.warn('startGame: fullscreen CSS failed', e); }

    // recalc canvas backing store to match new CSS size; fallback to window sizes if needed
    try{
        resizeCanvas();
        if(!viewWidth || !viewHeight){
            viewWidth = window.innerWidth || 800;
            viewHeight = window.innerHeight || 600;
            CENTER_X = Math.round(viewWidth/2); CENTER_Y = Math.round(viewHeight/2);
            console.warn('startGame: resizeCanvas produced zero view; using window.inner sizes', viewWidth, viewHeight);
        }
        console.log('DEBUG startGame: resizeCanvas ok view=', viewWidth, viewHeight, 'CENTER=', CENTER_X, CENTER_Y);
    }catch(e){ console.warn('startGame: resizeCanvas threw', e); viewWidth = window.innerWidth || 800; viewHeight = window.innerHeight || 600; CENTER_X = Math.round(viewWidth/2); CENTER_Y = Math.round(viewHeight/2); }

    // hide HUD (settings + quick buttons) while playing (best-effort)
    try{ setHUDVisible(false); }catch(e){ console.warn('startGame: setHUDVisible failed', e); }

    // populate demo inventory if empty for testing (non-blocking)
    try{
        if(player.inventory.length===0){
            addToInventory('Air','Common',30);
            addToInventory('Pollen','Common',12);
            addToInventory('Missile','Rare',3);
            addToInventory('Light','Rare',2);
            addToInventory('Stinger','Epic',1);
            console.log('DEBUG startGame: populated demo inventory');
        }
    }catch(e){ console.warn('startGame: populate inventory failed', e); }

    // reset player state for a new run
    try{
        isDead = false;
        player.health = player.maxHealth;
        player.x = CENTER_X; player.y = CENTER_Y;
        // ensure canvas is focusable and get keyboard input
        try{ canvas.tabIndex = canvas.tabIndex || 0; canvas.focus(); }catch(e){}
        mobs=[]; drops=[]; projectiles=[];
        nextEquipIndex = 0;
        refreshPetals();
        console.log('DEBUG startGame: player reset, arrays cleared');
    }catch(e){ console.warn('startGame: player reset failed', e); }

    // log canvas/debug info to console for diagnostics
    try{
        const rect = canvas.getBoundingClientRect();
        console.log('DEBUG startGame: DPR=', window.devicePixelRatio, 'canvas.width=', canvas.width, 'canvas.height=', canvas.height, 'rect=', rect);
    }catch(e){ console.log('DEBUG startGame: error reading canvas rect', e); }

    // ensure any previous animation frame is cancelled before starting
    try{ if(animationId) cancelAnimationFrame(animationId); animationId = null; }catch(e){ console.warn('startGame: cancelAnimationFrame failed', e); }

    // spawn wave and start loop; keep these as the last critical steps so UI failures won't block gameplay
    try{
        spawnWave(currentWave);
        console.log('DEBUG startGame: spawnWave called, mobs=', mobs.length);
    }catch(e){ console.error('startGame: spawnWave failed', e); mobs = []; }

    try{ if(window.renderInventory) window.renderInventory(); }catch(e){}

    try{
        gameLoop();
        console.log('DEBUG startGame: gameLoop started');
    }catch(e){ console.error('startGame: gameLoop failed to start', e); }
};

// (removed DOM debug overlay - diagnostics kept in console)

// --- RARITY SYSTEM ---
const RARITY_NAMES = [
    'Common','Unusual','Rare','Epic','Legendary','Mythical','Ultra','Super','Radiant','Mystitic','Runic','Seraphic','Umbral','Impracticality'
];
const RARITY_COLOR = {
    Common: '#bfeecb',       // Light Green
    Unusual: '#fff9c4',      // Light Yellow
    Rare: '#3b6cff',         // Blue
    Epic: '#d6b3ff',         // Light Purple
    Legendary: '#800000',    // Maroon
    Mythical: '#5fd6d1',     // Light Blue / Teal
    Ultra: '#ff4db8',        // Hot Pink
    Super: '#00c9a7',        // Cyan Green
    Radiant: '#ffd24d',      // Gold / Bright Yellow
    Mystitic: '#30e0d0',     // Turquoise
    Runic: '#2b2b7a',        // Deep Indigo
    Seraphic: '#ffffff',     // White / Pearl
    Umbral: '#000000',       // Black / Void
    Impracticality: null     // Shifting rainbow / cosmic handled separately
};
// removed stray extra closing brace

// Spawn probability table per rarity by wave ranges.
const RARITY_SPAWN_TABLE = [
    // Wave 1-3
    [50,25,12,6,3,2,1,0.5,0.3,0.2,0.1,0.05,0.01,0.01],
    // Wave 4-6
    [40,25,15,8,5,4,2,1,0.5,0.3,0.2,0.1,0.05,0.05],
    // Wave 7-9
    [30,20,20,10,8,6,3,2,1,0.5,0.3,0.2,0.1,0.1],
    // Wave 10+
    [20,15,20,10,10,8,5,4,2,1,0.5,0.3,0.2,0.2]
];

function getRarityDistributionForWave(wave){
    if(wave <= 3) return RARITY_SPAWN_TABLE[0].slice();
    if(wave <= 6) return RARITY_SPAWN_TABLE[1].slice();
    if(wave <= 9) return RARITY_SPAWN_TABLE[2].slice();
    return RARITY_SPAWN_TABLE[3].slice();
}

function pickRarityByWave(wave){
    const dist = getRarityDistributionForWave(wave);
    // normalize and weighted pick
    const total = dist.reduce((a,b)=>a+b,0);
    if(total <= 0) return 'Common';
    let r = Math.random() * total;
    for(let i=0;i<dist.length;i++){
        r -= dist[i];
        if(r <= 0) return RARITY_NAMES[i] || 'Common';
    }
    return RARITY_NAMES[RARITY_NAMES.length-1];
}

function hexToRgb(hex){
    if(!hex) return null;
    hex = hex.replace('#','');
    if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
    const bigint = parseInt(hex,16); return {r:(bigint>>16)&255, g:(bigint>>8)&255, b:bigint&255};
}
function luminanceOfHex(hex){ const rgb = hexToRgb(hex); if(!rgb) return 0; const r = rgb.r/255, g = rgb.g/255, b = rgb.b/255; return 0.2126*r + 0.7152*g + 0.0722*b; }
function contrastColor(hex){ const lum = luminanceOfHex(hex||'#000'); return (lum > 0.6) ? '#000' : '#fff'; }

// helper to build rounded rect path (stroke/fill externally)
function roundRectPath(ctx, x, y, width, height, radius){
    const r = Math.min(radius, width/2, height/2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

const RARITY_BASE_MULTIPLIER = 1.55; // exponential base for scaling; higher -> wider gaps between rarities
function rarityMultiplier(index){ return Math.pow(RARITY_BASE_MULTIPLIER, Math.max(0, index)); }

// --- SIMPLE CHAT SYSTEM (client-side) ---
// Creates a small chat overlay with message area and input. Press Enter to focus/send.
(function(){
    try{
        // build chat root
        const cr = document.createElement('div'); cr.id = 'chatRoot';
        cr.style.position = 'fixed'; cr.style.left = '12px'; cr.style.bottom = '12px'; cr.style.width = '360px'; cr.style.maxHeight = '40vh'; cr.style.zIndex = 99999; cr.style.display = 'flex'; cr.style.flexDirection = 'column'; cr.style.gap = '6px'; cr.style.fontFamily = 'Arial, sans-serif';
        cr.style.pointerEvents = 'auto';

        const msgs = document.createElement('div'); msgs.id = 'chatMessages'; msgs.style.background = 'rgba(8,8,12,0.6)'; msgs.style.color = '#fff'; msgs.style.padding = '8px'; msgs.style.borderRadius = '8px'; msgs.style.overflowY = 'auto'; msgs.style.flex = '1 1 auto'; msgs.style.maxHeight = '40vh'; msgs.style.fontSize = '13px'; msgs.style.boxShadow = '0 6px 18px rgba(0,0,0,0.5)';
        cr.appendChild(msgs);

        const inputWrap = document.createElement('div'); inputWrap.style.display = 'flex'; inputWrap.style.gap = '6px';
        const input = document.createElement('input'); input.id = 'chatInput'; input.type = 'text'; input.placeholder = 'Press Enter to chat — use $spawnmob or $setwave';
        input.style.flex = '1 1 auto'; input.style.padding = '8px 10px'; input.style.borderRadius = '6px'; input.style.border = '1px solid rgba(255,255,255,0.12)'; input.style.background = 'rgba(255,255,255,0.04)'; input.style.color = '#fff';
        const sendBtn = document.createElement('button'); sendBtn.textContent = 'Send'; sendBtn.style.padding = '8px 10px'; sendBtn.style.borderRadius = '6px'; sendBtn.style.border = 'none'; sendBtn.style.background = '#3b82f6'; sendBtn.style.color = '#fff';
        inputWrap.appendChild(input); inputWrap.appendChild(sendBtn);
        cr.appendChild(inputWrap);

        document.addEventListener('DOMContentLoaded', ()=>{ document.body.appendChild(cr); });
        if(document.body) document.body.appendChild(cr);

        function appendMsg(text, cls){
            try{
                const el = document.createElement('div'); el.style.marginBottom = '6px'; el.style.wordBreak = 'break-word';
                el.innerHTML = text;
                if(cls === 'system') el.style.opacity = '0.9';
                msgs.appendChild(el);
                msgs.scrollTop = msgs.scrollHeight;
            }catch(e){}
        }

        function spawnMobCommand(name, rarityArg){
            try{
                if(!name) { appendMsg('<em>spawnmob requires a name</em>','system'); return; }
                let rarityName = 'Common';
                if(typeof rarityArg === 'number'){ const i = Math.max(0, Math.min(RARITY_NAMES.length-1, rarityArg)); rarityName = RARITY_NAMES[i]; }
                else if(typeof rarityArg === 'string' && rarityArg.trim().length>0){ const maybe = rarityArg.trim(); if(/^[0-9]+$/.test(maybe)) rarityName = RARITY_NAMES[Math.max(0, Math.min(RARITY_NAMES.length-1, parseInt(maybe)))]; else rarityName = maybe; }

                const rarityIndex = Math.max(0, RARITY_NAMES.indexOf(rarityName));
                const mult = rarityMultiplier(rarityIndex);
                const x = Math.max(0, Math.min(viewWidth, player.x + (Math.random()*400 - 200)));
                const y = Math.max(0, Math.min(viewHeight, player.y + (Math.random()*400 - 200)));
                const radius = Math.max(8, Math.round(12 * (1 + rarityIndex*0.14)));
                const hp = Math.max(6, Math.round(30 * mult));
                const speed = Math.max(0.2, 1.2 - (rarityIndex*0.02));
                const sk = (name||'').toString().toLowerCase();
                mobs.push({ x, y, radius, speed, health: hp, maxHealth: hp, name: name, type: name, projectiles: [], shootCooldown: 0, spriteKey: sk, rarityIndex, rarityName, stationary: false, mass: Math.round(radius * (1 + rarityIndex*0.14)), vx:0, vy:0 });
                appendMsg(`<strong>Spawned</strong> ${name} (${rarityName}) near player`,'system');
            }catch(e){ appendMsg('<em>spawn failed</em>','system'); }
        }

        function setWaveCommand(n){
            try{
                const val = parseInt(n,10);
                if(isNaN(val) || val < 1){ appendMsg('<em>invalid wave number</em>','system'); return; }
                currentWave = val;
                spawnWave(currentWave);
                appendMsg(`<strong>Wave set to</strong> ${currentWave}`,'system');
            }catch(e){ appendMsg('<em>setwave failed</em>','system'); }
        }

        function handleChatLine(line){
            if(!line) return;
            const trimmed = line.trim();
            if(trimmed.length === 0) return;
            // commands start with $
            if(trimmed.startsWith('$')){
                const parts = trimmed.split(/\s+/);
                const cmd = parts[0].toLowerCase();
                if(cmd === '$spawnmob'){
                    if(parts.length < 3){ appendMsg('<em>Usage: $spawnmob &lt;name&gt; &lt;rarity-number&gt;</em>','system'); return; }
                    const name = parts[1]; const r = parts[2]; spawnMobCommand(name, r);
                    return;
                } else if(cmd === '$setwave'){
                    if(parts.length < 2){ appendMsg('<em>Usage: $setwave &lt;number&gt;</em>','system'); return; }
                    setWaveCommand(parts[1]); return;
                } else if(cmd === '$godmode'){
                    // toggle godmode
                    player.godmode = !player.godmode;
                    appendMsg(`<strong>Godmode</strong> ${player.godmode ? 'ENABLED' : 'DISABLED'}`,'system'); return;
                } else if(cmd === '$givepetal'){
                    if(parts.length < 3){ appendMsg('<em>Usage: $givepetal &lt;name&gt; &lt;rarity-number&gt;</em>','system'); return; }
                    const name = parts[1]; const r = parts[2];
                    let rarityName = 'Common';
                    if(/^[0-9]+$/.test(r)) rarityName = RARITY_NAMES[Math.max(0, Math.min(RARITY_NAMES.length-1, parseInt(r)))] || 'Common'; else if(r) rarityName = r;
                    addToInventory(name, rarityName, 1);
                    appendMsg(`<strong>Given</strong> ${name} (${rarityName})`,'system'); return;
                } else {
                    appendMsg(`<em>Unknown command:</em> ${cmd}`,'system'); return;
                }
            }
            // normal chat echo (client-only)
            appendMsg(`<strong>You:</strong> ${escapeHtml(trimmed)}`);
        }

        function escapeHtml(s){ return String(s).replace(/[&<>\"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":"&#39;"}[c]; }); }

        sendBtn.addEventListener('click', ()=>{ const v = input.value || ''; handleChatLine(v); input.value=''; input.focus(); });
        input.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); const v = input.value || ''; handleChatLine(v); input.value=''; input.blur(); } });

        // Pressing Enter anywhere should focus the chat input (unless typing in a field already)
        document.addEventListener('keydown', function(e){
            try{
                if(e.key === 'Enter'){
                    const active = document.activeElement;
                    if(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
                    input.focus(); e.preventDefault();
                }
            }catch(err){}
        });

        // expose commands for external use
        window.chatCommands = { spawnMob: spawnMobCommand, setWave: setWaveCommand, givePetal: function(n,r){ try{ spawnMobCommand(n,r); }catch(e){} }, appendMsg };
        // small welcome
        appendMsg('<em>Chat initialized. Use <strong>$spawnmob &lt;name&gt; &lt;rarity-number&gt;</strong> or <strong>$setwave &lt;number&gt;</strong></em>','system');
    }catch(e){ console.warn('chat init failed', e); }
})();

// --- Simple crafting executor: combine 5 of same petal -> 1 of next rarity ---
function updateCraftUI(){
    try{
        const btn = document.getElementById('craftButton'); if(!btn) return;
        let can = false; for(const it of player.inventory){ if((it.stack||0) >= 5){ can = true; break; } }
        btn.disabled = !can;
    }catch(e){}
}
window.updateCraftUI = updateCraftUI;

function doCraftAction(){
    try{
        // find first craftable stack
        let idx = player.inventory.findIndex(it => (it.stack||0) >= 5);
        if(idx === -1){ if(window.chatCommands && window.chatCommands.appendMsg) window.chatCommands.appendMsg('<em>No craftable stacks (need 5)</em>','system'); return; }
        const it = player.inventory[idx]; const fromR = it.rarity || 'Common'; const next = nextRarity(fromR) || fromR;
        // remove 5
        removeFromInventory(it.type, fromR, 5);
        // add crafted upgraded petal
        addToInventory(it.type, next, 1);
        try{ savePlayerState(); }catch(e){}
        if(window.chatCommands && window.chatCommands.appendMsg) window.chatCommands.appendMsg(`<strong>Crafted</strong> 5x ${it.type} (${fromR}) → 1x ${it.type} (${next})`,'system');
        // refresh UI
        try{ if(typeof renderInventory === 'function') renderInventory(); }catch(e){}
        updateCraftUI();
    }catch(e){ console.warn('craft failed', e); }
}
window.doCraftAction = doCraftAction;
// wire craft button if present
try{ const cb = document.getElementById('craftButton'); if(cb){ cb.addEventListener('click', ()=> doCraftAction()); } }catch(e){}
// periodically refresh craft button state
setInterval(()=>{ try{ updateCraftUI(); }catch(e){} }, 800);

// Minimal runtime starter: ensures window.startGame exists and runs a simple loop
if(!window.startGame){
    window.startGame = function(){
        if(window._gameStarted) return;
        window._gameStarted = true;
        console.log('startGame: minimal starter invoked');

        // Ensure some basic state
        isDead = false;
        player.x = CENTER_X; player.y = CENTER_Y; player.health = player.maxHealth;

        // Minimal spawnWave fallback if real one is missing
        window.spawnWave = window.spawnWave || function(w){
            try{
                mobs = mobs || [];
                // spawn a few placeholder mobs for testing
                for(let i=0;i<4;i++){
                    const x = Math.random() * viewWidth;
                    const y = Math.random() * viewHeight;
                    mobs.push({ x, y, radius: 12 + Math.floor(Math.random()*8), speed: 0.8 + Math.random()*1.2, health: 30, maxHealth: 30, name: 'Bug', type: 'bug', vx:0, vy:0 });
                }
            }catch(e){ console.warn('spawnWave fallback failed', e); }
        };

        // Simple update & draw loop (non-invasive; does not rely on missing helpers)
        function simpleUpdate(){
            // basic player movement
            if(keys['ArrowUp']||keys['w']||keys['W']) player.y -= player.speed;
            if(keys['ArrowDown']||keys['s']||keys['S']) player.y += player.speed;
            if(keys['ArrowLeft']||keys['a']||keys['A']) player.x -= player.speed;
            if(keys['ArrowRight']||keys['d']||keys['D']) player.x += player.speed;
            player.x = Math.max(player.radius, Math.min(viewWidth - player.radius, player.x));
            player.y = Math.max(player.radius, Math.min(viewHeight - player.radius, player.y));

            // update projectiles
            for(let i=projectiles.length-1;i>=0;i--){ const p = projectiles[i]; p.x += (p.dx||0); p.y += (p.dy||0); if(p.x < -50 || p.x > viewWidth+50 || p.y < -50 || p.y > viewHeight+50) projectiles.splice(i,1); }

            // move mobs simply
            for(const m of mobs){
                const dx = player.x - m.x; const dy = player.y - m.y; const d = Math.hypot(dx,dy)||1;
                m.x += (dx/d) * (m.speed||0.6) * 0.25;
                m.y += (dy/d) * (m.speed||0.6) * 0.25;
            }
        }

        function simpleDraw(){
            try{
                ctx.clearRect(0,0,viewWidth,viewHeight);
                // background
                ctx.fillStyle = '#061018'; ctx.fillRect(0,0,viewWidth,viewHeight);
                // mobs
                for(const m of mobs){ ctx.save(); ctx.fillStyle = '#cc8899'; ctx.beginPath(); ctx.arc(m.x, m.y, m.radius,0,Math.PI*2); ctx.fill(); ctx.restore(); }
                // projectiles
                for(const p of projectiles){ ctx.save(); ctx.fillStyle = (p.type==='Missile') ? '#111' : '#fff'; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius||4,0,Math.PI*2); ctx.fill(); ctx.restore(); }
                // player
                ctx.save(); ctx.beginPath(); ctx.fillStyle = '#7fe0a8'; ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2); ctx.fill(); ctx.restore();
                // HUD
                ctx.save(); ctx.fillStyle = '#ffffff'; ctx.font = '14px Arial'; ctx.fillText('HP: ' + Math.round(player.health) + '/' + player.maxHealth, 12, 20); ctx.restore();
            }catch(e){ console.warn('simpleDraw failed', e); }
        }

        function loop(){
            simpleUpdate();
            simpleDraw();
            animationId = requestAnimationFrame(loop);
        }

        // kick off
        spawnWave(currentWave || 1);
        loop();
    };
}
