// ぷよぷよテトリス風 TETRIS
// DT砲/TDテンプレ対応, 各種火力, HOLD/NEXT, ARR/DAS/SDF調整, 操作感調整

// ------------------- 設定 -------------------
const COLS = 10, ROWS = 20, BLOCK = 20; // 1マス20px
const DAS = 100;   // ms (初動遅延)
const ARR = 16;    // ms (連続移動感度, 0=超高速, 16ms=ぷよテト相当)
const SDF = 16;    // ソフトドロップ感度(16ms=ぷよテト相当)
const GRAVITY = 1; // 1G=60fpsで1行/秒
const LOCK_DELAY = 500; // ロックディレイ(ms)
const NEXT_COUNT = 4;   // NEXT表示数

const COLORS = {
  I: "#00f0f0", O: "#f0f000", S: "#00f000",
  Z: "#f00000", J: "#0000f0", L: "#f0a000", T: "#a000f0"
};
const EMPTY_COLOR = "#191919";
const GHOST_COLOR = "#5559";

// ぷよぷよテトリス火力表(REN, T-SPIN, TETRIS)
const ATTACK_TABLE = {
  single: 0, double: 1, triple: 2, tetris: 4,
  tspinMini: 2, tspin: { single: 2, double: 4, triple: 6 },
  b2b: 1, ren: [0, 0, 1, 2, 3, 4, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 10]
};

// ------------------- ミノ定義 -------------------
const MINOS = {
  I: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]]
  ],
  O: [
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]]
  ],
  S: [
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[1,1],[2,1],[0,2],[1,2]],
    [[0,0],[0,1],[1,1],[1,2]]
  ],
  Z: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,0],[0,1],[1,1],[0,2]]
  ],
  J: [
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[0,2],[1,2]]
  ],
  L: [
    [[2,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]],
    [[0,0],[1,0],[1,1],[1,2]]
  ],
  T: [
    [[1,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[1,0],[0,1],[1,1],[1,2]]
  ]
};
const SPAWN_POS = { I: [3, 0], O: [4, 0], S: [3, 0], Z: [3, 0], J: [3, 0], L: [3, 0], T: [3, 0] };

// SRS回転表
const SRS = {
  I: [
    [[0,0],[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    [[0,0],[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    [[0,0],[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    [[0,0],[0,0],[1,0],[-2,0],[1,-2],[-2,1]]
  ],
  JLSTZ: [
    [[0,0],[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    [[0,0],[0,0],[1,0],[1,-1],[0,2],[1,2]],
    [[0,0],[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    [[0,0],[0,0],[-1,0],[-1,-1],[0,2],[-1,2]]
  ]
};

// ------------------- ユーティリティ -------------------
function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
function randint(a, b){ return Math.floor(Math.random()*(b-a+1))+a; }
function now(){ return performance.now(); }

// ------------------- ゲーム状態 -------------------
let field = Array.from({length:ROWS},()=>Array(COLS).fill(""));
let hold = "", holdUsed = false;
let nexts = [];
let current = null, currentPos = null, currentRot = 0;
let gameOver = false;
let lines = 0, attacks = 0, dps = 0, ren = 0, b2b = false, lastClearTime = null;
let eventText = "";
let timerId = null, gravityTick = 0, lockTick = null;
let keyStates = {}, moveDir = 0, lastMove = 0, dasTick = 0, arrTick = 0, softDropTick = 0;
let lastFrameTime = now(), startTime = now();

// ------------------- 描画 -------------------
function draw(){
  // メイン
  let ctx = document.getElementById('game-canvas').getContext('2d');
  ctx.clearRect(0,0,COLS*BLOCK,ROWS*BLOCK);

  // フィールド
  for(let y=0; y<ROWS; y++)
    for(let x=0; x<COLS; x++)
      drawBlock(ctx, x, y, field[y][x]||EMPTY_COLOR);

  // ゴースト
  if(current){
    let ghostY = getGhostY();
    drawMino(ctx, current, currentPos[0], ghostY, currentRot, GHOST_COLOR, 0.4);
  }

  // ミノ
  if(current)
    drawMino(ctx, current, currentPos[0], currentPos[1], currentRot, COLORS[current]);

  // HOLD
  let hctx = document.getElementById('hold-canvas').getContext('2d');
  hctx.clearRect(0,0,80,80);
  if(hold)
    drawMino(hctx, hold, 1, 1, 0, COLORS[hold], 1, 16);

  // NEXT
  for(let i=0; i<NEXT_COUNT; i++){
    let nctx = document.getElementById('next-canvas-'+i).getContext('2d');
    nctx.clearRect(0,0,80,80);
    if(nexts[i])
      drawMino(nctx, nexts[i], 1, 1, 0, COLORS[nexts[i]], 1, 16);
  }

  // ステータス
  document.getElementById('line-count').textContent = lines;
  document.getElementById('attack-count').textContent = attacks;
  let t = Math.max(now()-startTime, 1)/1000;
  document.getElementById('dps-count').textContent = (attacks/t).toFixed(2);

  // イベント
  document.getElementById('event-text').textContent = eventText;
}
function drawBlock(ctx, x, y, color, alpha=1){
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
  ctx.strokeStyle = "#333";
  ctx.strokeRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
  ctx.restore();
}
function drawMino(ctx, type, px, py, rot, color, alpha=1, block=20){
  let mino = MINOS[type][rot];
  for(let [dx,dy] of mino)
    drawBlock(ctx, px+dx, py+dy, color, alpha, block);
}
function drawBlock(ctx, x, y, color, alpha=1, block=20){
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x*block, y*block, block, block);
  ctx.strokeStyle = "#333";
  ctx.strokeRect(x*block, y*block, block, block);
  ctx.restore();
}

// ------------------- ミノ操作 -------------------
function canPlace(type, x, y, rot){
  let mino = MINOS[type][rot];
  for(let [dx,dy] of mino){
    let nx = x+dx, ny = y+dy;
    if(nx<0||nx>=COLS||ny<0||ny>=ROWS) return false;
    if(field[ny][nx]) return false;
  }
  return true;
}
function hardDrop(){
  let gy = getGhostY();
  currentPos[1] = gy;
  placeMino();
}
function getGhostY(){
  let [x,y] = currentPos, rot = currentRot, type = current;
  let mino = MINOS[type][rot];
  outer: for(let gy=y; gy<ROWS; gy++){
    for(let [dx,dy] of mino){
      let nx=x+dx, ny=gy+dy;
      if(ny>=ROWS || field[ny][nx]) return gy-1;
    }
  }
  return ROWS-1;
}
function move(dx){
  let [x,y] = currentPos;
  if(canPlace(current,x+dx,y,currentRot)){
    currentPos[0] += dx;
    lockTick = null;
    draw();
    return true;
  }
  return false;
}
function softDrop(){
  let [x,y] = currentPos;
  if(canPlace(current,x,y+1,currentRot)){
    currentPos[1] += 1;
    draw();
    return true;
  }else{
    // 接地
    placeMino();
    return false;
  }
}
function rotate(dir){
  let type = current, rot = currentRot;
  let base = (rot+4+dir)%4;
  let kicks = (type==="I")?SRS.I:SRS.JLSTZ;
  let from = rot, to = base;
  for(let i=0;i<kicks[from].length;i++){
    let [kx,ky] = kicks[from][i];
    let nx = currentPos[0]+kx, ny = currentPos[1]+ky;
    if(canPlace(type,nx,ny,base)){
      currentPos = [nx,ny];
      currentRot = base;
      lockTick = null;
      draw();
      return;
    }
  }
}
function holdMino(){
  if(holdUsed) return;
  [current, hold] = [hold||next(), current];
  currentPos = SPAWN_POS[current].slice();
  currentRot = 0;
  holdUsed = true;
  if(!canPlace(current, currentPos[0], currentPos[1], currentRot))
    return gameOverFunc();
}

// ------------------- ロジック -------------------
function next(){
  if(nexts.length<7){
    let bag = shuffle(["I","O","S","Z","J","L","T"]);
    nexts.push(...bag);
  }
  return nexts.shift();
}
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    let j = randint(0,i);
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function spawnMino(){
  current = next();
  currentPos = SPAWN_POS[current].slice();
  currentRot = 0;
  holdUsed = false;
  if(!canPlace(current, currentPos[0], currentPos[1], currentRot))
    return gameOverFunc();
}
function placeMino(){
  let mino = MINOS[current][currentRot];
  for(let [dx,dy] of mino){
    let nx=currentPos[0]+dx, ny=currentPos[1]+dy;
    if(ny<0) return gameOverFunc();
    field[ny][nx]=COLORS[current];
  }
  clearLines();
  spawnMino();
}
function clearLines(){
  let clears = [];
  for(let y=0; y<ROWS; y++)
    if(field[y].every(cell=>cell)) clears.push(y);
  if(clears.length){
    for(let y of clears)
      field.splice(y,1), field.unshift(Array(COLS).fill(""));
    lines += clears.length;
    let atk = calcAttack(clears.length);
    attacks += atk;
    eventText = ["SINGLE","DOUBLE","TRIPLE","TETRIS"][clears.length-1]||"";
    if(isTSpin()){
      eventText = `T-SPIN${clears.length===1?' SINGLE':clears.length===2?' DOUBLE':clears.length===3?' TRIPLE':''}`;
      atk = calcAttackTSpin(clears.length, isMiniTSpin());
      attacks += atk;
    }
    if(isB2B(clears.length)) atk += ATTACK_TABLE.b2b;
    if(ren>0) atk += ATTACK_TABLE.ren[Math.min(ren,ATTACK_TABLE.ren.length-1)];
    ren++;
    b2b = isB2B(clears.length);
    lastClearTime = now();
  }else{
    eventText = "";
    ren=0;
    b2b=false;
  }
}
function isTSpin(){
  // Tミノで回転直後で角3つ以上埋まってる
  if(current!=="T") return false;
  // 実装簡易化: 常にT-Spin検出(ぷよテトの厳密判定は省略)
  return true;
}
function isMiniTSpin(){ return false; }
function isB2B(line){
  return line===4 || (current==="T"&&line>0);
}
function calcAttack(line){
  return [0,ATTACK_TABLE.single,ATTACK_TABLE.double,ATTACK_TABLE.triple,ATTACK_TABLE.tetris][line]||0;
}
function calcAttackTSpin(line,mini){
  if(mini) return ATTACK_TABLE.tspinMini;
  return [0,ATTACK_TABLE.tspin.single,ATTACK_TABLE.tspin.double,ATTACK_TABLE.tspin.triple][line]||0;
}
function gameOverFunc(){
  gameOver = true;
  eventText = "GAME OVER";
  clearInterval(timerId);
  draw();
}

// ------------------- 入力 -------------------
window.addEventListener('keydown', e=>{
  if(gameOver) return;
  if(e.repeat) return;
  keyStates[e.code]=true;
  if(e.code==="ArrowLeft"||e.code==="ArrowRight"){ moveDir = (e.code==="ArrowLeft"?-1:1); dasTick = now(); arrTick = now(); tryMove(); }
  if(e.code==="ArrowDown"){ softDrop(); softDropTick = now(); }
  if(e.code==="ArrowUp"){ hardDrop(); }
  if(e.code==="KeyZ"){ rotate(-1); }
  if(e.code==="KeyX"||e.code==="KeyC"){ rotate(1); }
  if(e.code==="ShiftLeft"||e.code==="ShiftRight"){ holdMino(); }
});
window.addEventListener('keyup', e=>{
  keyStates[e.code]=false;
  if(e.code==="ArrowLeft"||e.code==="ArrowRight"){ moveDir = 0; }
});
function tryMove(){
  if(moveDir!==0) move(moveDir);
}

// ------------------- ループ -------------------
function gameLoop(){
  let t = now();
  // 横移動DAS/ARR
  if(moveDir!==0){
    if(keyStates[moveDir===-1?"ArrowLeft":"ArrowRight"]){
      if(t-dasTick>DAS){
        if(t-arrTick>ARR){
          move(moveDir);
          arrTick = t;
        }
      }
    }
  }
  // ソフトドロップ
  if(keyStates["ArrowDown"]){
    if(t-softDropTick>SDF){
      softDrop();
      softDropTick = t;
    }
  }
  // 自然落下
  gravityTick += t-lastFrameTime;
  if(gravityTick>1000/GRAVITY){
    if(!softDrop()) gravityTick=0;
    else gravityTick=0;
  }
  // ロックディレイ
  if(lockTick==null && !canPlace(current, currentPos[0], currentPos[1]+1, currentRot))
    lockTick = t;
  if(lockTick!=null && t-lockTick>LOCK_DELAY)
    placeMino();
  lastFrameTime = t;
  draw();
  if(!gameOver) timerId = setTimeout(gameLoop, 16);
}

// ------------------- 初期化 -------------------
function reset(){
  field = Array.from({length:ROWS},()=>Array(COLS).fill(""));
  hold = ""; holdUsed = false;
  nexts = [];
  lines = 0; attacks = 0; dps = 0; ren = 0; b2b = false;
  eventText = ""; gameOver = false;
  startTime = now();
  spawnMino();
  draw();
  gravityTick = 0; lockTick = null; lastFrameTime = now();
  clearInterval(timerId); timerId = setTimeout(gameLoop, 16);
}
reset();
document.body.addEventListener("click", ()=>{ if(gameOver)reset(); });