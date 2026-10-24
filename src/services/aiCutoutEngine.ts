export type GarmentCategory = 'Tops' | 'Outerwear' | 'Bottoms' | 'Shoes' | 'Accessories';

export interface AutoProcessedGarment {
  cutoutDataUrl: string;
  detectedCategory: GarmentCategory;
  detectedColorHex: string;
  detectedColorName: string;
  suggestedName: string;
  engineUsed: string;
  durationMs: number;
}

export interface FineTuneOptions {
  mode: 'flood' | 'global';
  targetColor: { r: number; g: number; b: number };
  tolerance: number;
  edgeLock: number;
  feather: number;
  choke: number;
  autoCrop: boolean;
  userMask?: Int8Array | null;
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let rn = r / 255;
  let gn = g / 255;
  let bn = b / 255;
  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;
  const x = (rn * 0.4124 + gn * 0.3576 + bn * 0.1805) / 0.95047;
  const y = (rn * 0.2126 + gn * 0.7152 + bn * 0.0722) / 1.0;
  const z = (rn * 0.0193 + gn * 0.1192 + bn * 0.9505) / 1.08883;
  const fx = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  const fy = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  const fz = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
      .join('')
  );
}

export function getColorLabel(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r / 255) h = 60 * (((g - b) / 255 / d) % 6);
    else if (max === g / 255) h = 60 * ((b - r) / 255 / d + 2);
    else h = 60 * ((r - g) / 255 / d + 4);
  }
  if (h < 0) h += 360;

  if (l < 0.17) return 'Obsidian Black';
  if (l > 0.88 && s < 0.18) return 'Snow White';
  if (l > 0.78 && s < 0.3) return 'Cream Ivory';
  if (s < 0.14) return l < 0.45 ? 'Charcoal Grey' : 'Heather Silver';
  if (h >= 250 && h <= 315) return l < 0.45 ? 'Royal Violet' : 'Lavender Purple';
  if (h >= 195 && h < 250) return l < 0.4 ? 'Navy Indigo' : 'Cobalt Blue';
  if (h >= 85 && h < 165) return 'Sage Emerald';
  if (h >= 18 && h < 50) return l < 0.45 ? 'Espresso Brown' : 'Camel Tan';
  if (h >= 50 && h < 85) return 'Amber Gold';
  return 'Crimson Rose';
}

export function autoCenterAndTrimCanvas(sourceCanvas: HTMLCanvasElement): {
  canvas: HTMLCanvasElement;
  aspectRatio: number;
  legSplitScore: number;
  avgR: number;
  avgG: number;
  avgB: number;
} {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d')!;
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      if (a > 35) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (a > 140) {
          rSum += data[idx];
          gSum += data[idx + 1];
          bSum += data[idx + 2];
          count++;
        }
      }
    }
  }

  if (count === 0 || minX >= maxX || minY >= maxY) {
    return {
      canvas: sourceCanvas,
      aspectRatio: 1,
      legSplitScore: 0,
      avgR: 35,
      avgG: 25,
      avgB: 55
    };
  }

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const aspectRatio = boxH / Math.max(1, boxW);

  const midX = Math.floor((minX + maxX) / 2);
  let emptyCenterLower = 0;
  let lowerRows = 0;
  for (let y = Math.floor(minY + boxH * 0.58); y <= maxY; y++) {
    lowerRows++;
    const idx = (y * w + midX) * 4;
    if (data[idx + 3] < 30) emptyCenterLower++;
  }
  const legSplitScore = lowerRows > 0 ? emptyCenterLower / lowerRows : 0;

  const out = document.createElement('canvas');
  out.width = 480;
  out.height = 480;
  const oCtx = out.getContext('2d')!;
  const targetMax = 410;
  const scale = Math.min(targetMax / boxW, targetMax / boxH);
  const drawW = Math.round(boxW * scale);
  const drawH = Math.round(boxH * scale);
  const dx = Math.round((480 - drawW) / 2);
  const dy = Math.round((480 - drawH) / 2);

  oCtx.drawImage(sourceCanvas, minX, minY, boxW, boxH, dx, dy, drawW, drawH);

  return {
    canvas: out,
    aspectRatio,
    legSplitScore,
    avgR: Math.round(rSum / count),
    avgG: Math.round(gSum / count),
    avgB: Math.round(bSum / count)
  };
}

export function classifyGarment(
  fileName: string,
  aspectRatio: number,
  legSplitScore: number,
  colorLabel: string
): { category: GarmentCategory; name: string } {
  const lower = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').toLowerCase();

  if (/(shoe|sneaker|boot|loafer|heel|runner|sandal|slipper)/.test(lower)) {
    return { category: 'Shoes', name: `${colorLabel} Sneakers` };
  }
  if (/(pant|jean|trouser|cargo|short|skirt|denim|jogger|legging)/.test(lower)) {
    return { category: 'Bottoms', name: `${colorLabel} Cargo Pants` };
  }
  if (/(jacket|coat|hoodie|blazer|cardigan|windbreaker|puffer|parka|vest|outer)/.test(lower)) {
    return { category: 'Outerwear', name: `${colorLabel} Utility Jacket` };
  }
  if (/(hat|cap|beanie|bag|tote|belt|scarf|glasses|watch|chain|ring|backpack)/.test(lower)) {
    return { category: 'Accessories', name: `${colorLabel} Accessory` };
  }
  if (/(shirt|tee|tshirt|top|blouse|tank|polo|sweater|knit|jersey)/.test(lower)) {
    return { category: 'Tops', name: `${colorLabel} Studio Tee` };
  }

  if (aspectRatio < 0.68) {
    return { category: 'Shoes', name: `${colorLabel} Low-Top Runners` };
  }
  if (aspectRatio > 1.24 || legSplitScore > 0.35) {
    return { category: 'Bottoms', name: `${colorLabel} Tailored Bottoms` };
  }
  if (aspectRatio >= 0.68 && aspectRatio <= 0.84) {
    return { category: 'Accessories', name: `${colorLabel} Headwear / Bag` };
  }
  if (aspectRatio > 1.05) {
    return { category: 'Outerwear', name: `${colorLabel} Oversized Layer` };
  }
  return { category: 'Tops', name: `${colorLabel} Boxy Top` };
}

export function runMultiClusterSaliencyCutout(
  imgOrCanvas: HTMLImageElement | HTMLCanvasElement,
  options?: Partial<FineTuneOptions>
): HTMLCanvasElement {
  const maxWork = 520;
  const srcW = imgOrCanvas.width;
  const srcH = imgOrCanvas.height;
  const scale = Math.min(1, maxWork / Math.max(srcW, srcH));
  const w = Math.max(64, Math.round(srcW * scale));
  const h = Math.max(64, Math.round(srcH * scale));

  const work = document.createElement('canvas');
  work.width = w;
  work.height = h;
  const ctx = work.getContext('2d')!;
  ctx.drawImage(imgOrCanvas, 0, 0, w, h);

  const srcData = ctx.getImageData(0, 0, w, h);
  const px = srcData.data;
  const total = w * h;

  const borderLabs: [number, number, number][] = [];
  if (options?.targetColor) {
    borderLabs.push(rgbToLab(options.targetColor.r, options.targetColor.g, options.targetColor.b));
  } else {
    const stepX = Math.max(4, Math.floor(w / 10));
    const stepY = Math.max(4, Math.floor(h / 10));
    for (let x = 2; x < w - 2; x += stepX) {
      const iTop = (2 * w + x) * 4;
      const iBot = ((h - 3) * w + x) * 4;
      borderLabs.push(rgbToLab(px[iTop], px[iTop + 1], px[iTop + 2]));
      borderLabs.push(rgbToLab(px[iBot], px[iBot + 1], px[iBot + 2]));
    }
    for (let y = 2; y < h - 2; y += stepY) {
      const iLeft = (y * w + 2) * 4;
      const iRight = (y * w + (w - 3)) * 4;
      borderLabs.push(rgbToLab(px[iLeft], px[iLeft + 1], px[iLeft + 2]));
      borderLabs.push(rgbToLab(px[iRight], px[iRight + 1], px[iRight + 2]));
    }
  }

  const minDistSq = new Float32Array(total);
  const luma = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const p = i * 4;
    const r = px[p];
    const g = px[p + 1];
    const b = px[p + 2];
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    const [l, a, bl] = rgbToLab(r, g, b);
    let best = 1e9;
    for (let c = 0; c < borderLabs.length; c++) {
      const [cl, ca, cb] = borderLabs[c];
      const dl = (l - cl) * 0.82;
      const da = a - ca;
      const db = bl - cb;
      const d = dl * dl + da * da + db * db;
      if (d < best) best = d;
    }
    minDistSq[i] = best;
  }

  const grad = new Float32Array(total);
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = row + x;
      const gx = luma[idx + 1] - luma[idx - 1];
      const gy = luma[idx + w] - luma[idx - w];
      grad[idx] = Math.hypot(gx, gy);
    }
  }

  const tol = (options?.tolerance ?? 28) * 1.15;
  const tolSq = tol * tol;
  const softSpanSq = Math.pow(Math.max(tol + 9, tol * 1.32), 2);
  const edgeBarrier = (105 - (options?.edgeLock ?? 55)) * 0.9 + 6;
  const mode = options?.mode ?? 'flood';

  const bgMask = new Uint8Array(total);

  if (mode === 'flood') {
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    for (let x = 0; x < w; x++) {
      const tIdx = x;
      const bIdx = (h - 1) * w + x;
      if (minDistSq[tIdx] <= softSpanSq) {
        bgMask[tIdx] = 1;
        queue[tail++] = tIdx;
      }
      if (minDistSq[bIdx] <= softSpanSq) {
        bgMask[bIdx] = 1;
        queue[tail++] = bIdx;
      }
    }
    for (let y = 1; y < h - 1; y++) {
      const lIdx = y * w;
      const rIdx = y * w + (w - 1);
      if (minDistSq[lIdx] <= softSpanSq) {
        bgMask[lIdx] = 1;
        queue[tail++] = lIdx;
      }
      if (minDistSq[rIdx] <= softSpanSq) {
        bgMask[rIdx] = 1;
        queue[tail++] = rIdx;
      }
    }

    while (head < tail) {
      const curr = queue[head++];
      const cx = curr % w;
      const cy = (curr - cx) / w;
      const nbs = [
        cx > 0 ? curr - 1 : -1,
        cx < w - 1 ? curr + 1 : -1,
        cy > 0 ? curr - w : -1,
        cy < h - 1 ? curr + w : -1
      ];
      for (let k = 0; k < 4; k++) {
        const nb = nbs[k];
        if (nb !== -1 && bgMask[nb] === 0) {
          if (minDistSq[nb] <= tolSq && grad[nb] < edgeBarrier) {
            bgMask[nb] = 1;
            queue[tail++] = nb;
          }
        }
      }
    }
  } else {
    for (let i = 0; i < total; i++) {
      if (minDistSq[i] <= tolSq) bgMask[i] = 1;
    }
  }

  let alpha = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    alpha[i] = bgMask[i] === 1 ? 0 : 1;
  }

  const choke = options?.choke ?? 1;
  for (let step = 0; step < choke; step++) {
    const nextAlpha = new Float32Array(alpha);
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        nextAlpha[i] = Math.min(alpha[i], alpha[i - 1], alpha[i + 1], alpha[i - w], alpha[i + w]);
      }
    }
    alpha = nextAlpha;
  }

  const feather = options?.feather ?? 2;
  if (feather > 0) {
    const temp = new Float32Array(total);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let cnt = 0;
        for (let dx = -feather; dx <= feather; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < w) {
            sum += alpha[row + nx];
            cnt++;
          }
        }
        temp[row + x] = sum / cnt;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let cnt = 0;
        for (let dy = -feather; dy <= feather; dy++) {
          const ny = y + dy;
          if (ny >= 0 && ny < h) {
            sum += temp[ny * w + x];
            cnt++;
          }
        }
        alpha[y * w + x] = sum / cnt;
      }
    }
  }

  if (options?.userMask && options.userMask.length === total) {
    for (let i = 0; i < total; i++) {
      if (options.userMask[i] === 1) alpha[i] = 1;
      else if (options.userMask[i] === -1) alpha[i] = 0;
    }
  }

  for (let i = 0; i < total; i++) {
    px[i * 4 + 3] = Math.round(alpha[i] * 255);
  }
  ctx.putImageData(srcData, 0, 0);
  return work;
}

export async function processSmartOneClickUpload(
  file: File,
  useNeuralAi: boolean,
  removeBgApiKey: string,
  onProgress?: (status: string) => void
): Promise<AutoProcessedGarment> {
  const t0 = performance.now();
  let engineUsed = 'Multi-Cluster LAB Saliency';
  let rawCutoutCanvas: HTMLCanvasElement | null = null;

  if (removeBgApiKey.trim()) {
    try {
      onProgress?.('Calling Remove.bg Cloud Studio API...');
      const formData = new FormData();
      formData.append('image_file', file);
      formData.append('size', 'auto');
      const res = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': removeBgApiKey.trim() },
        body: formData
      });
      if (res.ok) {
        const blob = await res.blob();
        rawCutoutCanvas = await blobToCanvas(blob);
        engineUsed = 'Remove.bg Cloud AI';
      }
    } catch {
      rawCutoutCanvas = null;
    }
  }

  if (!rawCutoutCanvas && useNeuralAi) {
    try {
      onProgress?.('Running On-Device Neural AI Segmentation...');
      const imgly = await import('@imgly/background-removal');
      const removeBackground = imgly.removeBackground || imgly.default;
      if (removeBackground) {
        const outBlob = await removeBackground(file);
        rawCutoutCanvas = await blobToCanvas(outBlob);
        engineUsed = 'Neural U2-Net AI (@imgly)';
      }
    } catch {
      rawCutoutCanvas = null;
    }
  }

  if (!rawCutoutCanvas) {
    onProgress?.('Isolating garment silhouette & edges...');
    const img = await fileToImage(file);
    rawCutoutCanvas = runMultiClusterSaliencyCutout(img);
  }

  onProgress?.('Auto-trimming & classifying garment...');
  const trimmed = autoCenterAndTrimCanvas(rawCutoutCanvas);
  const colorName = getColorLabel(trimmed.avgR, trimmed.avgG, trimmed.avgB);
  const colorHex = rgbToHex(trimmed.avgR, trimmed.avgG, trimmed.avgB);
  const classified = classifyGarment(file.name, trimmed.aspectRatio, trimmed.legSplitScore, colorName);

  return {
    cutoutDataUrl: trimmed.canvas.toDataURL('image/png'),
    detectedCategory: classified.category,
    detectedColorHex: colorHex,
    detectedColorName: colorName,
    suggestedName: classified.name,
    engineUsed,
    durationMs: Math.max(1, Math.round(performance.now() - t0))
  };
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
