"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Grid,
  Image as ImageIcon,
  Layers,
  Layout,
  Loader2,
  Maximize,
  Minimize,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Shapes,
  ShoppingBag,
  Sparkles,
  Square,
  Trash2,
  Triangle,
  Type,
  Undo2,
  UploadCloud,
  X,
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

function blankCanvas(area: any) {
  return {
    version: "5.3.0",
    width: area?.width_px || 1000,
    height: area?.height_px || 1000,
    objects: [],
  };
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

export function DesignEditor({ product, initialDesign, initialTemplate, initialVariantId, initialMethodId }: EditorProps) {
  const router = useRouter();
  const { user, cartCount } = useAuth();
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
  const [error, setError] = useState("");
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

  const activeStage = useMemo(
    () => product.stages.find((stage) => stage.id === activeStageId) || product.stages[0],
    [product.stages, activeStageId]
  );
  const activeArea = activeStage?.print_area;
  const mockupUrl = activeStage?.mockup_url || "";

  useEffect(() => {
    nameRef.current = name;
  }, [name]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

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
      if (!canvas || !stage?.print_area || !template.canvas_json) return;
      const json = scaleCanvasJson(template.canvas_json, stage.print_area);
      loadingRef.current = true;
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
      });
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
    if (!user) {
      setQuote(null);
      return;
    }
    const payload: any = {
      product: product.id,
      variant: variantId || undefined,
      printing_method: methodId || undefined,
      quantity,
    };
    if (designIdRef.current) payload.design = designIdRef.current;
    api
      .post<Quote>("/pricing/", payload)
      .then(setQuote)
      .catch(() => setQuote(null));
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
    if (!fabric || !canvas || !activeArea) return;
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
      textAlign: "center",
    });
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.renderAll();
    setNewText("");
    refreshLayers();
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
  };

  const addImage = (url: string, naturalWidth = 800, naturalHeight = 800, name?: string) => {
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
        if (name) image.set({ name });
        canvas.add(image);
        canvas.setActiveObject(image);
        canvas.renderAll();
        refreshLayers();
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
      if (file.url) window.open(mediaUrl(file.url), "_blank");
      setNotice(`Print-ready ${fileType.toUpperCase()} generated.`);
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

  const clipartCategories = useMemo(
    () => ["All", ...Array.from(new Set(cliparts.map((item) => item.category)))],
    [cliparts]
  );
  const visibleCliparts = cliparts.filter((item) => clipartFilter === "All" || item.category === clipartFilter);
  const relevantTemplates = templates.filter((item) => !item.product_slug || item.product_slug === product.slug);
  const templateList = relevantTemplates.length ? relevantTemplates : templates;

  const selectedVariant = product.variants.find((variant) => variant.id === variantId);
  const methods = product.printing_methods;
  const displayTotal = quote?.total || (Number(product.base_price) + Number(selectedVariant?.price_delta || 0)) * quantity;

  // Canvas container sizing - fit within available viewport
  const canvasContainerStyle = {
    position: "relative" as const,
    width: "100%",
    height: "100%",
    maxWidth: "100vw",
    maxHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden" as const,
  };

  return (
    <div className="fixed inset-0 z-0 bg-cream text-ink selection:bg-d95d39 selection:text-fbf7ef">
      {/* Top Toolbar */}
      <div className="fixed top-0 left-0 right-0 h-14 z-50 bg-cream/95 backdrop-blur-sm border-b border-ink/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href={`/products/${product.slug}`} className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink/15 hover:bg-ink/5" aria-label="Back to product">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex flex-col items-start gap-0.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-clay">Studio · {product.name}</p>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setDirty(true);
              }}
              className="w-full max-w-xs border-none bg-transparent font-display text-xl font-bold outline-none focus:ring-0"
              aria-label="Design name"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTool("products")} title="Product">
            <Layout size={16} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTool("templates")} title="Templates">
            <Shapes size={16} />
          </Button>
          <Button
            variant={showMockupPreview ? "clay" : "outline"}
            size="sm"
            onClick={() => setShowMockupPreview((prev) => !prev)}
            title="Mockup Preview"
          >
            <Maximize size={16} />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-clay">{activeStageObj?.name || "Front"}</span>
            <button
              onClick={() => {
                const stages = product.stages;
                const currentIndex = stages.findIndex((s) => s.id === activeStageId);
                const nextIndex = (currentIndex + 1) % stages.length;
                loadStage(stages[nextIndex].id);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 hover:bg-ink/5"
              title="Next view"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="h-6 w-px border-ink/20" />

          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-clay">Ready to print</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          </div>

          <div className="h-6 w-px border-ink/20" />

          <button
            onClick={() => router.push("/cart")}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink/15 bg-white hover:bg-ink/10"
            aria-label="View cart"
          >
            <ShoppingBag size={16} />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-clay text-cream text-[10px] font-bold">
              {cartCount > 0 ? cartCount : ""}
            </span>
          </button>

          <span className="text-sm font-mono font-bold text-clay">${money(displayTotal)}</span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setQuantity((v) => Math.max(1, v - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 hover:bg-ink/5"
            >
              <Minus size={13} />
            </button>
            <input
              type="number"
              min={1}
              max={1000}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))}
              className="w-10 h-8 border border-ink/15 rounded-lg text-center text-xs outline-none focus:ring-2 focus:ring-clay/20"
            />
            <button
              onClick={() => setQuantity((v) => Math.min(1000, v + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 hover:bg-ink/5"
            >
              <Plus size={13} />
            </button>
          </div>

          <Button size="sm" onClick={handleAddToCart} loading={adding}>
            <ShoppingBag size={16} /> Add to cart
          </Button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex h-[calc(100dvh-3.5rem)]">
        {/* Left Tool Panel */}
        <aside className="hidden lg:flex h-full w-64 border-r border-ink/10 bg-white flex flex-col z-40">
          <div className="grid grid-cols-5 border-b border-ink/10">
            {TOOL_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setTool(item.id);
                  setPanelOpen(true);
                }}
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
                  <div className="grid grid-cols-2 gap-3">
                    <select value={variantId} onChange={(event) => setVariantId(event.target.value)} className="field">
                      {product.variants.filter((variant) => variant.is_active).map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {[variant.color_name, variant.size].filter(Boolean).join(" / ") || variant.name}
                          {Number(variant.price_delta) > 0 ? ` (+${money(variant.price_delta)})` : ""}
                        </option>
                      ))}
                    </select>
                    <select value={methodId} onChange={(event) => setMethodId(event.target.value)} className="field">
                      {methods.map((link) => (
                        <option key={link.id} value={link.printing_method.id}>
                          {link.printing_method.name}
                          {Number(link.printing_method.base_fee) > 0 ? ` (+${money(link.printing_method.base_fee)})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
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
                  <Button className="mt-2 w-full" size="sm" onClick={addText}>Add to canvas</Button>
                </div>
                <div>
                  <label className="label">Typeface</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {(fonts.length
                      ? fonts
                      : ([
                          { id: "inter", name: "Inter", family: "Inter" },
                          { id: "lora", name: "Lora", family: "Lora" },
                          { id: "mono", name: "Space Mono", family: "Space Mono" },
                        ] as FontResource[])
                    ).map((font) => (
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
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => toggleStyle("fontWeight")}
                    className={cn("rounded-lg border py-2 text-sm font-bold", bold ? "border-ink bg-ink text-cream" : "border-ink/10")}
                  >
                    B
                  </button>
                  <button
                    onClick={() => toggleStyle("fontStyle")}
                    className={cn("rounded-lg border py-2 text-sm italic", italic ? "border-ink bg-ink text-cream" : "border-ink/10")}
                  >
                    I
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

            {tool === "clipart" && (
              <div className="space-y-3">
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
                      onClick={() => addImage(item.image_url, 600, 600, item.name)}
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
                    <button
                      key={`${object.type}-${index}`}
                      onClick={() => {
                        const canvas = fabricRef.current;
                        canvas?.setActiveObject(object);
                        canvas?.requestRenderAll();
                        refreshLayers();
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs",
                        selected === object ? "border-clay bg-clay/5" : "border-ink/10 hover:border-ink/30"
                      )}
                    >
                      <span className="truncate">
                        <span className="font-semibold capitalize">{object.type?.replace("-", " ")}</span>
                        {object.text ? ` · ${String(object.text).slice(0, 22)}` : object.name ? ` · ${object.name}` : ""}
                      </span>
                      <span className="text-[9px] uppercase text-muted">{index === 0 ? "top" : ""}</span>
                    </button>
                  ))}
                  {layers.length === 0 && <p className="text-[11px] text-muted">Your canvas is empty. Add text or art to begin.</p>}
                </div>
                {selected && (
                  <div className="grid grid-cols-3 gap-1.5 border-t border-ink/10 pt-3">
                    <button onClick={() => moveLayer("up")} className="rounded-lg border border-ink/10 py-2 text-[10px] font-semibold hover:border-ink">Forward</button>
                    <button onClick={() => moveLayer("down")} className="rounded-lg border border-ink/10 py-2 text-[10px] font-semibold hover:border-ink">Backward</button>
                    <button onClick={duplicateSelected} className="rounded-lg border border-ink/10 py-2 text-[10px] font-semibold hover:border-ink">Duplicate</button>
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
              <div className="mt-3 flex gap-1.5">
                <Button variant="danger" size="sm" className="flex-1" onClick={deleteSelected}><Trash2 size={14} /> Delete</Button>
              </div>
            )}
            {isTextSelected && (
              <p className="mt-2 text-[10px] text-muted">Text selected — style controls are in the Text tab.</p>
            )}
          </div>
        </aside>

        {/* Main Canvas Workspace */}
        <section className="absolute top-[56px] left-0 right-0 bottom-0 bg-sand flex flex-col pb-0">
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

          <div className="flex-1 relative bg-sand flex items-center justify-center overflow-hidden">
            <div
              className="absolute inset-0 h-full w-full bg-[repeating-conic-gradient(#efe7d9_0_25%,#f7f1e7_0_50%)] bg-[length:24px_24px]"
            />
            <div
              className="absolute z-10"
              style={stageBox}
            >
              <div className="editor-canvas h-full w-full">
                <canvas ref={canvasElRef} />
              </div>
              <div className="absolute inset-0 z-20 border border-dashed border-clay/50 pointer-events-none" style={stageBox} />
            </div>
            {!ready && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-cream/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2 text-xs text-muted">
                  <Loader2 className="animate-spin text-clay" /> Warming up the studio…
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted px-4">
            <span>Drag to move · corners to scale · double-click text to edit</span>
            <span>{activePrintArea ? `${activePrintArea.export_width_px} × ${activePrintArea.export_height_px}px @ ${activePrintArea.export_dpi} DPI` : ""}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-olive-soft px-4 py-3 text-xs text-olive">
            <span className="flex items-center gap-2"><Sparkles size={14} /> Every stage exports as a production-ready file.</span>
            <span className="font-semibold">{dirty ? "Remember to save" : "All changes saved"}</span>
          </div>
        </section>

        {/* Right Configuration Panel (Desktop) */}
        <aside className="hidden lg:flex h-full w-80 border-l border-ink/10 bg-white flex flex-col z-40">
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
                >
                  {product.variants.filter((variant) => variant.is_active).map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {[variant.color_name, variant.size].filter(Boolean).join(" / ") || variant.name}
                      {Number(variant.price_delta) > 0 ? ` (+${money(variant.price_delta)})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {methods.length > 0 && (
                <label className="block">
                  <span className="label">Print method</span>
                  <select value={methodId} onChange={(event) => setMethodId(event.target.value)} className="field">
                    {methods.map((link) => (
                      <option key={link.id} value={link.printing_method.id}>
                        {link.printing_method.name}
                        {Number(link.printing_method.base_fee) > 0 ? ` (+${money(link.printing_method.base_fee)})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
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

            <Button className="mt-4 w-full" size="lg" onClick={handleAddToCart} loading={adding}>
              <ShoppingBag size={16} /> Add to cart <ArrowRight size={15} />
            </Button>
            <p className="mt-2 text-center text-[10px] text-muted">
              {user ? "Your design is saved with this order." : "Sign in to save and order your design."}
            </p>

            <div className="rounded-2xl bg-sand/70 p-4 text-xs leading-relaxed text-muted">
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

      {/* Bottom Toolbar (Mobile) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-14 z-50 bg-cream border-t border-ink/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setTool("products")} className={cn("flex h-10 w-10 items-center justify-center rounded-full", tool === "products" ? "bg-ink text-cream" : "bg-white text-muted hover:bg-ink/5")}>
            <Layout size={16} />
          </button>
          <button onClick={() => setTool("templates")} className={cn("flex h-10 w-10 items-center justify-center rounded-full", tool === "templates" ? "bg-ink text-cream" : "bg-white text-muted hover:bg-ink/5")}>
            <Shapes size={16} />
          </button>
          <button onClick={() => setTool("text")} className={cn("flex h-10 w-10 items-center justify-center rounded-full", tool === "text" ? "bg-ink text-cream" : "bg-white text-muted hover:bg-ink/5")}>
            <Type size={16} />
          </button>
          <button onClick={() => setTool("elements")} className={cn("flex h-10 w-10 items-center justify-center rounded-full", tool === "elements" ? "bg-ink text-cream" : "bg-white text-muted hover:bg-ink/5")}>
            <Grid size={16} />
          </button>
          <button onClick={() => setTool("images")} className={cn("flex h-10 w-10 items-center justify-center rounded-full", tool === "images" ? "bg-ink text-cream" : "bg-white text-muted hover:bg-ink/5")}>
            <ImageIcon size={16} />
          </button>
          <button onClick={() => setTool("upload")} className={cn("flex h-10 w-10 items-center justify-center rounded-full", tool === "upload" ? "bg-ink text-cream" : "bg-white text-muted hover:bg-ink/5")}>
            <UploadCloud size={16} />
          </button>
          <button onClick={() => setTool("layers")} className={cn("flex h-10 w-10 items-center justify-center rounded-full", tool === "layers" ? "bg-ink text-cream" : "bg-white text-muted hover:bg-ink/5")}>
            <Layers size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={undo} className={cn("flex h-10 w-10 items-center justify-center rounded-full", !canUndo ? "bg-white text-muted" : "bg-ink text-cream")} disabled={!canUndo}>
            <Undo2 size={16} />
          </button>
          <button onClick={redo} className={cn("flex h-10 w-10 items-center justify-center rounded-full", !canRedo ? "bg-white text-muted" : "bg-ink text-cream")} disabled={!canRedo}>
            <Redo2 size={16} />
          </button>
          <button onClick={() => setShowMockupPreview((prev) => !prev)} className={cn("flex h-10 w-10 items-center justify-center rounded-full", showMockupPreview ? "bg-ink text-cream" : "bg-white text-muted hover:bg-ink/5")}>
            <Maximize size={16} />
          </button>
          <button onClick={handleAddToCart} className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-cream" disabled={adding}>
            <ShoppingBag size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
