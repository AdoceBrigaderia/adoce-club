import { Capacitor } from "@capacitor/core";
import { requireSupabase } from "./supabase";
import { buildThermalReceipt, printThermalOrder, type ThermalOrder } from "./thermal-printer";
import { queuePrint } from "./print-queue";

export async function printCashSale(id: string) {
  const {data,error} = await requireSupabase().from("instant_orders")
    .select("*,instant_order_items(*,instant_order_item_sauces(*))").eq("id",id).single();
  if(error) throw error;
  if(!data) throw Error("Não foi possível carregar o cupom.");
  const order = {...data,payments:data.payment_allocations || [],remaining_balance:Math.max(0,Number(data.total)-Number(data.amount_paid || 0))} as ThermalOrder;
  if(Capacitor.isNativePlatform()) await printThermalOrder(order,true);
  else await queuePrint(`Venda ${order.order_number}`,buildThermalReceipt(order).split("\n"));
}
