import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Payment = 'Dinheiro' | 'Pix' | 'Cartão' | 'Cortesia' | 'Fidelidade';
export type Sale = {
  id: string;
  qty: number;
  value: number;
  payment: Payment;
  kind: 'Presencial' | 'Delivery / Retirada';
  seller: string;
  token: string;
  claimed: boolean;
  createdAt: string;
};

type Role = 'cliente' | 'vendedor' | 'admin';
type Family = { name: string; code: string; members: string[] };
type State = {
  role: Role;
  stamps: number;
  reward: number;
  cashOpen: boolean;
  cashFund: number;
  available: number;
  price: number;
  cost: number;
  sales: Sale[];
  family: Family | null;
  referralCode: string;
  referralBonus: boolean;
  setRole: (role: Role) => void;
  openCash: (fund: number, available: number) => void;
  addSale: (sale: Omit<Sale, 'id' | 'token' | 'claimed' | 'createdAt'>) => Sale;
  claim: (token: string) => boolean;
  createFamily: () => void;
  joinFamily: (code: string) => boolean;
  activateReferral: () => void;
  setConfig: (price: number, cost: number) => void;
};

const initialSales: Sale[] = [
  { id: 'A12', qty: 3, value: 48, payment: 'Pix', kind: 'Presencial', seller: 'Atendimento Demo', token: 'ADOCE-A12', claimed: true, createdAt: '09:35' },
  { id: 'A11', qty: 2, value: 32, payment: 'Dinheiro', kind: 'Delivery / Retirada', seller: 'Atendimento Demo', token: 'ADOCE-A11', claimed: false, createdAt: '09:20' },
];

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      role: 'cliente', stamps: 9, reward: 0, cashOpen: false, cashFund: 0,
      available: 72, price: 16, cost: 6.67, sales: initialSales,
      family: null, referralCode: 'ADOCE10', referralBonus: false,
      setRole: role => set({ role }),
      openCash: (cashFund, available) => set({ cashOpen: true, cashFund, available }),
      addSale: data => {
        const id = `A${Math.floor(100 + Math.random() * 900)}`;
        const sale = {
          ...data, id, token: `ADOCE-${id}-${Date.now().toString(36).toUpperCase()}`,
          claimed: false, createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
        set(state => ({ sales: [sale, ...state.sales] }));
        return sale;
      },
      claim: token => {
        const sale = get().sales.find(item => item.token === token);
        if (!sale || sale.claimed) return false;
        const total = get().stamps + sale.qty;
        set(state => ({
          stamps: total % 14,
          reward: state.reward + Math.floor(total / 14),
          sales: state.sales.map(item => item.token === token ? { ...item, claimed: true } : item),
        }));
        return true;
      },
      createFamily: () => set({ family: { name: 'Família Demo', code: 'FAMILIA-DOCE', members: ['Cliente Demo'] } }),
      joinFamily: code => {
        if (code.trim().toUpperCase() !== 'FAMILIA-DOCE') return false;
        set({ family: { name: 'Família Demo', code: 'FAMILIA-DOCE', members: ['Cliente Demo', 'Novo membro'] } });
        return true;
      },
      activateReferral: () => {
        if (get().referralBonus) return;
        const total = get().stamps + 1;
        set(state => ({ referralBonus: true, stamps: total % 14, reward: state.reward + Math.floor(total / 14) }));
      },
      setConfig: (price, cost) => set({ price, cost }),
    }),
    { name: 'adoce-club-demo', storage: createJSONStorage(() => localStorage) },
  ),
);
