import { useEffect, useState, type ReactNode } from "react";
import { isSupabaseConfigured, requireSupabase } from "./lib/supabase";
import { siteVisualAssetKeys, visualAssetPath } from "./site-visual-assets";

type VisualOverride = {
  asset_key: string;
  image_url: string;
};

function rewriteImage(image: HTMLImageElement, overrides: Map<string, string>) {
  const remembered = image.dataset.adoceVisualSource;
  const current = remembered || visualAssetPath(image.currentSrc || image.src);
  if (!siteVisualAssetKeys.has(current)) return;
  image.dataset.adoceVisualSource = current;
  const replacement = overrides.get(current);
  if (replacement && image.src !== replacement) image.src = replacement;
  if (!replacement && remembered && image.getAttribute("src") !== remembered) image.src = remembered;
}

function rewriteSource(source: HTMLSourceElement, overrides: Map<string, string>) {
  const original = source.dataset.adoceVisualSrcset || source.srcset;
  if (!original) return;
  source.dataset.adoceVisualSrcset = original;
  const next = original
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      const splitAt = trimmed.lastIndexOf(" ");
      const rawUrl = splitAt > 0 ? trimmed.slice(0, splitAt) : trimmed;
      const descriptor = splitAt > 0 ? trimmed.slice(splitAt) : "";
      const key = visualAssetPath(rawUrl);
      return `${overrides.get(key) || rawUrl}${descriptor}`;
    })
    .join(", ");
  if (source.srcset !== next) source.srcset = next;
}

function applyOverrides(overrides: Map<string, string>) {
  const heroCakeDefault = "/site/hero-cake.webp";
  document.documentElement.style.setProperty(
    "--adoce-hero-cake-image",
    `url("${overrides.get(heroCakeDefault) || heroCakeDefault}")`,
  );

  document.querySelectorAll("img").forEach((image) => rewriteImage(image, overrides));
  document.querySelectorAll<HTMLSourceElement>("source[srcset]").forEach((source) => rewriteSource(source, overrides));
}

export default function SiteVisualOverrides({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const load = async () => {
      const { data, error } = await requireSupabase()
        .from("site_visual_assets")
        .select("asset_key,image_url")
        .eq("active", true);
      if (!active || error) return;
      setOverrides(new Map(((data || []) as VisualOverride[]).map((item) => [item.asset_key, item.image_url])));
    };
    void load();
    const refresh = () => void load();
    window.addEventListener("adoce-site-visual-assets-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("adoce-site-visual-assets-changed", refresh);
    };
  }, []);

  useEffect(() => {
    applyOverrides(overrides);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node instanceof HTMLImageElement) rewriteImage(node, overrides);
        if (node instanceof HTMLSourceElement) rewriteSource(node, overrides);
        node.querySelectorAll("img").forEach((image) => rewriteImage(image, overrides));
        node.querySelectorAll<HTMLSourceElement>("source[srcset]").forEach((source) => rewriteSource(source, overrides));
      }));
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [overrides]);

  return children;
}
