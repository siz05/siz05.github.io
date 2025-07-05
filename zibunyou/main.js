// --- 設定 ---
const COLS = 10;
const ROWS = 24; // Pythonは1-index+壁込み、JavaScriptは0-indexで壁無し
const VISIBLE_ROWS = 20;
const BLOCK_SIZE = 30;
const DAS = 2;
const ARR = 3;
const SDF = 3;

// --- 盤面 ---
let board = [];
function initBoard() {
    board = [];
    for (let y = 0; y < ROWS + 2; y++) {
        let row = [];
        for (let x = 0; x < COLS + 2; x++) {
            if (x === 0 || x === COLS + 1 || y === 0 || y === ROWS + 1) row.push(1);
            else row.push(0);
        }
        board.push(row);
    }
}

// --- ミノ定義 (Pythonの番号と合わせて2=I, 3=O, ... 8=T) ---
const MINO_TYPES = [2, 3, 4, 5, 6, 7, 8];
const TETROMINOS = {
    2: [ // I
        [1, 13, 25, 37],   // 0
        [13, 14, 15, 16],  // 1
        [1, 13, 25, 37],   // 2
        [13, 14, 15, 16],  // 3
    ],
    3: [ // O
        [13, 14, 25, 26],
        [13, 14, 25, 26],
        [13, 14, 25, 26],
        [13, 14, 25, 26],
    ],
    4: [ // S
        [14, 15, 25, 26],
        [13, 25, 26, 38],
        [14, 15, 25, 26],
        [13, 25, 26, 38],
    ],
    5: [ // Z
        [13, 14, 26, 27],
        [14, 25, 26, 37],
        [13, 14, 26, 27],
        [14, 25, 26, 37],
    ],
    6: [ // J
        [13, 25, 26, 27],
        [14, 15, 26, 38],
        [13, 14, 15, 27],
        [12, 14, 25, 26],
    ],
    7: [ // L
        [15, 25, 26, 27],
        [14, 15, 25, 38],
        [13, 14, 15, 25],
        [12, 25, 26, 27],
    ],
    8: [ // T
        [14, 25, 26, 27],
        [14, 25, 26, 38],
        [13, 14, 15, 26],
        [14, 25, 26, 38],
    ],
};
// --- ミノの色 ---
const MINO_COLORS = ["#00ffff", "#ffff00", "#00ff00", "#ff0000", "#0000ff", "#ffa500", "#a000f0"];
const GHOST_COLORS = ["#00cccc", "#cccc00", "#00cc00", "#cc0000", "#0000cc", "#cc8800", "#8000a0"];
// --- SRS風回転オフセット（Pythonロジックに準拠） ---
const ROTATE_OFFSETS = [
    [0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]
];

// --- グローバル変数 ---
let canvas, ctx, holdCanvas, holdCtx, nextCanvas, nextCtx;
let next = [];
let tet_type = "";
let tet_d = 0;
let tet_x = 0;
let tet_y = 0;
let hold = "";
let able_hold = 1;
let rockdown_f = 0;
let touch = 0;
let key_list = Array(7).fill(false);
let key_down = Array(7).fill(0);
let keyname = ["space", "Down", "Left", "Right", "z", "x", "c"];
let fall_mino = [0, 0, 0, 0];
let ghost_fall_mino = [0, 0, 0, 0];
let G = 0;
let SDF_counter = 0;
let app; // for after()
let size = BLOCK_SIZE;

// --- Next生成 ---
function gene_next() {
    let l1 = [2, 3, 4, 5, 6, 7, 8];
    for (let i = 0; i < 7; i++) {
        let idx = Math.floor(Math.random() * l1.length);
        next.push(l1[idx]);
        l1.splice(idx, 1);
    }
}

// --- ミノセット ---
function mino_set() {
    if (tet_type !== "") {
        let v1 = tet_y * 12 + tet_x + 1;
        let v2 = (tet_type - 2) * 16 + tet_d * 4;
        for (let i = 0; i < 4; i++) {
            fall_mino[i] = v1 + mino_position[i + v2] - 1;
        }
    }
}

// --- ゴーストミノセット ---
function ghost_mino_set() {
    let v2 = -12;
    let v1 = enable(-12);
    while (v1 === 1 && v2 > -300) {
        v2 -= 12;
        v1 = enable(v2);
    }
    for (let i = 0; i < 4; i++) {
        ghost_fall_mino[i] = fall_mino[i] + v2 + 12;
    }
    if (v2 === -12) {
        touch = 1;
    } else {
        touch = 0;
    }
}

// --- 有効判定 ---
function enable(plus) {
    for (let i = 0; i < 4; i++) {
        let pos = fall_mino[i] + plus;
        let y = Math.floor(pos / 12);
        let x = pos % 12;
        if (board[y][x]) return 0;
    }
    return 1;
}

// --- 描画 ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 背景
    ctx.fillStyle = "#0e101f";
    ctx.fillRect(0, 0, BLOCK_SIZE * 12, BLOCK_SIZE * 32);

    // 盤面
    for (let y = 2; y < ROWS + 1; y++) {
        for (let x = 1; x < COLS + 1; x++) {
            if (board[y][x]) {
                draw_mino((x - 1) * BLOCK_SIZE, (y - 2) * BLOCK_SIZE, board[y][x] - 2, 0, BLOCK_SIZE, false);
            }
        }
    }
    // ゴーストミノ
    if (tet_type !== "") {
        for (let i = 0; i < 4; i++) {
            let pos = ghost_fall_mino[i];
            let y = Math.floor(pos / 12) - 2;
            let x = (pos % 12) - 1;
            draw_mino(x * BLOCK_SIZE, y * BLOCK_SIZE, tet_type - 2, 0, BLOCK_SIZE, true);
        }
        // 操作ミノ
        for (let i = 0; i < 4; i++) {
            let pos = fall_mino[i];
            let y = Math.floor(pos / 12) - 2;
            let x = (pos % 12) - 1;
            draw_mino(x * BLOCK_SIZE, y * BLOCK_SIZE, tet_type - 2, 0, BLOCK_SIZE, false);
        }
    }
}

// --- ミノ描画 ---
function draw_mino(x, y, type, pos, size, ghost) {
    ctx.fillStyle = ghost ? GHOST_COLORS[type] : MINO_COLORS[type];
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(x, y, size, size);
}

// --- ロックダウン ---
function rockdown() {
    mino_set();
    ghost_mino_set();
    for (let i = 0; i < 4; i++) {
        let pos = ghost_fall_mino[i];
        let y = Math.floor(pos / 12);
        let x = pos % 12;
        board[y][x] = tet_type;
    }
    tet_type = "";
    able_hold = 1;
    line_delete();
}

// --- ライン消去 ---
function line_delete() {
    for (let y = 1; y < ROWS + 1; y++) {
        let full = true;
        for (let x = 1; x < COLS + 1; x++) {
            if (board[y][x] === 0) {
                full = false;
                break;
            }
        }
        if (full) {
            for (let yy = y; yy > 1; yy--) {
                for (let x = 1; x < COLS + 1; x++) {
                    board[yy][x] = board[yy - 1][x];
                }
            }
            for (let x = 1; x < COLS + 1; x++) {
                board[1][x] = 0;
            }
        }
    }
}

// --- 回転 ---
function rotate(d) {
    let prev_d = tet_d;
    tet_d = (tet_d + d + 4) % 4;
    mino_set();
    let end = false;
    for (let i = 0; i < 5; i++) {
        let plus = ROTATE_OFFSETS[i][0] * d + ROTATE_OFFSETS[i][1] * d * 12;
        let ok = true;
        for (let j = 0; j < 4; j++) {
            let pos = fall_mino[j] + plus;
            let y = Math.floor(pos / 12);
            let x = pos % 12;
            if (board[y][x]) {
                ok = false;
                break;
            }
        }
        if (ok) {
            let center = tet_y * 12 + tet_x + 1 + plus;
            tet_x = center % 12 - 1;
            tet_y = Math.floor(center / 12);
            rockdown_f = 0;
            mino_set();
            ghost_mino_set();
            end = true;
            break;
        }
    }
    if (!end) tet_d = prev_d;
}

// --- Hold ---
function do_hold() {
    if (!able_hold) return;
    able_hold = 0;
    tet_x = 5;
    tet_y = 22;
    tet_d = 0;
    if (hold === "") {
        hold = tet_type;
        tet_type = next.shift();
    } else {
        let v1 = hold;
        hold = tet_type;
        tet_type = v1;
    }
}

// --- メインゲームループ ---
function game() {
    if (tet_type === "") {
        tet_type = next.shift();
        tet_x = 5;
        tet_y = 22;
        tet_d = 0;
        rockdown_f = 0;
        if (next.length < 21) gene_next();
    }
    // Hold
    if (key_list[6] && able_hold) {
        do_hold();
    }
    // 自由落下
    G++;
    if (G > 15) {
        mino_set();
        if (enable(-12)) {
            tet_y--;
        }
        G = 0;
    }
    // ロックダウン
    if (rockdown_f > 40) {
        rockdown();
        rockdown_f = 0;
    }
    // ハードドロップ
    if (key_list[0] && key_down[0] === 0) {
        key_down[0] = 1;
        rockdown();
    } else if (!key_list[0]) {
        key_down[0] = 0;
    }
    // 左移動
    if (key_list[2] && !key_list[3]) {
        if (key_down[2] === 0 || DAS < key_down[2]) {
            let dash = (DAS < key_down[2]) ? 1 : 0;
            for (let i = 0; i < 1 + dash * ARR; i++) {
                mino_set();
                if (enable(-1)) {
                    tet_x--;
                    rockdown_f = 0;
                }
            }
        }
        key_down[2]++;
    } else {
        key_down[2] = 0;
    }
    // 右移動
    if (key_list[3] && !key_list[2]) {
        if (key_down[3] === 0 || DAS < key_down[3]) {
            let dash = (DAS < key_down[3]) ? 1 : 0;
            for (let i = 0; i < 1 + dash * ARR; i++) {
                mino_set();
                if (enable(1)) {
                    tet_x++;
                    rockdown_f = 0;
                }
            }
        }
        key_down[3]++;
    } else {
        key_down[3] = 0;
    }
    // ソフトドロップ
    if (key_list[1]) {
        for (let i = 0; i < SDF; i++) {
            mino_set();
            if (enable(-12)) {
                tet_y--;
                G = 0;
            } else {
                rockdown_f += 2;
            }
        }
    }
    // 左回転
    if (key_list[4]) {
        if (key_down[4] === 0) rotate(-1);
        key_down[4] = 1;
    } else key_down[4] = 0;
    // 右回転
    if (key_list[5]) {
        if (key_down[5] === 0) rotate(1);
        key_down[5] = 1;
    } else key_down[5] = 0;

    // ゴースト・落下ミノセット
    mino_set();
    ghost_mino_set();
}

// --- イベントハンドラ ---
function keydownHandler(e) {
    for (let i = 0; i < 7; i++) {
        if (e.code === "Space" && keyname[i] === "space") key_list[i] = true;
        else if (e.code === "ArrowDown" && keyname[i] === "Down") key_list[i] = true;
        else if (e.code === "ArrowLeft" && keyname[i] === "Left") key_list[i] = true;
        else if (e.code === "ArrowRight" && keyname[i] === "Right") key_list[i] = true;
        else if (e.code === "KeyZ" && keyname[i] === "z") key_list[i] = true;
        else if (e.code === "KeyX" && keyname[i] === "x") key_list[i] = true;
        else if (e.code === "KeyC" && keyname[i] === "c") key_list[i] = true;
    }
}
function keyupHandler(e) {
    for (let i = 0; i < 7; i++) {
        if (e.code === "Space" && keyname[i] === "space") key_list[i] = false;
        else if (e.code === "ArrowDown" && keyname[i] === "Down") key_list[i] = false;
        else if (e.code === "ArrowLeft" && keyname[i] === "Left") key_list[i] = false;
        else if (e.code === "ArrowRight" && keyname[i] === "Right") key_list[i] = false;
        else if (e.code === "KeyZ" && keyname[i] === "z") key_list[i] = false;
        else if (e.code === "KeyX" && keyname[i] === "x") key_list[i] = false;
        else if (e.code === "KeyC" && keyname[i] === "c") key_list[i] = false;
    }
}

// --- ミノの相対座標データ（Pythonのmino_positionに相当） ---
const mino_position = [
    0, 1, 2, 3,  // I
    0, 12, 24, 36,
    0, 1, 12, 13, // O
    0, 1, 2, 13,
    0, 12, 13, 25,
    0, 12, 13, 14, // S
    1, 2, 12, 13,
    0, 1, 13, 14,
    0, 12, 24, 25,
    0, 1, 13, 25, // J
    0, 1, 12, 24,
    0, 1, 2, 13,
    0, 12, 13, 14,
    1, 2, 12, 24, // L
    0, 12, 13, 14,
    0, 1, 2, 13,
    0, 1, 12, 13, // T
    0, 1, 2, 13,
    0, 12, 13, 25,
    0, 12, 13, 14,
];

// --- 初期化 ---
function init() {
    // キャンバスセット
    canvas = document.getElementById('tetris');
    ctx = canvas.getContext('2d');
    initBoard();
    // Next初期化
    next = [];
    for (let i = 0; i < 100; i++) gene_next();
    // ゲーム変数
    tet_type = "";
    tet_d = 0;
    tet_x = 0;
    tet_y = 0;
    hold = "";
    able_hold = 1;
    rockdown_f = 0;
    touch = 0;
    G = 0;
}

// --- メインループ ---
function mainloop() {
    game();
    draw();
    setTimeout(mainloop, 33);
}

// --- イベント ---
window.addEventListener('keydown', keydownHandler);
window.addEventListener('keyup', keyupHandler);

// --- スタート ---
window.onload = function() {
    init();
    mainloop();
};