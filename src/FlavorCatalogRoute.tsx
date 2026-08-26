import { useEffect, useState } from "react";
import CatalogoDeSabores from "./CatalogoDeSabores";
import type { SaborNaVitrine } from "./catalogo-de-sabores";
import { requireSupabase } from "./lib/supabase";

type FlavorRow = {
  id: string;
  name: string;
  category: string | null;
  description: string;
  short_description: string;
  image_path: string | null;
  base_price: number;
  whole_cake_available: boolean;
  whole_cake_price: number | null;
  whole_cake_image_path: string | null;
};

const todayInFortaleza = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Fortaleza",
}).format(new Date());

export default function FlavorCatalogRoute() {
  const [sabores, setSabores] = useState<SaborNaVitrine[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = requireSupabase();
      const today = todayInFortaleza();
      const [flavorResult, summaryResult, availabilityResult, menuResult] = await Promise.all([
        supabase.from("flavors").select("id,name,category,description,short_description,image_path,base_price,whole_cake_available,whole_cake_price,whole_cake_image_path").eq("active", true).order("name"),
        supabase.from("flavor_summaries").select("flavor_id,resumo"),
        supabase.from("flavor_availability").select("flavor_id,status,quantity_available,quantity_reserved").eq("service_date", today),
        supabase.from("weekly_service_menu").select("flavor_id,service_date").gte("service_date", today).order("service_date"),
      ]);
      if (!active) return;
      if (flavorResult.error) {
        setError("Não conseguimos abrir todos os sabores agora. Tente novamente em instantes.");
        return;
      }
      // Resumos são enriquecimento. Enquanto a migração correspondente ainda
      // não chegou ao banco, a vitrine usa o resumo curto já existente.
      const summaries = new Map((summaryResult.error ? [] : summaryResult.data || []).map((row) => [row.flavor_id, row.resumo]));
      const availability = new Map((availabilityResult.data || []).map((row) => [row.flavor_id, row]));
      const nextMenu = new Map<string, string>();
      for (const row of menuResult.error ? [] : menuResult.data || []) if (!nextMenu.has(row.flavor_id)) nextMenu.set(row.flavor_id, row.service_date);
      setSabores(((flavorResult.data || []) as FlavorRow[]).map((flavor) => {
        const available = availability.get(flavor.id);
        const free = available?.quantity_available == null
          ? 0
          : Math.max(0, Number(available.quantity_available) - Number(available.quantity_reserved || 0));
        const nextDate = nextMenu.get(flavor.id) || null;
        const availableToday = available != null && !["sold_out", "unavailable"].includes(available.status);
        return {
          id: flavor.id,
          nome: flavor.name,
          resumo: summaries.get(flavor.id) || flavor.short_description || "Feito à mão pela Adoce.",
          descricao: flavor.description || "",
          ingredientes: "",
          preco: Number(flavor.base_price),
          fotoFatia: flavor.image_path,
          fotoTorta: flavor.whole_cake_image_path,
          tortaInteira: Boolean(flavor.whole_cake_available),
          precoTorta: flavor.whole_cake_price == null ? null : Number(flavor.whole_cake_price),
          categoria: flavor.category,
          estado: availableToday ? "hoje" : nextDate ? "previsto" : "ausente",
          disponiveis: availableToday ? free : 0,
          proximaData: nextDate,
          proximoDia: nextDate ? new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "America/Fortaleza" }).format(new Date(`${nextDate}T12:00:00-03:00`)) : null,
        } satisfies SaborNaVitrine;
      }));
    })().catch(() => active && setError("Não conseguimos abrir todos os sabores agora. Tente novamente em instantes."));
    return () => { active = false; };
  }, []);

  if (error) return <main className="sabores"><p className="sab-resumo" role="alert">{error}</p></main>;
  if (!sabores.length) return <main className="sabores"><p className="sab-resumo">Abrindo os sabores…</p></main>;
  return <CatalogoDeSabores sabores={sabores} onReservar={() => { location.hash = "adoce-hoje"; }} />;
}
