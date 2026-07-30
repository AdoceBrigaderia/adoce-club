import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  RotateCw,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import {
  EDITED_IMAGE_MAX_BYTES,
  validateProductImage,
  type EditedProductImage,
} from "./admin-media";
import { formatImageBytes, imageAspectRatioLabel, imageDimensionsLabel } from "./image-editor-metadata";
import "./image-editor.css";

export type ImageEditorPreset = {
  label: string;
  description: string;
  aspectWidth: number;
  aspectHeight: number;
  outputWidth?: number;
};

export const PRODUCT_IMAGE_PRESET: ImageEditorPreset = {
  label: "Foto de produto",
  description: "Corte 4:3 recomendado para produtos",
  aspectWidth: 4,
  aspectHeight: 3,
  outputWidth: 1200,
};

export const CATEGORY_IMAGE_PRESET: ImageEditorPreset = {
  label: "Capa de categoria",
  description: "Corte 4:3 recomendado para capas",
  aspectWidth: 4,
  aspectHeight: 3,
  outputWidth: 1400,
};

type FitMode = "cover" | "contain";
type Point = { x: number; y: number };

type ImageEditorProps = {
  file: File;
  title: string;
  preset: ImageEditorPreset;
  onCancel: () => void;
  onApply: (image: EditedProductImage) => void | Promise<void>;
};

const AUTO_ADJUSTMENTS = { brightness: 104, contrast: 108, saturation: 106 };
const ORIGINAL_ADJUSTMENTS = { brightness: 100, contrast: 100, saturation: 100 };

function optimizedWebp(canvas: HTMLCanvasElement) {
  const qualities = [0.9, 0.86, 0.8, 0.74, 0.68];
  const maxBytes = 500 * 1024;
  return new Promise<Blob>((resolve, reject) => {
    const attempt = (index: number) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Não foi possível preparar a imagem."));
          if (blob.size <= maxBytes || index === qualities.length - 1) return resolve(blob);
          attempt(index + 1);
        },
        "image/webp",
        qualities[index],
      );
    };
    attempt(0);
  });
}

export default function ImageEditor({ file, title, preset, onCancel, onApply }: ImageEditorProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const lastGesture = useRef<{ center: Point; distance: number } | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [fitMode, setFitMode] = useState<FitMode>("cover");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [comparing, setComparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(validateProductImage(file));

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    const nextImage = new Image();
    nextImage.onload = () => setImage(nextImage);
    nextImage.onerror = () => setError("Não foi possível abrir esta imagem.");
    nextImage.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    const update = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rotatedSize = useMemo(() => {
    if (!image) return { width: 1, height: 1 };
    return rotation % 180
      ? { width: image.naturalHeight, height: image.naturalWidth }
      : { width: image.naturalWidth, height: image.naturalHeight };
  }, [image, rotation]);

  const baseScale = useMemo(() => {
    const widthScale = viewport.width / rotatedSize.width;
    const heightScale = viewport.height / rotatedSize.height;
    return fitMode === "cover"
      ? Math.max(widthScale, heightScale)
      : Math.min(widthScale, heightScale);
  }, [fitMode, rotatedSize, viewport]);

  const scale = baseScale * zoom;
  const minZoom = fitMode === "cover" ? 1 : 0.75;
  const filter = comparing
    ? "none"
    : `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;

  const clampOffset = (point: Point, nextZoom = zoom) => {
    const nextScale = baseScale * nextZoom;
    const maxX = Math.max(0, (rotatedSize.width * nextScale - viewport.width) / 2);
    const maxY = Math.max(0, (rotatedSize.height * nextScale - viewport.height) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, point.x)),
      y: Math.max(-maxY, Math.min(maxY, point.y)),
    };
  };

  const changeZoom = (value: number) => {
    const next = Math.max(minZoom, Math.min(3, value));
    setZoom(next);
    setOffset((current) => clampOffset(current, next));
  };

  const resetPosition = (mode = fitMode) => {
    setFitMode(mode);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const pointerCenter = () => {
    const values = [...pointers.current.values()];
    return values.reduce((result, point) => ({ x: result.x + point.x / values.length, y: result.y + point.y / values.length }), { x: 0, y: 0 });
  };

  const pointerDistance = () => {
    const values = [...pointers.current.values()];
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    lastGesture.current = { center: pointerCenter(), distance: pointerDistance() };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !lastGesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const center = pointerCenter();
    const distance = pointerDistance();
    const previous = lastGesture.current;
    if (pointers.current.size >= 2 && previous.distance > 0) {
      changeZoom(zoom * (distance / previous.distance));
    }
    const movement = { x: center.x - previous.center.x, y: center.y - previous.center.y };
    setOffset((current) => clampOffset({ x: current.x + movement.x, y: current.y + movement.y }));
    lastGesture.current = { center, distance };
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    lastGesture.current = pointers.current.size
      ? { center: pointerCenter(), distance: pointerDistance() }
      : null;
  };

  const improveAutomatically = () => {
    setBrightness(AUTO_ADJUSTMENTS.brightness);
    setContrast(AUTO_ADJUSTMENTS.contrast);
    setSaturation(AUTO_ADJUSTMENTS.saturation);
  };

  const restore = () => {
    setBrightness(ORIGINAL_ADJUSTMENTS.brightness);
    setContrast(ORIGINAL_ADJUSTMENTS.contrast);
    setSaturation(ORIGINAL_ADJUSTMENTS.saturation);
    setRotation(0);
    resetPosition("cover");
  };

  const apply = async () => {
    if (!image || error) return;
    setBusy(true);
    setError("");
    try {
      const outputWidth = preset.outputWidth || 1200;
      const outputHeight = Math.round(outputWidth * preset.aspectHeight / preset.aspectWidth);
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar a imagem.");
      context.fillStyle = "#f2e4d9";
      context.fillRect(0, 0, outputWidth, outputHeight);
      const targetBaseScale = fitMode === "cover"
        ? Math.max(outputWidth / rotatedSize.width, outputHeight / rotatedSize.height)
        : Math.min(outputWidth / rotatedSize.width, outputHeight / rotatedSize.height);
      const targetScale = targetBaseScale * zoom;
      const offsetScaleX = outputWidth / viewport.width;
      const offsetScaleY = outputHeight / viewport.height;
      context.save();
      context.translate(
        outputWidth / 2 + offset.x * offsetScaleX,
        outputHeight / 2 + offset.y * offsetScaleY,
      );
      context.rotate(rotation * Math.PI / 180);
      context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      context.drawImage(
        image,
        -image.naturalWidth * targetScale / 2,
        -image.naturalHeight * targetScale / 2,
        image.naturalWidth * targetScale,
        image.naturalHeight * targetScale,
      );
      context.restore();
      const blob = await optimizedWebp(canvas);
      await onApply({ blob, sourceFile: file, width: outputWidth, height: outputHeight });
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Não foi possível aplicar a edição.");
      setBusy(false);
    }
  };

  const outputWidth = preset.outputWidth || 1200;
  const outputHeight = Math.round(outputWidth * preset.aspectHeight / preset.aspectWidth);
  const hasLowResolution = Boolean(
    image && (rotatedSize.width < outputWidth || rotatedSize.height < outputHeight),
  );
  const validationStatus = error
    ? { kind: "error", title: "Publicação bloqueada", detail: error }
    : hasLowResolution
      ? {
        kind: "warning",
        title: "A imagem será ampliada",
        detail: "A foto original é menor que a saída recomendada e pode perder nitidez.",
      }
      : {
        kind: "good",
        title: "Imagem pronta para publicação",
        detail: "Formato de origem aceito e resolução suficiente para o corte escolhido.",
      };

  return createPortal(
    <div className="image-editor-backdrop" role="dialog" aria-modal="true" aria-label={`Editar ${title}`}>
      <section className="image-editor-shell">
        <header>
          <div><ImageIcon /><span><strong>Editar foto</strong><small>{title}</small></span></div>
          <button type="button" onClick={onCancel} aria-label="Fechar editor"><X /></button>
        </header>
        <div className="image-editor-workspace">
          <div className="image-editor-stage-column">
            <div
              ref={previewRef}
              className="image-editor-stage"
              style={{ aspectRatio: `${preset.aspectWidth} / ${preset.aspectHeight}` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
            >
              {sourceUrl ? (
                <img
                  src={sourceUrl}
                  alt="Prévia da edição"
                  draggable={false}
                  style={{
                    width: image?.naturalWidth || "auto",
                    height: image?.naturalHeight || "auto",
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${rotation}deg) scale(${scale})`,
                    filter,
                  }}
                />
              ) : null}
              <span className="image-editor-grid" aria-hidden="true" />
              <small>Arraste para enquadrar · use dois dedos para ajustar</small>
            </div>
            <div className={`image-editor-quality ${validationStatus.kind}`}>
              <strong>{validationStatus.title}</strong>
              <span>{validationStatus.detail}</span>
            </div>
            <dl className="image-editor-metadata" aria-label="Detalhes técnicos da imagem">
              <div>
                <dt>Imagem original</dt>
                <dd>{imageDimensionsLabel(image?.naturalWidth || 0, image?.naturalHeight || 0)}</dd>
                <small>Proporção {imageAspectRatioLabel(image?.naturalWidth || 0, image?.naturalHeight || 0)} · {formatImageBytes(file.size)}</small>
              </div>
              <div>
                <dt>Arquivo para o site</dt>
                <dd>{imageDimensionsLabel(outputWidth, outputHeight)}</dd>
                <small>Proporção {imageAspectRatioLabel(outputWidth, outputHeight)} · WebP de até {formatImageBytes(EDITED_IMAGE_MAX_BYTES)}</small>
              </div>
              <div className={`image-editor-metadata-status ${validationStatus.kind}`}>
                <dt>Verificação</dt>
                <dd>{validationStatus.title}</dd>
                <small>{validationStatus.detail}</small>
              </div>
            </dl>
          </div>
          <aside className="image-editor-controls">
            <fieldset>
              <legend>Como ocupar o espaço</legend>
              <div className="image-editor-segmented">
                <button type="button" className={fitMode === "cover" ? "active" : ""} onClick={() => resetPosition("cover")}><Maximize2 /> Preencher</button>
                <button type="button" className={fitMode === "contain" ? "active" : ""} onClick={() => resetPosition("contain")}><Minimize2 /> Foto inteira</button>
              </div>
            </fieldset>
            <label>Zoom <output>{Math.round(zoom * 100)}%</output><input type="range" min={minZoom} max="3" step="0.01" value={zoom} onChange={(event) => changeZoom(Number(event.target.value))} /></label>
            <div className="image-editor-actions-row">
              <button type="button" onClick={() => { setRotation((current) => (current + 90) % 360); setOffset({ x: 0, y: 0 }); }}><RotateCw /> Girar</button>
              <button type="button" onClick={restore}><Undo2 /> Restaurar</button>
            </div>
            <fieldset>
              <legend>Melhorar a foto real</legend>
              <button type="button" className="image-editor-auto" onClick={improveAutomatically}><Sparkles /> Melhorar automaticamente</button>
              <label>Luz <output>{brightness}%</output><input type="range" min="85" max="120" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} /></label>
              <label>Contraste <output>{contrast}%</output><input type="range" min="85" max="125" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} /></label>
              <label>Cor <output>{saturation}%</output><input type="range" min="80" max="125" value={saturation} onChange={(event) => setSaturation(Number(event.target.value))} /></label>
              <button
                type="button"
                className="image-editor-compare"
                onPointerDown={() => setComparing(true)}
                onPointerUp={() => setComparing(false)}
                onPointerCancel={() => setComparing(false)}
                onPointerLeave={() => setComparing(false)}
              >Segure para comparar com a original</button>
            </fieldset>
          </aside>
        </div>
        {error ? <p className="image-editor-error" role="alert">{error}</p> : null}
        <footer>
          <span>A original será guardada para futuras edições.</span>
          <div><button type="button" onClick={onCancel}>Cancelar</button><button type="button" className="primary" disabled={busy || !image || Boolean(error)} onClick={() => void apply()}><Check /> {busy ? "Preparando..." : "Usar esta foto"}</button></div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
