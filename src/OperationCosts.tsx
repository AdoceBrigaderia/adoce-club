import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { requireSupabase } from "./lib/supabase";
import { CostEngine, calculateSale, decimal, money as costMoney, type Component, type Ingredient, type Preparation, type Quantity, type Unit } from "./lib/cost-engine";
import { moneyFromTypedDigits, referenceQuantityInBase, type BaseUnit } from "./lib/purchase-invoice";
import CostPurchaseInvoice from "./CostPurchaseInvoice";
import CostItemEditor from "./CostItemEditor";
import CostRecordArchiveDialog from "./CostRecordArchiveDialog";
import CostItemCreator from "./CostItemCreator";
import CostShoppingPlanner from "./CostShoppingPlanner";
import CostSheetTable from "./CostSheetTable";
import { compositionUsage } from "./lib/purchase-planner";
import { cakeSections, selectedComponentQuantity, slicePackagingSection, packagingQuantity, suggestedSlicePackaging, sliceFinishingSection, isPerSliceSection, suggestedSliceFinishing } from "./lib/cost-sheet";
import { ingredientFromPurchase } from "./lib/cost-purchase-reference";
import { requiredCakePreparations } from "./lib/cake-required-preparations";
import { defaultIdealSalePrice, parseIdealSalePrice, idealSaleMargin, parsePaymentFeePercent, weightedPaymentFeePercent } from "./lib/ideal-sale-price";
import { compactCostHeader, describeItemUsage, firstProblemRow } from "./table-and-sheet-ui";
import "./operation-costs.css";

type Flavor = { id: string; name: string; base_price: number | null; active: boolean };
type Item = { id: string; internal_code: string; name: string; item_kind: string; purchase_unit: string; consumption_unit: string; reference_package_name: string | null; reference_quantity: number | null; reference_unit: BaseUnit | null; data_status: string; active: boolean; price: null | { purchase_price: number; purchased_quantity: number; purchase_unit: string; useful_quantity: number | null; data_status: string; effective_at: string } };
type Recipe = { id: string; name: string; recipe_kind: "intermediate" | "final_product"; flavor_id: string | null; active: boolean; batter_color?: string | null };
type Version = { id: string; recipe_id: string; version_number: number; version_status: string; yield_quantity: number | null; yield_unit: string | null; size_code: string | null; created_at: string; preparation_minutes?: number | null; cooking_minutes?: number | null; cooling_minutes?: number | null };
type Row = { id: string; recipe_version_id: string; component_kind: "item" | "recipe_version"; item_id: string | null; child_recipe_version_id: string | null; quantity: number | null; unit: string; placement: string; sort_order: number };
type Price = { id: string; item_id: string; purchase_price: number; purchased_quantity: number; purchase_unit: string; useful_quantity: number | null; data_status: string; effective_at: string; source_note: string };
type IdealPrice = { recipe_id: string; size_code: string; ideal_sale_price: number };
type MarginSettings = { payment_fee_percent: number; reference_sales_total: number; reference_fees_total: number };
type Workspace = { flavors: Flavor[]; items: Item[]; prices: Price[]; recipes: Recipe[]; versions: Version[]; components: Row[]; ideal_prices: IdealPrice[] };
type PurchaseLine = { item_id: string; brand_name: string; package_layers: { name: string; quantity: string }[]; normalized_quantity: number; normalized_unit: string; outer_unit_price: number | null; gross_total: number; net_total: number; useful_quantity: number | null };
type PurchaseInvoice = { id: string; issued_on: string; created_at: string; lines: PurchaseLine[] };
type DraftRow = { kind: "item" | "recipe_version"; id: string; quantity: string; unit: Unit; placement: string };
const units: Unit[] = ["g", "kg", "ml", "l", "unit"];
const costUnits: Unit[] = ["unit", "g", "ml"];
const costKinds = ["ingredient", "packaging"] as const;
const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatQuantity = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const formatUnitCost = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: value < 0.01 ? 5 : 2, maximumFractionDigits: 6 });
const formatDate = (date: string) => date.split("-").reverse().join("/");
const referenceUnits = (base: string): BaseUnit[] => base === "g" ? ["g", "kg"] : base === "ml" ? ["ml", "l"] : base === "unit" ? ["unit"] : [];
const newRow = (): DraftRow => ({ kind: "item", id: "", quantity: "", unit: "g", placement: "composition" });

export default function OperationCosts() {
  const composerRef = useRef<HTMLFormElement>(null);
  const preserveComposer = useRef(false);
  const focusedModal = useRef(false);
  const [creatingItemAt, setCreatingItemAt] = useState<number | null>(null);
  const [archivingItem, setArchivingItem] = useState<Item | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [data, setData] = useState<Workspace | null>(null);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [tab, setTab] = useState<"invoices" | "items" | "preparations" | "sheets" | "shopping">("invoices");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [itemKind, setItemKind] = useState<(typeof costKinds)[number]>("ingredient");
  const [itemName, setItemName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [itemUnit, setItemUnit] = useState<Unit | "">("");
  const [itemReferenceName, setItemReferenceName] = useState("");
  const [itemReferenceQuantity, setItemReferenceQuantity] = useState("");
  const [itemReferenceUnit, setItemReferenceUnit] = useState<BaseUnit | "">("");
  const [editingReference, setEditingReference] = useState<{ itemId: string; name: string; quantity: string; unit: BaseUnit | "" } | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [itemFilter, setItemFilter] = useState("all");
  const [itemSort, setItemSort] = useState("name");
  const [recipeSort, setRecipeSort] = useState("pending");
  const usage = useMemo(() => data ? compositionUsage(data) : null, [data]);
  const [itemDirection, setItemDirection] = useState("asc");
  const [recipeName, setRecipeName] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [flavorId, setFlavorId] = useState("");
  const [size, setSize] = useState<"P" | "M" | "G" | "GG">("G");
  const [yieldQuantity, setYieldQuantity] = useState("");
  const [yieldUnit, setYieldUnit] = useState<Unit>("g");
  const [preparationMinutes, setPreparationMinutes] = useState("");
  const [cookingMinutes, setCookingMinutes] = useState("");
  const [coolingMinutes, setCoolingMinutes] = useState("");
  const [slices, setSlices] = useState("13");
  const [slicePrice, setSlicePrice] = useState("");
  const [itemPackaging, setItemPackaging] = useState("");
  const [orderPackaging, setOrderPackaging] = useState("");
  const [discount, setDiscount] = useState("");
  const [feePercent, setFeePercent] = useState("");
  const [fixedFee, setFixedFee] = useState("");
  const [rewardCost, setRewardCost] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [idealPricesAvailable, setIdealPricesAvailable] = useState(false);
  const [idealPriceDrafts, setIdealPriceDrafts] = useState<Record<string, string>>({});
  const [idealPriceNotices, setIdealPriceNotices] = useState<Record<string, string>>({});
  const [savingIdealPrices, setSavingIdealPrices] = useState<Record<string, boolean>>({});
  const [marginSettings, setMarginSettings] = useState<MarginSettings | null>(null);
  const [marginFeeDraft, setMarginFeeDraft] = useState<string | null>(null);
  const [marginFeeNotice, setMarginFeeNotice] = useState("");
  const [savingMarginFee, setSavingMarginFee] = useState(false);
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [sheetModalMissing, setSheetModalMissing] = useState<string[]>([]);
  const marginFeeValue = marginFeeDraft ?? (marginSettings ? String(marginSettings.payment_fee_percent).replace(".", ",") : "");
  const marginFeePercent = marginSettings ? parsePaymentFeePercent(marginFeeValue) : null;

  useEffect(() => {
    if (!sheetModalOpen) { focusedModal.current = false; return; }
    if (!data || !rows.length || focusedModal.current) return;
    focusedModal.current = true;
    const problem = firstProblemRow(rows.map(row => {
      const version = row.kind === "recipe_version" ? data.versions.find(candidate => candidate.id === row.id) : undefined;
      const recipe = version ? data.recipes.find(candidate => candidate.id === version.recipe_id) : undefined;
      const item = row.kind === "item" ? data.items.find(candidate => candidate.id === row.id) : undefined;
      return { id: row.id, quantity: row.quantity, label: item?.name || recipe?.name };
    }), sheetModalMissing);
    requestAnimationFrame(() => {
      const target = composerRef.current?.querySelector<HTMLElement>(`[data-row-index="${problem}"] [data-component-control]`)
        || composerRef.current?.querySelector<HTMLElement>("input:invalid, select:invalid, input, select");
      target?.scrollIntoView({ block: "center" });
      target?.focus({ preventScroll: true });
    });
  }, [data, rows, sheetModalMissing, sheetModalOpen]);

  const load = useCallback(async () => {
    setBusy(true);
    const [{ data: result, error }, { data: invoices, error: purchaseError }, { data: idealPrices, error: idealPriceError }, { data: marginConfig, error: marginError }] = await Promise.all([
      requireSupabase().rpc("manager_get_costing_workspace_with_times"),
      requireSupabase().rpc("manager_get_costing_purchase_workspace"),
      requireSupabase().rpc("manager_get_costing_ideal_prices"),
      requireSupabase().rpc("manager_get_costing_margin_settings"),
    ]);
    setBusy(false);
    if (error) { setNotice(error.message); return; }
    setData({ ...(result as Workspace), ideal_prices: (idealPrices || []) as IdealPrice[] });
    setIdealPricesAvailable(!idealPriceError);
    if (!idealPriceError) setIdealPriceDrafts({});
    setMarginSettings(marginError ? null : marginConfig as MarginSettings);
    if (!marginError) setMarginFeeDraft(null);
    if (purchaseError) setNotice(`Itens carregados, mas o histórico de compras não pôde ser consultado: ${purchaseError.message}`);
    else setPurchaseInvoices((invoices || []) as PurchaseInvoice[]);
    if (!purchaseError) setNotice(idealPriceError ? `Os preços ideais não puderam ser consultados: ${idealPriceError.message}` : marginError ? `A taxa média não pôde ser consultada: ${marginError.message}` : "");
  }, []);
  useEffect(() => { void load(); }, [load]);

  const saveMarginFee = async () => {
    if (marginFeePercent == null) { setMarginFeeNotice("Informe uma taxa de 0 a menos de 100%, com até quatro casas decimais."); return; }
    setSavingMarginFee(true); setMarginFeeNotice("Salvando taxa...");
    try {
      const { error } = await requireSupabase().rpc("manager_set_costing_payment_fee", { next_percent: marginFeePercent });
      if (error) throw error;
      setMarginSettings(current => current && ({ ...current, payment_fee_percent: marginFeePercent }));
      setMarginFeeDraft(null); setMarginFeeNotice("Taxa salva e aplicada às margens de todas as fichas.");
    } catch (error) {
      setMarginFeeNotice(`Taxa não salva: ${error instanceof Error ? error.message : "confira a conexão e tente novamente."}`);
    } finally { setSavingMarginFee(false); }
  };

  const saveIdealPrice = async (recipeId: string, sizeCode: string, raw: string) => {
    const key = `${recipeId}:${sizeCode}`;
    const value = parseIdealSalePrice(raw);
    if (value == null) {
      setIdealPriceNotices(current => ({ ...current, [key]: "Informe um preço maior que zero, com até duas casas decimais. Valor não salvo." }));
      return;
    }
    const previous = data?.ideal_prices.find(p => p.recipe_id === recipeId && p.size_code === sizeCode)?.ideal_sale_price ?? defaultIdealSalePrice;
    if (Number(previous) === value) return;
    setSavingIdealPrices(current => ({ ...current, [key]: true }));
    setIdealPriceNotices(current => ({ ...current, [key]: "Salvando..." }));
    try {
      const { error } = await requireSupabase().rpc("manager_set_costing_ideal_price", { target_recipe_id: recipeId, target_size_code: sizeCode, next_price: value });
      if (error) throw error;
      setData(current => current && ({ ...current, ideal_prices: [...current.ideal_prices.filter(p => p.recipe_id !== recipeId || p.size_code !== sizeCode), { recipe_id: recipeId, size_code: sizeCode, ideal_sale_price: value }] }));
      setIdealPriceDrafts(current => ({ ...current, [key]: value.toFixed(2).replace(".", ",") }));
      setIdealPriceNotices(current => ({ ...current, [key]: "Preço ideal salvo." }));
    } catch (error) {
      setIdealPriceNotices(current => ({ ...current, [key]: `Valor não salvo: ${error instanceof Error ? error.message : "confira a conexão e tente novamente."}` }));
    } finally {
      setSavingIdealPrices(current => ({ ...current, [key]: false }));
    }
  };

  const latest = useCallback((recipeId: string, sizeCode: string | null = null) =>
    data?.versions.filter(v => v.recipe_id === recipeId && v.size_code === sizeCode)
      .sort((a, b) => b.version_number - a.version_number)[0], [data]);
  const selectedFlavor = data?.flavors.find(f => f.id === flavorId);
  const flavorRecipe = data?.recipes.find(r => r.flavor_id === flavorId);
  const activeVersion = flavorRecipe ? latest(flavorRecipe.id, size) : undefined;
  useEffect(() => {
    if (!data) return;
    if (preserveComposer.current) { preserveComposer.current = false; return; }
    const current = tab === "sheets" ? activeVersion : tab === "preparations" && selectedRecipeId ? latest(selectedRecipeId) : undefined;
    if (tab === "sheets") setSlices(current?.yield_unit === "slice" && current.yield_quantity ? String(current.yield_quantity) : "13");
    setRows(current ? data.components.filter(c => c.recipe_version_id === current.id).map(c => ({
      kind: c.component_kind,
      id: (c.component_kind === "item" ? c.item_id : c.child_recipe_version_id) || "",
      quantity: isPerSliceSection(c.placement) ? packagingQuantity(c.quantity, current?.yield_quantity || 13, "edit") : c.quantity == null ? "" : String(c.quantity),
      unit: units.includes(c.unit as Unit) ? c.unit as Unit : "g",
      placement: c.placement,
    })) : tab === "sheets" && flavorId ? [...cakeSections.flatMap(section => Array.from({ length: section.count }, () => ({ ...newRow(), kind: "recipe_version" as const, placement: section.name }))), ...suggestedSlicePackaging(data), ...suggestedSliceFinishing(data), ...requiredCakePreparations(data)] : []);
    if (tab === "preparations") {
      setPreparationMinutes(current?.preparation_minutes == null ? "" : String(current.preparation_minutes));
      setCookingMinutes(current?.cooking_minutes == null ? "" : String(current.cooking_minutes));
      setCoolingMinutes(current?.cooling_minutes == null ? "" : String(current.cooling_minutes));
      setYieldQuantity(current?.yield_quantity == null ? "" : String(current.yield_quantity));
      setYieldUnit(units.includes(current?.yield_unit as Unit) ? current!.yield_unit as Unit : "g");
    }
  }, [data, tab, flavorId, size, selectedRecipeId, activeVersion, latest]);

  const engine = useMemo(() => {
    const ingredients = new Map<string, Ingredient>();
    const preparations = new Map<string, Preparation>();
    for (const item of data?.items || []) {
      ingredients.set(item.id, ingredientFromPurchase(item));
    }
    for (const version of data?.versions || []) {
      const recipe = data?.recipes.find(r => r.id === version.recipe_id);
      if (!recipe || recipe.recipe_kind !== "intermediate") continue;
      preparations.set(version.id, {
        id: version.id, name: `${recipe.name} v${version.version_number}`,
        yield: version.yield_quantity && units.includes(version.yield_unit as Unit)
          ? { value: String(version.yield_quantity), unit: version.yield_unit as Unit } : undefined,
        components: (data?.components || []).filter(c => c.recipe_version_id === version.id).map(toComponent),
      });
    }
    return new CostEngine(ingredients, preparations);
  }, [data]);


  const sheetEntries = useMemo(() => {
    if (!data) return [];
    return data.recipes.filter(recipe => recipe.active && recipe.recipe_kind === "final_product").flatMap(recipe =>
      [...new Set(data.versions.filter(version => version.recipe_id === recipe.id && version.size_code).map(version => version.size_code!))].flatMap(sizeCode => {
        const version = latest(recipe.id, sizeCode);
        if (!version) return [];
        const result = engine.cake({ size: sizeCode as "P" | "M" | "G" | "GG", sections: [{ name: recipe.name, components: data.components.filter(c => c.recipe_version_id === version.id).map(toComponent) }] }, version.yield_unit === "slice" ? version.yield_quantity ?? 0 : 0);
        return [{recipe, sizeCode, version, result}];
      })
    ).sort((a,b) => (recipeSort === "pending" ? Number(b.result.status !== "CALCULADA") - Number(a.result.status !== "CALCULADA") : 0) || (recipeSort === "desc" ? -1 : 1) * a.recipe.name.localeCompare(b.recipe.name,"pt-BR") || a.sizeCode.localeCompare(b.sizeCode));
  }, [data, engine, latest, recipeSort]);

  const calculated = useMemo(() => {
    if (tab !== "sheets" || !flavorId) return null;
    if (!Number.isSafeInteger(Number(slices)) || Number(slices) <= 0) return { status: "ERRO" as const, missing: ["Informe um rendimento válido em fatias"] };
    const components = activeVersion
      ? (data?.components || []).filter(c => c.recipe_version_id === activeVersion.id).map(toComponent)
      : rows.map(row => ({ kind: row.kind === "item" ? "ingredient" as const : "preparation" as const, id: row.id, quantity: row.quantity ? { value: isPerSliceSection(row.placement) && Number(row.quantity) > 0 ? packagingQuantity(row.quantity, Number(slices), "save") : row.quantity, unit: row.unit } : undefined }));
    return engine.cake(activeVersion || rows.length ? { size, sections: [{ name: "Torta", components }] } : undefined,
      slices ? Number(slices) : undefined);
  }, [tab, flavorId, activeVersion, data, rows, engine, size, slices]);
  const sale = useMemo(() => {
    if (calculated?.status !== "CALCULADA" || calculated.sliceMicros == null ||
      [slicePrice, itemPackaging, orderPackaging, discount, feePercent, fixedFee, rewardCost].some(value => value === "")) return null;
    try {
      const rate = decimal(feePercent) / 100n;
      const rateText = `${rate / 1_000_000n}.${String(rate % 1_000_000n).padStart(6, "0")}`;
      return calculateSale({ slices: 1, sliceProductionMicros: calculated.sliceMicros,
        grossUnitPrice: slicePrice, discountTotal: discount,
        itemPackagingMicros: decimal(itemPackaging), orderPackagingMicros: decimal(orderPackaging),
        percentageFee: rateText, fixedFee,
        loyalty: { mode: "provision", pointsGranted: 1, pointsNeeded: 14, expectedRewardMicros: decimal(rewardCost) },
      });
    } catch (error) { return { status: "ERRO" as const, missing: [(error as Error).message] }; }
  }, [calculated, slicePrice, itemPackaging, orderPackaging, discount, feePercent, fixedFee, rewardCost]);

  const saveItem = async (event: FormEvent) => {
    event.preventDefault();
    if ((itemReferenceName || itemReferenceQuantity || itemReferenceUnit) &&
      (!itemReferenceName.trim() || !itemReferenceQuantity || !itemReferenceUnit ||
        referenceQuantityInBase(itemReferenceQuantity, itemReferenceUnit, itemUnit as BaseUnit) == null))
      return setNotice("Preencha nome, conteúdo e unidade compatível da embalagem de referência.");
    setBusy(true);
    const { error } = await requireSupabase().rpc("manager_create_costing_item_with_reference", {
      next_internal_code: itemCode.trim().toUpperCase(), next_name: itemName.trim(),
      next_item_kind: itemKind, next_consumption_unit: itemUnit,
      next_package_name: itemReferenceName.trim() || null,
      next_quantity: itemReferenceQuantity ? Number(itemReferenceQuantity) : null,
      next_unit: itemReferenceUnit || null,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setItemName(""); setItemCode(""); setItemUnit(""); setItemReferenceName(""); setItemReferenceQuantity(""); setItemReferenceUnit(""); await load(); setNotice("Item salvo. Registre e confira seu preço em uma nota de compra para calcular.");
  };
  const saveReference = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingReference) return;
    const item = data?.items.find(candidate => candidate.id === editingReference.itemId);
    if ((editingReference.name || editingReference.quantity || editingReference.unit) &&
      (!editingReference.name.trim() || !editingReference.quantity || !editingReference.unit ||
        !item || referenceQuantityInBase(editingReference.quantity, editingReference.unit, item.consumption_unit as BaseUnit) == null))
      return setNotice("Preencha nome, conteúdo e unidade compatível da embalagem de referência.");
    setBusy(true);
    const { error } = await requireSupabase().rpc("manager_set_costing_item_reference", {
      target_item_id: editingReference.itemId,
      next_package_name: editingReference.name.trim() || null,
      next_quantity: editingReference.quantity ? Number(editingReference.quantity) : null,
      next_unit: editingReference.unit || null,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setEditingReference(null); await load(); setNotice("Embalagem de referência atualizada para comparação visual.");
  };
  const validateItem = async (id: string) => {
    setBusy(true);
    const { error } = await requireSupabase().rpc("manager_validate_costing_item", { target_item_id: id });
    setBusy(false);
    if (error) return setNotice(error.message);
    await load(); setNotice("Item conferido e validado.");
  };
  const saveRecipe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const startNew = ((event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value === "save-and-new";
    setSaveNotice("");
    const invalid = Array.from(event.currentTarget.elements).find(element => (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) && !element.validity.valid) as HTMLInputElement | HTMLSelectElement | undefined;
    if (invalid) {
      setSaveNotice(`${invalid.closest("label")?.childNodes[0]?.textContent?.trim() || "Campo"}: ${invalid.validationMessage}`);
      invalid.focus();
      return;
    }
    const isSheet = tab === "sheets";
    const flavor = data?.flavors.find(f => f.id === flavorId);
    if (isSheet && !flavor) return setNotice("Selecione um sabor existente.");
    if (!isSheet && !recipeName.trim()) return setNotice("Informe o nome da preparação.");
    setBusy(true);
    setSaveNotice("Salvando alterações...");
    try {
    const { error } = await requireSupabase().rpc("manager_save_costing_sheet_with_times", {
      target_recipe_id: isSheet ? flavorRecipe?.id || null : selectedRecipeId || null,
      next_name: isSheet ? flavor!.name : recipeName.trim(),
      next_kind: isSheet ? "final_product" : "intermediate",
      next_flavor_id: isSheet ? flavorId : null,
      next_size_code: isSheet ? size : null,
      next_yield_quantity: isSheet ? Number(slices || "13") : yieldQuantity || null,
      next_yield_unit: isSheet ? "slice" : yieldQuantity ? yieldUnit : null,
      next_components: rows.map((row, index) => ({
        kind: row.kind, id: row.id, quantity: isSheet && isPerSliceSection(row.placement) ? packagingQuantity(row.quantity, Number(slices), "save") || null : row.quantity || null,
        unit: row.unit, placement: row.placement.trim() || "composition", sort_order: index,
      })),
      next_reason: "Editado na operação",
      next_preparation_minutes: isSheet ? activeVersion?.preparation_minutes ?? null : preparationMinutes === "" ? null : Number(preparationMinutes),
      next_cooking_minutes: isSheet ? activeVersion?.cooking_minutes ?? null : cookingMinutes === "" ? null : Number(cookingMinutes),
      next_cooling_minutes: isSheet ? activeVersion?.cooling_minutes ?? null : coolingMinutes === "" ? null : Number(coolingMinutes),
    });
    setBusy(false);
    if (error) { setSaveNotice(`Não foi possível salvar: ${error.message}`); return; }
    await load(); setNotice("Ficha salva. Compras e custo já consideram a composição atual.");
    if (startNew) {
      setFlavorId(""); setSelectedRecipeId(""); setRecipeName(""); setRows([]);
      setSize("G"); setSlices("13"); setYieldQuantity(""); setYieldUnit("g");
      setPreparationMinutes(""); setCookingMinutes(""); setCoolingMinutes("");
      setSlicePrice(""); setItemPackaging(""); setOrderPackaging(""); setDiscount("");
      setFeePercent(""); setFixedFee(""); setRewardCost("");
      setSaveNotice("Ficha salva. Selecione o próximo sabor ou preencha a nova preparação.");
      requestAnimationFrame(() => {
        composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        composerRef.current?.querySelector<HTMLSelectElement>("select")?.focus({ preventScroll: true });
      });
    } else {
      setSaveNotice("Alterações salvas. A ficha atual e a lista foram atualizadas.");
    }
    } catch (error) {
      setSaveNotice(`Não foi possível salvar: ${error instanceof Error ? error.message : "verifique a conexão e tente novamente."}`);
    } finally { setBusy(false); }
  };

  const editRow = (index: number, change: Partial<DraftRow>) =>
    setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...change } : row));
  const selectedRecipe = data?.recipes.find(r => r.id === selectedRecipeId);
  const openPreparation = (recipe: Recipe, missing: string[] = []) => {
    const version = latest(recipe.id);
    setSelectedRecipeId(recipe.id); setRecipeName(recipe.name);
    setRows(version ? data!.components.filter(c => c.recipe_version_id === version.id).map(c => ({
      kind: c.component_kind, id: (c.item_id || c.child_recipe_version_id) ?? "",
      quantity: isPerSliceSection(c.placement) ? packagingQuantity(c.quantity, version?.yield_quantity || 13, "edit") : c.quantity == null ? "" : String(c.quantity), unit: units.includes(c.unit as Unit) ? c.unit as Unit : "g", placement: c.placement,
    })) : []);
    setYieldQuantity(version?.yield_quantity == null ? "" : String(version.yield_quantity));
    setYieldUnit(units.includes(version?.yield_unit as Unit) ? version!.yield_unit as Unit : "g");
    setPreparationMinutes(version?.preparation_minutes == null ? "" : String(version.preparation_minutes));
    setCookingMinutes(version?.cooking_minutes == null ? "" : String(version.cooking_minutes));
    setCoolingMinutes(version?.cooling_minutes == null ? "" : String(version.cooling_minutes));
    setSheetModalMissing(missing);
    setSheetModalOpen(true);
    requestAnimationFrame(() => { composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); composerRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }); });
  };
  const prepVersion = selectedRecipe ? latest(selectedRecipe.id) : undefined;
  const showExisting = (version?: Version) => version && data?.components.filter(c => c.recipe_version_id === version.id).map(row => {
    const name = row.component_kind === "item"
      ? data.items.find(i => i.id === row.item_id)?.name
      : data.recipes.find(r => r.id === data.versions.find(v => v.id === row.child_recipe_version_id)?.recipe_id)?.name;
    const componentCost = engine.components([toComponent(row)]);
    return <li key={row.id}>{row.placement === "composition" ? "Composição" : row.placement === "finishing" ? "Finalização" : row.placement}: {name || "Referência ausente"} · {row.quantity ?? "quantidade pendente"} {row.unit} · {componentCost.status === "CALCULADA" ? <strong>Custo: {formatCurrency(Number(costMoney(componentCost.micros)))}</strong> : <span className="adoce-cost-pending">Custo pendente: {[...new Set(componentCost.missing)].join(" · ")}</span>}</li>;
  });

  return <section className="adoce-costs">
    <nav aria-label="Áreas de custos">
      <button className={tab === "invoices" ? "active" : ""} onClick={() => { setTab("invoices"); setSheetModalOpen(false); }}>Notas de compra</button>
      <button className={tab === "items" ? "active" : ""} onClick={() => { setTab("items"); setSheetModalOpen(false); }}>Insumos e embalagens</button>
      <button className={tab === "preparations" ? "active" : ""} onClick={() => { setTab("preparations"); setSheetModalOpen(false); }}>Preparações</button>
      <button className={tab === "sheets" ? "active" : ""} onClick={() => { setTab("sheets"); setSheetModalOpen(false); }}>Fichas por sabor</button>
      <button className={tab === "shopping" ? "active" : ""} onClick={() => { setTab("shopping"); setSheetModalOpen(false); }}>Planejar compras</button>
    </nav>
    {notice && <p className="adoce-cost-notice" role="status">{notice}</p>}
    {!data && <p>{busy ? "Carregando custos..." : "Não foi possível carregar custos."}</p>}
    {archivingItem && <CostRecordArchiveDialog kind="item" id={archivingItem.id} name={archivingItem.name} restore={!archivingItem.active} linked={!!data?.components.some(component => component.item_id === archivingItem.id)} onClose={() => setArchivingItem(null)} onSaved={load} />}
    {editingItemId && <CostItemEditor itemId={editingItemId} onClose={() => setEditingItemId(null)} onSaved={async () => { await load(); setNotice("Cadastro atualizado. Histórico de compras e preços preservado."); }} />}
    {creatingItemAt !== null && <CostItemCreator itemKind={rows[creatingItemAt]?.placement === slicePackagingSection ? "packaging" : "ingredient"} onClose={() => setCreatingItemAt(null)} onCreated={item => {
      preserveComposer.current = true;
      setData(current => current ? { ...current, items: [...current.items, item].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) } : current);
      editRow(creatingItemAt, { kind: "item", id: item.id, quantity: "", unit: item.consumption_unit as Unit });
      setNotice(`${item.name} cadastrado e selecionado. Informe a quantidade usada; os demais campos da preparação foram mantidos.`);
    }} />}
    {data && tab === "invoices" && <CostPurchaseInvoice items={data.items} onSaved={load} />}
    {data && tab === "items" && <div className="adoce-cost-grid adoce-items-layout">
      <form className="adoce-item-create" onSubmit={saveItem}><h4>Novo insumo ou embalagem</h4>
        <label>Tipo<select value={itemKind} onChange={e => setItemKind(e.target.value as typeof itemKind)}><option value="ingredient">Insumo</option><option value="packaging">Embalagem</option></select></label>
        <label>Nome<input required maxLength={160} value={itemName} onChange={e => setItemName(e.target.value)} /></label>
        <label>Código interno<input required maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" value={itemCode} onChange={e => setItemCode(e.target.value)} /></label>
        <label>Calcular custo e uso por<select required value={itemUnit} onChange={e => { setItemUnit(e.target.value as Unit); setItemReferenceUnit(""); }}><option value="">Escolha a unidade</option>{costUnits.map(unit => <option key={unit} value={unit}>{unit === "unit" ? "unidade" : unit === "g" ? "grama" : "mililitro"}</option>)}</select></label>
        <small>Esta unidade também será usada na ficha técnica. A nota converte caixas, pacotes, kg e litros para ela.</small>
        <fieldset className="adoce-reference-fields"><legend>Embalagem de referência para comparar preços</legend>
          <label>Nome da embalagem<input required={Boolean(itemReferenceName || itemReferenceQuantity || itemReferenceUnit)} maxLength={60} value={itemReferenceName} onChange={e => setItemReferenceName(e.target.value)} placeholder="Ex.: caixinha" /></label>
          <div><label>Conteúdo padrão<input required={Boolean(itemReferenceName || itemReferenceQuantity || itemReferenceUnit)} type="number" min="0.000001" step="any" value={itemReferenceQuantity} onChange={e => setItemReferenceQuantity(e.target.value)} placeholder="Ex.: 395" /></label>
          <label>Unidade<select required={Boolean(itemReferenceName || itemReferenceQuantity || itemReferenceUnit)} value={itemReferenceUnit} onChange={e => setItemReferenceUnit(e.target.value as BaseUnit)}><option value="">Escolha</option>{referenceUnits(itemUnit).map(unit => <option key={unit} value={unit}>{unit === "unit" ? "unidade" : unit}</option>)}</select></label></div>
          <small>Opcional. Mostra o equivalente de preço da embalagem comum; não altera o custo da ficha.</small>
        </fieldset>
        <button type="submit" disabled={busy}>Cadastrar</button>
      </form>
      <div className="adoce-cost-list adoce-items-table-panel"><h4>Itens cadastrados</h4>
        <div className="adoce-items-filters"><label>Buscar nome, código ou marca<input type="search" value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Digite para encontrar" /></label><label>Filtrar<select value={itemFilter} onChange={e => setItemFilter(e.target.value)}><option value="all">Itens ativos</option><option value="archived">Excluídos · restaurar</option><option value="ingredient">Insumos</option><option value="packaging">Embalagens</option><option value="validated">Com preço de compra</option><option value="pending">Cálculo incompleto</option><option value="no_purchase">Sem compra registrada</option><option value="unused">Sem uso em composição</option></select></label><label>Ordenar por<select value={itemSort} onChange={e => setItemSort(e.target.value)}><option value="name">Nome</option><option value="brand">Marca da última compra</option><option value="date">Data da última compra</option><option value="total">Total da última compra</option><option value="cost">Custo por unidade de uso</option><option value="unused">Sem uso primeiro</option></select></label><label>Ordem<select value={itemDirection} onChange={e => setItemDirection(e.target.value)}><option value="asc">Crescente</option><option value="desc">Decrescente</option></select></label></div>
        <div className="adoce-items-table-scroll"><table className="adoce-items-table"><thead><tr>{["Produto", "Última compra", "Marca", "Média semanal", "Embalagem comprada", "Custo de uso", "Referência", "Composição das tortas", "Situação e ações"].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead><tbody>{data.items.filter(item => {
          const purchases = purchaseInvoices.flatMap(invoice => invoice.lines.filter(line => line.item_id === item.id));
          const validated = !!ingredientFromPurchase(item).purchased;
          const text = `${item.name} ${item.internal_code || ""} ${purchases.map(line => line.brand_name).join(" ")}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          return (itemFilter === "archived" ? !item.active : item.active) && text.includes(itemSearch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()) && (itemFilter === "all" || itemFilter === "archived" || itemFilter === item.item_kind || itemFilter === "validated" && validated || itemFilter === "pending" && !validated || itemFilter === "no_purchase" && !purchases.length || itemFilter === "unused" && !usage?.items[item.id]?.used);
        }).sort((a, b) => {
          const last = (id: string) => purchaseInvoices.flatMap(invoice => invoice.lines.filter(line => line.item_id === id).map(line => ({ ...line, date: invoice.issued_on }))).sort((x, y) => y.date.localeCompare(x.date))[0];
          const x = last(a.id), y = last(b.id);
          const compared = itemSort === "unused" ? Number(usage?.items[a.id]?.used || false) - Number(usage?.items[b.id]?.used || false) || a.name.localeCompare(b.name, "pt-BR") : itemSort === "total" ? Number(x?.net_total || 0) - Number(y?.net_total || 0) : itemSort === "cost" ? (x ? x.net_total / Number(x.useful_quantity || x.normalized_quantity) : 0) - (y ? y.net_total / Number(y.useful_quantity || y.normalized_quantity) : 0) : (itemSort === "brand" ? x?.brand_name || "" : itemSort === "date" ? x?.date || "" : a.name).localeCompare(itemSort === "brand" ? y?.brand_name || "" : itemSort === "date" ? y?.date || "" : b.name, "pt-BR", { numeric: true });
          return (itemDirection === "desc" ? -1 : 1) * compared;
        }).map(item => {
        const reference = referenceQuantityInBase(item.reference_quantity, item.reference_unit, item.consumption_unit as BaseUnit);
        const equivalent = reference && item.price ? item.price.purchase_price / Number(item.price.useful_quantity || item.price.purchased_quantity) * reference : null;
        const purchases = purchaseInvoices.flatMap(invoice => invoice.lines.filter(line => line.item_id === item.id).map(line => ({ ...line, issued_on: invoice.issued_on, created_at: invoice.created_at })));
        purchases.sort((a, b) => b.issued_on.localeCompare(a.issued_on) || b.created_at.localeCompare(a.created_at));
        const last = purchases[0];
        const firstDate = purchases.length ? purchases[purchases.length - 1].issued_on : null;
        const firstDay = firstDate ? Date.parse(`${firstDate}T00:00:00Z`) : NaN;
        const today = new Date();
        const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        const weeks = firstDate ? Math.max(1, Math.ceil((Math.max(0, Math.floor((todayUtc - firstDay) / 86400000)) + 1) / 7)) : 0;
        const weeklyAverage = weeks ? purchases.reduce((sum, line) => sum + Number(line.normalized_quantity), 0) / weeks : null;
        const packageCount = Number(last?.package_layers[0]?.quantity);
        const packageName = last?.package_layers[0]?.name || "embalagem";
        const packageQuantity = last && packageCount > 0 ? Number(last.normalized_quantity) / packageCount : null;
        const packageCost = last && packageCount > 0 ? Number(last.net_total) / packageCount : null;
        const unitCost = last ? Number(last.net_total) / Number(last.useful_quantity || last.normalized_quantity) : null;
        return <tr key={item.id}><td data-label="Produto"><strong>{item.name}</strong><small>Código: {item.internal_code}</small><button type="button" disabled={busy} onClick={() => setEditingItemId(item.id)} aria-label={`Editar ${item.name}`}>Editar nome e cadastro</button><button type="button" disabled={busy} onClick={() => setArchivingItem(item)}>{item.active ? "Excluir produto" : "Restaurar produto"}</button><small>{item.item_kind === "packaging" ? "Embalagem" : "Insumo"}</small></td>
          <td data-label="Última compra">{last ? <>{formatDate(last.issued_on)}<strong>{formatCurrency(Number(last.net_total))}</strong><small>{formatQuantity(Number(last.normalized_quantity))} {last.normalized_unit}</small></> : "Sem compra"}</td>
          <td data-label="Marca">{last?.brand_name || "Não informada"}</td>
          <td data-label="Média semanal">{weeklyAverage == null ? "Aguardando compra" : <>{formatQuantity(weeklyAverage)} {item.consumption_unit}/semana<small>Desde {formatDate(firstDate!)}</small></>}</td>
          <td data-label="Embalagem comprada">{last && packageQuantity != null && packageCost != null ? <>{packageName} de {formatQuantity(packageQuantity)} {last.normalized_unit}<strong>{formatCurrency(packageCost)}</strong></> : "—"}</td>
          <td data-label="Custo de uso">{unitCost == null ? "—" : `${formatUnitCost(unitCost)} / ${item.consumption_unit}`}</td>
          <td data-label="Referência">{reference ? <span className="adoce-reference-result">{item.reference_package_name} de {item.reference_quantity} {item.reference_unit}: {equivalent == null ? "aguardando preço" : `${formatCurrency(equivalent)} (equivalente)`}</span> : "Sem referência"}</td>
          <td data-label="Composição das tortas">{describeItemUsage(
            { id: item.id, name: item.name, internalCode: item.internal_code },
            usage?.items[item.id],
            data.items.map(candidate => ({ item: { id: candidate.id, name: candidate.name, internalCode: candidate.internal_code }, usage: usage?.items[candidate.id] || { used: false, cakes: [] } })),
          )}</td><td data-label="Situação e ações">

          <small>{ingredientFromPurchase(item).purchased ? item.price?.useful_quantity == null ? "Custo pela quantidade comprada" : "Custo pela quantidade útil" : "Sem preço de compra disponível"}</small>
          <button type="button" disabled={busy} onClick={() => setEditingReference({ itemId: item.id, name: item.reference_package_name || "", quantity: item.reference_quantity == null ? "" : String(item.reference_quantity), unit: item.reference_unit || "" })}>Editar embalagem de referência</button>
          {editingReference?.itemId === item.id && <form onSubmit={saveReference} className="adoce-reference-editor"><label>Nome da embalagem<input maxLength={60} value={editingReference.name} onChange={e => setEditingReference({ ...editingReference, name: e.target.value })} placeholder="Ex.: caixinha" /></label><div><label>Conteúdo padrão<input type="number" min="0.000001" step="any" value={editingReference.quantity} onChange={e => setEditingReference({ ...editingReference, quantity: e.target.value })} /></label><label>Unidade<select value={editingReference.unit} onChange={e => setEditingReference({ ...editingReference, unit: e.target.value as BaseUnit })}><option value="">Escolha</option>{referenceUnits(item.consumption_unit).map(unit => <option key={unit} value={unit}>{unit === "unit" ? "unidade" : unit}</option>)}</select></label></div><button type="submit" disabled={busy}>Salvar referência</button><button type="button" onClick={() => setEditingReference(null)}>Cancelar</button></form>}
          {item.active && item.data_status !== "validated" && item.price?.data_status === "validated" && <button type="button" disabled={busy} onClick={() => void validateItem(item.id)}>Validar item conferido</button>}
        </td></tr>;
      })}</tbody></table></div><p className="adoce-items-empty">Use a busca e os filtros para encontrar os itens. Se nenhum resultado aparecer, altere os filtros.</p></div>
      <div className="adoce-cost-list"><h4>Histórico de preços</h4><label>Item<select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}><option value="">Selecione</option>{data.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{selectedItemId ? (data.prices || []).filter(price => price.item_id === selectedItemId).map(price => <div key={price.id}><strong>{new Date(price.effective_at).toLocaleDateString("pt-BR")}</strong><span>{formatCurrency(price.purchase_price)} / {price.purchased_quantity} {price.purchase_unit} · útil: {price.useful_quantity ?? "não informada"}</span><small>{price.useful_quantity == null ? "Base: quantidade comprada" : "Base: quantidade útil"} · {price.source_note}</small></div>) : <p>Selecione um item para consultar o histórico.</p>}</div>
    </div>}
    {data && <div style={{display:tab === "shopping" ? undefined : "none"}}><CostShoppingPlanner active={tab === "shopping"} workspace={data} invoices={purchaseInvoices} flavors={data.flavors} /></div>}
    {data && (tab === "preparations" || tab === "sheets") && <div className={`adoce-cost-grid ${tab === "sheets" ? "adoce-sheet-layout" : ""}`}>
      {tab === "sheets" && <section className="adoce-preparation-list"><h4>Fichas cadastradas</h4><label>Ordenar<select value={recipeSort} onChange={e => setRecipeSort(e.target.value)}><option value="pending">Custos incompletos primeiro</option><option value="name">Nome A–Z</option><option value="desc">Nome Z–A</option></select></label><p>Margens após ingredientes, finalização, descartáveis por fatia e taxa média estimada de pagamento. Embalagens compartilhadas do pedido, gás e outros custos comerciais ainda não estão incluídos.</p><div className="adoce-margin-fee"><label>Taxa média estimada de pagamento (%)<input type="text" inputMode="decimal" value={marginFeeValue} disabled={!marginSettings || savingMarginFee} onChange={e => { setMarginFeeDraft(e.target.value); setMarginFeeNotice("Prévia recalculada. Salve para aplicar o percentual nas próximas consultas."); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void saveMarginFee(); } }} /></label><button type="button" disabled={!marginSettings || savingMarginFee} onClick={() => void saveMarginFee()}>{savingMarginFee ? "Salvando..." : "Salvar taxa"}</button>{marginSettings && <small>Estimativa inicial de 1%, baseada no relatório enviado: {formatCurrency(Number(marginSettings.reference_sales_total))} em vendas e {formatCurrency(Number(marginSettings.reference_fees_total))} em taxas, equivalentes a {weightedPaymentFeePercent([{ amount: Number(marginSettings.reference_sales_total), fee: Number(marginSettings.reference_fees_total) }])?.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% do total. Ajuste quando a proporção dos pagamentos ou as tarifas mudar.</small>}{marginFeeNotice && <small role="status" aria-live="polite">{marginFeeNotice}</small>}</div><p>O preço de venda ideal é uma referência interna por fatia. Edite o valor e saia do campo ou pressione Enter para salvar. O preço de venda atual permanece no cadastro comercial.</p><CostSheetTable><table className="adoce-items-table adoce-cost-summary-table"><thead><tr>{["Sabor / tamanho", "Rendimento", "Ingredientes da torta", "Ingredientes por fatia", "Descartáveis por fatia", "Finalização por fatia", "Custo total por fatia", "Venda por fatia", "Margem após custos e taxas", "Preço de venda ideal", "Margem no preço ideal", "Situação"].map(title => <th key={title}>{compactCostHeader(title).split("\n").map((line, index) => <span key={line}>{line}{index === 0 && compactCostHeader(title).includes("\n") ? <br /> : null}</span>)}</th>)}</tr></thead><tbody>{sheetEntries.map(({recipe,sizeCode,version,result}) => {
        const flavor = data.flavors.find(candidate => candidate.id === recipe.flavor_id);
        const packagingRows = data.components.filter(component => component.recipe_version_id === version.id && component.placement === slicePackagingSection);
        const packagingCost = engine.components(packagingRows.map(toComponent));
        const finishingRows = data.components.filter(component => component.recipe_version_id === version.id && component.placement === sliceFinishingSection);
        const finishingCost = engine.components(finishingRows.map(toComponent));
        const ingredientsCost = engine.components(data.components.filter(component => component.recipe_version_id === version.id && !isPerSliceSection(component.placement)).map(toComponent));
        const sliceCount = version.yield_unit === "slice" ? Number(version.yield_quantity) : 0;
        const packagingPerSlice = packagingCost.status === "CALCULADA" && sliceCount > 0 ? Number(packagingCost.micros) / 1000000 / sliceCount : null;
        const finishingPerSlice = finishingCost.status === "CALCULADA" && sliceCount > 0 ? Number(finishingCost.micros) / 1000000 / sliceCount : null;
        const ingredientsPerSlice = ingredientsCost.status === "CALCULADA" && sliceCount > 0 ? Number(ingredientsCost.micros) / 1000000 / sliceCount : null;
        const unitCost = result.status === "CALCULADA" && result.sliceMicros != null ? Number(result.sliceMicros) / 1000000 : null;
        const price = flavor?.base_price;
        const idealKey = `${recipe.id}:${sizeCode}`;
        const idealValue = idealPriceDrafts[idealKey] ?? Number(data.ideal_prices.find(p => p.recipe_id === recipe.id && p.size_code === sizeCode)?.ideal_sale_price ?? defaultIdealSalePrice).toFixed(2).replace(".", ",");
        const currentMargin = marginFeePercent != null ? idealSaleMargin(unitCost, price ?? null, marginFeePercent) : null;
        const idealMargin = idealPricesAvailable && marginFeePercent != null ? idealSaleMargin(unitCost, parseIdealSalePrice(idealValue), marginFeePercent) : null;
        return <tr key={version.id} className={result.status !== "CALCULADA" ? "adoce-sheet-incomplete" : undefined}>
          <td data-label="Sabor / tamanho"><strong>{flavor?.name || recipe.name} · {sizeCode}</strong>{result.status !== "CALCULADA" && <small className="adoce-cost-pending">CUSTO INCOMPLETO</small>}<button type="button" onClick={() => { setFlavorId(recipe.flavor_id || ""); setSize(sizeCode as "P" | "M" | "G" | "GG"); setSheetModalMissing(result.status === "CALCULADA" ? [] : [...new Set(result.missing)]); setSheetModalOpen(true); }}>Abrir ficha</button></td>
          <td data-label="Rendimento">{version.yield_quantity ?? "Pendente"} {version.yield_unit === "slice" ? "fatias" : version.yield_unit}</td>
          <td data-label="Ingredientes da torta">{ingredientsCost.status === "CALCULADA" ? formatCurrency(Number(costMoney(ingredientsCost.micros))) : "Custo incompleto"}</td>
          <td data-label="Ingredientes por fatia">{ingredientsPerSlice == null ? "—" : formatCurrency(ingredientsPerSlice)}</td>
          <td data-label="Descartáveis por fatia">{packagingRows.length ? packagingPerSlice == null ? "Custo incompleto" : formatCurrency(packagingPerSlice) : "Não cadastrados"}</td>
          <td data-label="Finalização por fatia">{finishingRows.length ? finishingPerSlice == null ? "Custo incompleto" : formatCurrency(finishingPerSlice) : "Não cadastrada"}</td>
          <td data-label="Custo total por fatia">{unitCost == null ? "—" : formatCurrency(unitCost)}</td>
          <td data-label="Venda por fatia">{price == null ? "Sem preço" : formatCurrency(price)}</td>
          <td data-label="Margem após custos e taxas">{currentMargin ? <><strong>{currentMargin.percent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong><small>{formatCurrency(currentMargin.amount)} por fatia</small></> : marginFeePercent == null ? "Taxa pendente" : "—"}</td>
          <td data-label="Preço de venda ideal"><span>R$</span><input className="adoce-ideal-price-input" type="text" inputMode="decimal" aria-label={`Preço de venda ideal de ${flavor?.name || recipe.name} ${sizeCode}`} value={idealPricesAvailable ? idealValue : ""} placeholder={idealPricesAvailable ? "18,00" : "Indisponível"} disabled={!idealPricesAvailable || !!savingIdealPrices[idealKey]} onChange={e => { setIdealPriceDrafts(current => ({ ...current, [idealKey]: e.target.value })); setIdealPriceNotices(current => ({ ...current, [idealKey]: "" })); }} onBlur={e => { void saveIdealPrice(recipe.id, sizeCode!, e.target.value); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} /><small role="status" aria-live="polite">{idealPriceNotices[idealKey]}</small></td>
          <td data-label="Margem no preço ideal">{idealMargin ? <><strong>{idealMargin.percent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong><small>{formatCurrency(idealMargin.amount)} por fatia</small></> : unitCost == null ? "Custo incompleto" : marginFeePercent == null ? "Taxa pendente" : "—"}</td>
          <td data-label="Situação">{result.status === "CALCULADA" ? "Custo calculado" : <details className="adoce-cost-pending"><summary><strong>CUSTO INCOMPLETO · ver pendências</strong></summary><ul>{[...new Set(result.missing)].map(message => <li key={message}>{message}</li>)}</ul></details>}</td>
        </tr>;
      })}</tbody></table></CostSheetTable>{!data.recipes.some(recipe => recipe.active && recipe.recipe_kind === "final_product") && <p>Nenhuma ficha cadastrada.</p>}</section>}
      {tab === "preparations" && <section className="adoce-preparation-list"><h4>Preparações cadastradas</h4><label>Ordenar<select value={recipeSort} onChange={e => setRecipeSort(e.target.value)}><option value="pending">Custos incompletos primeiro</option><option value="name">Nome A–Z</option><option value="desc">Nome Z–A</option><option value="unused">Sem uso primeiro</option></select></label>{data.recipes.filter(recipe => recipe.recipe_kind === "intermediate").length ? data.recipes.filter(recipe => recipe.recipe_kind === "intermediate").sort((a,b) => {
 const pending = (recipe: Recipe) => {
  const versions = data.versions.filter(v=>v.recipe_id===recipe.id && (recipe.recipe_kind==="intermediate" || latest(recipe.id,v.size_code)?.id===v.id));
  if(!versions.length)return true;
  return versions.filter(v => recipe.recipe_kind !== "intermediate" || latest(recipe.id)?.id === v.id).some(v=> recipe.recipe_kind==="intermediate" ? engine.preparation(v.id, v.yield_quantity && units.includes(v.yield_unit as Unit) ? {value:String(v.yield_quantity),unit:v.yield_unit as Unit}:undefined).status!=="CALCULADA" : engine.cake({size:(v.size_code||"G") as "P"|"M"|"G"|"GG",sections:[{name:recipe.name,components:data.components.filter(c=>c.recipe_version_id===v.id).map(toComponent)}]},v.yield_unit==="slice"?v.yield_quantity??undefined:undefined).status!=="CALCULADA");
 };
 const priority = recipeSort==="pending" ? Number(pending(b))-Number(pending(a)) : recipeSort==="unused" ? Number(usage?.preparations[a.id]?.used||false)-Number(usage?.preparations[b.id]?.used||false):0;
 return priority || (recipeSort==="desc"?-1:1)*a.name.localeCompare(b.name,"pt-BR");
}).map(recipe => {
        const version = latest(recipe.id);
        const preparationCost = version ? engine.preparation(version.id, version.yield_quantity && units.includes(version.yield_unit as Unit) ? { value: String(version.yield_quantity), unit: version.yield_unit as Unit } : undefined) : null;
        const preparationMissing = preparationCost && preparationCost.status !== "CALCULADA" ? [...new Set(preparationCost.missing)] : [];
        return <article key={recipe.id}><div><strong>{recipe.name}</strong><small>{usage?.preparations[recipe.id]?.used ? `Tortas: ${usage.preparations[recipe.id].cakes.join(" · ") || "sem torta vinculada"}` : "Sem uso em composição"}</small><small>{version ? `Versão ${version.version_number} · rendimento: ${version.yield_quantity ?? "pendente"} ${version.yield_unit || ""}` : "Sem versão salva"}</small><div className="adoce-preparation-cost">{preparationCost?.status === "CALCULADA" ? <><strong>Custo da preparação: {formatCurrency(Number(costMoney(preparationCost.micros)))}</strong><small>Custo por {version?.yield_unit === "unit" ? "unidade" : version?.yield_unit}: {formatUnitCost(Number(preparationCost.micros) / 1000000 / Number(version?.yield_quantity))}</small><small>Ingredientes da receita, pelos preços das compras cadastradas.</small></> : <div className="adoce-cost-pending"><strong>Custo incompleto · itens pendentes</strong><ul>{preparationMissing.length ? preparationMissing.map(message => <li key={message}>{message}</li>) : <li>Composição ou rendimento ausente.</li>}</ul><button type="button" onClick={() => setTab("invoices")}>Cadastrar compra para atualizar custos</button></div>}</div><small>Preparo: {version?.preparation_minutes == null ? "não informado" : `${version.preparation_minutes} min`} · Cozimento: {version?.cooking_minutes == null ? "não informado" : `${version.cooking_minutes} min`} · Resfriamento: {version?.cooling_minutes == null ? "não informado" : `${version.cooling_minutes} min`}</small></div><button type="button" onClick={() => openPreparation(recipe, preparationMissing)}>Abrir preparação</button></article>;
      }) : <p>Nenhuma preparação cadastrada. Use o formulário abaixo para criar a primeira.</p>}</section>}
      <form ref={composerRef} className={`adoce-cost-composer ${sheetModalOpen && (tab === "sheets" || tab === "preparations") ? "adoce-sheet-editor-modal" : ""}`} role={sheetModalOpen && (tab === "sheets" || tab === "preparations") ? "dialog" : undefined} aria-modal={sheetModalOpen && (tab === "sheets" || tab === "preparations") ? "true" : undefined} aria-label={sheetModalOpen && (tab === "sheets" || tab === "preparations") ? (tab === "sheets" ? "Editar ficha técnica" : "Editar preparação") : undefined} noValidate onSubmit={saveRecipe}>
        <header className="adoce-sheet-editor-header"><h4>{tab === "sheets" ? "Ficha técnica do sabor" : "Preparação base"}</h4>{sheetModalOpen && (tab === "sheets" || tab === "preparations") && <button type="button" onClick={() => setSheetModalOpen(false)} aria-label="Fechar">Fechar</button>}</header>
        {sheetModalOpen && sheetModalMissing.length > 0 && <div className="adoce-sheet-modal-errors" role="alert"><strong>Comece pela pendência destacada:</strong><ul>{sheetModalMissing.map(message => <li key={message}>{message}</li>)}</ul></div>}
        {tab === "sheets" ? <>
          <label>Sabor existente<select required value={flavorId} onChange={e => { setFlavorId(e.target.value); setRows([]); }}><option value="">Selecione</option>{data.flavors.filter(f => f.active && (f.id === flavorId || !data.recipes.some(recipe => recipe.active && recipe.recipe_kind === "final_product" && recipe.flavor_id === f.id && data.versions.some(version => version.recipe_id === recipe.id && version.size_code === size)))).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          <label>Tamanho<select value={size} onChange={e => setSize(e.target.value as typeof size)}>{["P", "M", "G", "GG"].map(s => <option key={s}>{s}</option>)}</select></label>
          <small>G é o tamanho oficial do Festival de Fatias. As preparações cadastradas já estão ajustadas para ele.</small>
          <label>Rendimento da torta (fatias)<input required type="number" min="1" step="1" value={slices} onChange={e => setSlices(e.target.value)} /></label>
        </> : <>
          <label>Preparação existente ou nova<select value={selectedRecipeId} onChange={e => { const id = e.target.value; setSelectedRecipeId(id); setRecipeName(data.recipes.find(r => r.id === id)?.name || ""); setRows([]); }}><option value="">Nova preparação</option>{data.recipes.filter(r => r.recipe_kind === "intermediate").sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true })).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          <label>Nome<input required value={recipeName} onChange={e => setRecipeName(e.target.value)} /></label>
          <label>Rendimento final<input type="number" min="0.000001" step="0.000001" value={yieldQuantity} onChange={e => setYieldQuantity(e.target.value)} placeholder="Pendente se ainda não medido" /></label>
          <label>Unidade do rendimento<select value={yieldUnit} onChange={e => setYieldUnit(e.target.value as Unit)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label>
          <fieldset className="adoce-preparation-duration"><legend>Tempos da preparação</legend>{[{ name: "Preparo", value: preparationMinutes, set: setPreparationMinutes }, { name: "Cozimento", value: cookingMinutes, set: setCookingMinutes }, { name: "Resfriamento", value: coolingMinutes, set: setCoolingMinutes }].map(field => <label key={field.name}>{field.name} (minutos)<input type="number" inputMode="numeric" min="0" max="100000" step="1" value={field.value} onChange={e => field.set(e.target.value)} placeholder="Não informado" /></label>)}<small>Registre os tempos para o futuro cálculo de energia e gás. Deixe vazio se ainda não mediu; use 0 quando a etapa não se aplica.</small></fieldset>
        </>}
        <h5>Componentes</h5>
        {tab === "sheets" && <p>Monte a torta por partes. Preparações carregam o rendimento e a composição cadastrados; insumos avulsos precisam da quantidade usada.</p>}
        {tab === "sheets" && <p>Incluídos em cada torta: Desmoldante formas — 40 g e Irrigação — 300 ml. Essas quantidades são garantidas ao salvar a ficha.</p>}
        {tab === "sheets" && flavorId && !activeVersion && <p>Os descartáveis foram sugeridos a partir da ficha G de Abacaxi com Coco e a finalização inclui 1 unidade de Calda por fatia. Confira e ajuste os itens e quantidades antes de salvar.</p>}
        {(tab === "sheets" ? [...cakeSections.map(section => section.name), ...new Set(rows.map(row => row.placement).filter(name => !cakeSections.some(section => section.name === name)))] : [""]).map(section => <fieldset className="adoce-sheet-section" key={section}>
          {section && <><legend>{section}</legend><p>{cakeSections.find(candidate => candidate.name === section)?.hint || "Componentes já cadastrados nesta etapa."}</p></>}
          {rows.map((row, index) => {
            if (tab === "sheets" && row.placement !== section) return null;
            const version = row.kind === "recipe_version" ? data.versions.find(v => v.id === row.id) : undefined;
            const recipe = version ? data.recipes.find(r => r.id === version.recipe_id) : undefined;
            const choices = data.versions.filter(v => {
              const r = data.recipes.find(candidate => candidate.id === v.recipe_id);
              return r?.recipe_kind === "intermediate" && (v.id === row.id || (r.active && latest(r.id)?.id === v.id));
            });
            return <div className="adoce-cost-row" data-row-index={index} key={index}>
              <label>Origem<select disabled={section === slicePackagingSection} value={row.kind} onChange={e => editRow(index, { kind: e.target.value as DraftRow["kind"], id: "", quantity: "", unit: "g" })}><option value="item">{section === slicePackagingSection ? "Descartável" : "Insumo"}</option><option value="recipe_version">Preparação</option></select></label>
              <label>Componente<select data-component-control required value={row.id} onChange={e => {
                if (e.target.value === "__create_item__") { setCreatingItemAt(index); return; }
                const id = e.target.value;
                const source = row.kind === "item" ? data.items.find(item => item.id === id) : data.versions.find(candidate => candidate.id === id);
                const selected = selectedComponentQuantity(row.kind, source);
                editRow(index, { id, ...selected, ...(section === sliceFinishingSection && row.kind === "recipe_version" ? { quantity: selected.unit === "unit" ? "1" : "" } : {}) });
              }}><option value="">Selecione</option>{row.kind === "item" && <option value="__create_item__">{section === slicePackagingSection ? "+ Cadastrar descartável aqui" : "+ Cadastrar novo insumo aqui"}</option>}{row.kind === "item" ? data.items.filter(i => i.active && i.item_kind === (section === slicePackagingSection ? "packaging" : "ingredient")).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true })).map(i => <option key={i.id} value={i.id}>{i.name} · {i.consumption_unit}</option>) : choices.sort((a, b) => (data.recipes.find(r => r.id === a.recipe_id)?.name || "").localeCompare(data.recipes.find(r => r.id === b.recipe_id)?.name || "", "pt-BR", { sensitivity: "base", numeric: true }) || b.version_number - a.version_number).map(v => <option key={v.id} value={v.id}>{data.recipes.find(r => r.id === v.recipe_id)?.name} · {v.yield_quantity ?? "rendimento pendente"} {v.yield_unit || ""} · v{v.version_number}</option>)}</select></label>
              <label>{row.kind === "item" ? `${isPerSliceSection(section) ? "Quantidade por fatia" : "Quantidade usada"} (${row.unit === "unit" ? "unidades" : row.unit})` : section === sliceFinishingSection ? `Quantidade por fatia (${row.unit === "unit" ? "unidades" : row.unit})` : "Quantidade da preparação usada"}<input required={tab === "sheets"} type="number" inputMode="decimal" min="0.000001" step="any" value={row.quantity} onChange={e => editRow(index, { quantity: e.target.value })} placeholder={row.kind === "item" ? "Informe a quantidade usada" : "Informe o rendimento usado"} /></label>
              <label>Unidade de uso<select value={row.unit} onChange={e => editRow(index, { unit: e.target.value as Unit, quantity: "" })}>{units.map(unit => <option key={unit} value={unit}>{unit === "unit" ? "unidade" : unit}</option>)}</select><small>Ao trocar a unidade, informe novamente a quantidade usada.</small></label>
              {version && <div className="adoce-component-summary"><strong>{recipe?.name}: uma preparação rende {version.yield_quantity ?? "quantidade pendente"} {version.yield_unit || ""}.</strong><small>{version.yield_quantity && row.quantity ? `Uso: ${formatQuantity(Number(row.quantity) / version.yield_quantity)} × a receita cadastrada. Ajuste a quantidade para usar uma parte ou mais de uma receita.` : "Cadastre o rendimento da preparação para calcular a proporção."}</small><details><summary>Ver composição cadastrada</summary><ul>{data.components.filter(c => c.recipe_version_id === version.id).map(c => <li key={c.id}>{c.component_kind === "item" ? data.items.find(item => item.id === c.item_id)?.name : data.recipes.find(r => r.id === data.versions.find(v => v.id === c.child_recipe_version_id)?.recipe_id)?.name}: {c.quantity == null ? "quantidade pendente" : formatQuantity(c.quantity)} {c.unit}</li>)}</ul></details></div>}
              {tab !== "sheets" && <label>Etapa<input list="adoce-preparation-stages" value={row.placement === "composition" ? "Composição" : row.placement === "finishing" ? "Finalização" : row.placement} onChange={e => editRow(index, { placement: e.target.value })} placeholder="Escolha ou digite outra etapa" /></label>}
              <button type="button" onClick={() => setRows(current => current.filter((_, i) => i !== index))}>Remover</button>
              {row.kind === "item" && <button type="button" onClick={() => setCreatingItemAt(index)}>{section === slicePackagingSection ? "+ Cadastrar descartável aqui" : "+ Cadastrar novo insumo aqui"}</button>}
            </div>;
          })}
          <div className="adoce-section-actions">{section !== slicePackagingSection && <button type="button" onClick={() => setRows(current => [...current, { ...newRow(), kind: "recipe_version", placement: section || "composition" }])}>+ Preparação{section ? ` em ${section.toLowerCase()}` : ""}</button>}<button type="button" onClick={() => setRows(current => [...current, { ...newRow(), placement: section || "composition" }])}>{section === slicePackagingSection ? "+ Descartável por fatia" : `+ Insumo${section ? ` em ${section.toLowerCase()}` : ""}`}</button></div>
        </fieldset>)}
        {saveNotice && <p role="status" aria-live="polite" className="adoce-cost-notice">{saveNotice}</p>}
        <div className="adoce-section-actions">
          <button type="submit" value="save" disabled={busy}>{busy ? "Salvando..." : "Salvar alterações"}</button>
          <button type="submit" value="save-and-new" disabled={busy}>Salvar e criar nova</button>
        </div>
      </form>
      <datalist id="adoce-preparation-stages"><option value="Composição" /><option value="Finalização" /></datalist>
      <aside className="adoce-cost-preview">
        <h4>Ficha atual</h4>
        {tab === "sheets" ? <>
          <p>{selectedFlavor?.name || "Escolha um sabor."} {flavorId && `· ${size}`}</p>
          <strong>{!activeVersion ? "SEM FICHA" : calculated?.status || "INCOMPLETA"}</strong>
          {activeVersion && <><p>Versão {activeVersion.version_number} · {activeVersion.version_status}</p><ul>{showExisting(activeVersion)}</ul></>}
          {calculated?.status === "CALCULADA" ? <><p>Custo total da torta com finalização e descartáveis: {formatCurrency(Number(costMoney(calculated.micros)))}</p>{calculated.sliceMicros != null && <p>Fatia: {formatCurrency(Number(costMoney(calculated.sliceMicros)))}</p>}</> : <ul>{[...new Set(calculated?.missing || [])].map((line, i) => <li key={i}>{line}</li>)}</ul>}
          {activeVersion && !data.components.some(c => c.recipe_version_id === activeVersion.id && c.placement === slicePackagingSection) && <p>Descartáveis por fatia ainda não cadastrados. O custo mostrado considera somente os componentes existentes.</p>}
          {activeVersion && <p>Rendimento cadastrado: {activeVersion.yield_unit === "slice" ? activeVersion.yield_quantity : "não informado"} fatias.</p>}
          {selectedFlavor?.base_price != null && <p>Preço atual cadastrado: {formatCurrency(selectedFlavor.base_price)}</p>}
          {calculated?.status === "CALCULADA" && calculated.sliceMicros != null && <div className="adoce-cost-sale">
            <h5>Simular uma fatia vendida</h5><p>Informe todos os valores aplicáveis. Use 0 quando não houver custo.</p>
            <label>Preço da fatia (R$)<input type="text" inputMode="numeric" value={slicePrice ? formatCurrency(Number(slicePrice)) : ""} onChange={e => setSlicePrice(moneyFromTypedDigits(e.target.value))} placeholder="R$ 0,00" /></label>
            <label>Embalagem extra desta fatia, além da ficha (R$)<input type="text" inputMode="numeric" value={itemPackaging ? formatCurrency(Number(itemPackaging)) : ""} onChange={e => setItemPackaging(moneyFromTypedDigits(e.target.value))} placeholder="R$ 0,00" /></label>
            <label>Embalagem deste pedido (R$)<input type="text" inputMode="numeric" value={orderPackaging ? formatCurrency(Number(orderPackaging)) : ""} onChange={e => setOrderPackaging(moneyFromTypedDigits(e.target.value))} placeholder="R$ 0,00" /></label>
            <label>Desconto (R$)<input type="text" inputMode="numeric" value={discount ? formatCurrency(Number(discount)) : ""} onChange={e => setDiscount(moneyFromTypedDigits(e.target.value))} placeholder="R$ 0,00" /></label>
            <label>Taxa sobre preço líquido (%)<input type="text" inputMode="numeric" value={feePercent ? `${Number(feePercent).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%` : ""} onChange={e => setFeePercent(moneyFromTypedDigits(e.target.value))} placeholder="0,00%" /></label>
            <label>Taxa fixa (R$)<input type="text" inputMode="numeric" value={fixedFee ? formatCurrency(Number(fixedFee)) : ""} onChange={e => setFixedFee(moneyFromTypedDigits(e.target.value))} placeholder="R$ 0,00" /></label>
            <label>Custo esperado da fatia grátis, incluindo embalagens (R$)<input type="text" inputMode="numeric" value={rewardCost ? formatCurrency(Number(rewardCost)) : ""} onChange={e => setRewardCost(moneyFromTypedDigits(e.target.value))} placeholder="R$ 0,00" /></label>
            {sale?.status === "CALCULADA" ? <><p>Preço líquido: {formatCurrency(Number(costMoney(sale.netMicros)))}</p><p>Custo físico: {formatCurrency(Number(costMoney(sale.physicalMicros)))}</p><p>Custo comercial: {formatCurrency(Number(costMoney(sale.commercialMicros)))}</p><p>Contribuição: {formatCurrency(Number(costMoney(sale.contributionMicros)))}</p><strong>Margem estimada: {(Number(sale.marginMillionths) / 10000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong><small>Fidelidade: provisão por 1 ponto em 14, usando o custo de recompensa informado.</small></> : <p>{sale?.status === "ERRO" ? sale.missing.join(" · ") : "Cálculo incompleto: informe embalagem, taxas e custo da recompensa."}</p>}
          </div>}
          <small>Esta simulação não modifica preços, vendas ou produção.</small>
        </> : <>{prepVersion ? <><p>{selectedRecipe?.name} · versão {prepVersion.version_number}</p><ul>{showExisting(prepVersion)}</ul></> : <p>Preparação sem versão salva.</p>}</>}
      </aside>
    </div>}
  </section>;
}

function toComponent(row: Row): Component {
  return {
    kind: row.component_kind === "item" ? "ingredient" : "preparation",
    id: (row.component_kind === "item" ? row.item_id : row.child_recipe_version_id) || "",
    quantity: row.quantity != null && units.includes(row.unit as Unit)
      ? { value: String(row.quantity), unit: row.unit as Unit } as Quantity : undefined,
  };
}

