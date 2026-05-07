"use strict";

const modulations = ["ASK", "FSK", "BPSK", "DPSK"];
let lastSweepRows = [];
let lastSweepSummary = null;

const el = {
  bitCount: document.getElementById("bitCount"),
  samplesPerSymbol: document.getElementById("samplesPerSymbol"),
  carrierCycles: document.getElementById("carrierCycles"),
  fskCycles0: document.getElementById("fskCycles0"),
  fskCycles1: document.getElementById("fskCycles1"),
  trials: document.getElementById("trials"),
  seed: document.getElementById("seed"),
  singleMod: document.getElementById("singleMod"),
  singleSnr: document.getElementById("singleSnr"),
  snrStart: document.getElementById("snrStart"),
  snrEnd: document.getElementById("snrEnd"),
  snrStep: document.getElementById("snrStep"),
  importMod: document.getElementById("importMod"),
  txBitsFile: document.getElementById("txBitsFile"),
  rxSamplesFile: document.getElementById("rxSamplesFile"),
  singleResult: document.getElementById("singleResult"),
  sweepResult: document.getElementById("sweepResult"),
  importResult: document.getElementById("importResult"),
  exportCsv: document.getElementById("exportCsv"),
  exportReport: document.getElementById("exportReport"),
  txCanvas: document.getElementById("txCanvas"),
  rxCanvas: document.getElementById("rxCanvas"),
  demodCanvas: document.getElementById("demodCanvas"),
  berCanvas: document.getElementById("berCanvas"),
  runSingle: document.getElementById("runSingle"),
  runSweep: document.getElementById("runSweep"),
  runImported: document.getElementById("runImported")
};

el.runSingle.addEventListener("click", onRunSingle);
el.runSweep.addEventListener("click", onRunSweep);
el.runImported.addEventListener("click", onRunImported);
el.exportCsv.addEventListener("click", onExportCsv);
el.exportReport.addEventListener("click", onExportReport);

drawSignal(el.txCanvas, [], "发射信号");
drawSignal(el.rxCanvas, [], "接收信号");
drawSignal(el.demodCanvas, [], "解调度量");
drawBerChart(el.berCanvas, [], {}, {});

function readConfig() {
  const cfg = {
    bitCount: toInt(el.bitCount.value, 5000, 100, 500000),
    ns: toInt(el.samplesPerSymbol.value, 40, 8, 256),
    carrierCycles: toInt(el.carrierCycles.value, 4, 1, 20),
    fskCycles0: toInt(el.fskCycles0.value, 3, 1, 20),
    fskCycles1: toInt(el.fskCycles1.value, 5, 1, 20),
    trials: toInt(el.trials.value, 5, 1, 30),
    seed: toInt(el.seed.value, 20260506, 1, 2147483646)
  };
  if (cfg.fskCycles0 === cfg.fskCycles1) {
    cfg.fskCycles1 = cfg.fskCycles0 + 1;
    el.fskCycles1.value = String(cfg.fskCycles1);
  }
  return cfg;
}

function onRunSingle() {
  const cfg = readConfig();
  const mod = el.singleMod.value;
  const snrDb = Number(el.singleSnr.value);
  const rng = makeRng(cfg.seed);
  const bits = randomBits(cfg.bitCount, rng);
  const sim = simulateOne(mod, bits, snrDb, cfg, rng);

  drawSignal(el.txCanvas, sim.tx, `发射信号 (${mod})`);
  drawSignal(el.rxCanvas, sim.rx, `接收信号 (${mod}, SNR=${snrDb} dB)`);
  drawSignal(el.demodCanvas, sim.metric, `解调度量 (${mod})`);

  el.singleResult.textContent =
    `调制=${mod} | SNR=${snrDb} dB | 比特数=${sim.effectiveBits} | 误码=${sim.errors} | BER=${sim.ber.toExponential(4)} | 种子=${cfg.seed}`;
}

function onRunSweep() {
  const cfg = readConfig();
  const start = Number(el.snrStart.value);
  const end = Number(el.snrEnd.value);
  const step = Math.max(1, Number(el.snrStep.value));
  const snrs = [];

  if (end < start) {
    el.sweepResult.textContent = "SNR 终点必须大于等于起点。";
    return;
  }

  for (let s = start; s <= end + 1e-9; s += step) {
    snrs.push(Number(s.toFixed(6)));
  }

  const results = {};
  const theory = {};
  const rows = [["SNR_dB", ...modulations, "TH_ASK", "TH_FSK", "TH_BPSK", "TH_DPSK"]];
  for (const mod of modulations) {
    results[mod] = [];
    theory[mod] = [];
  }

  for (let i = 0; i < snrs.length; i += 1) {
    const snrDb = snrs[i];
    const row = [snrDb];
    for (let m = 0; m < modulations.length; m += 1) {
      const mod = modulations[m];
      let berSum = 0;
      for (let t = 0; t < cfg.trials; t += 1) {
        const rng = makeRng(cfg.seed + 100000 * i + 1000 * m + t);
        const bits = randomBits(cfg.bitCount, rng);
        const sim = simulateOne(mod, bits, snrDb, cfg, rng);
        berSum += sim.ber;
      }
      const berAvg = berSum / cfg.trials;
      results[mod].push(berAvg);
      row.push(berAvg);
    }
    for (const mod of modulations) {
      const tb = theoreticalBer(mod, snrDb);
      theory[mod].push(tb);
      row.push(tb);
    }
    rows.push(row);
  }

  lastSweepRows = rows;
  lastSweepSummary = {
    snrStart: start,
    snrEnd: end,
    snrStep: step,
    cfg,
    snrs,
    results,
    theory
  };
  el.exportCsv.disabled = false;
  el.exportReport.disabled = false;
  drawBerChart(el.berCanvas, snrs, results, theory);

  const minSummary = modulations
    .map((m) => {
      const minBer = Math.min(...results[m]);
      return `${m}:最小BER=${minBer.toExponential(3)}`;
    })
    .join(" | ");

  el.sweepResult.textContent =
    `扫频完成：SNR ${start}~${end} dB，步长 ${step} dB，重复 ${cfg.trials} 次，种子 ${cfg.seed}。${minSummary}`;
}

async function onRunImported() {
  const mod = el.importMod.value;
  const cfg = readConfig();
  const txFile = el.txBitsFile.files && el.txBitsFile.files[0];
  const rxFile = el.rxSamplesFile.files && el.rxSamplesFile.files[0];

  if (!txFile || !rxFile) {
    el.importResult.textContent = "请同时选择发送比特 CSV 和接收采样 CSV。";
    return;
  }

  try {
    const [txText, rxText] = await Promise.all([txFile.text(), rxFile.text()]);
    const txBits = parseBitList(txText);
    const rxSamples = parseNumberList(rxText);

    if (txBits.length === 0 || rxSamples.length === 0) {
      el.importResult.textContent = "导入数据为空或格式错误，请检查文件内容。";
      return;
    }

    const demodObj = demodulate(mod, rxSamples, cfg);
    const compareLen = Math.min(txBits.length, demodObj.bits.length);
    if (compareLen === 0) {
      el.importResult.textContent = "导入数据长度不足，无法完成判决。";
      return;
    }

    let errors = 0;
    for (let i = 0; i < compareLen; i += 1) {
      if (txBits[i] !== demodObj.bits[i]) {
        errors += 1;
      }
    }
    const ber = errors / compareLen;

    drawSignal(el.rxCanvas, rxSamples, `导入接收信号 (${mod})`);
    drawSignal(el.demodCanvas, demodObj.metric, `导入数据解调度量 (${mod})`);

    const usedSamples = compareLen * cfg.ns;
    const txView = modulate(mod, txBits.slice(0, compareLen), cfg).tx;
    drawSignal(el.txCanvas, txView, `导入比特对应发射参考 (${mod})`);

    el.importResult.textContent =
      `导入评估完成：调制=${mod} | 比特输入=${txBits.length} | 接收采样=${rxSamples.length} | 有效比特=${compareLen} | 使用采样≈${usedSamples} | 误码=${errors} | BER=${ber.toExponential(4)}`;
  } catch (err) {
    el.importResult.textContent = `导入失败：${err && err.message ? err.message : String(err)}`;
  }
}

function onExportCsv() {
  if (!lastSweepRows.length) {
    return;
  }
  const csv = lastSweepRows
    .map((row) => row.map((v) => (typeof v === "number" ? String(v) : v)).join(","))
    .join("\n");
  saveTextFile("ber_sweep_results.csv", csv, "text/csv;charset=utf-8;");
}

function onExportReport() {
  if (!lastSweepSummary) {
    return;
  }
  const report = buildReport(lastSweepSummary);
  saveTextFile("实验报告-自动生成.md", report, "text/markdown;charset=utf-8;");
}

function buildReport(summary) {
  const { cfg, snrStart, snrEnd, snrStep, results, theory, snrs } = summary;
  const lines = [];
  lines.push("# 数字频带通信系统仿真实验报告（自动生成）");
  lines.push("");
  lines.push("## 1. 实验配置");
  lines.push(`- 比特数：${cfg.bitCount}`);
  lines.push(`- 每码元采样点：${cfg.ns}`);
  lines.push(`- 重复次数：${cfg.trials}`);
  lines.push(`- 载波周期/码元：${cfg.carrierCycles}`);
  lines.push(`- FSK 低/高频周期：${cfg.fskCycles0}/${cfg.fskCycles1}`);
  lines.push(`- SNR 范围：${snrStart} ~ ${snrEnd} dB，步长 ${snrStep} dB`);
  lines.push(`- 随机种子：${cfg.seed}`);
  lines.push("");
  lines.push("## 2. 关键结果");
  for (const mod of modulations) {
    const arr = results[mod];
    const minBer = Math.min(...arr);
    const bestIdx = arr.indexOf(minBer);
    const bestSnr = snrs[bestIdx];
    const highSnrBer = arr[arr.length - 1];
    lines.push(`- ${mod}：最小 BER=${minBer.toExponential(4)}（SNR=${bestSnr} dB），高 SNR 端 BER=${highSnrBer.toExponential(4)}`);
  }
  lines.push("");
  lines.push("## 3. 仿真与理论对照（高 SNR 端）");
  for (const mod of modulations) {
    const simLast = results[mod][results[mod].length - 1];
    const thLast = theory[mod][theory[mod].length - 1];
    lines.push(`- ${mod}：仿真 BER=${simLast.toExponential(4)}，理论 BER=${thLast.toExponential(4)}`);
  }
  lines.push("");
  lines.push("## 4. 结论建议");
  lines.push("- 该结果可直接用于论文“仿真结果与分析”章节。");
  lines.push("- 若需要更平滑曲线，建议增大比特数与重复次数。");
  lines.push("- 若需要更真实验证，建议导入实测 tx/rx 数据并复用同一判决链路评估 BER。");
  lines.push("");
  lines.push("## 5. 理论模型说明");
  lines.push("- BPSK: BER = Q(sqrt(2*Eb/N0))");
  lines.push("- DPSK(差分检测): BER = 0.5*exp(-Eb/N0)");
  lines.push("- FSK(相干正交近似): BER = Q(sqrt(Eb/N0))");
  lines.push("- ASK(OOK相干近似): BER = Q(sqrt(Eb/(2*N0)))");
  return lines.join("\n");
}

function simulateOne(mod, bits, snrDb, cfg, rng) {
  const txObj = modulate(mod, bits, cfg);
  const rx = addAwgn(txObj.tx, snrDb, rng);
  const demodObj = demodulate(mod, rx, cfg);

  const compareLen = Math.min(bits.length, demodObj.bits.length);
  let errors = 0;
  for (let i = 0; i < compareLen; i += 1) {
    if (bits[i] !== demodObj.bits[i]) {
      errors += 1;
    }
  }
  return {
    tx: txObj.tx,
    rx,
    metric: demodObj.metric,
    errors,
    effectiveBits: compareLen,
    ber: compareLen > 0 ? errors / compareLen : 0
  };
}

function modulate(mod, bits, cfg) {
  const ns = cfg.ns;
  if (mod === "ASK") return { tx: genAsk(bits, ns, cfg.carrierCycles) };
  if (mod === "FSK") return { tx: genFsk(bits, ns, cfg.fskCycles0, cfg.fskCycles1) };
  if (mod === "BPSK") return { tx: genBpsk(bits, ns, cfg.carrierCycles) };
  if (mod === "DPSK") return { tx: genDpsk(bits, ns, cfg.carrierCycles) };
  throw new Error(`未知调制方式: ${mod}`);
}

function demodulate(mod, rx, cfg) {
  const ns = cfg.ns;
  if (mod === "ASK") return demodAsk(rx, ns, cfg.carrierCycles);
  if (mod === "FSK") return demodFsk(rx, ns, cfg.fskCycles0, cfg.fskCycles1);
  if (mod === "BPSK") return demodBpsk(rx, ns, cfg.carrierCycles);
  if (mod === "DPSK") return demodDpsk(rx, ns);
  throw new Error(`未知解调方式: ${mod}`);
}

function genAsk(bits, ns, cycles) {
  const out = new Array(bits.length * ns);
  let idx = 0;
  for (const bit of bits) {
    const amp = bit === 1 ? 1 : 0;
    for (let n = 0; n < ns; n += 1) out[idx++] = amp * carrier(n, ns, cycles);
  }
  return out;
}

function genFsk(bits, ns, c0, c1) {
  const out = new Array(bits.length * ns);
  let idx = 0;
  for (const bit of bits) {
    const cyc = bit === 1 ? c1 : c0;
    for (let n = 0; n < ns; n += 1) out[idx++] = carrier(n, ns, cyc);
  }
  return out;
}

function genBpsk(bits, ns, cycles) {
  const out = new Array(bits.length * ns);
  let idx = 0;
  for (const bit of bits) {
    const amp = bit === 1 ? 1 : -1;
    for (let n = 0; n < ns; n += 1) out[idx++] = amp * carrier(n, ns, cycles);
  }
  return out;
}

function genDpsk(bits, ns, cycles) {
  const symbols = bits.length + 1;
  const out = new Array(symbols * ns);
  let idx = 0;
  let phaseBit = 0;
  for (let n = 0; n < ns; n += 1) out[idx++] = carrier(n, ns, cycles);
  for (const bit of bits) {
    if (bit === 1) phaseBit ^= 1;
    const amp = phaseBit === 0 ? 1 : -1;
    for (let n = 0; n < ns; n += 1) out[idx++] = amp * carrier(n, ns, cycles);
  }
  return out;
}

function demodAsk(rx, ns, cycles) {
  const symbols = Math.floor(rx.length / ns);
  const bits = new Array(symbols);
  const metric = new Array(symbols * ns);
  const threshold = 0.25;
  for (let k = 0; k < symbols; k += 1) {
    let sum = 0;
    for (let n = 0; n < ns; n += 1) sum += rx[k * ns + n] * carrier(n, ns, cycles);
    const m = sum / ns;
    bits[k] = m >= threshold ? 1 : 0;
    for (let n = 0; n < ns; n += 1) metric[k * ns + n] = m;
  }
  return { bits, metric };
}

function demodFsk(rx, ns, c0, c1) {
  const symbols = Math.floor(rx.length / ns);
  const bits = new Array(symbols);
  const metric = new Array(symbols * ns);
  for (let k = 0; k < symbols; k += 1) {
    let s0 = 0;
    let s1 = 0;
    for (let n = 0; n < ns; n += 1) {
      const x = rx[k * ns + n];
      s0 += x * carrier(n, ns, c0);
      s1 += x * carrier(n, ns, c1);
    }
    const d = (s1 - s0) / ns;
    bits[k] = d >= 0 ? 1 : 0;
    for (let n = 0; n < ns; n += 1) metric[k * ns + n] = d;
  }
  return { bits, metric };
}

function demodBpsk(rx, ns, cycles) {
  const symbols = Math.floor(rx.length / ns);
  const bits = new Array(symbols);
  const metric = new Array(symbols * ns);
  for (let k = 0; k < symbols; k += 1) {
    let sum = 0;
    for (let n = 0; n < ns; n += 1) sum += rx[k * ns + n] * carrier(n, ns, cycles);
    const m = sum / ns;
    bits[k] = m >= 0 ? 1 : 0;
    for (let n = 0; n < ns; n += 1) metric[k * ns + n] = m;
  }
  return { bits, metric };
}

function demodDpsk(rx, ns) {
  const symbols = Math.floor(rx.length / ns);
  if (symbols <= 1) return { bits: [], metric: [] };
  const bits = new Array(symbols - 1);
  const metric = new Array((symbols - 1) * ns);
  for (let k = 1; k < symbols; k += 1) {
    let corr = 0;
    for (let n = 0; n < ns; n += 1) corr += rx[(k - 1) * ns + n] * rx[k * ns + n];
    bits[k - 1] = corr < 0 ? 1 : 0;
    const m = corr / ns;
    for (let n = 0; n < ns; n += 1) metric[(k - 1) * ns + n] = m;
  }
  return { bits, metric };
}

function addAwgn(signal, snrDb, rng) {
  const power = meanPower(signal);
  const snrLinear = Math.pow(10, snrDb / 10);
  const noisePower = power / snrLinear;
  const sigma = Math.sqrt(noisePower);
  const out = new Array(signal.length);
  for (let i = 0; i < signal.length; i += 1) out[i] = signal[i] + sigma * gaussian(rng);
  return out;
}

function theoreticalBer(mod, snrDb) {
  const ebn0 = Math.pow(10, snrDb / 10);
  if (mod === "BPSK") return qfunc(Math.sqrt(2 * ebn0));
  if (mod === "DPSK") return 0.5 * Math.exp(-ebn0);
  if (mod === "FSK") return qfunc(Math.sqrt(ebn0));
  if (mod === "ASK") return qfunc(Math.sqrt(ebn0 / 2));
  return NaN;
}

function qfunc(x) {
  return 0.5 * erfc(x / Math.SQRT2);
}

function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + z / 2);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 +
      t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 +
      t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function meanPower(arr) {
  let s = 0;
  for (const x of arr) s += x * x;
  return arr.length ? s / arr.length : 0;
}

function carrier(n, ns, cyclesPerSymbol) {
  return Math.cos((2 * Math.PI * cyclesPerSymbol * n) / ns);
}

function randomBits(count, rng) {
  const arr = new Array(count);
  for (let i = 0; i < count; i += 1) arr[i] = rng() < 0.5 ? 0 : 1;
  return arr;
}

function gaussian(rng) {
  let u1 = rng();
  const u2 = rng();
  if (u1 < 1e-12) u1 = 1e-12;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function makeRng(seedValue) {
  let seed = seedValue % 2147483647;
  if (seed <= 0) seed += 2147483646;
  return function next() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function parseBitList(text) {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const out = [];
  for (const tk of tokens) {
    if (tk === "0" || tk === "1") out.push(Number(tk));
  }
  return out;
}

function parseNumberList(text) {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const out = [];
  for (const tk of tokens) {
    const n = Number(tk);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function saveTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toInt(v, def, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function drawSignal(canvas, data, title) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#24405a";
  ctx.font = "14px Microsoft YaHei";
  ctx.fillText(title, 12, 20);
  ctx.strokeStyle = "#d7e1ec";
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  if (!data || data.length === 0) return;
  const view = sampleToWidth(data, w - 20);
  let min = Infinity;
  let max = -Infinity;
  for (const v of view) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = Math.max(1e-9, max - min);
  const padTop = 30;
  const padBottom = 12;
  const plotH = h - padTop - padBottom;
  ctx.strokeStyle = "#1b6fd2";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < view.length; i += 1) {
    const x = 10 + i;
    const y = padTop + ((max - view[i]) / span) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawBerChart(canvas, snrs, resultMap, theoryMap) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#24405a";
  ctx.font = "15px Microsoft YaHei";
  ctx.fillText("BER 对比曲线（实线=仿真，虚线=理论）", 12, 22);

  const left = 58;
  const right = 20;
  const top = 36;
  const bottom = 36;
  const pw = w - left - right;
  const ph = h - top - bottom;
  ctx.strokeStyle = "#d7e1ec";
  ctx.strokeRect(left, top, pw, ph);
  if (!snrs || snrs.length === 0) return;

  let yMin = 1e-5;
  let yMax = 1;
  for (const mod of modulations) {
    const arr = (resultMap && resultMap[mod]) || [];
    const tar = (theoryMap && theoryMap[mod]) || [];
    for (const v of arr.concat(tar)) if (v > 0) yMin = Math.min(yMin, v);
  }
  yMin = Math.max(1e-5, yMin / 2);
  drawAxisLabels(ctx, left, top, pw, ph, snrs, yMin, yMax);

  const colors = { ASK: "#cf2f3b", FSK: "#1f7a8c", BPSK: "#2f9e44", DPSK: "#7b4dd1" };
  for (const mod of modulations) {
    drawSeries(ctx, snrs, resultMap[mod] || [], left, top, pw, ph, yMin, yMax, colors[mod], false);
    drawSeries(ctx, snrs, theoryMap[mod] || [], left, top, pw, ph, yMin, yMax, colors[mod], true);

    const lx = left + 10 + modulations.indexOf(mod) * 120;
    const ly = h - 12;
    ctx.fillStyle = colors[mod];
    ctx.fillRect(lx, ly - 8, 18, 4);
    ctx.fillStyle = "#24405a";
    ctx.font = "13px Microsoft YaHei";
    ctx.fillText(`${mod} S/T`, lx + 24, ly);
  }
}

function drawSeries(ctx, snrs, arr, left, top, pw, ph, yMin, yMax, color, dashed) {
  if (!arr.length) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = dashed ? 1.3 : 2;
  if (dashed) ctx.setLineDash([6, 4]);
  else ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < snrs.length; i += 1) {
    const x = left + (i / (snrs.length - 1 || 1)) * pw;
    const y = top + logMap(arr[i] || yMax, yMin, yMax) * ph;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawAxisLabels(ctx, left, top, pw, ph, snrs, yMin, yMax) {
  ctx.fillStyle = "#57728c";
  ctx.font = "12px Microsoft YaHei";
  const ticksY = [1, 1e-1, 1e-2, 1e-3, 1e-4, 1e-5].filter((v) => v >= yMin && v <= yMax);
  for (const v of ticksY) {
    const y = top + logMap(v, yMin, yMax) * ph;
    ctx.strokeStyle = "#edf2f8";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + pw, y);
    ctx.stroke();
    ctx.fillText(v.toExponential(0), 6, y + 4);
  }
  const xTicks = Math.min(snrs.length, 8);
  for (let i = 0; i < xTicks; i += 1) {
    const idx = Math.round((i / (xTicks - 1 || 1)) * (snrs.length - 1));
    const x = left + (idx / (snrs.length - 1 || 1)) * pw;
    ctx.strokeStyle = "#edf2f8";
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + ph);
    ctx.stroke();
    ctx.fillStyle = "#57728c";
    ctx.fillText(String(snrs[idx]), x - 10, top + ph + 16);
  }
  ctx.fillText("SNR(dB)", left + pw - 40, top + ph + 30);
  ctx.fillText("BER(log)", 6, top - 6);
}

function logMap(value, yMin, yMax) {
  const v = Math.min(yMax, Math.max(yMin, value));
  const lv = Math.log10(v);
  const lmin = Math.log10(yMin);
  const lmax = Math.log10(yMax);
  return (lv - lmax) / (lmin - lmax);
}

function sampleToWidth(arr, maxPoints) {
  if (arr.length <= maxPoints) return arr.slice();
  const step = arr.length / maxPoints;
  const out = new Array(maxPoints);
  for (let i = 0; i < maxPoints; i += 1) out[i] = arr[Math.floor(i * step)];
  return out;
}
