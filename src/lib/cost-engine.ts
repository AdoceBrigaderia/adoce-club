// Valores monetários internos usam micros de real; entradas decimais são lidas sem float binário.
export type Unit = "g" | "kg" | "ml" | "l" | "unit";
export type Quantity = { value: string; unit: Unit };
export type CostResult =
  | { status: "INCOMPLETA" | "ERRO"; missing: string[] }
  | { status: "CALCULADA"; micros: bigint; trace: CostTrace[] };
export type CostTrace = { label: string; micros: bigint; children?: CostTrace[] };
export type Ingredient = {
  id: string; name: string; purchasePrice?: string; purchased?: Quantity;
  useful?: Quantity; active?: boolean;
};
export type Component = { kind: "ingredient" | "preparation"; id: string; quantity?: Quantity };
export type Preparation = { id: string; name: string; yield?: Quantity; components: Component[] };
export type SheetVariant = { size: "P" | "M" | "G" | "GG"; sections: { name: string; components: Component[] }[] };
export type SaleInput = {
  slices: number;
  sliceProductionMicros: bigint;
  grossUnitPrice: string;
  discountTotal: string;
  itemPackagingMicros: bigint;
  orderPackagingMicros: bigint;
  percentageFee: string;
  fixedFee: string;
  loyalty:
    | { mode: "none" }
    | { mode: "provision"; pointsGranted: number; pointsNeeded: number; expectedRewardMicros: bigint }
    | { mode: "redemption"; realizedRewardMicros: bigint; releasedProvisionMicros: bigint };
};
export type SaleResult =
  | { status: "ERRO"; missing: string[] }
  | {
    status: "CALCULADA"; grossMicros: bigint; netMicros: bigint;
    physicalMicros: bigint; commercialMicros: bigint; contributionMicros: bigint;
    marginMillionths: bigint; trace: CostTrace[];
  };

const SCALE = 1_000_000n;
const DIMENSION: Record<Unit, string> = { g: "mass", kg: "mass", ml: "volume", l: "volume", unit: "count" };
const FACTOR: Record<Unit, bigint> = { g: 1n, kg: 1000n, ml: 1n, l: 1000n, unit: 1n };

export function decimal(value: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) throw new Error(`Número inválido: ${value}`);
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0") || "0");
}

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Divisão por zero ou quantidade inválida");
  return (numerator + denominator / 2n) / denominator;
}

function baseQuantity(quantity: Quantity): bigint {
  const amount = decimal(quantity.value);
  if (amount <= 0n) throw new Error("Quantidade deve ser positiva");
  return amount * FACTOR[quantity.unit];
}

function converted(quantity: Quantity, target: Unit): bigint {
  if (DIMENSION[quantity.unit] !== DIMENSION[target]) throw new Error(`Unidades incompatíveis: ${quantity.unit} e ${target}`);
  return baseQuantity(quantity);
}

export function money(micros: bigint): string {
  if (micros < 0n) return `-${money(-micros)}`;
  const cents = divideRounded(micros, 10_000n);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

export function calculateSale(input: SaleInput): SaleResult {
  try {
    if (!Number.isSafeInteger(input.slices) || input.slices <= 0) throw new Error("Quantidade de fatias inválida");
    if ([input.sliceProductionMicros, input.itemPackagingMicros, input.orderPackagingMicros].some(value => value < 0n))
      throw new Error("Custo negativo inválido");
    const gross = decimal(input.grossUnitPrice) * BigInt(input.slices);
    const discount = decimal(input.discountTotal);
    if (discount > gross) throw new Error("Desconto excede preço bruto");
    const net = gross - discount;
    const feeRate = decimal(input.percentageFee);
    if (feeRate >= SCALE) throw new Error("Taxa percentual inválida");
    const fee = divideRounded(net * feeRate, SCALE) + decimal(input.fixedFee);
    const physical = input.sliceProductionMicros * BigInt(input.slices);
    const packaging = input.itemPackagingMicros * BigInt(input.slices) + input.orderPackagingMicros;
    let loyalty = 0n;
    if (input.loyalty.mode === "provision") {
      if (!Number.isSafeInteger(input.loyalty.pointsNeeded) || input.loyalty.pointsNeeded <= 0 ||
        !Number.isSafeInteger(input.loyalty.pointsGranted) || input.loyalty.pointsGranted < 0 ||
        input.loyalty.expectedRewardMicros < 0n) throw new Error("Configuração de fidelidade inválida");
      loyalty = divideRounded(input.loyalty.expectedRewardMicros * BigInt(input.loyalty.pointsGranted), BigInt(input.loyalty.pointsNeeded));
    } else if (input.loyalty.mode === "redemption") {
      if (input.loyalty.realizedRewardMicros < 0n || input.loyalty.releasedProvisionMicros < 0n)
        throw new Error("Custo de resgate inválido");
      // O custo realizado já contém produção, embalagem e taxa desta venda.
      loyalty = input.loyalty.realizedRewardMicros - input.loyalty.releasedProvisionMicros
        - physical - packaging - fee;
    }
    const commercial = packaging + fee + loyalty;
    const contribution = net - physical - commercial;
    const marginMillionths = net > 0n ? contribution * SCALE / net : 0n;
    return { status: "CALCULADA", grossMicros: gross, netMicros: net, physicalMicros: physical,
      commercialMicros: commercial, contributionMicros: contribution, marginMillionths,
      trace: [{ label: "Produção", micros: physical }, { label: "Embalagens", micros: packaging },
        { label: "Taxas", micros: fee }, { label: "Fidelidade", micros: loyalty }] };
  } catch (error) {
    return { status: "ERRO", missing: [(error as Error).message] };
  }
}

export class CostEngine {
  constructor(private ingredients: Map<string, Ingredient>, private preparations: Map<string, Preparation>) {}

  ingredient(id: string, quantity?: Quantity): CostResult {
    const item = this.ingredients.get(id);
    if (!item || item.active === false) return { status: "INCOMPLETA", missing: [`Insumo ${id} inexistente ou inativo`] };
    if (!quantity) return { status: "INCOMPLETA", missing: [`${item.name}: quantidade de uso não informada`] };
    if (!item.purchasePrice || !item.purchased) return { status: "INCOMPLETA", missing: [`${item.name}: preço ou quantidade de compra não cadastrados`] };
    try {
      const bought = baseQuantity(item.purchased);
      const useful = item.useful ? converted(item.useful, item.purchased.unit) : bought;
      if (useful > bought) throw new Error("Rendimento útil excede a compra");
      const used = converted(quantity, item.purchased.unit);
      const micros = divideRounded(decimal(item.purchasePrice) * used, useful);
      return { status: "CALCULADA", micros, trace: [{ label: item.name, micros }] };
    } catch (error) {
      return { status: "ERRO", missing: [`${item.name}: ${(error as Error).message}`] };
    }
  }

  preparation(id: string, quantity?: Quantity, path: string[] = []): CostResult {
    const recipe = this.preparations.get(id);
    if (!recipe) return { status: "INCOMPLETA", missing: [`Preparação ${id} ausente`] };
    if (path.includes(id)) return { status: "ERRO", missing: [`Dependência circular: ${[...path, id].join(" → ")}`] };
    if (!recipe.yield || !quantity || !recipe.components.length) return { status: "INCOMPLETA", missing: [`${recipe.name}: rendimento, consumo ou composição ausente`] };
    const total = this.components(recipe.components, [...path, id]);
    if (total.status !== "CALCULADA") return total;
    try {
      const consumed = converted(quantity, recipe.yield.unit);
      const micros = divideRounded(total.micros * consumed, baseQuantity(recipe.yield));
      return { status: "CALCULADA", micros, trace: [{ label: recipe.name, micros, children: total.trace }] };
    } catch (error) {
      return { status: "ERRO", missing: [`${recipe.name}: ${(error as Error).message}`] };
    }
  }

  components(components: Component[], path: string[] = []): CostResult {
    let micros = 0n;
    const trace: CostTrace[] = [];
    const missing: string[] = [];
    let error = false;
    for (const component of components) {
      const result = component.kind === "ingredient"
        ? this.ingredient(component.id, component.quantity)
        : this.preparation(component.id, component.quantity, path);
      if (result.status === "CALCULADA") { micros += result.micros; trace.push(...result.trace); }
      else { missing.push(...result.missing); error ||= result.status === "ERRO"; }
    }
    return missing.length ? { status: error ? "ERRO" : "INCOMPLETA", missing } : { status: "CALCULADA", micros, trace };
  }

  cake(variant?: SheetVariant, slices?: number): CostResult & { sliceMicros?: bigint } {
    if (!variant) return { status: "INCOMPLETA", missing: ["Tamanho sem ficha"] };
    if (!variant.sections.length || variant.sections.every(section => !section.components.length))
      return { status: "INCOMPLETA", missing: ["Ficha sem componentes"] };
    const result = this.components(variant.sections.flatMap(section => section.components));
    if (result.status !== "CALCULADA") return result;
    if (slices === undefined) return result;
    if (!Number.isSafeInteger(slices) || slices <= 0) return { status: "ERRO", missing: ["Rendimento em fatias inválido"] };
    return { ...result, sliceMicros: divideRounded(result.micros, BigInt(slices)) };
  }
}
