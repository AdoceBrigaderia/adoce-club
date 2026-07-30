import {
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent as ReactDragEvent,
} from "react";
import { ClipboardPaste, LoaderCircle } from "lucide-react";
import {
  PRODUCT_IMAGE_TYPES,
  validateProductImage,
} from "./admin-media";
import { firstSupportedImageFile } from "./image-input-files";
import "./clipboard-image-input.css";

type ClipboardImageInputProps = {
  onImage: (file: File) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  onError?: (message: string) => void;
};

function extensionForType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export function clipboardBlobToFile(blob: Blob, now = Date.now()) {
  if (!PRODUCT_IMAGE_TYPES.includes(blob.type)) return null;
  return new File(
    [blob],
    `foto-colada-${now}.${extensionForType(blob.type)}`,
    { type: blob.type, lastModified: now },
  );
}

export function imageFileFromClipboardItems(
  items: ArrayLike<Pick<DataTransferItem, "kind" | "type" | "getAsFile">>,
) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.kind !== "file" || !PRODUCT_IMAGE_TYPES.includes(item.type)) continue;
    const file = item.getAsFile();
    if (!file) continue;
    return clipboardBlobToFile(file);
  }
  return null;
}

async function readImageFromClipboard() {
  if (!navigator.clipboard?.read) return null;
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const imageType = item.types.find((type) => PRODUCT_IMAGE_TYPES.includes(type));
    if (!imageType) continue;
    return clipboardBlobToFile(await item.getType(imageType));
  }
  return null;
}

export default function ClipboardImageInput({
  onImage,
  disabled = false,
  label = "Colar foto",
  className = "",
  onError,
}: ClipboardImageInputProps) {
  const pasteAreaRef = useRef<HTMLDivElement>(null);
  const [awaitingPaste, setAwaitingPaste] = useState(false);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const armManualPaste = () => {
    setAwaitingPaste(true);
    requestAnimationFrame(() => pasteAreaRef.current?.focus());
  };

  const acceptFile = (file: File | null, armWhenMissing = true) => {
    if (!file) {
      onError?.("Use uma foto JPG, PNG ou WebP.");
      if (armWhenMissing) armManualPaste();
      return;
    }
    const validation = validateProductImage(file);
    if (validation) {
      onError?.(validation);
      return;
    }
    setAwaitingPaste(false);
    onImage(file);
  };

  const handleButtonClick = async () => {
    if (disabled || reading) return;
    setReading(true);
    try {
      acceptFile(await readImageFromClipboard());
    } catch {
      // Alguns navegadores bloqueiam a leitura automática. O gesto manual
      // abaixo continua funcionando no computador e no celular.
      armManualPaste();
    } finally {
      setReading(false);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    acceptFile(imageFileFromClipboardItems(event.clipboardData.items));
  };

  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setDragging(true);
  };

  const handleDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) setDragging(false);
  };

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    acceptFile(
      firstSupportedImageFile(event.dataTransfer.files, PRODUCT_IMAGE_TYPES),
      false,
    );
  };

  return (
    <div
      className={`clipboard-image-input ${dragging ? "is-dragging" : ""} ${className}`.trim()}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <button
        type="button"
        className="clipboard-image-button"
        disabled={disabled || reading}
        onClick={() => void handleButtonClick()}
      >
        {reading ? <LoaderCircle className="clipboard-image-spinner" /> : <ClipboardPaste />}
        {reading ? "Lendo foto..." : label}
      </button>
      <span className="clipboard-image-drop-hint" aria-hidden="true">
        ou arraste uma foto para cá
      </span>
      {awaitingPaste ? (
        <div
          ref={pasteAreaRef}
          className="clipboard-image-paste-area"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Cole a foto copiada aqui"
          tabIndex={0}
          onPaste={handlePaste}
          onInput={(event) => { event.currentTarget.textContent = ""; }}
        >
          <strong>Cole a foto aqui</strong>
          <span>No computador, pressione Ctrl+V. No celular, toque e segure e escolha Colar.</span>
        </div>
      ) : null}
    </div>
  );
}
