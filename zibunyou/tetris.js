// ぷよぷよテトリス風 TETRIS
// 2024-2025 siz05氏向け

// -------------------- 設定値（ぷよテト準拠） --------------------
const COLS = 10, ROWS = 20;
const BLOCK = 20;
const ARR = 16; // Auto-Repeat Rate (frames): 約0.267s（60fps基準）ぷよテト: 16F
const DAS = 10; // Delayed Auto-Shift (frames): 約0.167s（60fps基準）ぷよテト: 10F
const SDF = 16; // Soft Drop Factor (blocks/frame)
const GRAVITY = 1/60; // 1G (60fps)
const LOCK_DELAY = 30; // ミノ設置後のロック猶予（frames）ぷよテト: 30F
const NEXT_NUM = 4;

// 火力テーブル ぷよテト準拠
const ATTACK_TABLE = {
  tetris: 4,
  triple: 2,
  double: 1,
  single: 0,
  tspinMini: 0,
  tspinMiniSingle: 2,
  tspin: 2,
  tspinSingle: 2,
  tspinDouble: 4,
  tspinTriple: 6,
  backToBack: 1,
  miniBackToBack: 1,
  ren: [0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10], // 0index
}

// ミノ定義（DT砲、TD対応、SRS）
const TETROMINOS = {
  I: [
    [[0,1,0,0],
     [0,1,0,0],
     [0,1,0,0],
     [0,1,0,0]],
    [[0,0,0,0],
     [1,1,1,1],
     [0,0,0,0],
     [0,0,0,0]],
    [[0,0,1,0],
     [0,0,1,0],
     [0,0,1,0],
     [0,0,1,0]],
    [[0,0,0,0],
     [0,0,0,0],
     [1,1,1,1],
     [0,0,0,0]]
  ],
  O: [
    [[1,1],
     [1,1]],
    [[1,1],
     [1,1]],
    [[1,1],
     [1,1]],
    [[1,1],
     [1,1]]
  ],
  S: [
    [[0,1,1],
     [1,1,0],
     [0,0,0]],
    [[0,1,0],
     [0,1,1],
     [0,0,1]],
    [[0,0,0],
     [0,1,1],
     [1,1,0]],
    [[1,0,0],
     [1,1,0],
     [0,1,0]]
  ],
  Z: [
    [[1,1,0],
     [0,1,1],
     [0,0,0]],
    [[0,0,1],
     [0,1,1],
     [0,1,0]],
    [[0,0,0],
     [1,1,0],
     [0,1,1]],
    [[0,1,0],
     [1,1,0],
     [1,0,0]]
  ],
  J: [
    [[1,0,0],
     [1,1,1],
     [0,0,0]],
    [[0,1,1],
     [0,1,0],
     [0,1,0]],
    [[0,0,0],
     [1,1,1],
     [0,0,1]],
    [[0,1,0],
     [0,1,0],
     [1,1,0]]
  ],
  L: [
    [[0,0,1],
     [1,1,1],
     [0,0,0]],
    [[0,1,0],
     [0,1,0],
     [0,1,1]],
    [[0,0,0],
     [1,1,1],
     [1,0,0]],
    [[1,1,0],
     [0,1,0],
     [0,1,0]]
  ],
  T: [
    [[0,1,0],
     [1,1,1],
     [0,0,0]],
    [[0,1,0],
     [0,1,1],
     [0,1,0]],
    [[0,0,0],
     [1,1,1],
     [0,1,0]],
    [[0,1,0],
     [1,1,0],
     [0,1,0]]
  ]
}

const COLORS = {
  I: "#00f0f0",
  O: "#f0f000",
  S: "#00f000",
  Z: "#f00000",
  J: "#0000f0",
  L: "#f0a000",
  T: "#b000f0"
};

const KEY = {
  LEFT: 37, RIGHT: 39, DOWN: 40, UP: 38, C: 67,
  Z: 90, X: 88, SPACE: 32
};

let field, current, hold, holdUsed, nexts, queue;
let frame, dropFrame, lockFrame, gravity, gameOver;
let lines, attack, dps, startFrame;
let b2b, ren, lastClear;
let moveState = {left:0, right:0, das:0, arr:0, direction:0, softDrop:false};
let stats = {lines:0, attack:0, clears:0, lastAttack:0, dps:0, frames:0, lastClearLines:0};

window.onload = () => {
  init();
  requestAnimationFrame(mainLoop);
};

function init() {
  field = [...Array(ROWS)].map(_ => Array(COLS).fill(""));
  queue = [];
  nexts = [];
  for (let i=0; i<7; i++) queue.push(...shuffledBag());
  nexts = queue.slice(0,NEXT_NUM);
  queue = queue.slice(NEXT_NUM);
  lines = attack = dps = frame = dropFrame = lockFrame = 0;
  startFrame = null;
  b2b = false; ren = 0; lastClear = 0;
  hold = null; holdUsed = false; gameOver = false;
  spawnTetromino();
  updateInfo();
  drawAll();
}

function shuffledBag() {
  return ["I","O","S","Z","J","L","T"].sort(()=>Math.random()-0.5);
}

function spawnTetromino() {
  if (queue.length < 7) queue.push(...shuffledBag());
  current = {
    type: nexts[0],
    x: 3,
    y: -getMinY(nexts[0],0),
    dir: 0,
    shape: TETROMINOS[nexts[0]][0]
  };
  nexts.shift();
  nexts.push(queue.shift());
  holdUsed = false;
  if (isCollide(current)) {
    gameOver = true;
  }
}

function getMinY(type, dir) {
  const shape = TETROMINOS[type][dir];
  for (let y=0; y<shape.length; y++) {
    if (shape[y].some(v=>v)) return y;
  }
  return 0;
}

function isCollide(piece, dx=0, dy=0, ndir=null) {
  const shape = TETROMINOS[piece.type][ndir===null?piece.dir:ndir];
  for (let y=0; y<shape.length; y++) {
    for (let x=0; x<shape[y].length; x++) {
      if (shape[y][x]) {
        let nx = piece.x + x + dx, ny = piece.y + y + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && field[ny][nx]) return true;
      }
    }
  }
  return false;
}

function placePiece() {
  const shape = TETROMINOS[current.type][current.dir];
  for (let y=0; y<shape.length; y++) {
    for (let x=0; x<shape[y].length; x++) {
      if (shape[y][x]) {
        let nx = current.x + x, ny = current.y + y;
        if (ny >= 0) field[ny][nx] = current.type;
      }
    }
  }
}

function clearLines() {
  let cleared = 0;
  for (let y=ROWS-1; y>=0; y--) {
    if (field[y].every(cell=>cell)) {
      field.splice(y,1);
      field.unshift(Array(COLS).fill(""));
      cleared++;
      y++;
    }
  }
  return cleared;
}

function tryHold() {
  if (holdUsed) return;
  if (!hold) {
    hold = current.type;
    spawnTetromino();
  } else {
    [hold, current.type] = [current.type, hold];
    current.dir = 0;
    current.x = 3;
    current.y = -getMinY(current.type,0);
    current.shape = TETROMINOS[current.type][0];
    if (isCollide(current)) {
      gameOver = true;
    }
  }
  holdUsed = true;
}

function hardDrop() {
  while (!isCollide(current,0,1)) {
    current.y++;
  }
  lockFrame = LOCK_DELAY;
  update();
}

function softDrop() {
  if (!isCollide(current,0,1)) {
    current.y++;
    stats.clears++;
  }
}

function rotate(dir) {
  let ndir = (current.dir + dir + 4) % 4;
  if (!isCollide(current,0,0,ndir)) {
    current.dir = ndir;
    current.shape = TETROMINOS[current.type][current.dir];
  } else {
    // SRS simple壁蹴り
    for (let [dx,dy] of [[1,0],[-1,0],[0,-1],[0,1]]) {
      if (!isCollide(current,dx,dy,ndir)) {
        current.x += dx;
        current.y += dy;
        current.dir = ndir;
        current.shape = TETROMINOS[current.type][current.dir];
        break;
      }
    }
  }
}

function update() {
  if (gameOver) return;
  // 落下
  if (moveState.softDrop) {
    for (let i=0; i<SDF; i++) {
      if (!isCollide(current,0,1)) current.y++;
      else break;
    }
  } else {
    dropFrame += gravity;
    if (dropFrame >= 1) {
      dropFrame = 0;
      if (!isCollide(current,0,1)) {
        current.y++;
      } else {
        lockFrame++;
        if (lockFrame >= LOCK_DELAY) {
          placePiece();
          let cleared = clearLines();
          stats.lines += cleared;
          lines += cleared;
          // 火力計算
          let atk = 0, tetris = false, tspin = false;
          if (current.type === "T" && isTSpin()) {
            tspin = true;
            if (cleared === 1) atk = ATTACK_TABLE.tspinSingle;
            else if (cleared === 2) atk = ATTACK_TABLE.tspinDouble;
            else if (cleared === 3) atk = ATTACK_TABLE.tspinTriple;
            else atk = ATTACK_TABLE.tspin;
          } else if (cleared === 4) {
            atk = ATTACK_TABLE.tetris;
            tetris = true;
          } else if (cleared === 3) atk = ATTACK_TABLE.triple;
          else if (cleared === 2) atk = ATTACK_TABLE.double;
          else if (cleared === 1) atk = ATTACK_TABLE.single;
          // B2B/REN
          if ((tetris || tspin) && lastClear > 0) { atk += ATTACK_TABLE.backToBack; b2b = true; }
          if (cleared > 0) ren++;
          else ren = 0;
          atk += ATTACK_TABLE.ren[Math.min(ren,ATTACK_TABLE.ren.length-1)];
          attack += atk;
          stats.attack += atk;
          lastClear = cleared;
          lockFrame = 0;
          spawnTetromino();
        }
      }
    }
  }
}

function isTSpin() {
  // Tミノで3隅にブロック
  const cx = current.x+1, cy = current.y+1;
  let corners = 0;
  for (let [dx,dy] of [[0,0],[2,0],[0,2],[2,2]]) {
    let x = cx+dx-1, y = cy+dy-1;
    if (x<0||x>=COLS||y<0||y>=ROWS||field[y][x]) corners++;
  }
  return corners>=3;
}

// キー制御 ------------------------------
document.addEventListener("keydown", e => {
  if (gameOver) return;
  switch (e.keyCode) {
    case KEY.LEFT:
      moveState.left = 1; moveState.das = 0; moveState.direction = -1;
      tryMove(-1,0);
      break;
    case KEY.RIGHT:
      moveState.right = 1; moveState.das = 0; moveState.direction = 1;
      tryMove(1,0);
      break;
    case KEY.DOWN:
      moveState.softDrop = true;
      break;
    case KEY.UP:
      hardDrop();
      break;
    case KEY.Z:
      rotate(-1);
      break;
    case KEY.X:
      rotate(1);
      break;
    case KEY.C:
      tryHold();
      break;
  }
});
document.addEventListener("keyup", e => {
  switch (e.keyCode) {
    case KEY.LEFT: moveState.left = 0; moveState.das = 0; break;
    case KEY.RIGHT: moveState.right = 0; moveState.das = 0; break;
    case KEY.DOWN: moveState.softDrop = false; break;
  }
});

function tryMove(dx,dy) {
  if (!isCollide(current,dx,dy)) current.x += dx, current.y += dy;
}

function handleARR() {
  if (moveState.left || moveState.right) {
    moveState.das++;
    if (moveState.das > DAS) {
      moveState.arr++;
      if (moveState.arr >= ARR) {
        moveState.arr = 0;
        tryMove(moveState.direction,0);
      }
    }
  } else {
    moveState.das = 0; moveState.arr = 0;
  }
}

// 描画部 -------------------------------
function drawAll() {
  drawField();
  drawHold();
  drawNext();
  updateInfo();
}

function drawField() {
  const ctx = document.getElementById("game-canvas").getContext("2d");
  ctx.clearRect(0,0, BLOCK*COLS, BLOCK*ROWS);
  // フィールド
  for (let y=0; y<ROWS; y++) for (let x=0; x<COLS; x++) {
    if (field[y][x]) drawBlock(ctx, x, y, COLORS[field[y][x]]);
  }
  // 現在ミノ
  const shape = TETROMINOS[current.type][current.dir];
  for (let y=0; y<shape.length; y++)
    for (let x=0; x<shape[y].length; x++)
      if (shape[y][x]) drawBlock(ctx, current.x+x, current.y+y, COLORS[current.type]);
  // ゴースト
  let gy = current.y;
  while (!isCollide(current,0,gy-current.y+1)) gy++;
  ctx.globalAlpha = 0.3;
  for (let y=0; y<shape.length; y++)
    for (let x=0; x<shape[y].length; x++)
      if (shape[y][x]) drawBlock(ctx, current.x+x, gy+y, COLORS[current.type]);
  ctx.globalAlpha = 1.0;
}

function drawBlock(ctx, x, y, color) {
  if (y<0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
  ctx.strokeStyle = "#222";
  ctx.strokeRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
}

function drawHold() {
  const ctx = document.getElementById("hold-canvas").getContext("2d");
  ctx.clearRect(0,0,80,80);
  if (!hold) return;
  drawMiniMino(ctx, hold, 20, 20);
}

function drawNext() {
  const ctx = document.getElementById("next-canvas").getContext("2d");
  ctx.clearRect(0,0,80,320);
  for (let i=0; i<NEXT_NUM; i++) {
    drawMiniMino(ctx, nexts[i], 20, i*80+20);
  }
}

function drawMiniMino(ctx, type, ox, oy) {
  const shape = TETROMINOS[type][0];
  const color = COLORS[type];
  for (let y=0; y<shape.length; y++)
    for (let x=0; x<shape[y].length; x++)
      if (shape[y][x]) {
        ctx.fillStyle = color;
        ctx.fillRect(ox+x*15, oy+y*15, 15, 15);
        ctx.strokeStyle = "#111";
        ctx.strokeRect(ox+x*15, oy+y*15, 15, 15);
      }
}

function updateInfo() {
  document.getElementById("lines").textContent = "Lines: " + lines;
  document.getElementById("attack").textContent = "攻撃量: " + attack;
  document.getElementById("dps").textContent = "DPS: " + (frame ? (attack/(frame/60)).toFixed(2) : "0.00");
}

// メインループ -------------------------
function mainLoop(ts) {
  if (!startFrame) startFrame = ts;
  frame = Math.floor((ts-startFrame)/1000*60);
  gravity = GRAVITY;
  handleARR();
  update();
  drawAll();
  if (!gameOver) requestAnimationFrame(mainLoop);
  else {
    const ctx = document.getElementById("game-canvas").getContext("2d");
    ctx.font = "24px Meiryo";
    ctx.fillStyle = "#fff";
    ctx.fillText("GAME OVER", 30, 200);
  }
}