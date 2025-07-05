// PPT風テトリス本体
const COLS = 10, ROWS = 20;
const BLOCK = 20;
const BOARD_W = COLS * BLOCK, BOARD_H = ROWS * BLOCK;
const NEXT_COUNT = 4;

const DAS = 133;     // ms
const ARR = 16;      // ms
const SDF = 16;      // ms
const GRAVITY = 1/60;

const KEY = {
  LEFT: 37, RIGHT: 39, DOWN: 40, UP: 38, HOLD: 67 // C
};

const COLORS = [
  "#00f0f0", "#0000f0", "#f0a000", "#f0f000", "#00f000", "#a000f0", "#f00000"
];

// ミノ定義
const PIECES = [
  { name: "I", color: 0, shape: [[0,1],[1,1],[2,1],[3,1]], spawn: {x:3,y:0}, type: 0 },
  { name: "J", color: 1, shape: [[0,0],[0,1],[1,1],[2,1]], spawn: {x:3,y:0}, type: 1 },
  { name: "L", color: 2, shape: [[2,0],[0,1],[1,1],[2,1]], spawn: {x:3,y:0}, type: 2 },
  { name: "O", color: 3, shape: [[1,0],[2,0],[1,1],[2,1]], spawn: {x:4,y:0}, type: 3 },
  { name: "S", color: 4, shape: [[1,0],[2,0],[0,1],[1,1]], spawn: {x:3,y:0}, type: 4 },
  { name: "T", color: 5, shape: [[1,0],[0,1],[1,1],[2,1]], spawn: {x:3,y:0}, type: 5 },
  { name: "Z", color: 6, shape: [[0,0],[1,0],[1,1],[2,1]], spawn: {x:3,y:0}, type: 6 }
];

// 火力表（ぷよテト準拠）
const GARBAGE_TABLE = {
  1: 0, 2: 1, 3: 2, 4: 4,
  tmini: 0,
  tspin0: 2,
  tspin1: 2,
  tspin2: 4,
  tspin3: 6,
  btb: 1,
  ren: [0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10]
};

let board, current, hold, holdUsed, next, combo, b2b, ren, lines, atk, dropStart, dropTime;
let stats = { lines:0, atk:0, drops:0, start:0, lastAttack:0 };
let dasTimer = null, arrTimer = null, moveDir = 0;
let softDrop = false, gravity = 0, lockDelay = 0;

// 配列のディープコピー
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function resetGame() {
  board = Array.from({length:ROWS}, ()=>Array(COLS).fill(-1));
  next = [];
  for(let i=0; i<NEXT_COUNT+2; ++i) next.push(randomPiece());
  current = spawnPiece();
  hold = null;
  holdUsed = false;
  combo = 0;
  b2b = false;
  ren = 0;
  lines = 0;
  atk = 0;
  stats = { lines:0, atk:0, drops:0, start:Date.now(), lastAttack:0 };
  dropStart = Date.now();
  dropTime = dropStart;
  gravity = 0;
  lockDelay = 0;
  drawAll();
}

function randomPiece() {
  if(!randomPiece.bag || randomPiece.bag.length === 0) {
    randomPiece.bag = [...Array(7).keys()];
    for(let i=6;i>0;--i) {
      const j = Math.floor(Math.random()*(i+1));
      [randomPiece.bag[i],randomPiece.bag[j]] = [randomPiece.bag[j],randomPiece.bag[i]];
    }
  }
  // クローンして返す
  return clone(PIECES[randomPiece.bag.pop()]);
}

function spawnPiece() {
  let piece = next.shift();
  next.push(randomPiece());
  piece = clone(piece);
  piece.x = piece.spawn.x;
  piece.y = piece.spawn.y;
  piece.r = 0;
  piece.lastMove = Date.now();
  holdUsed = false;
  return piece;
}

function getPieceBlocks(p, r=p.r, x=p.x, y=p.y) {
  let shape = PIECES[p.type].shape;
  let pts = shape.map(([px,py]) => rotate(px,py,r,p.type));
  return pts.map(([dx,dy]) => [dx+x, dy+y]);
}

function rotate(x,y,r,type) {
  if(type === 3) { // O
    return [x,y];
  }
  if(type === 0) { // I
    if(r===0) return [x,y];
    if(r===1) return [y,3-x];
    if(r===2) return [3-x,3-y];
    if(r===3) return [3-y,x];
  }
  if(r===0) return [x,y];
  if(r===1) return [y,2-x];
  if(r===2) return [2-x,2-y];
  if(r===3) return [2-y,x];
}

function canMove(p,x,y,r) {
  let blocks = getPieceBlocks(p,r,x,y);
  return blocks.every(([cx,cy])=>
    cx>=0 && cx<COLS && cy<ROWS && (cy<0 || board[cy][cx]===-1));
}

function move(dx,dy) {
  if(canMove(current,current.x+dx,current.y+dy,current.r)) {
    current.x += dx;
    current.y += dy;
    drawAll();
    return true;
  }
  return false;
}

function rotatePiece(dir) {
  let oldR = current.r;
  let newR = (current.r+dir+4)%4;
  let type = current.type;
  // SRS省略: 通常回転のみ
  if(canMove(current,current.x,current.y,newR)) {
    current.r = newR;
    drawAll();
    return;
  }
}

function holdPiece() {
  if(holdUsed) return;
  if(hold) {
    [hold,current] = [clone(current),clone(hold)];
    current.x = PIECES[current.type].spawn.x;
    current.y = PIECES[current.type].spawn.y;
    current.r = 0;
  } else {
    hold = clone(current);
    current = spawnPiece();
  }
  holdUsed = true;
  drawAll();
}

function hardDrop() {
  let y = current.y;
  while(canMove(current,current.x,y+1,current.r)) y++;
  current.y = y;
  placePiece();
}

function softDropStart() {
  softDrop = true;
}
function softDropEnd() {
  softDrop = false;
}

function placePiece() {
  let blocks = getPieceBlocks(current);
  blocks.forEach(([x,y])=>{
    if(y>=0) board[y][x] = current.color;
  });
  let [line, tspin, mini] = checkLinesAndTSpin();
  lines += line;
  stats.lines += line;
  let fire = calcAtk(line, tspin, mini);
  atk += fire;
  stats.atk += fire;
  if(line>0) stats.lastAttack = Date.now();
  current = spawnPiece();
  if(!canMove(current,current.x,current.y,current.r)) {
    setTimeout(resetGame, 1000);
  }
  drawAll();
}

function calcAtk(line, tspin, mini) {
  let btbUsed = false;
  let atk = 0;
  if(tspin) {
    if(line===1) atk = (mini ? GARBAGE_TABLE.tmini : GARBAGE_TABLE.tspin1);
    else if(line===2) atk = GARBAGE_TABLE.tspin2;
    else if(line===3) atk = GARBAGE_TABLE.tspin3;
    btbUsed = true;
  } else {
    atk = GARBAGE_TABLE[line] || 0;
    if(line===4) btbUsed = true;
  }
  if(btbUsed) {
    if(b2b) atk += GARBAGE_TABLE.btb;
    b2b = true;
  } else {
    b2b = false;
  }
  if(line>0) {
    ren++;
    atk += GARBAGE_TABLE.ren[Math.min(ren,20)];
  } else {
    ren = 0;
  }
  return atk;
}

function checkLinesAndTSpin() {
  let tspin = false, mini = false;
  if(current.type===5) {
    let t = current;
    let centerX = t.x+1, centerY = t.y+1;
    let cnt = 0;
    [[0,0],[2,0],[0,2],[2,2]].forEach(([dx,dy])=>{
      let x = centerX+dx-1, y = centerY+dy-1;
      if(y>=0 && (x<0||x>=COLS||y>=ROWS||board[y][x]!==-1)) cnt++;
    });
    if(cnt>=3) tspin = true;
    if(tspin && (t.r%2)!==0) mini = true;
  }
  let del = [];
  for(let y=0;y<ROWS;++y) {
    if(board[y].every(c=>c!==-1)) del.push(y);
  }
  del.forEach(y=>board.splice(y,1));
  while(board.length<ROWS) board.unshift(Array(COLS).fill(-1));
  return [del.length, tspin, mini];
}

// 入力
window.addEventListener('keydown',e=>{
  if(e.repeat) return;
  switch(e.keyCode) {
    case KEY.LEFT: startMove(-1); break;
    case KEY.RIGHT: startMove(1); break;
    case KEY.DOWN: softDropStart(); break;
    case KEY.UP: hardDrop(); break;
    case KEY.HOLD: holdPiece(); break;
  }
});
window.addEventListener('keyup',e=>{
  switch(e.keyCode) {
    case KEY.LEFT:
    case KEY.RIGHT: stopMove(); break;
    case KEY.DOWN: softDropEnd(); break;
  }
});

function startMove(dir) {
  moveDir = dir;
  move(dir,0);
  if(dasTimer) clearTimeout(dasTimer);
  if(arrTimer) clearInterval(arrTimer);
  dasTimer = setTimeout(()=>{
    arrTimer = setInterval(()=>{
      move(moveDir,0);
    }, ARR);
  }, DAS);
}

function stopMove() {
  moveDir = 0;
  if(dasTimer) clearTimeout(dasTimer);
  if(arrTimer) clearInterval(arrTimer);
}

// 描画
function drawAll() {
  drawBoard();
  drawHold();
  drawNext();
  drawStats();
}

function drawBoard() {
  let boardCanvas = document.getElementById('board');
  if (!boardCanvas) return;
  let ctx = boardCanvas.getContext('2d');
  ctx.clearRect(0,0,BOARD_W,BOARD_H);
  for(let y=0;y<ROWS;++y)
    for(let x=0;x<COLS;++x)
      if(board[y][x]!==-1) drawBlock(ctx,x,y,COLORS[board[y][x]]);
  if(current) {
    let ghostY = current.y;
    while(canMove(current,current.x,ghostY+1,current.r)) ghostY++;
    getPieceBlocks(current).forEach(([x,y])=>{
      if(y>=0) drawBlock(ctx,x,ghostY,COLORS[current.color],0.3);
    });
    getPieceBlocks(current).forEach(([x,y])=>{
      if(y>=0) drawBlock(ctx,x,y,COLORS[current.color],1.0);
    });
  }
}

function drawBlock(ctx,x,y,color,alpha=1.0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x*BLOCK,y*BLOCK,BLOCK,BLOCK);
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(x*BLOCK+0.5,y*BLOCK+0.5,BLOCK-1,BLOCK-1);
  ctx.restore();
}

function drawHold() {
  let holdCanvas = document.getElementById('hold');
  if (!holdCanvas) return;
  let ctx = holdCanvas.getContext('2d');
  ctx.clearRect(0,0,80,80);
  if(hold) drawPiece(ctx, hold, 1, 1);
}

function drawNext() {
  for(let i=0;i<NEXT_COUNT;++i) {
    let nextCanvas = document.getElementById('next'+i);
    if (!nextCanvas) continue;
    let ctx = nextCanvas.getContext('2d');
    ctx.clearRect(0,0,80,80);
    if(next[i]) drawPiece(ctx, next[i], 1, 1);
  }
}

function drawPiece(ctx, p, ox, oy) {
  PIECES[p.type].shape.forEach(([x,y])=>{
    let [dx,dy] = rotate(x,y,0,p.type);
    drawBlock(ctx,dx+ox,dy+oy,COLORS[p.color]);
  });
}

function drawStats() {
  let linesElem = document.getElementById('lines');
  let atkElem = document.getElementById('atk');
  let dpsElem = document.getElementById('dps');
  if (linesElem) linesElem.textContent = lines;
  if (atkElem) atkElem.textContent = atk;
  let sec = (Date.now()-stats.start)/1000;
  let dps = stats.atk/(sec||1);
  if (dpsElem) dpsElem.textContent = dps.toFixed(2);
}

// ゲームループ
function gameLoop() {
  let now = Date.now();
  let dt = (now-dropTime)/1000;
  dropTime = now;
  gravity += (softDrop? (1/SDF) : GRAVITY) * dt * 60;
  let moved = false;
  while(gravity>=1) {
    if(move(0,1)) moved = true;
    else {
      if(lockDelay++>30) {
        placePiece();
        lockDelay = 0;
        gravity = 0;
      }
      break;
    }
    gravity--;
  }
  if(!moved) lockDelay++;
  requestAnimationFrame(gameLoop);
}

// DOMContentLoadedで初期化
window.addEventListener("DOMContentLoaded", () => {
  resetGame();
  gameLoop();
});