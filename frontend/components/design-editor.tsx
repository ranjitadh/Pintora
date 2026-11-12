"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpToLine,
  CaseUpper,
  ChevronRight,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Grid,
  Image as ImageIcon,
  Layers,
  Layout,
  Loader2,
  Lock,
  LockOpen,
  Maximize,
  Minimize,
  Minus,
  Move,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Search,
  Shapes,
  ShoppingBag,
  Square,
  Trash2,
  Triangle,
  Type,
  Undo2,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { api, errorMessage, mediaUrl } from "@/lib/api";
import { notifyCart, useAuth } from "@/lib/auth";
import type { Cart, Clipart, Design, FontResource, GeneratedFile, Product, Quote, Template, Upload } from "@/lib/types";
import { cn, money } from "@/lib/utils";
import { Alert, Button } from "@/components/ui";

type Tool = "text" | "upload" | "clipart" | "templates" | "layers" | "products" | "elements" | "images";

interface EditorProps {
  product: Product;
  initialDesign: Design | null;
  initialTemplate: Template | null;
  initialVariantId?: string;
  initialMethodId?: string;
  initialError?: string;
}

interface StageState {
  last: any;
  undo: any[];
  redo: any[];
}

const COLORS = ["#211b16", "#fbf7ef", "#d95d39", "#65714c", "#f2c96b", "#2f5d8a", "#8b4a6b", "#ffffff"];

const TOOL_ITEMS: { id: Tool; label: string; icon: any }[] = [
  { id: "products", label: "Product", icon: Layout },
  { id: "templates", label: "Templates", icon: Shapes },
  { id: "text", label: "Text", icon: Type },
  { id: "elements", label: "Elements", icon: Grid },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "upload", label: "Uploads", icon: UploadCloud },
  { id: "layers", label: "Layers", icon: Layers },
];

const FALLBACK_FONTS = [
  { id: "inter", name: "Inter", family: "Inter" },
  { id: "lora", name: "Lora", family: "Lora" },
  { id: "mono", name: "Space Mono", family: "Space Mono" },
] as FontResource[];

function blankCanvas(area: any) {
  return {
    version: "5.3.0",
    width: area?.width_px || 1000,
    height: area?.height_px || 1000,
    objects: [],
  };
}

function isTextObject(object: any) {
  return !!object && ["i-text", "text", "textbox"].includes(object.type);
}

function normalizeTextStyles(objects: any[]) {
  (objects || []).forEach((obj: any) => {
    if (!obj || typeof obj !== "object") return;
    if (["textbox", "i-text", "text"].includes(obj.type) && (!obj.styles || typeof obj.styles !== "object")) {
      obj.styles = {};
    }
    if (Array.isArray(obj.objects)) normalizeTextStyles(obj.objects);
  });
  return objects;
}

function normalizeCanvasJson(json: any) {
  const copy = JSON.parse(JSON.stringify(json || {}));
  normalizeTextStyles(copy.objects || []);
  return copy;
}

function scaleCanvasJson(json: any, area: any) {
  const copy = normalizeCanvasJson(json);
  const targetW = area?.width_px || copy.width || 1000;
  const targetH = area?.height_px || copy.height || 1000;
  const sourceW = copy.width || targetW;
  const sourceH = copy.height || targetH;
  const sx = targetW / sourceW;
  const sy = targetH / sourceH;
  copy.width = targetW;
  copy.height = targetH;
  copy.objects = (copy.objects || []).map((obj: any) => {
    if (typeof obj.left === "number") obj.left *= sx;
    if (typeof obj.top === "number") obj.top *= sy;
    if (typeof obj.scaleX === "number") obj.scaleX *= sx;
    if (typeof obj.scaleY === "number") obj.scaleY *= sy;
    return obj;
  });
  return copy;
}

export function DesignEditor({
  product,
  initialDesign,
  initialTemplate,
  initialVariantId,
  initialMethodId,
  initialError,
}: EditorProps) {
  const router = useRouter();
  const { user, cartCount, isAdmin } = useAuth();
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<any>(null);
  const fabricLibRef = useRef<any>(null);
  const stageStates = useRef<Record<string, StageState>>({});
  const loadingRef = useRef(false);
  const activeStageRef = useRef("");
  const dirtyRef = useRef(false);
  const designIdRef = useRef(initialDesign?.id || "");
  const nameRef = useRef(initialDesign?.name || `${product.name} design`);

  const [ready, setReady] = useState(false);
  const [activeStageId, setActiveStageId] = useState(initialDesign?.stage || product.stages[0]?.id || "");
  const [name, setName] = useState(initialDesign?.name || `${product.name} design`);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState(initialError || "");
  const [notice, setNotice] = useState("");
  const [tool, setTool] = useState<Tool>("products");
  const [panelOpen, setPanelOpen] = useState(false);
  const [layers, setLayers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [fabricModule, setFabricModule] = useState<any>(null);

  const [color, setColor] = useState("#211b16");
  const [defaultFont, setDefaultFont] = useState("Inter");
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [fontSize, setFontSize] = useState(120);
  const [newText, setNewText] = useState("");

  const [fonts, setFonts] = useState<FontResource[]>([]);
  const [cliparts, setCliparts] = useState<Clipart[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clipartFilter, setClipartFilter] = useState("All");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [variantId, setVariantId] = useState(initialVariantId || product.variants.find((variant) => variant.is_active)?.id || "");
  const [methodId, setMethodId] = useState(
    initialMethodId ||
      product.printing_methods.find((link) => link.is_default)?.printing_method.id ||
      product.printing_methods[0]?.printing_method.id ||
      ""
  );
  const [quantity, setQuantity] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [adding, setAdding] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showMockupPreview, setShowMockupPreview] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [panning, setPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [workspaceSize, setWorkspaceSize] = useState({ width: 0, height: 0 });

  const [opacity, setOpacity] = useState(100);
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");
  const [charSpacing, setCharSpacing] = useState(0);
  const [lineHeight, setLineHeight] = useState(1);
  const [fontQuery, setFontQuery] = useState("");
  const [clipartQuery, setClipartQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const activeStage = useMemo(
    () => product.stages.find((stage) => stage.id === activeStageId) || product.stages[0],
    [product.stages, activeStageId]
  );
  const activeArea = activeStage?.print_area;
  const mockupUrl = activeStage?.mockup_url || product.image_url || "";
  const usingProductFallback = !activeStage?.mockup_url && !!product.image_url;

  useEffect(() => {
    nameRef.current = name;
  }, [name]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;
    const measure = () => {
      setWorkspaceSize({ width: element.clientWidth, height: element.clientHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPanMode(false);
    setPanning(false);
    panStart.current = null;
  }, [activeStageId]);

  useEffect(() => {
    if (!showMockupPreview && !panMode) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setSelected(null);
  }, [showMockupPreview, panMode]);

  const selectTool = useCallback((id: Tool) => {
    setTool(id);
    setPanelOpen(true);
  }, []);

  const refreshLayers = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setLayers([...canvas.getObjects()].reverse());
    setSelected(canvas.getActiveObject() || null);
    setHistoryTick((value) => value + 1);
  }, []);

  const notifySelection = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    setSelected(obj || null);
    if (obj) {
      if (typeof obj.fill === "string") setColor(obj.fill);
      if (obj.fontFamily) setDefaultFont(obj.fontFamily);
      if (obj.fontSize) setFontSize(obj.fontSize);
      if (typeof obj.fontWeight !== "undefined") setBold(obj.fontWeight === "bold" || Number(obj.fontWeight) >= 600);
      if (obj.fontStyle) setItalic(obj.fontStyle === "italic");
      if (typeof obj.opacity === "number") setOpacity(Math.round(obj.opacity * 100));
      if (obj.textAlign) setTextAlign(obj.textAlign);
      if (typeof obj.charSpacing === "number") setCharSpacing(obj.charSpacing);
      if (typeof obj.lineHeight === "number") setLineHeight(obj.lineHeight);
    }
  }, []);

  const persistCurrent = useCallback(() => {
    const canvas = fabricRef.current;
    const id = activeStageRef.current;
    if (!canvas || !id) return;
    const state = stageStates.current[id];
    if (state) state.last = canvas.toJSON();
  }, []);

  const pushHistory = useCallback(() => {
    if (loadingRef.current) return;
    const canvas = fabricRef.current;
    const id = activeStageRef.current;
    if (!canvas || !id) return;
    const state = stageStates.current[id];
    if (!state) return;
    const json = canvas.toJSON();
    const last = state.undo[state.undo.length - 1];
    if (!last || JSON.stringify(last) !== JSON.stringify(json)) {
      state.undo.push(json);
      if (state.undo.length > 40) state.undo.shift();
      state.redo = [];
      state.last = json;
    }
    setDirty(true);
    refreshLayers();
    notifySelection();
  }, [refreshLayers, notifySelection]);

  const applyCanvas = useCallback(
    (json: any) =>
      new Promise<void>((resolve) => {
        const canvas = fabricRef.current;
        const stage = product.stages.find((item) => item.id === activeStageRef.current);
        const area = stage?.print_area;
        if (!canvas || !area) return resolve();
        loadingRef.current = true;
        canvas.setDimensions({ width: area.width_px, height: area.height_px });
        canvas.loadFromJSON(normalizeCanvasJson(json || blankCanvas(area)), () => {
          canvas.renderAll();
          loadingRef.current = false;
          const id = activeStageRef.current;
          if (stageStates.current[id]) stageStates.current[id].last = canvas.toJSON();
          refreshLayers();
          notifySelection();
          resolve();
        });
      }),
    [notifySelection, product.stages, refreshLayers]
  );

  const loadStage = useCallback(
    async (id: string, override?: any) => {
      const canvas = fabricRef.current;
      const stage = product.stages.find((item) => item.id === id);
      if (!canvas || !stage?.print_area) return;
      if (activeStageRef.current && activeStageRef.current !== id) persistCurrent();
      activeStageRef.current = id;
      setActiveStageId(id);
      const stored = override
        ? override.stages
          ? override.stages[id]
          : override
        : stageStates.current[id]?.last;
      const json = stored || blankCanvas(stage.print_area);
      if (!stageStates.current[id]) {
        stageStates.current[id] = { last: json, undo: [json], redo: [] };
      }
      setFontSize(Math.round(stage.print_area.width_px * 0.075));
      await applyCanvas(json);
      setHistoryTick((value) => value + 1);
    },
    [applyCanvas, persistCurrent, product.stages]
  );

  const applyTemplate = useCallback(
    async (template: Template) => {
      const canvas = fabricRef.current;
      const stage = product.stages.find((item) => item.id === activeStageRef.current);
      if (!canvas || !stage?.print_area) return;

      const templateJson = template.canvas_json;
      const hasContent =
        templateJson !== null &&
        typeof templateJson === "object" &&
        !Array.isArray(templateJson) &&
        (Array.isArray(templateJson.objects)
          ? templateJson.objects.length > 0
          : Object.keys(templateJson).length > 0);

      if (!hasContent) {
        setNotice("This template has no design saved yet. Try another template.");
        return;
      }

      const json = scaleCanvasJson(templateJson, stage.print_area);
      loadingRef.current = true;
      try {
        canvas.loadFromJSON(normalizeCanvasJson(json), () => {
          canvas.renderAll();
          loadingRef.current = false;
          const id = activeStageRef.current;
          const state = stageStates.current[id];
          if (state) {
            state.last = canvas.toJSON();
            state.undo.push(state.last);
            state.redo = [];
          }
          setDirty(true);
          refreshLayers();
          notifySelection();
          setNotice(`Applied “${template.name}” — make it yours.`);
          setPanelOpen(false);
        });
      } catch {
        loadingRef.current = false;
        setNotice("That template could not be loaded. Please try another one.");
      }
    },
    [notifySelection, product.stages, refreshLayers]
  );

  useEffect(() => {
    let disposed = false;
    let canvas: any = null;
    import("fabric")
      .then((module: any) => {
        if (disposed) return;
        const fabric = module.fabric || module.default?.fabric || module.default || module;
        fabricLibRef.current = fabric;
        setFabricModule(fabric);
        const element = canvasElRef.current;
        if (!element) return;
        canvas = new fabric.Canvas(element, {
          preserveObjectStacking: true,
          selection: true,
          backgroundColor: undefined,
          fireRightClick: true,
          stopContextMenu: true,
        });
        fabricRef.current = canvas;
        fabric.Object.prototype.set({
          borderColor: "#d95d39",
          cornerColor: "#d95d39",
          cornerStrokeColor: "#fbf7ef",
          cornerStyle: "circle",
          transparentCorners: false,
          borderScaleFactor: 2,
        });

        const imports: Record<string, StageState> = {};
        if (initialDesign?.canvas_json?.stages) {
          Object.entries(initialDesign.canvas_json.stages).forEach(([id, json]) => {
            imports[id] = { last: json, undo: [json], redo: [] };
          });
        }
        stageStates.current = { ...imports };

        const desired =
          initialDesign?.stage ||
          initialDesign?.canvas_json?.activeStage ||
          product.stages[0]?.id;
        const startStage = product.stages.some((stage) => stage.id === desired)
          ? desired
          : product.stages[0]?.id;
        if (startStage) {
          activeStageRef.current = startStage;
          loadStage(startStage).then(async () => {
            if (disposed) return;
            if (initialTemplate && !initialDesign) await applyTemplate(initialTemplate);
            setReady(true);
          });
        }

        canvas.on("object:modified", pushHistory);
        canvas.on("object:added", pushHistory);
        canvas.on("object:removed", pushHistory);
        canvas.on("selection:created", notifySelection);
        canvas.on("selection:updated", notifySelection);
        canvas.on("selection:cleared", () => setSelected(null));
        canvas.on("text:changed", () => {
          setDirty(true);
          refreshLayers();
        });
        canvas.on("mouse:down", (opt: any) => {
          const native = opt.e as MouseEvent;
          if (native && native.button === 2) {
            const target = opt.target;
            if (target) {
              canvas.setActiveObject(target);
              canvas.requestRenderAll();
              setSelected(target);
              const x = Math.min(native.clientX, window.innerWidth - 220);
              const y = Math.min(native.clientY, window.innerHeight - 320);
              setContextMenu({ x, y });
            } else {
              setContextMenu(null);
            }
            return;
          }
          setContextMenu(null);
        });
      })
      .catch(() => setError("The design engine failed to load. Please refresh the page."));

    return () => {
      disposed = true;
      try {
        canvas?.dispose();
      } catch {}
      fabricRef.current = null;
      stageStates.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  useEffect(() => {
    api.get<FontResource[]>("/fonts/").then((data) => {
      setFonts(data);
      data.forEach((font) => {
        if (!font.url) return;
        try {
          const face = new FontFace(font.family, `url("${mediaUrl(font.url)}")`, {
            weight: font.weight || "normal",
            style: font.style || "normal",
          });
          face.load().then((loaded) => document.fonts.add(loaded)).catch(() => {});
        } catch {}
      });
    }).catch(() => {});
    api.get<Clipart[]>("/cliparts/").then(setCliparts).catch(() => {});
    api.get<Template[]>("/templates/").then(setTemplates).catch(() => {});
  }, []);

  useEffect(() => {
    if (!fabricModule || !ready) return;
    const stage = product.stages.find((item) => item.id === activeStageId);
    const width = stage?.print_area?.width_px || 1000;
    const control = Math.max(18, Math.round(width * 0.012));
    fabricModule.Object.prototype.set({
      cornerSize: control,
      touchCornerSize: control * 2,
      padding: Math.round(control * 0.2),
      borderScaleFactor: Math.max(1.5, width / 800),
    });
  }, [fabricModule, ready, activeStageId, product.stages]);

  useEffect(() => {
    let cancelled = false;
    const payload: any = {
      product: product.id,
      variant: variantId || undefined,
      printing_method: methodId || undefined,
      quantity,
    };
    if (user && designIdRef.current) payload.design = designIdRef.current;
    api
      .post<Quote>("/pricing/", payload)
      .then((data) => {
        if (!cancelled) setQuote(data);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, product.id, variantId, methodId, quantity, savedAt, activeStageId]);

  const buildPayload = useCallback(() => {
    persistCurrent();
    const stages: Record<string, any> = {};
    product.stages.forEach((stage) => {
      if (stageStates.current[stage.id]) {
        const stageJson = { ...stageStates.current[stage.id].last };
        if (stageJson.width === undefined) {
          stageJson.width = stage.print_area?.width_px || 1000;
        }
        if (stageJson.height === undefined) {
          stageJson.height = stage.print_area?.height_px || 1000;
        }
        stages[stage.id] = stageJson;
      }
    });
    const activeStage = product.stages.find((s) => s.id === activeStageRef.current);
    const area = activeStage?.print_area;
    return {
      product: product.id,
      stage: activeStageRef.current,
      name: nameRef.current || `${product.name} design`,
      canvas_json: {
        stages,
        activeStage: activeStageRef.current,
        width: area?.width_px || 1000,
        height: area?.height_px || 1000,
      },
      metadata: { stage: activeStageRef.current },
    };
  }, [persistCurrent, product]);

  const save = useCallback(
    async (autosave = false): Promise<string | null> => {
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return null;
      }
      setSaving(true);
      setError("");
      try {
        const payload = buildPayload();
        if (!designIdRef.current) {
          const created = await api.post<Design>("/designs/", { ...payload, status: "saved" });
          designIdRef.current = created.id;
          const url = new URL(window.location.href);
          url.searchParams.set("design", created.id);
          window.history.replaceState(window.history.state, "", url.toString());
          setNotice("Design saved to your studio.");
        } else if (autosave) {
          await api.post(`/designs/${designIdRef.current}/autosave/`, payload);
          setNotice("Draft autosaved.");
        } else {
          await api.patch(`/designs/${designIdRef.current}/`, { ...payload, status: "saved" });
          setNotice("Design saved.");
        }
        setDirty(false);
        setSavedAt(new Date());
        return designIdRef.current;
      } catch (err: any) {
        setError(errorMessage(err));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [buildPayload, router, user]
  );

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      if (designIdRef.current && dirtyRef.current && !loadingRef.current) saveRef.current(true);
    }, 45000);
    return () => clearInterval(timer);
  }, [user]);

  const addText = () => {
    const fabric = fabricLibRef.current;
    const canvas = fabricRef.current;
    if (!ready || !fabric || !canvas || !activeArea) return;
    const value = (newText || "Your text").trim();
    const object = new fabric.IText(value, {
      left: activeArea.width_px / 2,
      top: activeArea.height_px / 2,
      originX: "center",
      originY: "center",
      fontFamily: defaultFont,
      fontSize,
      fontWeight: bold ? "bold" : "normal",
      fontStyle: italic ? "italic" : "normal",
      fill: color,
      textAlign,
      charSpacing,
      lineHeight,
    });
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.renderAll();
    setNewText("");
    refreshLayers();
    setPanelOpen(false);
  };

  const addShape = (shape: "rect" | "circle" | "triangle") => {
    const fabric = fabricLibRef.current;
    const canvas = fabricRef.current;
    if (!fabric || !canvas || !activeArea) return;
    const size = Math.round(activeArea.width_px * 0.25);
    const options = {
      left: activeArea.width_px / 2,
      top: activeArea.height_px / 2,
      originX: "center",
      originY: "center",
      fill: color,
      strokeWidth: 0,
      opacity: 0.92,
    };
    let object: any;
    if (shape === "circle") object = new fabric.Circle({ ...options, radius: size / 2 });
    else if (shape === "triangle") object = new fabric.Triangle({ ...options, width: size, height: size });
    else object = new fabric.Rect({ ...options, width: size, height: Math.round(size * 0.66), rx: 8, ry: 8 });
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.renderAll();
    refreshLayers();
    setPanelOpen(false);
  };

  const addImage = (
    url: string,
    naturalWidth = 800,
    naturalHeight = 800,
    name?: string,
    printoraType: "image" | "clipart" = "image"
  ) => {
    const fabric = fabricLibRef.current;
    const canvas = fabricRef.current;
    if (!fabric || !canvas || !activeArea) return;
    fabric.Image.fromURL(
      mediaUrl(url),
      (image: any) => {
        if (!image) return;
        const maxWidth = activeArea.width_px * 0.55;
        const maxHeight = activeArea.height_px * 0.45;
        const scale = Math.min(maxWidth / (image.width || naturalWidth), maxHeight / (image.height || naturalHeight), 1);
        image.set({
          left: activeArea.width_px / 2,
          top: activeArea.height_px / 2,
          originX: "center",
          originY: "center",
          scaleX: scale,
          scaleY: scale,
        });
        image.set({ printoraType });
        if (name) image.set({ name });
        canvas.add(image);
        canvas.setActiveObject(image);
        canvas.renderAll();
        refreshLayers();
        setPanelOpen(false);
      },
      { crossOrigin: "anonymous" }
    );
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const asset = await api.upload<Upload>("/uploads/", form);
      setUploads((current) => [asset, ...current]);
      addImage(asset.url, asset.width, asset.height, asset.original_name);
      setNotice(`${asset.original_name} added to your canvas.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const applySelected = (props: Record<string, any>) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getActiveObjects();
    if (!objects.length) return;
    objects.forEach((object: any) => object.set(props));
    canvas.requestRenderAll();
    pushHistory();
  };

  const changeColor = (value: string) => {
    setColor(value);
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (object) applySelected({ fill: value });
  };

  const changeFont = (family: string) => {
    setDefaultFont(family);
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (object && (object.type === "i-text" || object.type === "text" || object.type === "textbox")) {
      applySelected({ fontFamily: family });
    }
  };

  const changeFontSize = (value: number) => {
    setFontSize(value);
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (object && "fontSize" in object) applySelected({ fontSize: value });
  };

  const toggleStyle = (prop: "fontWeight" | "fontStyle") => {
    if (prop === "fontWeight") {
      const next = !bold;
      setBold(next);
      applySelected({ fontWeight: next ? "bold" : "normal" });
    } else {
      const next = !italic;
      setItalic(next);
      applySelected({ fontStyle: next ? "italic" : "normal" });
    }
  };

  const deleteSelected = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getActiveObjects();
    if (!objects.length) return;
    objects.forEach((object: any) => canvas.remove(object));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    pushHistory();
  };

  const duplicateSelected = () => {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    object.clone((clone: any) => {
      clone.set({ left: object.left + 40, top: object.top + 40, evented: true });
      canvas.add(clone);
      canvas.setActiveObject(clone);
      canvas.requestRenderAll();
      refreshLayers();
    });
  };

  const moveLayer = (direction: "up" | "down") => {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    if (direction === "up") canvas.bringForward(object);
    else canvas.sendBackwards(object);
    canvas.requestRenderAll();
    pushHistory();
  };

  const makeBigger = () => {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    const factor = 1.2;
    object.scaleX = Number((object.scaleX || 1) * factor);
    object.scaleY = Number((object.scaleY || 1) * factor);
    object.setCoords();
    canvas.requestRenderAll();
    pushHistory();
  };

  const rotateSelected = (degrees = 15) => {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    const currentAngle = typeof object.getAngle === "function" ? object.getAngle() : (object.angle || 0);
    object.setAngle(currentAngle + degrees);
    object.setCoords();
    canvas.requestRenderAll();
    pushHistory();
  };

  const applyTextProp = (props: Record<string, any>) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getActiveObjects().filter(isTextObject);
    if (!objects.length) return;
    objects.forEach((object: any) => object.set(props));
    canvas.requestRenderAll();
    pushHistory();
  };

  const alignSelected = (edge: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    const canvas = fabricRef.current;
    if (!canvas || !activeArea) return;
    const object = canvas.getActiveObject();
    if (!object) return;
    object.setCoords();
    const rect = object.getBoundingRect(true, true);
    let dx = 0;
    let dy = 0;
    if (edge === "left") dx = -rect.left;
    if (edge === "center") dx = (activeArea.width_px - rect.width) / 2 - rect.left;
    if (edge === "right") dx = activeArea.width_px - rect.width - rect.left;
    if (edge === "top") dy = -rect.top;
    if (edge === "middle") dy = (activeArea.height_px - rect.height) / 2 - rect.top;
    if (edge === "bottom") dy = activeArea.height_px - rect.height - rect.top;
    object.set({ left: (object.left || 0) + dx, top: (object.top || 0) + dy });
    object.setCoords();
    canvas.requestRenderAll();
    pushHistory();
  };

  const changeOpacity = (value: number) => {
    setOpacity(value);
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    object.set({ opacity: value / 100 });
    canvas.requestRenderAll();
    pushHistory();
  };

  const changeTextAlign = (value: "left" | "center" | "right") => {
    setTextAlign(value);
    applyTextProp({ textAlign: value });
  };

  const changeCharSpacing = (value: number) => {
    setCharSpacing(value);
    applyTextProp({ charSpacing: value });
  };

  const changeLineHeight = (value: number) => {
    setLineHeight(value);
    applyTextProp({ lineHeight: value });
  };

  const toggleUppercase = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getActiveObjects().filter(isTextObject);
    if (!objects.length) return;
    objects.forEach((object: any) => {
      if (!object.__originalText) object.__originalText = object.text || "";
      const original = object.__originalText as string;
      const isUpper = (object.text || "") === original.toUpperCase();
      object.set("text", isUpper ? original : original.toUpperCase());
    });
    canvas.requestRenderAll();
    pushHistory();
  };

  const bringToFront = () => {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    canvas.bringToFront(object);
    canvas.requestRenderAll();
    pushHistory();
  };

  const sendToBack = () => {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object) return;
    canvas.sendToBack(object);
    canvas.requestRenderAll();
    pushHistory();
  };

  const toggleLayerVisibility = (object: any) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const nextVisible = object.visible === false;
    object.set("visible", nextVisible);
    if (!nextVisible && canvas.getActiveObject() === object) {
      canvas.discardActiveObject();
      setSelected(null);
    }
    canvas.requestRenderAll();
    pushHistory();
  };

  const toggleLayerLock = (object: any) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const nextSelectable = object.selectable === false;
    object.set({ selectable: nextSelectable, evented: nextSelectable });
    if (!nextSelectable && canvas.getActiveObject() === object) {
      canvas.discardActiveObject();
      setSelected(null);
    }
    canvas.requestRenderAll();
    pushHistory();
  };

  const nudgeSelected = (dx: number, dy: number) => {
    const canvas = fabricRef.current;
    const object = canvas?.getActiveObject();
    if (!canvas || !object || object.type === "activeSelection") return;
    object.set({ left: (object.left || 0) + dx, top: (object.top || 0) + dy });
    object.setCoords();
    canvas.requestRenderAll();
    pushHistory();
  };

  const undo = () => {
    const state = stageStates.current[activeStageRef.current];
    if (!state || state.undo.length < 2) return;
    const current = state.undo.pop();
    if (current) state.redo.push(current);
    const previous = state.undo[state.undo.length - 1];
    applyCanvas(previous).then(() => {
      setDirty(true);
      setHistoryTick((value) => value + 1);
    });
  };

  const redo = () => {
    const state = stageStates.current[activeStageRef.current];
    if (!state || !state.redo.length) return;
    const next = state.redo.pop();
    if (!next) return;
    state.undo.push(next);
    applyCanvas(next).then(() => {
      setDirty(true);
      setHistoryTick((value) => value + 1);
    });
  };

  const handleAddToCart = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!ready || !activeStageRef.current) {
      setError("The design canvas is still loading. Please try again in a moment.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      let id: string | null = designIdRef.current;
      if (!id || dirtyRef.current) {
        id = await save(false);
      }
      if (!id) return;
      await api.post<Cart>("/cart/items/", {
        product: product.id,
        variant: variantId || null,
        design: id,
        printing_method: methodId || null,
        quantity,
      });
      notifyCart();
      router.push("/cart");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const handleDownload = async (fileType: "png" | "svg" | "pdf" = "png") => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setDownloading(true);
    setError("");
    try {
      const id = designIdRef.current || (await save(false));
      if (!id) return;
      const dpi = fileType === "png" ? 150 : 300;
      const file = await api.post<GeneratedFile>("/exports/create/", { design: id, file_type: fileType, dpi });
      if (file.url) {
        window.open(mediaUrl(file.url), "_blank");
        setNotice(`Print-ready ${fileType.toUpperCase()} generated.`);
      } else {
        setNotice(`${fileType.toUpperCase()} export queued — it will appear in your studio when ready.`);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const state = stageStates.current[activeStageId];
  const canUndo = !!state && state.undo.length > 1;
  const canRedo = !!state && state.redo.length > 0;
  const isTextSelected = !!selected && ["i-text", "text", "textbox"].includes(selected.type);

  const activeStageObj = product.stages.find((stage) => stage.id === activeStageId);
  const activePrintArea = activeStageObj?.print_area;

  const stageBox =
    activeStageObj && activePrintArea
      ? {
          left: `${(activePrintArea.mockup_x / (activeStageObj.mockup_width || 1000)) * 100}%`,
          top: `${(activePrintArea.mockup_y / (activeStageObj.mockup_height || 1000)) * 100}%`,
          width: `${(activePrintArea.mockup_width / (activeStageObj.mockup_width || 1000)) * 100}%`,
          height: `${(activePrintArea.mockup_height / (activeStageObj.mockup_height || 1000)) * 100}%`,
        }
      : { left: "8%", top: "8%", width: "84%", height: "84%" };

  const mockupRatio = activeStageObj
    ? `${activeStageObj.mockup_width || 1000}/${activeStageObj.mockup_height || 1000}`
    : activePrintArea
    ? `${activePrintArea.width_px}/${activePrintArea.height_px}`
    : "1/1";

  const stageMockupWidth = activeStageObj?.mockup_width || activePrintArea?.width_px || 1000;
  const stageMockupHeight = activeStageObj?.mockup_height || activePrintArea?.height_px || 1000;
  const workspacePadding = workspaceSize.width < 640 ? 24 : 56;
  const availableWidth = Math.max(120, workspaceSize.width - workspacePadding * 2);
  const availableHeight = Math.max(120, workspaceSize.height - workspacePadding * 2);
  const fitScale = Math.min(availableWidth / stageMockupWidth, availableHeight / stageMockupHeight);
  const displayMockupWidth = workspaceSize.width ? Math.max(120, Math.round(stageMockupWidth * fitScale)) : 0;
  const displayMockupHeight = workspaceSize.height ? Math.max(120, Math.round(stageMockupHeight * fitScale)) : 0;

  const clampZoom = (value: number) => Math.min(3, Math.max(0.5, Math.round(value * 100) / 100));
  const zoomBy = (delta: number) => setZoom((value) => clampZoom(value + delta));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-editor-controls]")) return;
    if (!panMode && !event.altKey && event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    panStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setPanning(true);
  };
  const movePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panStart.current) return;
    event.preventDefault();
    event.stopPropagation();
    setPan({
      x: panStart.current.panX + event.clientX - panStart.current.x,
      y: panStart.current.panY + event.clientY - panStart.current.y,
    });
  };
  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panStart.current) return;
    event.stopPropagation();
    panStart.current = null;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const shortcutRef = useRef({ undo, redo, deleteSelected, duplicateSelected, nudgeSelected, save });
  useEffect(() => {
    shortcutRef.current = { undo, redo, deleteSelected, duplicateSelected, nudgeSelected, save };
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      const canvas = fabricRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject() as any;
      if (active?.isEditing) return;
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key;
      if (meta && key.toLowerCase() === "s") {
        event.preventDefault();
        shortcutRef.current.save(false);
        return;
      }
      if (meta && key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) shortcutRef.current.redo();
        else shortcutRef.current.undo();
        return;
      }
      if (meta && key.toLowerCase() === "y") {
        event.preventDefault();
        shortcutRef.current.redo();
        return;
      }
      if (meta && key.toLowerCase() === "d") {
        event.preventDefault();
        shortcutRef.current.duplicateSelected();
        return;
      }
      if (key === "Delete" || key === "Backspace") {
        if (active) {
          event.preventDefault();
          shortcutRef.current.deleteSelected();
        }
        return;
      }
      if (key === "Escape") {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        setSelected(null);
        setContextMenu(null);
        setPanMode(false);
        setShowMockupPreview(false);
        return;
      }
      if (active && key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        if (key === "ArrowLeft") shortcutRef.current.nudgeSelected(-step, 0);
        if (key === "ArrowRight") shortcutRef.current.nudgeSelected(step, 0);
        if (key === "ArrowUp") shortcutRef.current.nudgeSelected(0, -step);
        if (key === "ArrowDown") shortcutRef.current.nudgeSelected(0, step);
        return;
      }
      if (!meta && (key === "+" || key === "=")) {
        event.preventDefault();
        setZoom((value) => Math.min(3, Math.max(0.5, Math.round((value + 0.1) * 100) / 100)));
      }
      if (!meta && key === "-") {
        event.preventDefault();
        setZoom((value) => Math.min(3, Math.max(0.5, Math.round((value - 0.1) * 100) / 100)));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((value) => Math.min(3, Math.max(0.5, Math.round((value - event.deltaY * 0.002) * 100) / 100)));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [contextMenu]);

  const clipartCategories = useMemo(
    () => ["All", ...Array.from(new Set(cliparts.map((item) => item.category)))],
    [cliparts]
  );
  const visibleCliparts = cliparts.filter((item) => {
    const matchesCategory = clipartFilter === "All" || item.category === clipartFilter;
    const query = clipartQuery.trim().toLowerCase();
    const matchesQuery =
      !query || `${item.name} ${item.category} ${(item.tags || []).join(" ")}`.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });
  const fontList = (fonts.length ? fonts : FALLBACK_FONTS).filter((font) => {
    const query = fontQuery.trim().toLowerCase();
    return !query || `${font.name} ${font.family}`.toLowerCase().includes(query);
  });
  const relevantTemplates = templates.filter((item) => !item.product_slug || item.product_slug === product.slug);
  const templateList = relevantTemplates.length ? relevantTemplates : templates;

  const selectedVariant = product.variants.find((variant) => variant.id === variantId);
  const methods = product.printing_methods;
  const selectedMethodFee = Number(
    methods.find((link) => link.printing_method.id === methodId)?.printing_method.base_fee || 0
  );
  const displayTotal =
    quote?.total || (Number(product.base_price) + Number(selectedVariant?.price_delta || 0) + selectedMethodFee) * quantity;
  const toolLabel = TOOL_ITEMS.find((item) => item.id === tool)?.label || "Tools";
  const exportTypes = isAdmin ? (["png", "svg", "pdf"] as const) : (["png"] as const);

  return (
    <div className="fixed inset-0 z-0 flex flex-col bg-cream text-ink selection:bg-clay selection:text-cream">
      <header className="relative z-50 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-ink/10 bg-cream/95 px-3 backdrop-blur-sm sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href={`/products/${product.slug}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink/15 hover:bg-ink/5"
            aria-label="Back to product"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex min-w-0 flex-col items-start gap-0.5">
            <p className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-clay sm:block">
              Studio · {product.name}
            </p>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setDirty(true);
              }}
              className="w-32 truncate border-none bg-transparent font-display text-base font-bold outline-none focus:ring-0 sm:w-48 sm:text-xl md:w-64"
              aria-label="Design name"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center gap-1.5 lg:flex">
            <span className="font-mono text-[10px] uppercase tracking-wider text-clay">
              {activeStageObj?.name || "Front"}
            </span>
            {product.stages.length > 1 && (
              <button
                onClick={() => {
                  const stages = product.stages;
                  const currentIndex = stages.findIndex((stage) => stage.id === activeStageId);
                  const nextIndex = (currentIndex + 1) % stages.length;
                  loadStage(stages[nextIndex].id);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 hover:bg-ink/5"
                title="Next view"
                aria-label="Next view"
              >
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          <div className="hidden h-6 w-px bg-ink/10 md:block" />

          <button
            onClick={undo}
            disabled={!canUndo}
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-ink/15 bg-white hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40 md:flex"
            title="Undo"
            aria-label="Undo"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-ink/15 bg-white hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40 md:flex"
            title="Redo"
            aria-label="Redo"
          >
            <Redo2 size={15} />
          </button>
          <button
            onClick={() => setShowMockupPreview((prev) => !prev)}
            className={cn(
              "hidden h-9 w-9 items-center justify-center rounded-lg border lg:flex",
              showMockupPreview ? "border-clay bg-clay text-white" : "border-ink/15 bg-white hover:bg-ink/5"
            )}
            title={showMockupPreview ? "Exit mockup preview" : "Mockup preview"}
            aria-label={showMockupPreview ? "Exit mockup preview" : "Mockup preview"}
          >
            {showMockupPreview ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
          <button
            onClick={() => save(false)}
            disabled={!ready || saving}
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-ink/15 bg-white hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
            title="Save design"
            aria-label="Save design"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          </button>

          <button
            onClick={() => router.push("/cart")}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-ink/15 bg-white hover:bg-ink/10"
            aria-label="View cart"
          >
            <ShoppingBag size={16} />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-cream">
                {cartCount}
              </span>
            )}
          </button>

          <span className="hidden font-mono text-sm font-bold text-clay sm:inline">{money(displayTotal)}</span>

          <div className="hidden items-center gap-1 md:flex">
            <button
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 hover:bg-ink/5"
              aria-label="Decrease quantity"
            >
              <Minus size={13} />
            </button>
            <input
              type="number"
              min={1}
              max={1000}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))}
              className="h-8 w-10 rounded-lg border border-ink/15 text-center text-xs outline-none focus:ring-2 focus:ring-clay/20"
              aria-label="Quantity"
            />
            <button
              onClick={() => setQuantity((value) => Math.min(1000, value + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 hover:bg-ink/5"
              aria-label="Increase quantity"
            >
              <Plus size={13} />
            </button>
          </div>

          <Button size="sm" onClick={handleAddToCart} loading={adding} disabled={!ready} aria-label="Add to cart" className="px-3 sm:px-3.5">
            <ShoppingBag size={16} /> <span className="hidden sm:inline">Add to cart</span>
          </Button>
        </div>
      </header>

      {(error || notice) && (
        <div className="fixed left-1/2 top-16 z-[90] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2">
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg",
              error ? "border-rose-200 bg-rose-50 text-rose-900" : "border-olive/20 bg-olive-soft text-olive"
            )}
            role={error ? "alert" : "status"}
          >
            <span className="flex-1">{error || notice}</span>
            <button
              onClick={() => {
                setError("");
                setNotice("");
              }}
              className="shrink-0 rounded p-0.5 hover:bg-black/5"
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {panelOpen && (
          <div
            className="fixed inset-0 z-40 bg-ink/40 xl:hidden"
            onClick={() => setPanelOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Left Tool Panel */}
        <aside
          className={cn(
            "w-64 shrink-0 flex-col border-r border-ink/10 bg-white xl:static xl:z-30 xl:flex xl:h-full",
            panelOpen
              ? "fixed bottom-14 left-0 top-14 z-[70] flex max-w-[85vw] shadow-2xl"
              : "hidden"
          )}
        >
          <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3 xl:hidden">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-clay">Studio tools</p>
              <p className="font-display text-lg font-bold">{toolLabel}</p>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 hover:bg-ink/5"
              aria-label="Close tools"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-4 border-b border-ink/10">
            {TOOL_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => selectTool(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-[10px] font-semibold transition",
                  tool === item.id ? "bg-ink text-cream" : "text-muted hover:bg-ink/5 hover:text-ink"
                )}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Tool panels */}
            {tool === "products" && (
              <div className="space-y-4">
                <div>
                  <label className="label">Product</label>
                  <p className="text-[11px] text-muted">{product.name}</p>
                  <p className="text-[10px] text-muted">{product.short_description}</p>
                </div>
                <div className="mt-4">
                  <label className="label">Colour / Size</label>
                  <div className="grid grid-cols-1 gap-2">
                    <select
                      value={variantId}
                      onChange={(event) => setVariantId(event.target.value)}
                      className="field"
                      disabled={!product.variants.some((variant) => variant.is_active)}
                      aria-label="Colour and size"
                    >
                      {product.variants.filter((variant) => variant.is_active).map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {[variant.color_name, variant.size].filter(Boolean).join(" / ") || variant.name}
                          {Number(variant.price_delta) > 0 ? ` (+${money(variant.price_delta)})` : ""}
                        </option>
                      ))}
                    </select>
                    <select
                      value={methodId}
                      onChange={(event) => setMethodId(event.target.value)}
                      className="field"
                      disabled={!methods.length}
                      aria-label="Print method"
                    >
                      {methods.map((link) => (
                        <option key={link.id} value={link.printing_method.id}>
                          {link.printing_method.name}
                          {Number(link.printing_method.base_fee) > 0 ? ` (+${money(link.printing_method.base_fee)})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!product.variants.some((variant) => variant.is_active) && (
                    <p className="mt-2 text-[11px] text-rose-700">This product has no variants available right now.</p>
                  )}
                  {!methods.length && <p className="mt-2 text-[11px] text-rose-700">No printing methods are configured for this product.</p>}
                </div>
                <div className="mt-4">
                  <label className="label">Quantity</label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setQuantity((v) => Math.max(1, v - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 hover:border-ink"
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={quantity}
                      onChange={(event) => setQuantity(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))}
                      className="w-10 h-8 border border-ink/15 text-center text-xs outline-none focus:ring-2 focus:ring-clay/20"
                    />
                    <button
                      onClick={() => setQuantity((v) => Math.min(1000, v + 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 hover:bg-ink/5"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tool === "templates" && (
              <div className="space-y-3">
                <p className="text-[11px] text-muted">Applying a template replaces the current stage canvas. You can undo it.</p>
                <div className="grid grid-cols-2 gap-2">
                  {templateList.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="group overflow-hidden rounded-xl border border-ink/10 bg-white text-left hover:border-clay"
                    >
                      <div className="aspect-[4/5] bg-sand">
                        {template.preview_url ? (
                          <img src={mediaUrl(template.preview_url)} alt={template.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-ink/20"><Shapes /></div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="truncate text-[11px] font-semibold">{template.name}</p>
                        <p className="text-[10px] text-muted">{template.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {templateList.length === 0 && <p className="text-[11px] text-muted">No templates available.</p>}
              </div>
            )}

            {tool === "text" && (
              <div className="space-y-5">
                <div>
                  <label className="label">Add text</label>
                  <textarea
                    value={newText}
                    onChange={(event) => setNewText(event.target.value)}
                    placeholder="Your words here"
                    rows={2}
                    className="field resize-none"
                  />
                  <Button className="mt-2 w-full" size="sm" onClick={addText} disabled={!ready}>Add to canvas</Button>
                </div>
                <div>
                  <label className="label">Typeface</label>
                  <div className="relative mb-2">
                    <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      value={fontQuery}
                      onChange={(event) => setFontQuery(event.target.value)}
                      placeholder="Search fonts"
                      className="field h-9 pl-8 text-xs"
                    />
                  </div>
                  <div className="grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto pr-0.5">
                    {fontList.map((font) => (
                      <button
                        key={font.id}
                        onClick={() => changeFont(font.family)}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                          defaultFont === font.family ? "border-clay bg-clay/5" : "border-ink/10 hover:border-ink/30"
                        )}
                        style={{ fontFamily: font.family }}
                      >
                        <span>{font.name}</span>
                        <span className="text-[10px] text-muted">{font.family}</span>
                      </button>
                    ))}
                    {fontList.length === 0 && <p className="text-[11px] text-muted">No fonts match “{fontQuery}”.</p>}
                  </div>
                </div>
                <div>
                  <label className="label">Alignment</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { value: "left" as const, icon: AlignLeft, label: "Align text left" },
                      { value: "center" as const, icon: AlignCenter, label: "Align text center" },
                      { value: "right" as const, icon: AlignRight, label: "Align text right" },
                    ]).map((item) => (
                      <button
                        key={item.value}
                        onClick={() => changeTextAlign(item.value)}
                        className={cn(
                          "flex items-center justify-center rounded-lg border py-2",
                          textAlign === item.value ? "border-ink bg-ink text-cream" : "border-ink/10 hover:border-ink/30"
                        )}
                        aria-label={item.label}
                        title={item.label}
                      >
                        <item.icon size={14} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => toggleStyle("fontWeight")}
                    className={cn("rounded-lg border py-2 text-sm font-bold", bold ? "border-ink bg-ink text-cream" : "border-ink/10")}
                    aria-label="Bold"
                    title="Bold"
                  >
                    B
                  </button>
                  <button
                    onClick={() => toggleStyle("fontStyle")}
                    className={cn("rounded-lg border py-2 text-sm italic", italic ? "border-ink bg-ink text-cream" : "border-ink/10")}
                    aria-label="Italic"
                    title="Italic"
                  >
                    I
                  </button>
                  <button
                    onClick={toggleUppercase}
                    className="flex items-center justify-center rounded-lg border border-ink/10 py-2 hover:border-ink/30"
                    aria-label="Toggle uppercase"
                    title="Uppercase"
                  >
                    <CaseUpper size={14} />
                  </button>
                </div>
                <div>
                  <label className="label">Size · {fontSize}px</label>
                  <input
                    type="range"
                    min={24}
                    max={Math.max(400, Math.round((activeArea?.width_px || 1200) * 0.35))}
                    value={fontSize}
                    onChange={(event) => changeFontSize(Number(event.target.value))}
                    className="w-full accent-clay"
                  />
                </div>
                <div>
                  <label className="label">Letter spacing · {charSpacing}</label>
                  <input
                    type="range"
                    min={-50}
                    max={300}
                    step={10}
                    value={charSpacing}
                    onChange={(event) => changeCharSpacing(Number(event.target.value))}
                    className="w-full accent-clay"
                  />
                </div>
                <div>
                  <label className="label">Line height · {lineHeight.toFixed(1)}</label>
                  <input
                    type="range"
                    min={0.8}
                    max={2}
                    step={0.1}
                    value={lineHeight}
                    onChange={(event) => changeLineHeight(Number(event.target.value))}
                    className="w-full accent-clay"
                  />
                </div>
              </div>
            )}

            {tool === "elements" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => addShape("rect")}
                    className="aspect-square overflow-hidden rounded-lg border border-ink/10 bg-white p-1.5 hover:border-clay"
                    title="Rectangle"
                  >
                    <Square size={14} />
                  </button>
                  <button
                    onClick={() => addShape("circle")}
                    className="aspect-square overflow-hidden rounded-lg border border-ink/10 bg-white p-1.5 hover:border-clay"
                    title="Circle"
                  >
                    <Circle size={14} />
                  </button>
                  <button
                    onClick={() => addShape("triangle")}
                    className="aspect-square overflow-hidden rounded-lg border border-ink/10 bg-white p-1.5 hover:border-clay"
                    title="Triangle"
                  >
                    <Triangle size={14} />
                  </button>
                </div>
              </div>
            )}

            {(tool === "images" || tool === "clipart") && (
              <div className="space-y-3">
                <div>
                  <label className="label">Clipart library</label>
                  <p className="text-[11px] text-muted">Click any image to add it to the current print area.</p>
                </div>
                <div className="relative">
                  <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={clipartQuery}
                    onChange={(event) => setClipartQuery(event.target.value)}
                    placeholder="Search clipart"
                    className="field h-9 pl-8 text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {clipartCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setClipartFilter(category)}
                      className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold", clipartFilter === category ? "bg-ink text-cream" : "bg-sand")}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {visibleCliparts.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addImage(item.image_url, 600, 600, item.name, "clipart")}
                      className="group aspect-square overflow-hidden rounded-lg border border-ink/10 bg-white p-1.5 hover:border-clay"
                      title={item.name}
                    >
                      <img src={mediaUrl(item.thumbnail_url || item.image_url)} alt={item.name} className="h-full w-full object-contain transition group-hover:scale-105" />
                    </button>
                  ))}
                  {visibleCliparts.length === 0 && <p className="text-[11px] text-muted">No clipart in this category yet.</p>}
                </div>
              </div>
            )}

            {tool === "upload" && (
              <div className="space-y-4">
                <div
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/15 px-4 py-8 text-center transition hover:border-clay"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleUpload(event.dataTransfer.files?.[0] || null);
                  }}
                >
                  {uploading ? <Loader2 className="animate-spin text-clay" /> : <UploadCloud className="text-clay" />}
                  <p className="text-sm font-semibold">{uploading ? "Uploading…" : "Drop art or browse"}</p>
                  <p className="text-[11px] text-muted">PNG, JPG, WebP or SVG · max 10 MB</p>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(event) => handleUpload(event.target.files?.[0] || null)} />
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => fileRef.current?.click()} loading={uploading}>
                  <ImageIcon size={14} /> Choose file
                </Button>
                {uploads.length > 0 && (
                  <div>
                    <p className="label">This session</p>
                    <div className="grid grid-cols-3 gap-2">
                      {uploads.map((asset) => (
                        <button key={asset.id} onClick={() => addImage(asset.url, asset.width, asset.height, asset.original_name)} className="aspect-square overflow-hidden rounded-lg border border-ink/10 bg-white hover:border-clay">
                          <img src={mediaUrl(asset.url)} alt={asset.original_name} className="h-full w-full object-contain" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tool === "layers" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="label mb-0">Canvas layers</span>
                  <span className="text-[10px] text-muted">{layers.length} objects</span>
                </div>
                <div className="space-y-1">
                  {layers.map((object, index) => (
                    <div
                      key={`${object.type}-${index}`}
                      className={cn(
                        "flex w-full items-center gap-1 rounded-lg border px-2 py-1.5 text-left text-xs",
                        selected === object ? "border-clay bg-clay/5" : "border-ink/10 hover:border-ink/30"
                      )}
                    >
                      <button
                        onClick={() => {
                          const canvas = fabricRef.current;
                          canvas?.setActiveObject(object);
                          canvas?.requestRenderAll();
                          refreshLayers();
                        }}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 py-0.5 text-left"
                      >
                        <span className="truncate">
                          <span className="font-semibold capitalize">{object.type?.replace("-", " ")}</span>
                          {object.text ? ` · ${String(object.text).slice(0, 22)}` : object.name ? ` · ${object.name}` : ""}
                        </span>
                        <span className="text-[9px] uppercase text-muted">{index === 0 ? "top" : ""}</span>
                      </button>
                      <button
                        onClick={() => toggleLayerVisibility(object)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-ink/10"
                        aria-label={object.visible === false ? "Show layer" : "Hide layer"}
                        title={object.visible === false ? "Show layer" : "Hide layer"}
                      >
                        {object.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button
                        onClick={() => toggleLayerLock(object)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-ink/10"
                        aria-label={object.selectable === false ? "Unlock layer" : "Lock layer"}
                        title={object.selectable === false ? "Unlock layer" : "Lock layer"}
                      >
                        {object.selectable === false ? <Lock size={12} /> : <LockOpen size={12} />}
                      </button>
                    </div>
                  ))}
                  {layers.length === 0 && <p className="text-[11px] text-muted">Your canvas is empty. Add text or art to begin.</p>}
                </div>
                {selected && (
                  <div className="grid grid-cols-2 gap-1.5 border-t border-ink/10 pt-3">
                    <button onClick={bringToFront} className="rounded-lg border border-ink/10 py-2 text-[10px] font-semibold hover:border-ink">To front</button>
                    <button onClick={sendToBack} className="rounded-lg border border-ink/10 py-2 text-[10px] font-semibold hover:border-ink">To back</button>
                    <button onClick={() => moveLayer("up")} className="rounded-lg border border-ink/10 py-2 text-[10px] font-semibold hover:border-ink">Forward</button>
                    <button onClick={() => moveLayer("down")} className="rounded-lg border border-ink/10 py-2 text-[10px] font-semibold hover:border-ink">Backward</button>
                    <button onClick={duplicateSelected} className="col-span-2 rounded-lg border border-ink/10 py-2 text-[10px] font-semibold hover:border-ink">Duplicate</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-ink/10 p-4">
            <label className="label">Colour</label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((swatch) => (
                <button
                  key={swatch}
                  onClick={() => changeColor(swatch)}
                  className={cn("h-7 w-7 rounded-full border border-ink/20", color === swatch && "ring-2 ring-ink ring-offset-2 ring-offset-white")}
                  style={{ backgroundColor: swatch }}
                  title={swatch}
                />
              ))}
              <input type="color" value={color} onChange={(event) => changeColor(event.target.value)} className="h-7 w-7 cursor-pointer rounded-full border border-ink/20 bg-transparent p-0" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <Button variant="outline" size="sm" onClick={() => addShape("rect")} title="Rectangle"><Square size={14} /></Button>
              <Button variant="outline" size="sm" onClick={() => addShape("circle")} title="Circle"><Circle size={14} /></Button>
              <Button variant="outline" size="sm" onClick={() => addShape("triangle")} title="Triangle"><Triangle size={14} /></Button>
            </div>
            {selected && (
              <div className="mt-3">
                <label className="label">Opacity · {opacity}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opacity}
                  onChange={(event) => changeOpacity(Number(event.target.value))}
                  className="w-full accent-clay"
                  aria-label="Layer opacity"
                />
              </div>
            )}
            {selected && (
              <div className="mt-3 grid grid-cols-3 gap-1">
                <Button variant="outline" size="sm" onClick={makeBigger}><Maximize size={13} /> Bigger</Button>
                <Button variant="outline" size="sm" onClick={() => rotateSelected(15)}><RotateCcw size={13} /> Rotate</Button>
                <Button variant="danger" size="sm" onClick={deleteSelected}><Trash2 size={13} /> Delete</Button>
              </div>
            )}
            {isTextSelected && (
              <p className="mt-2 text-[10px] text-muted">Text selected — style controls are in the Text tab.</p>
            )}
            <div className="mt-4 space-y-2 border-t border-ink/10 pt-3 xl:hidden">
              <Button variant="outline" size="sm" className="w-full" onClick={() => save(false)} loading={saving} disabled={!ready}>
                <Save size={14} /> Save design
              </Button>
              <div className={cn("grid gap-1.5", isAdmin ? "grid-cols-3" : "grid-cols-1")}>
                {exportTypes.map((fileType) => (
                  <Button
                    key={fileType}
                    variant="outline"
                    size="sm"
                    className="px-2"
                    onClick={() => handleDownload(fileType)}
                    disabled={downloading || !ready}
                    aria-label={`Export ${fileType.toUpperCase()}`}
                  >
                    {fileType.toUpperCase()}
                  </Button>
                ))}
              </div>
              {!isAdmin && (
                <p className="text-[10px] text-muted">PNG proof available now. Production SVG/PDF files are prepared with your order.</p>
              )}
            </div>
          </div>
        </aside>

        {/* Main Canvas Workspace */}
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-sand">
          <div className="flex items-center justify-between gap-2 px-4 py-2 bg-sand border-b border-ink/10">
            <div className="flex flex-wrap gap-1.5">
              {product.stages.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => loadStage(stage.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[11px] font-semibold capitalize",
                    activeStageId === stage.id ? "bg-ink text-cream" : "bg-sand text-ink hover:bg-sand/70"
                  )}
                >
                  {stage.name}
                </button>
              ))}
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted">
              <RotateCcw size={11} /> {activePrintArea ? `${Number(activePrintArea.width_mm)} × ${Number(activePrintArea.height_mm)} mm` : "print area"}
            </span>
          </div>

          <div
            ref={workspaceRef}
            className={cn(
              "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-sand",
              panMode ? "cursor-grab" : "",
              panning ? "cursor-grabbing" : ""
            )}
            onPointerDownCapture={startPan}
            onPointerMoveCapture={movePan}
            onPointerUpCapture={endPan}
            onPointerCancelCapture={endPan}
          >
            <div className="pointer-events-none absolute inset-0 h-full w-full bg-[repeating-conic-gradient(#efe7d9_0_25%,#f7f1e7_0_50%)] bg-[length:24px_24px]" />

            {selected && !showMockupPreview && !panMode && (
              <div
                data-editor-controls
                className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-ink/15 bg-white/95 p-1 shadow-lg"
              >
                <button
                  onClick={() => alignSelected("left")}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5"
                  aria-label="Align left"
                  title="Align left"
                >
                  <AlignStartVertical size={14} />
                </button>
                <button
                  onClick={() => alignSelected("center")}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5"
                  aria-label="Center horizontally"
                  title="Center horizontally"
                >
                  <AlignCenterVertical size={14} />
                </button>
                <button
                  onClick={() => alignSelected("right")}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5"
                  aria-label="Align right"
                  title="Align right"
                >
                  <AlignEndVertical size={14} />
                </button>
                <button
                  onClick={() => alignSelected("top")}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5"
                  aria-label="Align top"
                  title="Align top"
                >
                  <AlignStartHorizontal size={14} />
                </button>
                <button
                  onClick={() => alignSelected("middle")}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5"
                  aria-label="Center vertically"
                  title="Center vertically"
                >
                  <AlignCenterHorizontal size={14} />
                </button>
                <button
                  onClick={() => alignSelected("bottom")}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5"
                  aria-label="Align bottom"
                  title="Align bottom"
                >
                  <AlignEndHorizontal size={14} />
                </button>
                <div className="mx-0.5 h-5 w-px bg-ink/10" />
                <button
                  onClick={duplicateSelected}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5"
                  aria-label="Duplicate selection"
                  title="Duplicate"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={deleteSelected}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-rose-600 hover:bg-rose-50"
                  aria-label="Delete selection"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
              <div
                className="relative shrink-0 will-change-transform"
                style={{
                  width: displayMockupWidth || "80%",
                  height: displayMockupHeight || undefined,
                  aspectRatio: displayMockupWidth ? undefined : mockupRatio,
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              >
                {mockupUrl ? (
                  <img
                    src={mediaUrl(mockupUrl)}
                    alt={`${product.name} ${activeStageObj?.name || ""} mockup`.trim()}
                    data-testid="stage-mockup"
                    className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain drop-shadow-xl"
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl border border-dashed border-ink/20 bg-white/45 text-xs text-muted">
                    No mockup image for this stage
                  </div>
                )}

                <div className="absolute z-10" style={stageBox}>
                  <div className={cn("editor-canvas h-full w-full", (showMockupPreview || panMode) && "pointer-events-none")}>
                    <canvas ref={canvasElRef} />
                  </div>
                  {!showMockupPreview && (
                    <div
                      data-testid="print-boundary"
                      className="pointer-events-none absolute inset-0 z-20 border border-dashed border-clay/70"
                    />
                  )}
                </div>
              </div>
            </div>

            {showMockupPreview && (
              <div className="pointer-events-none absolute left-4 top-4 z-30 rounded-full bg-ink/85 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cream">
                Mockup preview
              </div>
            )}

            {usingProductFallback && !showMockupPreview && (
              <div
                className="pointer-events-auto absolute right-3 top-3 z-30 cursor-help rounded-full border border-ink/10 bg-white/90 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-muted shadow-sm"
                title="This stage has no dedicated mockup, so the product photo is shown as a preview."
              >
                Product preview
              </div>
            )}

            <div data-editor-controls className="absolute bottom-3 right-3 z-30 flex items-center gap-1 rounded-full border border-ink/15 bg-white/95 p-1 shadow-lg sm:bottom-4 sm:right-4">
              <button
                onClick={() => zoomBy(-0.15)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5"
                aria-label="Zoom out"
                title="Zoom out"
              >
                <ZoomOut size={15} />
              </button>
              <button
                onClick={resetView}
                className="min-w-12 rounded-full px-1 font-mono text-[10px] font-semibold text-muted hover:bg-ink/5"
                aria-label="Reset zoom and pan"
                title="Reset view"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => zoomBy(0.15)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink/5"
                aria-label="Zoom in"
                title="Zoom in"
              >
                <ZoomIn size={15} />
              </button>
              <div className="h-5 w-px bg-ink/10" />
              <button
                onClick={() => setPanMode((value) => !value)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  panMode ? "bg-ink text-cream" : "hover:bg-ink/5"
                )}
                aria-label="Pan mode"
                aria-pressed={panMode}
                title="Pan mode"
              >
                <Move size={15} />
              </button>
            </div>

            {!ready && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-cream/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2 text-xs text-muted">
                  <Loader2 className="animate-spin text-clay" /> Warming up the studio…
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[11px] text-muted">
            <span>Drag to move · Alt-drag to pan · ⌘/Ctrl+Z undo · Del remove · ⌘/Ctrl+scroll to zoom</span>
            <span className="hidden sm:inline">
              {activePrintArea ? `${activePrintArea.export_width_px} × ${activePrintArea.export_height_px}px @ ${activePrintArea.export_dpi} DPI` : ""}
            </span>
          </div>

          <div className="mx-3 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-olive-soft px-3 py-2 text-[11px] text-olive sm:mx-4">
            <span className="hidden items-center gap-2 sm:flex">
              Every stage exports as a production-ready file.
            </span>
            <span className="font-semibold">{saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}</span>
          </div>
        </section>

        {/* Right Configuration Panel (Desktop) */}
        <aside className="hidden h-full w-80 shrink-0 flex-col border-l border-ink/10 bg-white xl:flex">
          <div className="p-5 flex-1 overflow-y-auto">
            <p className="eyebrow">Your configuration</p>
            <h2 className="mt-1 font-display text-2xl">{product.name}</h2>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="label">Colour / size</span>
                <select
                  value={variantId}
                  onChange={(event) => setVariantId(event.target.value)}
                  className="field"
                  disabled={!product.variants.some((variant) => variant.is_active)}
                  aria-label="Colour and size"
                >
                  {product.variants.filter((variant) => variant.is_active).map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {[variant.color_name, variant.size].filter(Boolean).join(" / ") || variant.name}
                      {Number(variant.price_delta) > 0 ? ` (+${money(variant.price_delta)})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {methods.length > 0 ? (
                <label className="block">
                  <span className="label">Print method</span>
                  <select
                    value={methodId}
                    onChange={(event) => setMethodId(event.target.value)}
                    className="field"
                    aria-label="Print method"
                  >
                    {methods.map((link) => (
                      <option key={link.id} value={link.printing_method.id}>
                        {link.printing_method.name}
                        {Number(link.printing_method.base_fee) > 0 ? ` (+${money(link.printing_method.base_fee)})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  No printing methods are configured for this product.
                </p>
              )}

              <div>
                <span className="label">Quantity</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 hover:border-ink"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={quantity}
                    onChange={(event) => setQuantity(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))}
                    className="field text-center"
                  />
                  <button
                    onClick={() => setQuantity((value) => Math.min(1000, value + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 hover:border-ink"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-ink/10 pt-4">
              {quote ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted"><span>Unit price</span><span>{money(quote.unit_price)}</span></div>
                  <div className="flex justify-between text-muted"><span>Subtotal</span><span>{money(quote.subtotal)}</span></div>
                  {Number(quote.discount) > 0 && (
                    <div className="flex justify-between text-olive"><span>Quantity discount</span><span>−{money(quote.discount)}</span></div>
                  )}
                  <div className="mt-2 flex items-baseline justify-between border-t border-ink/10 pt-2">
                    <span className="font-semibold">Design total</span>
                    <span className="font-display text-2xl">{money(quote.total)}</span>
                  </div>
                  <p className="text-[10px] text-muted">Shipping and tax calculated at checkout.</p>
                </div>
              ) : (
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted">Estimated</span>
                  <span className="font-display text-2xl">{money(displayTotal)}</span>
                </div>
              )}
            </div>

            <Button className="mt-4 w-full" size="lg" onClick={handleAddToCart} loading={adding} disabled={!ready}>
              <ShoppingBag size={16} /> Add to cart <ArrowRight size={15} />
            </Button>
            <p className="mt-2 text-center text-[10px] text-muted">
              {user ? "Your design is saved with this order." : "Sign in to save and order your design."}
            </p>

            <div className="mt-4 rounded-xl border border-ink/10 p-3">
              <div className="flex items-center justify-between">
                <span className="label mb-0">Production files</span>
                <span className="text-[10px] text-muted">{isAdmin ? "300 DPI" : "150 DPI proof"}</span>
              </div>
              <div className={cn("mt-2 grid gap-1.5", isAdmin ? "grid-cols-3" : "grid-cols-1")}>
                {exportTypes.map((fileType) => (
                  <Button
                    key={fileType}
                    variant="outline"
                    size="sm"
                    className="px-2"
                    onClick={() => handleDownload(fileType)}
                    disabled={downloading || !ready}
                    aria-label={`Export ${fileType.toUpperCase()}`}
                  >
                    {fileType.toUpperCase()}
                  </Button>
                ))}
              </div>
              {!isAdmin && (
                <p className="mt-2 text-[10px] text-muted">PNG proof available now. Production SVG/PDF files are prepared with your order.</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => save(false)}
                loading={saving}
                disabled={!ready}
              >
                <Save size={14} /> Save design
              </Button>
            </div>

            <div className="mt-4 rounded-2xl bg-sand/70 p-4 text-xs leading-relaxed text-muted">
              <p className="font-semibold text-ink">Designer tips</p>
              <ul className="mt-2 space-y-1">
                <li>• Keep text inside the dashed print boundary.</li>
                <li>• Use high-contrast colours on dark garments.</li>
                <li>• Upload transparent PNGs for the cleanest prints.</li>
                <li>• Each stage keeps its own artwork.</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      {contextMenu && (
        <div
          className="fixed z-[120] w-52 overflow-hidden rounded-xl border border-ink/10 bg-white py-1 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            onClick={() => {
              duplicateSelected();
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-ink/5"
          >
            <Copy size={13} /> Duplicate
          </button>
          <button
            onClick={() => {
              bringToFront();
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-ink/5"
          >
            <ArrowUpToLine size={13} /> Bring to front
          </button>
          <button
            onClick={() => {
              sendToBack();
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-ink/5"
          >
            <ArrowDownToLine size={13} /> Send to back
          </button>
          <div className="my-1 h-px bg-ink/10" />
          <button
            onClick={() => {
              alignSelected("center");
              alignSelected("middle");
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-ink/5"
          >
            <AlignCenter size={13} /> Center on print area
          </button>
          <div className="my-1 h-px bg-ink/10" />
          <button
            onClick={() => {
              deleteSelected();
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}

      {/* Bottom Toolbar (Mobile) */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-t border-ink/10 bg-cream px-2 xl:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1">
          {TOOL_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => selectTool(item.id)}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                tool === item.id ? "bg-ink text-cream" : "bg-white text-muted hover:bg-ink/5"
              )}
              aria-label={item.label}
              title={item.label}
            >
              <item.icon size={16} />
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={undo}
            className={cn("flex h-9 w-9 items-center justify-center rounded-full", !canUndo ? "bg-white text-muted" : "bg-ink text-cream")}
            disabled={!canUndo}
            aria-label="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            className={cn("flex h-9 w-9 items-center justify-center rounded-full", !canRedo ? "bg-white text-muted" : "bg-ink text-cream")}
            disabled={!canRedo}
            aria-label="Redo"
          >
            <Redo2 size={16} />
          </button>
          <button
            onClick={() => setShowMockupPreview((prev) => !prev)}
            className={cn("flex h-9 w-9 items-center justify-center rounded-full", showMockupPreview ? "bg-ink text-cream" : "bg-white text-muted hover:bg-ink/5")}
            aria-label={showMockupPreview ? "Exit mockup preview" : "Mockup preview"}
          >
            {showMockupPreview ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <button
            onClick={handleAddToCart}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-cream"
            disabled={adding || !ready}
            aria-label="Add to cart"
          >
            <ShoppingBag size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
