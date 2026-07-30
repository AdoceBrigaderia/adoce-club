export type VisualAssetOverrideMap = ReadonlyMap<string, string>;

const CSS_URL_PATTERN = /url\(\s*(?:(["'])(.*?)\1|([^\s)]+))\s*\)/gi;

function escapeCssUrl(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function pathForCssUrl(value: string, origin: string) {
  try {
    const parsed = new URL(value, origin);
    if (parsed.pathname === "/.netlify/images") {
      return parsed.searchParams.get("url") || parsed.pathname;
    }
    return parsed.pathname;
  } catch {
    return value;
  }
}

export function replaceVisualAssetUrls(
  cssValue: string,
  overrides: VisualAssetOverrideMap,
  assetKeys: ReadonlySet<string>,
  origin = "https://adocebrigaderia.com.br",
) {
  if (!cssValue || overrides.size === 0) return cssValue;

  return cssValue.replace(CSS_URL_PATTERN, (match, _quote, quotedUrl, unquotedUrl) => {
    const rawUrl = (quotedUrl || unquotedUrl || "").trim();
    const assetKey = pathForCssUrl(rawUrl, origin);
    if (!assetKeys.has(assetKey)) return match;
    const replacement = overrides.get(assetKey);
    if (!replacement) return match;
    return `url("${escapeCssUrl(replacement)}")`;
  });
}
