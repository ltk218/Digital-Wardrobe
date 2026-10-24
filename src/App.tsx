import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Scissors,
  Wand2,
  Sparkles,
  Upload,
  Trash2,
  RefreshCw,
  Layers,
  Grid,
  Download,
  Eye,
  RotateCcw,
  Palette,
  Sliders,
  FolderHeart,
  Save,
  Star,
  Search,
  Shuffle,
  Check,
  Cpu,
  Key
} from 'lucide-react';
import {
  GarmentCategory,
  processSmartOneClickUpload,
  runMultiClusterSaliencyCutout,
  autoCenterAndTrimCanvas,
  rgbToHex
} from './services/aiCutoutEngine';

interface WardrobeItem {
  id: string;
  name: string;
  category: GarmentCategory;
  colorName: string;
  colorHex: string;
  engineBadge: string;
  image: string;
  favorite: boolean;
}

interface StudioLayer {
  id: string;
  itemId: string;
  name: string;
  category: GarmentCategory;
  image: string;
  x: number;
  y: number;
  scale: number;
}

interface LookbookEntry {
  id: string;
  title: string;
  date: string;
  items: string[];
  layers: StudioLayer[];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function createPreloadedGarmentDataUrl(
  kind: 'top' | 'outer' | 'bottom' | 'shoes' | 'acc',
  primary: string,
  accent: string,
  label: string
): string {
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = 360;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.translate(180, 185);
  ctx.fillStyle = primary;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;

  if (kind === 'top') {
    ctx.beginPath();
    ctx.moveTo(-65, -115);
    ctx.lineTo(-140, -40);
    ctx.lineTo(-110, 12);
    ctx.lineTo(-80, -32);
    ctx.lineTo(-80, 125);
    ctx.lineTo(80, 125);
    ctx.lineTo(80, -32);
    ctx.lineTo(110, 12);
    ctx.lineTo(140, -40);
    ctx.lineTo(65, -115);
    ctx.quadraticCurveTo(0, -90, -65, -115);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, -10);
  } else if (kind === 'outer') {
    ctx.beginPath();
    ctx.moveTo(-70, -125);
    ctx.lineTo(-148, -30);
    ctx.lineTo(-115, 35);
    ctx.lineTo(-85, -30);
    ctx.lineTo(-85, 135);
    ctx.lineTo(85, 135);
    ctx.lineTo(85, -30);
    ctx.lineTo(115, 35);
    ctx.lineTo(148, -30);
    ctx.lineTo(70, -125);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'bottom') {
    ctx.beginPath();
    ctx.moveTo(-72, -125);
    ctx.lineTo(72, -125);
    ctx.lineTo(88, 135);
    ctx.lineTo(18, 135);
    ctx.lineTo(0, -20);
    ctx.lineTo(-18, 135);
    ctx.lineTo(-88, 135);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'shoes') {
    ctx.beginPath();
    ctx.rect(-120, -30, 105, 70);
    ctx.rect(15, -30, 105, 70);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f5f3ff';
    ctx.fillRect(-120, 26, 105, 14);
    ctx.fillRect(15, 26, 105, 14);
  } else {
    ctx.beginPath();
    ctx.arc(0, -10, 75, Math.PI, 0, false);
    ctx.lineTo(115, 15);
    ctx.lineTo(-115, 15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  return c.toDataURL('image/png');
}

function createSampleGarmentCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 520;
  c.height = 520;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const bgGrad = ctx.createLinearGradient(0, 0, 520, 520);
  bgGrad.addColorStop(0, '#e6d6d6');
  bgGrad.addColorStop(1, '#d8c5c5');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 520, 520);

  ctx.save();
  ctx.translate(260, 270);
  ctx.fillStyle = '#1f1638';
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-85, -145);
  ctx.lineTo(-185, -35);
  ctx.lineTo(-145, 20);
  ctx.lineTo(-105, -45);
  ctx.lineTo(-105, 165);
  ctx.lineTo(105, 165);
  ctx.lineTo(105, -45);
  ctx.lineTo(145, 20);
  ctx.lineTo(185, -35);
  ctx.lineTo(85, -145);
  ctx.quadraticCurveTo(0, -115, -85, -145);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  return c;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'drawers' | 'scanner' | 'studio' | 'lookbook'>('drawers');
  const [drawerFilter, setDrawerFilter] = useState<string>('All');
  const [drawerSearch, setDrawerSearch] = useState<string>('');
  const [studioCategoryFilter, setStudioCategoryFilter] = useState<string>('All');

  const [useNeuralAi, setUseNeuralAi] = useState<boolean>(true);
  const [removeBgApiKey, setRemoveBgApiKey] = useState<string>('');
  const [showAiConfig, setShowAiConfig] = useState<boolean>(false);
  const [isAutoProcessing, setIsAutoProcessing] = useState<boolean>(false);
  const [autoStatusText, setAutoStatusText] = useState<string>('');
  const [autoProgressPct, setAutoProgressPct] = useState<number>(0);

  const [scannerMode, setScannerMode] = useState<'flood' | 'global'>('flood');
  const [activeTool, setActiveTool] = useState<'pick' | 'erase' | 'restore'>('pick');
  const [targetColor, setTargetColor] = useState<{ r: number; g: number; b: number }>({ r: 228, g: 210, b: 210 });
  const [tolerance, setTolerance] = useState<number>(28);
  const [edgeLock, setEdgeLock] = useState<number>(55);
  const [feather, setFeather] = useState<number>(2);
  const [choke, setChoke] = useState<number>(1);
  const [brushSize, setBrushSize] = useState<number>(22);
  const [autoCrop, setAutoCrop] = useState<boolean>(true);
  const [compareOriginal, setCompareOriginal] = useState<boolean>(false);
  const [previewBg, setPreviewBg] = useState<'checker-dark' | 'bg-black' | 'checker-light'>('checker-dark');

  const [itemName, setItemName] = useState<string>('Nocturne Violet Hoodie');
  const [itemCategory, setItemCategory] = useState<GarmentCategory>('Outerwear');

  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [studioLayers, setStudioLayers] = useState<StudioLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [outfitTitle, setOutfitTitle] = useState<string>('Midnight Cyber Streetwear');
  const [lookbook, setLookbook] = useState<LookbookEntry[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const cutoutCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const workCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const userMaskRef = useRef<Int8Array | null>(null);
  const isPaintingRef = useRef<boolean>(false);
  const studioBoardRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const renderFineTuneCanvas = useCallback(() => {
    const cutoutCanvas = cutoutCanvasRef.current;
    const wCanvas = workCanvasRef.current;
    if (!cutoutCanvas || !wCanvas || !wCanvas.width) return;

    if (compareOriginal) {
      cutoutCanvas.width = wCanvas.width;
      cutoutCanvas.height = wCanvas.height;
      const ctx = cutoutCanvas.getContext('2d');
      if (ctx) ctx.drawImage(wCanvas, 0, 0);
      return;
    }

    const isolated = runMultiClusterSaliencyCutout(wCanvas, {
      mode: scannerMode,
      targetColor,
      tolerance,
      edgeLock,
      feather,
      choke,
      autoCrop,
      userMask: userMaskRef.current
    });

    const finalCanvas = autoCrop && !isPaintingRef.current ? autoCenterAndTrimCanvas(isolated).canvas : isolated;
    cutoutCanvas.width = finalCanvas.width;
    cutoutCanvas.height = finalCanvas.height;
    const cCtx = cutoutCanvas.getContext('2d');
    if (cCtx) {
      cCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
      cCtx.drawImage(finalCanvas, 0, 0);
    }
  }, [scannerMode, targetColor, tolerance, edgeLock, feather, choke, autoCrop, compareOriginal]);

  const loadIntoFineTune = useCallback((source: HTMLCanvasElement | HTMLImageElement) => {
    if (!workCanvasRef.current) {
      workCanvasRef.current = document.createElement('canvas');
    }
    const wCanvas = workCanvasRef.current;
    const maxDim = 520;
    const scale = Math.min(1, maxDim / Math.max(source.width, source.height));
    const w = Math.max(64, Math.round(source.width * scale));
    const h = Math.max(64, Math.round(source.height * scale));
    wCanvas.width = w;
    wCanvas.height = h;
    const ctx = wCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(source, 0, 0, w, h);
      const d = ctx.getImageData(4, 4, 1, 1).data;
      setTargetColor({ r: d[0], g: d[1], b: d[2] });
    }
    userMaskRef.current = new Int8Array(w * h);
  }, []);

  useEffect(() => {
    const initialItems: WardrobeItem[] = [
      {
        id: 'item-1',
        name: 'Obsidian Boxy Tee',
        category: 'Tops',
        colorName: 'Obsidian Black',
        colorHex: '#151324',
        engineBadge: 'Auto Studio',
        image: createPreloadedGarmentDataUrl('top', '#151324', '#a855f7', 'ARCHIVE'),
        favorite: true
      },
      {
        id: 'item-2',
        name: 'Cyber Violet Shell Jacket',
        category: 'Outerwear',
        colorName: 'Royal Violet',
        colorHex: '#3b1d6e',
        engineBadge: 'Auto Studio',
        image: createPreloadedGarmentDataUrl('outer', '#3b1d6e', '#c084fc', 'SHELL'),
        favorite: true
      },
      {
        id: 'item-3',
        name: 'Wide Pleated Charcoal Cargo',
        category: 'Bottoms',
        colorName: 'Charcoal Grey',
        colorHex: '#181824',
        engineBadge: 'Auto Studio',
        image: createPreloadedGarmentDataUrl('bottom', '#181824', '#8b5cf6', 'CARGO'),
        favorite: false
      },
      {
        id: 'item-4',
        name: 'Eclipse Low-Top Runners',
        category: 'Shoes',
        colorName: 'Obsidian Black',
        colorHex: '#221a3a',
        engineBadge: 'Auto Studio',
        image: createPreloadedGarmentDataUrl('shoes', '#221a3a', '#a855f7', 'RUN'),
        favorite: true
      },
      {
        id: 'item-5',
        name: 'Amethyst Knit Beanie',
        category: 'Accessories',
        colorName: 'Royal Violet',
        colorHex: '#4c1d95',
        engineBadge: 'Auto Studio',
        image: createPreloadedGarmentDataUrl('acc', '#4c1d95', '#e9d5ff', 'CAP'),
        favorite: false
      },
      {
        id: 'item-6',
        name: 'Silver Mist Heavy Tee',
        category: 'Tops',
        colorName: 'Heather Silver',
        colorHex: '#272438',
        engineBadge: 'Auto Studio',
        image: createPreloadedGarmentDataUrl('top', '#272438', '#c084fc', 'MIST'),
        favorite: false
      }
    ];
    setItems(initialItems);

    const defaultLayers: StudioLayer[] = [
      { id: 'layer-1', itemId: 'item-5', name: 'Amethyst Knit Beanie', category: 'Accessories', image: initialItems[4].image, x: 210, y: 12, scale: 0.72 },
      { id: 'layer-2', itemId: 'item-1', name: 'Obsidian Boxy Tee', category: 'Tops', image: initialItems[0].image, x: 185, y: 95, scale: 0.96 },
      { id: 'layer-3', itemId: 'item-3', name: 'Wide Pleated Charcoal Cargo', category: 'Bottoms', image: initialItems[2].image, x: 185, y: 225, scale: 0.95 },
      { id: 'layer-4', itemId: 'item-4', name: 'Eclipse Low-Top Runners', category: 'Shoes', image: initialItems[3].image, x: 185, y: 345, scale: 0.85 }
    ];
    setStudioLayers(defaultLayers);
    setSelectedLayerId('layer-2');
    setLookbook([
      {
        id: 'look-1',
        title: 'Midnight Cyber Streetwear',
        date: 'Saved Today',
        items: defaultLayers.map((l) => l.name),
        layers: defaultLayers
      }
    ]);

    loadIntoFineTune(createSampleGarmentCanvas());
  }, [loadIntoFineTune]);

  useEffect(() => {
    if (activeTab === 'scanner') {
      renderFineTuneCanvas();
    }
  }, [activeTab, renderFineTuneCanvas]);

  const handleOneClickBatchFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    setIsAutoProcessing(true);
    setAutoProgressPct(12);
    const createdItems: WardrobeItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setAutoStatusText(`Processing ${i + 1}/${files.length}: ${f.name}...`);
      setAutoProgressPct(Math.round(((i + 0.3) / files.length) * 100));

      const res = await processSmartOneClickUpload(f, useNeuralAi, removeBgApiKey, (step) => {
        setAutoStatusText(`${f.name}: ${step}`);
      });

      createdItems.push({
        id: 'item-' + Date.now() + '-' + i,
        name: res.suggestedName,
        category: res.detectedCategory,
        colorName: res.detectedColorName,
        colorHex: res.detectedColorHex,
        engineBadge: res.engineUsed,
        image: res.cutoutDataUrl,
        favorite: true
      });
      setAutoProgressPct(Math.round(((i + 1) / files.length) * 100));
    }

    setItems((prev) => [...createdItems, ...prev]);
    setIsAutoProcessing(false);
    setAutoStatusText('');
    setAutoProgressPct(0);
    setActiveTab('drawers');
    showToast(
      createdItems.length === 1
        ? `Auto-isolated & added "${createdItems[0].name}" to ${createdItems[0].category}!`
        : `Auto-isolated & added ${createdItems.length} pieces to your Drawers!`
    );
  };

  const applyCanvasToolAt = (clientX: number, clientY: number, isClick: boolean) => {
    const cutoutCanvas = cutoutCanvasRef.current;
    const wCanvas = workCanvasRef.current;
    const userMask = userMaskRef.current;
    if (!cutoutCanvas || !wCanvas || !userMask) return;

    const rect = cutoutCanvas.getBoundingClientRect();
    const scaleX = wCanvas.width / rect.width;
    const scaleY = wCanvas.height / rect.height;
    const x = Math.floor((clientX - rect.left) * scaleX);
    const y = Math.floor((clientY - rect.top) * scaleY);
    const w = wCanvas.width;
    const h = wCanvas.height;
    if (x < 0 || y < 0 || x >= w || y >= h) return;

    if (activeTool === 'pick' && isClick) {
      const ctx = wCanvas.getContext('2d');
      if (!ctx) return;
      const d = ctx.getImageData(x, y, 1, 1).data;
      setTargetColor({ r: d[0], g: d[1], b: d[2] });
      showToast('Backdrop sampled: ' + rgbToHex(d[0], d[1], d[2]));
    } else if (activeTool === 'erase' || activeTool === 'restore') {
      const r = brushSize;
      const rSq = r * r;
      const val = activeTool === 'restore' ? 1 : -1;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          if (dx * dx + dy * dy <= rSq) {
            userMask[ny * w + nx] = val;
          }
        }
      }
      renderFineTuneCanvas();
    }
  };

  const addLayerToStudio = (item: WardrobeItem) => {
    const yMap: Record<GarmentCategory, number> = {
      Accessories: 15,
      Tops: 95,
      Outerwear: 90,
      Bottoms: 220,
      Shoes: 340
    };
    const newLayer: StudioLayer = {
      id: 'layer-' + Date.now() + '-' + Math.floor(Math.random() * 999),
      itemId: item.id,
      name: item.name,
      category: item.category,
      image: item.image,
      x: 175 + Math.floor(Math.random() * 24 - 12),
      y: yMap[item.category] ?? 120,
      scale: 0.95
    };
    setStudioLayers((prev) => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);
  };

  const startDragLayer = (e: React.MouseEvent, layer: StudioLayer) => {
    e.stopPropagation();
    setSelectedLayerId(layer.id);
    const board = studioBoardRef.current;
    if (!board) return;
    const startX = e.clientX - layer.x;
    const startY = e.clientY - layer.y;

    const onMove = (ev: MouseEvent) => {
      const nx = Math.max(-30, Math.min(board.clientWidth - 110, ev.clientX - startX));
      const ny = Math.max(-20, Math.min(board.clientHeight - 110, ev.clientY - startY));
      setStudioLayers((prev) =>
        prev.map((l) => (l.id === layer.id ? { ...l, x: nx, y: ny } : l))
      );
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleShuffleOutfit = () => {
    const cats: GarmentCategory[] = ['Accessories', 'Tops', 'Outerwear', 'Bottoms', 'Shoes'];
    const yMap: Record<GarmentCategory, number> = {
      Accessories: 14,
      Tops: 95,
      Outerwear: 92,
      Bottoms: 222,
      Shoes: 342
    };
    const nextLayers: StudioLayer[] = [];
    cats.forEach((c) => {
      const pool = items.filter((i) => i.category === c);
      if (pool.length > 0 && (c !== 'Outerwear' || Math.random() > 0.35)) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        nextLayers.push({
          id: 'layer-' + Date.now() + '-' + Math.random(),
          itemId: pick.id,
          name: pick.name,
          category: pick.category,
          image: pick.image,
          x: c === 'Outerwear' ? 215 : 180,
          y: yMap[c],
          scale: 0.94
        });
      }
    });
    setStudioLayers(nextLayers);
    setSelectedLayerId(nextLayers[0]?.id ?? null);
    showToast('Shuffled a fresh combination');
  };

  const filteredDrawerItems = items.filter((item) => {
    const matchCat = drawerFilter === 'All' || item.category === drawerFilter;
    const q = drawerSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.colorName.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const selectedLayer = studioLayers.find((l) => l.id === selectedLayerId) || null;
  const targetHex = rgbToHex(targetColor.r, targetColor.g, targetColor.b);

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 px-4 pt-3 pb-2">
        <div className="max-w-7xl mx-auto nav-bar-shell rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-violet-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-600/40">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">NOCTURNE WARDROBE</h1>
              <p className="text-xs text-purple-300/70 mt-0.5">One-Click AI Cutout &amp; Auto-Drawer Studio</p>
            </div>
          </div>

          <nav className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-purple-500/20 overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('drawers')}
              className={`tab-btn px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-purple-200 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'drawers' ? 'active' : ''
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>Drawers</span>
              <span className="px-1.5 py-0.5 text-[11px] rounded-md bg-purple-950/90 text-purple-300 border border-purple-500/30">
                {items.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('scanner')}
              className={`tab-btn px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-purple-200 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'scanner' ? 'active' : ''
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span>Fine-Tune Studio</span>
            </button>

            <button
              onClick={() => setActiveTab('studio')}
              className={`tab-btn px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-purple-200 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'studio' ? 'active' : ''
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Mix &amp; Match</span>
            </button>

            <button
              onClick={() => setActiveTab('lookbook')}
              className={`tab-btn px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-purple-200 flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'lookbook' ? 'active' : ''
              }`}
            >
              <FolderHeart className="w-4 h-4" />
              <span>Lookbook</span>
              <span className="px-1.5 py-0.5 text-[11px] rounded-md bg-purple-950/90 text-purple-300 border border-purple-500/30">
                {lookbook.length}
              </span>
            </button>

            <button
              onClick={() => setShowAiConfig(!showAiConfig)}
              className={`ghost-btn px-3 py-2 rounded-lg text-xs font-semibold text-purple-200 flex items-center gap-1.5 ${
                showAiConfig ? 'active' : ''
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>AI Engine</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        {showAiConfig && (
          <div className="wardrobe-card rounded-2xl p-5 border border-purple-500/40 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-400" /> Smart Cutout Engine Settings
                </h3>
                <p className="text-xs text-purple-300/70">
                  On-Device Neural AI (@imgly/background-removal) runs automatically in your browser with zero API key needed. You can also add an optional Remove.bg key for instant cloud cutouts.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-purple-200 cursor-pointer bg-black/50 px-3 py-2 rounded-xl border border-purple-500/30">
                <input
                  type="checkbox"
                  checked={useNeuralAi}
                  onChange={(e) => setUseNeuralAi(e.target.checked)}
                  className="accent-purple-500 w-4 h-4"
                />
                <span>Enable Neural U2-Net AI (@imgly)</span>
              </label>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1 bg-black/60 border border-purple-500/30 rounded-xl px-3 py-2">
                <Key className="w-4 h-4 text-purple-400 shrink-0" />
                <input
                  type="password"
                  value={removeBgApiKey}
                  onChange={(e) => setRemoveBgApiKey(e.target.value)}
                  placeholder="Optional: Paste remove.bg API Key for 1-second cloud studio cutout..."
                  className="w-full bg-transparent text-xs text-white focus:outline-none"
                />
              </div>
              <button
                onClick={() => {
                  setShowAiConfig(false);
                  showToast('AI Engine settings updated');
                }}
                className="glow-btn px-4 py-2 rounded-xl text-xs font-semibold text-white"
              >
                Save Engine Config
              </button>
            </div>
          </div>
        )}

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleOneClickBatchFiles(e.dataTransfer.files);
          }}
          className="wardrobe-card rounded-2xl p-6 border-2 border-dashed border-purple-500/40 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="space-y-1.5 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Sparkles className="w-3 h-3" /> Zero-Touch Pipeline
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              One-Click Magic Upload: Drop Photos &amp; Done
            </h2>
            <p className="text-xs sm:text-sm text-purple-200/70 max-w-2xl">
              Select 1 or multiple clothing photos at once. The app automatically strips the background, trims &amp; centers the garment, detects its color and category, and puts it straight into the right Drawer.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <label className="glow-btn px-6 py-3.5 rounded-2xl text-sm font-bold text-white cursor-pointer inline-flex items-center gap-2.5 shadow-xl">
              <Upload className="w-4 h-4" />
              <span>One-Click Upload Photos</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleOneClickBatchFiles(e.target.files)}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {isAutoProcessing && (
          <div className="wardrobe-card rounded-2xl p-4 space-y-2 border border-purple-400/50">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-purple-200 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                {autoStatusText}
              </span>
              <span className="font-mono text-purple-300">{autoProgressPct}%</span>
            </div>
            <div className="stat-bar-track h-2.5 rounded-full">
              <div className="stat-bar-fill h-full rounded-full" style={{ width: `${autoProgressPct}%` }} />
            </div>
          </div>
        )}

        {activeTab === 'drawers' && (
          <section className="space-y-6">
            <div className="wardrobe-card rounded-2xl p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">My Digital Drawers</h2>
                  <p className="text-xs text-purple-300/70">
                    Automatically sorted by garment type and dominant color. Click any piece to Mix &amp; Match or Fine-Tune.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={drawerSearch}
                      onChange={(e) => setDrawerSearch(e.target.value)}
                      placeholder="Search name, color, drawer..."
                      className="pl-8 pr-3.5 py-2 rounded-xl bg-black/60 border border-purple-500/30 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {['All', 'Tops', 'Outerwear', 'Bottoms', 'Shoes', 'Accessories'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setDrawerFilter(cat)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      drawerFilter === cat
                        ? 'bg-gradient-to-r from-purple-600 to-fuchsia-500 border-transparent text-white shadow-lg shadow-purple-600/40'
                        : 'border-purple-500/25 bg-black/40 text-purple-200 hover:border-purple-400'
                    }`}
                  >
                    {cat === 'All' ? `All Drawers (${items.length})` : `${cat} (${items.filter((i) => i.category === cat).length})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filteredDrawerItems.map((item) => (
                <div key={item.id} className="wardrobe-card rounded-2xl p-4 flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-950/90 text-purple-300 border border-purple-500/30">
                        {item.category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-white/30"
                          style={{ backgroundColor: item.colorHex }}
                          title={item.colorName}
                        />
                        <button
                          onClick={() =>
                            setItems((prev) =>
                              prev.map((i) => (i.id === item.id ? { ...i, favorite: !i.favorite } : i))
                            )
                          }
                          className="text-xs px-2 py-1 rounded-lg bg-black/40 border border-purple-500/20 text-purple-300 hover:text-fuchsia-400"
                        >
                          <Star className={`w-3.5 h-3.5 ${item.favorite ? 'fill-fuchsia-400 text-fuchsia-400' : ''}`} />
                        </button>
                      </div>
                    </div>
                    <div className="h-48 rounded-xl checker-dark border border-purple-500/20 flex items-center justify-center p-3 overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="max-h-40 max-w-full object-contain transition-transform duration-300 group-hover:scale-110"
                      />
                    </div>
                    <h4 className="text-sm font-bold text-white mt-3 truncate">{item.name}</h4>
                    <p className="text-[11px] text-purple-300/60 mt-0.5">
                      {item.colorName} • {item.engineBadge}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-purple-500/15">
                    <button
                      onClick={() => {
                        addLayerToStudio(item);
                        setActiveTab('studio');
                        showToast(`Added "${item.name}" to Mix & Match`);
                      }}
                      className="glow-btn py-1.5 px-2 rounded-lg text-[11px] font-semibold text-white"
                    >
                      Wear
                    </button>
                    <button
                      onClick={() => {
                        const img = new Image();
                        img.onload = () => {
                          setItemName(item.name);
                          setItemCategory(item.category);
                          loadIntoFineTune(img);
                          setActiveTab('scanner');
                        };
                        img.src = item.image;
                      }}
                      className="ghost-btn py-1.5 px-2 rounded-lg text-[11px] font-medium text-purple-200"
                    >
                      Fine-Tune
                    </button>
                    <button
                      onClick={() => {
                        setItems((prev) => prev.filter((i) => i.id !== item.id));
                        showToast('Removed piece from drawer');
                      }}
                      className="ghost-btn py-1.5 px-2 rounded-lg text-[11px] font-medium text-purple-300 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'scanner' && (
          <section className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 wardrobe-card rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                    Manual Cutout &amp; Brush Touch-Up Studio
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPreviewBg('checker-dark')}
                      className={`ghost-btn px-2.5 py-1 rounded-lg text-xs text-purple-200 ${previewBg === 'checker-dark' ? 'active' : ''}`}
                    >
                      Dark Grid
                    </button>
                    <button
                      onClick={() => setPreviewBg('bg-black')}
                      className={`ghost-btn px-2.5 py-1 rounded-lg text-xs text-purple-200 ${previewBg === 'bg-black' ? 'active' : ''}`}
                    >
                      Black
                    </button>
                    <button
                      onClick={() => setPreviewBg('checker-light')}
                      className={`ghost-btn px-2.5 py-1 rounded-lg text-xs text-purple-200 ${previewBg === 'checker-light' ? 'active' : ''}`}
                    >
                      Light
                    </button>
                    <button
                      onMouseDown={() => setCompareOriginal(true)}
                      onMouseUp={() => setCompareOriginal(false)}
                      onMouseLeave={() => setCompareOriginal(false)}
                      className="ghost-btn px-2.5 py-1 rounded-lg text-xs text-purple-200 flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Hold Original
                    </button>
                  </div>
                </div>

                <div
                  className={`relative rounded-xl overflow-hidden ${previewBg} border border-purple-500/25 flex items-center justify-center min-h-[380px] sm:min-h-[440px]`}
                >
                  <canvas
                    ref={cutoutCanvasRef}
                    onMouseDown={(e) => {
                      isPaintingRef.current = true;
                      applyCanvasToolAt(e.clientX, e.clientY, true);
                    }}
                    onMouseMove={(e) => {
                      if (isPaintingRef.current && (activeTool === 'erase' || activeTool === 'restore')) {
                        applyCanvasToolAt(e.clientX, e.clientY, false);
                      }
                    }}
                    onMouseUp={() => {
                      if (isPaintingRef.current) {
                        isPaintingRef.current = false;
                        renderFineTuneCanvas();
                      }
                    }}
                    className="max-w-full max-h-[430px] object-contain cursor-crosshair"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setActiveTool('pick')}
                      className={`ghost-btn px-2.5 py-1.5 rounded-lg text-xs font-medium text-purple-200 ${
                        activeTool === 'pick' ? 'active' : ''
                      }`}
                    >
                      Pick BG Color
                    </button>
                    <button
                      onClick={() => setActiveTool('erase')}
                      className={`ghost-btn px-2.5 py-1.5 rounded-lg text-xs font-medium text-purple-200 ${
                        activeTool === 'erase' ? 'active' : ''
                      }`}
                    >
                      Erase Brush
                    </button>
                    <button
                      onClick={() => setActiveTool('restore')}
                      className={`ghost-btn px-2.5 py-1.5 rounded-lg text-xs font-medium text-purple-200 ${
                        activeTool === 'restore' ? 'active' : ''
                      }`}
                    >
                      Restore Brush
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (userMaskRef.current) userMaskRef.current.fill(0);
                        renderFineTuneCanvas();
                      }}
                      className="ghost-btn px-2.5 py-1.5 rounded-lg text-xs text-purple-300 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                    <button
                      onClick={() => {
                        const c = cutoutCanvasRef.current;
                        if (!c) return;
                        const a = document.createElement('a');
                        a.download = (itemName.trim() || 'cutout') + '.png';
                        a.href = c.toDataURL('image/png');
                        a.click();
                      }}
                      className="ghost-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-200 flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> PNG
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-5">
                <div className="wardrobe-card rounded-2xl p-5 space-y-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-400" /> Fine-Tune Controls
                  </h3>

                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/50 border border-purple-500/20">
                    <button
                      onClick={() => setScannerMode('flood')}
                      className={`ghost-btn py-2 px-3 rounded-lg text-xs font-semibold ${scannerMode === 'flood' ? 'active' : ''}`}
                    >
                      Smart Border Flood
                    </button>
                    <button
                      onClick={() => setScannerMode('global')}
                      className={`ghost-btn py-2 px-3 rounded-lg text-xs font-semibold ${scannerMode === 'global' ? 'active' : ''}`}
                    >
                      Global Color Key
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/40 border border-purple-500/15">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={targetHex}
                        onChange={(e) => setTargetColor(hexToRgb(e.target.value))}
                        className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border border-purple-400/40"
                      />
                      <div className="text-xs font-semibold text-white">Target Backdrop Color</div>
                    </div>
                    <span className="text-xs font-mono text-purple-300">{targetHex}</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-purple-200">Color Tolerance</span>
                      <span className="text-purple-300 font-mono">{tolerance}%</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={85}
                      value={tolerance}
                      onChange={(e) => setTolerance(parseInt(e.target.value, 10))}
                      className="purple-slider"
                      style={{
                        background: `linear-gradient(90deg, #7c3aed 0%, #c084fc ${((tolerance - 2) / 83) * 100}%, #1e1b2e ${
                          ((tolerance - 2) / 83) * 100
                        }%, #1e1b2e 100%)`
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-purple-200">Edge Lock</span>
                      <span className="text-purple-300 font-mono">{edgeLock}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={edgeLock}
                      onChange={(e) => setEdgeLock(parseInt(e.target.value, 10))}
                      className="purple-slider"
                      style={{
                        background: `linear-gradient(90deg, #7c3aed 0%, #c084fc ${edgeLock}%, #1e1b2e ${edgeLock}%, #1e1b2e 100%)`
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-purple-200">Feather</span>
                        <span className="text-purple-300 font-mono">{feather} px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={6}
                        value={feather}
                        onChange={(e) => setFeather(parseInt(e.target.value, 10))}
                        className="purple-slider"
                        style={{
                          background: `linear-gradient(90deg, #7c3aed 0%, #c084fc ${(feather / 6) * 100}%, #1e1b2e ${
                            (feather / 6) * 100
                          }%, #1e1b2e 100%)`
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-purple-200">Choke</span>
                        <span className="text-purple-300 font-mono">{choke} px</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={4}
                        value={choke}
                        onChange={(e) => setChoke(parseInt(e.target.value, 10))}
                        className="purple-slider"
                        style={{
                          background: `linear-gradient(90deg, #7c3aed 0%, #c084fc ${(choke / 4) * 100}%, #1e1b2e ${
                            (choke / 4) * 100
                          }%, #1e1b2e 100%)`
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="wardrobe-card rounded-2xl p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={itemName}
                      onChange={(e) => setItemName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-purple-500/30 text-sm text-white"
                    />
                    <select
                      value={itemCategory}
                      onChange={(e) => setItemCategory(e.target.value as GarmentCategory)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-purple-500/30 text-sm text-white"
                    >
                      <option value="Tops">Tops</option>
                      <option value="Outerwear">Outerwear</option>
                      <option value="Bottoms">Bottoms</option>
                      <option value="Shoes">Shoes</option>
                      <option value="Accessories">Accessories</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      const c = cutoutCanvasRef.current;
                      if (!c) return;
                      const newItem: WardrobeItem = {
                        id: 'item-' + Date.now(),
                        name: itemName.trim() || 'Custom Piece',
                        category: itemCategory,
                        colorName: 'Custom Shade',
                        colorHex: '#8b5cf6',
                        engineBadge: 'Fine-Tuned',
                        image: c.toDataURL('image/png'),
                        favorite: true
                      };
                      setItems((prev) => [newItem, ...prev]);
                      setActiveTab('drawers');
                      showToast(`Saved "${newItem.name}" to ${newItem.category}`);
                    }}
                    className="glow-btn w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Save to Drawer
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'studio' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Mix &amp; Match Outfit Studio</h2>
                <p className="text-xs text-purple-300/70">
                  Click pieces from your drawers on the right to layer an outfit, drag to position, or shuffle combinations.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleShuffleOutfit}
                  className="ghost-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-200 flex items-center gap-1.5"
                >
                  <Shuffle className="w-3.5 h-3.5" /> Shuffle Fit
                </button>
                <button
                  onClick={() => {
                    setStudioLayers([]);
                    setSelectedLayerId(null);
                  }}
                  className="ghost-btn px-3.5 py-2 rounded-xl text-xs font-semibold text-purple-200"
                >
                  Clear Board
                </button>
                <button
                  onClick={() => {
                    if (studioLayers.length === 0) return;
                    const newLook: LookbookEntry = {
                      id: 'look-' + Date.now(),
                      title: outfitTitle.trim() || 'Untitled Fit',
                      date: 'Just now',
                      items: studioLayers.map((l) => l.name),
                      layers: JSON.parse(JSON.stringify(studioLayers))
                    };
                    setLookbook((prev) => [newLook, ...prev]);
                    setActiveTab('lookbook');
                    showToast(`Saved "${newLook.title}" to Lookbook`);
                  }}
                  className="glow-btn px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save to Lookbook
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 wardrobe-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={outfitTitle}
                    onChange={(e) => setOutfitTitle(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-black/50 border border-purple-500/30 text-sm font-semibold text-white"
                  />
                  <span className="text-xs font-mono text-purple-300">{studioLayers.length} layers active</span>
                </div>

                <div
                  ref={studioBoardRef}
                  className="relative h-[480px] rounded-2xl checker-dark border border-purple-500/25 overflow-hidden select-none"
                >
                  {studioLayers.map((layer) => {
                    const isSel = layer.id === selectedLayerId;
                    return (
                      <div
                        key={layer.id}
                        onMouseDown={(e) => startDragLayer(e, layer)}
                        style={{
                          left: `${layer.x}px`,
                          top: `${layer.y}px`,
                          transform: `scale(${layer.scale})`
                        }}
                        className={`absolute w-40 h-40 flex items-center justify-center cursor-move ${
                          isSel ? 'ring-2 ring-purple-500 rounded-xl bg-purple-500/10' : ''
                        }`}
                      >
                        <img
                          src={layer.image}
                          alt={layer.name}
                          className="max-w-full max-h-full object-contain pointer-events-none"
                        />
                        {isSel && (
                          <button
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setStudioLayers((prev) => prev.filter((l) => l.id !== layer.id));
                              setSelectedLayerId(null);
                            }}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold shadow"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedLayer && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-purple-200 font-medium">Selected Layer Scale</span>
                      <span className="text-purple-300 font-mono">{Math.round(selectedLayer.scale * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={160}
                      value={Math.round(selectedLayer.scale * 100)}
                      onChange={(e) => {
                        const sc = parseInt(e.target.value, 10) / 100;
                        setStudioLayers((prev) =>
                          prev.map((l) => (l.id === selectedLayer.id ? { ...l, scale: sc } : l))
                        );
                      }}
                      className="purple-slider"
                      style={{
                        background: `linear-gradient(90deg, #7c3aed 0%, #c084fc ${
                          ((selectedLayer.scale * 100 - 50) / 110) * 100
                        }%, #1e1b2e ${((selectedLayer.scale * 100 - 50) / 110) * 100}%, #1e1b2e 100%)`
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 wardrobe-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-purple-400" /> Quick Drawer Picker
                  </h3>
                  <select
                    value={studioCategoryFilter}
                    onChange={(e) => setStudioCategoryFilter(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-black/60 border border-purple-500/30 text-xs text-purple-200"
                  >
                    <option value="All">All Categories</option>
                    <option value="Tops">Tops</option>
                    <option value="Outerwear">Outerwear</option>
                    <option value="Bottoms">Bottoms</option>
                    <option value="Shoes">Shoes</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1">
                  {items
                    .filter((i) => studioCategoryFilter === 'All' || i.category === studioCategoryFilter)
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          addLayerToStudio(item);
                          showToast(`Added ${item.name}`);
                        }}
                        className="wardrobe-card rounded-xl p-2.5 text-left flex flex-col items-center gap-2"
                      >
                        <div className="w-full h-24 rounded-lg checker-dark flex items-center justify-center p-2">
                          <img src={item.image} alt={item.name} className="max-h-20 max-w-full object-contain" />
                        </div>
                        <div className="w-full truncate text-xs font-semibold text-purple-100">{item.name}</div>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'lookbook' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Saved Lookbook</h2>
                <p className="text-xs text-purple-300/70">
                  Your curated combinations ready to wear or reload into the Mix &amp; Match board.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('studio')}
                className="glow-btn px-4 py-2 rounded-xl text-xs font-semibold text-white"
              >
                + Build New Outfit
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {lookbook.map((look) => (
                <div key={look.id} className="wardrobe-card rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-white">{look.title}</h4>
                      <span className="text-[11px] text-purple-300/70">{look.date}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {look.items.map((name, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[11px] bg-purple-950/80 border border-purple-500/25 text-purple-200"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-purple-500/15">
                    <button
                      onClick={() => {
                        setStudioLayers(JSON.parse(JSON.stringify(look.layers)));
                        setOutfitTitle(look.title);
                        setActiveTab('studio');
                        showToast(`Loaded "${look.title}"`);
                      }}
                      className="glow-btn flex-1 py-2 rounded-xl text-xs font-semibold text-white"
                    >
                      Open in Studio
                    </button>
                    <button
                      onClick={() => setLookbook((prev) => prev.filter((l) => l.id !== look.id))}
                      className="ghost-btn px-3 py-2 rounded-xl text-xs text-purple-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-purple-950/95 border border-purple-400/50 text-xs font-semibold text-white shadow-2xl shadow-purple-600/40 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
