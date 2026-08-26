export type ImageFitMode = "stretch" | "cover" | "contain";

export type ImageFitAnalysis = {
  title: string;
  detail: string;
  distorted: boolean;
  cropped: boolean;
  hasMargins: boolean;
  lowResolution: boolean;
};

export function imageOutputHeight(width: number, aspectWidth: number, aspectHeight: number) {
  return Math.round(width * aspectHeight / aspectWidth);
}

export function analyzeImageFit({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  mode,
}: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  mode: ImageFitMode;
}): ImageFitAnalysis {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  const sameRatio = Math.abs(sourceRatio - targetRatio) / targetRatio <= 0.01;
  const lowResolution = sourceWidth < targetWidth || sourceHeight < targetHeight;

  if (mode === "stretch") {
    return {
      title: sameRatio ? "Vai preencher sem distorção" : "Vai preencher com distorção",
      detail: sameRatio
        ? "A proporção combina com a moldura. A imagem será apenas redimensionada."
        : "A imagem será esticada até as bordas da moldura, sem corte e sem cobrir os textos.",
      distorted: !sameRatio,
      cropped: false,
      hasMargins: false,
      lowResolution,
    };
  }

  if (mode === "cover") {
    return {
      title: sameRatio ? "Vai preencher sem corte" : "Vai preencher com corte",
      detail: sameRatio
        ? "A proporção combina com a moldura."
        : "A imagem manterá a proporção e as partes que ultrapassarem a moldura serão cortadas.",
      distorted: false,
      cropped: !sameRatio,
      hasMargins: false,
      lowResolution,
    };
  }

  return {
    title: sameRatio ? "Vai preencher sem margens" : "Vai mostrar a foto inteira com margens",
    detail: sameRatio
      ? "A proporção combina com a moldura."
      : "A imagem manterá a proporção inteira. As áreas livres ficarão transparentes e mostrarão o fundo da página.",
    distorted: false,
    cropped: false,
    hasMargins: !sameRatio,
    lowResolution,
  };
}
