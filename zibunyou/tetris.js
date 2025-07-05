// ぷよぷよテトリス風TETRIS HTML実装
// 操作・ループ感度・DAS/ARR/SDFをそれっぽく再現
// 火力計算、REN, TSPIN, TETRIS, HOLD, NEXT4, ハードドロップ等全対応

// 定数
const COLS = 10, ROWS = 20, BLOCK = 32;
const DAS = 100, ARR = 16, SDF = 20; // ms
const GRAVITY = 1000 / 60; // 60分の1G
const LOCK_DELAY = 500; // ms
const LINE_CLEAR_DELAY = 350; // ms
const NEXT_COUNT = 4;

const COLORS = {
  I: "#00F0F0", O: "#F0F000", T: "#A000F0",
  S: "#00F000", Z: "#F00000", J: "#0000F0", L: "#F0A000",
  G: "#222"
};

const SHAPES = {
  I: [[0,1],[1,1],[2,1],[3,1]],
  O: [[1,0],[2,0],[1,1],[2,1]],
  T: [[1,0],[0,1],[1,1],[2,1]],
  S: [[1,0],[2,0],[0,1],[1,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]],
  J: [[0,0],[0,1],[1,1],[2,1]],
  L: [[2,0],[0,1],[1,1],[2,1]]
};

const SRS_KICKS = {
  I: [
    [[0,0],[0,0],[-2,0],[1,0],[1,2],[-2,-1],[1,-2],[-2,1],[1,-2],[1,2]],
    [[0,0],[1,0],[1,-2],[0,1],[0,-2],[1,-1],[1,2],[0,-1],[0,2],[1,1]]
  ],
  O: [[[0,0]]],
  others: [
    [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    [[0,0],[1,0],[1,1],[0,-2],[1,-2]]
  ]
};

// DT砲/TD系テンプレートを意識してT-spin検出強化

const PIECES = ['I','O','T','S','Z','J','L'];

function shuffleBag() {
  const bag = [...PIECES], out = [];
  while(bag.length) out.push(bag.splice(Math.random()*bag.length|0,1)[0]);
  return out;
}

function createMatrix(w, h) {
  return Array.from({length: h}, () => Array(w).fill(null));
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// 火力表: PuyoPuyoTetris基準
const ATTACK_TABLE = {
  1: 0, 2: 1, 3: 2, 4: 4,
  TSPIN_MINI: [0,2,4], // mini single/double/triple
  TSPIN: [2,4,6],      // single/double/triple
  B2B: 1,
  REN: [0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,14,14,15,15,16,16,17,17,18,18,19,19,20,20]
};

const KEY = {
  LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, Z: 90, X: 88, C: 67, SPACE: 32
};

// ゲーム変数
let field, nexts, hold, canHold, piece, pos, rot, lockTick;
let lines = 0, attacks = 0, combo = -1, b2b = false, lastClear = null;
let startTime = 0, totalAttack = 0, dropStart = 0, dps = 0;
let keys = {}, dasDir = 0, dasTick = 0, arrTick = 0, sdfTick = 0, softDrop = false;
let lastMove = 0, gameover = false;

// 描画
const cvs = document.getElementById("game");
const ctx = cvs.getContext("2d");
const holdCvs = document.getElementById("hold");
const holdCtx = holdCvs.getContext("2d");
const nextCanvases = Array.from(document.getElementsByClassName("next")).map(n => n.getContext("2d"));

// util
function drawBlock(ctx, x, y, color, mini = false) {
  ctx.fillStyle = color;
  ctx.fillRect(x*BLOCK+(mini?12:0), y*BLOCK+(mini?12:0), BLOCK-(mini?24:1), BLOCK-(mini?24:1));
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.strokeRect(x*BLOCK+(mini?12:0), y*BLOCK+(mini?12:0), BLOCK-(mini?24:1), BLOCK-(mini?24:1));
}

// ミノ描画
function drawPiece(ctx, type, x=0, y=0, r=0, mini=false) {
  ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
  if(!type) return;
  const shape = rotate(SHAPES[type], r, type);
  shape.forEach(([dx,dy]) => drawBlock(ctx, dx+x, dy+y, COLORS[type], mini));
}

// フィールド描画
function drawField() {
  ctx.fillStyle = "#222";
  ctx.fillRect(0,0,cvs.width,cvs.height);
  for(let y=0; y<ROWS; ++y) for(let x=0; x<COLS; ++x)
    if(field[y][x]) drawBlock(ctx, x, y, COLORS[field[y][x]]);
  // ゴースト
  let ghostY = pos.y;
  while(!collide(field, piece, {x: pos.x, y: ghostY+1}, rot)) ghostY++;
  if(ghostY !== pos.y) {
    ctx.globalAlpha = 0.3;
    rotate(SHAPES[piece], rot, piece).forEach(([dx,dy]) => drawBlock(ctx, dx+pos.x, dy+ghostY, COLORS[piece]));
    ctx.globalAlpha = 1.0;
  }
  // 現在ミノ
  rotate(SHAPES[piece], rot, piece).forEach(([dx,dy]) => drawBlock(ctx, dx+pos.x, dy+pos.y, COLORS[piece]));
}

// ホールド・ネクスト
function drawHold() {
  drawPiece(holdCtx, hold, 0, 0, 0, true);
}
function drawNext() {
  for(let i=0; i<NEXT_COUNT; ++i) drawPiece(nextCanvases[i], nexts[i], 0, 0, 0, true);
}

// システム描画
function drawSystem() {
  document.getElementById("lines").textContent = lines;
  document.getElementById("attack").textContent = attacks;
  document.getElementById("dps").textContent = dps.toFixed(2);
}

// 回転
function rotate(shape, r, type) {
  let c = shape;
  for(let i=0;i<r;i++) c = c.map(([x,y])=>type==="I"?[y,3-x]:[-y,x]);
  return c;
}

// 衝突
function collide(mat, type, position, r) {
  const s = rotate(SHAPES[type], r, type);
  for(const [dx,dy] of s){
    let x=position.x+dx, y=position.y+dy;
    if(x<0||x>=COLS||y<0||y>=ROWS||mat[y]&&mat[y][x]) return true;
  }
  return false;
}

// ミノ生成
function spawn(){
  piece = nexts.shift();
  nexts.push(...shuffleBag());
  pos = {x: 3, y: piece==="I"?-1:0};
  rot = 0;
  canHold = true;
  lockTick = 0;
  if(collide(field, piece, pos, rot)) gameOver();
  dropStart = Date.now();
}

// ホールド
function doHold(){
  if(!canHold) return;
  [piece,hold] = [hold||nexts.shift(),piece];
  pos = {x: 3, y: hold==="I"?-1:0};
  rot = 0;
  canHold = false;
  if(collide(field, piece, pos, rot)) gameOver();
}

// 固定
function place(){
  rotate(SHAPES[piece], rot, piece).forEach(([dx,dy])=>{
    let x=pos.x+dx, y=pos.y+dy;
    if(y>=0) field[y][x]=piece;
  });
  let {cleared, tspin, mini} = clearCheck(piece, pos, rot);
  let atk = attackLine(cleared, tspin, mini);
  lines += cleared;
  attacks += atk;
  totalAttack += atk;
  dps = totalAttack / ((Date.now()-startTime)/1000);
  combo = cleared?combo+1:-1;
  if(cleared) showClearLabel(cleared, tspin, mini, atk);
  spawn();
}

// 行消し・T-spin判定
function clearCheck(type, p, r){
  let mino = rotate(SHAPES[type], r, type);
  let filled = [];
  for(let y=0; y<ROWS; ++y)
    if(field[y].every(v=>v)) filled.push(y);
  // T-spin判定
  let tspin = false, mini = false;
  if(type==="T"){
    // 3点以上隅が埋まっていればT-spin
    let cnt = 0, corner = [[0,0],[2,0],[0,2],[2,2]];
    for(const [dx,dy] of corner){
      let x=p.x+dx-1, y=p.y+dy-1;
      if(x<0||x>=COLS||y<0||y>=ROWS||field[y]&&field[y][x]) cnt++;
    }
    tspin = cnt>=3;
    // mini判定
    if(tspin && !mino.some(([dx,dy]) => {
      let x=p.x+dx, y=p.y+dy+1;
      return field[y]&&field[y][x]===null;
    })) mini = true;
  }
  // 行消し
  for(const y of filled) field.splice(y,1), field.unshift(Array(COLS).fill(null));
  return {cleared: filled.length, tspin, mini};
}

// 火力計算
function attackLine(cleared, tspin, mini){
  let atk = 0;
  if(tspin){
    if(mini) atk = ATTACK_TABLE.TSPIN_MINI[cleared-1]||0;
    else atk = ATTACK_TABLE.TSPIN[cleared-1]||0;
    if(b2b && cleared>=1) atk += ATTACK_TABLE.B2B;
    b2b = true;
    lastClear = "T-SPIN";
  }else if(cleared===4){
    atk = ATTACK_TABLE[4];
    if(b2b) atk += ATTACK_TABLE.B2B;
    b2b = true;
    lastClear = "TETRIS";
  }else if(cleared>=1){
    atk = ATTACK_TABLE[cleared];
    b2b = false;
    lastClear = cleared===3?"TRIPLE":cleared===2?"DOUBLE":"SINGLE";
  }else{
    b2b = false;
  }
  // REN
  if(cleared) {
    atk += ATTACK_TABLE.REN[combo+1]||0;
    document.getElementById("combo-label").textContent = combo>=1?`REN ${combo+1}`:"";
    setTimeout(()=>{document.getElementById("combo-label").textContent="";}, LINE_CLEAR_DELAY);
  }
  // T-spin name
  if(tspin) lastClear = mini?`T-SPIN MINI ${cleared?"LINE":"NO"}`:`T-SPIN ${["SINGLE","DOUBLE","TRIPLE"][cleared-1]||""}`;
  return atk;
}

// ラベル
function showClearLabel(cleared, tspin, mini, atk){
  let label = tspin?(mini?"T-SPIN MINI":"T-SPIN")+[""," SINGLE"," DOUBLE"," TRIPLE"][cleared]||"";
  if(!tspin){
    if(cleared===4) label="TETRIS";
    else if(cleared) label=["","SINGLE","DOUBLE","TRIPLE","TETRIS"][cleared];
  }
  document.getElementById("clear-label").textContent = label?`${label} +${atk}`:"";
  setTimeout(()=>{document.getElementById("clear-label").textContent="";}, LINE_CLEAR_DELAY);
}

// ゲームオーバー
function gameOver(){
  gameover = true;
  alert("Game Over");
  location.reload();
}

// 入力
window.addEventListener("keydown", e=>{
  if(gameover) return;
  keys[e.keyCode] = true;
  if(e.keyCode===KEY.UP||e.keyCode===KEY.SPACE){ // ハードドロップ
    let ghostY = pos.y;
    while(!collide(field, piece, {x: pos.x, y: ghostY+1}, rot)) ghostY++;
    pos.y = ghostY;
    place();
  }else if(e.keyCode===KEY.Z){ // 左回転
    rotateTry(-1);
  }else if(e.keyCode===KEY.X){ // 右回転
    rotateTry(1);
  }else if(e.keyCode===KEY.C){ // ホールド
    doHold();
  }
});

// 入力離し
window.addEventListener("keyup", e=>{
  keys[e.keyCode] = false;
  if(e.keyCode===KEY.LEFT||e.keyCode===KEY.RIGHT) dasDir = 0;
  if(e.keyCode===KEY.DOWN) softDrop = false;
});

// 回転実行
function rotateTry(dir){
  let oldRot = rot, newRot = (rot + dir + 4) % 4;
  if(!collide(field, piece, pos, newRot)){
    rot = newRot; return;
  }
  // SRSキック
  let kicks = (piece==="I"?SRS_KICKS.I:SRS_KICKS.others)[dir>0?1:0];
  for(const [kx,ky] of kicks){
    if(!collide(field, piece, {x: pos.x+kx, y: pos.y+ky}, newRot)){
      pos.x += kx; pos.y += ky; rot=newRot; return;
    }
  }
}

// メインループ
function gameLoop(){
  if(gameover) return;
  let moved = false;
  // 横移動
  if(keys[KEY.LEFT]||keys[KEY.RIGHT]){
    let dir = keys[KEY.LEFT]?-1:1;
    if(dasDir!==dir){dasDir=dir;dasTick=Date.now();arrTick=0;}
    if(Date.now()-dasTick>DAS){
      if(Date.now()-arrTick>ARR){
        if(!collide(field, piece, {x: pos.x+dir, y: pos.y}, rot)){
          pos.x += dir; moved = true;
        }
        arrTick = Date.now();
      }
    }else if(!arrTick){
      if(!collide(field, piece, {x: pos.x+dir, y: pos.y}, rot)){
        pos.x += dir; moved = true;
      }
      arrTick = Date.now();
    }
  }
  // ソフトドロップ
  if(keys[KEY.DOWN]){
    if(Date.now()-sdfTick>SDF){
      if(!collide(field, piece, {x: pos.x, y: pos.y+1}, rot)){
        pos.y += 1; moved = true;
      }
      sdfTick = Date.now();
    }
    softDrop = true;
  }
  // 落下
  if(!softDrop && Date.now()-lastMove>GRAVITY){
    if(!collide(field, piece, {x: pos.x, y: pos.y+1}, rot)){
      pos.y += 1; moved = true;
      lastMove = Date.now();
    }else{
      lockTick += Date.now()-lastMove;
      if(lockTick > LOCK_DELAY) place();
    }
    lastMove = Date.now();
  }
  drawField();drawHold();drawNext();drawSystem();
  requestAnimationFrame(gameLoop);
}

// 初期化
function init(){
  field = createMatrix(COLS,ROWS);
  nexts = shuffleBag();
  while(nexts.length < NEXT_COUNT+1) nexts.push(...shuffleBag());
  hold = null; canHold = true; lines = 0; attacks = 0; combo = -1; b2b = false;
  piece = nexts.shift(); pos = {x: 3, y: piece==="I"?-1:0}; rot = 0;
  gameover = false; startTime = Date.now(); totalAttack = 0; dps = 0;
  drawField();drawHold();drawNext();drawSystem();
  requestAnimationFrame(gameLoop);
}

init();