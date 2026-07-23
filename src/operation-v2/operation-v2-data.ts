export type OperationTaskStatus =
  | "confirmation"
  | "payment"
  | "separating"
  | "ready"
  | "scheduled";

export type OperationTask = {
  id: string;
  customer: string;
  product: string;
  amount: number;
  time: string;
  status: OperationTaskStatus;
  phone: string;
  clubMember: boolean;
  note?: string;
};

export const OPERATION_STATUS_LABELS: Record<OperationTaskStatus, string> = {
  confirmation: "Aguardando confirmação",
  payment: "Aguardando pagamento",
  separating: "Em separação",
  ready: "Pronto para retirada",
  scheduled: "Encomendas de hoje",
};

export const OPERATION_STATUS_ORDER: OperationTaskStatus[] = [
  "confirmation",
  "payment",
  "separating",
  "ready",
  "scheduled",
];

export const INITIAL_OPERATION_TASKS: OperationTask[] = [
  {
    id: "1047",
    customer: "Juliana Martins",
    product: "Bolo de chocolate",
    amount: 95,
    time: "10:30",
    status: "confirmation",
    phone: "(85) 98765-1120",
    clubMember: true,
  },
  {
    id: "1046",
    customer: "Carlos Souza",
    product: "Kit festa",
    amount: 185,
    time: "11:00",
    status: "confirmation",
    phone: "(85) 99921-8421",
    clubMember: false,
  },
  {
    id: "1045",
    customer: "Mariana Lima",
    product: "Docinhos variados",
    amount: 75,
    time: "11:30",
    status: "confirmation",
    phone: "(85) 98874-2116",
    clubMember: true,
  },
  {
    id: "1044",
    customer: "Fernanda A.",
    product: "Torta de limão",
    amount: 90,
    time: "12:00",
    status: "confirmation",
    phone: "(85) 99608-7314",
    clubMember: false,
  },
  {
    id: "1043",
    customer: "Paula Ribeiro",
    product: "Bolo red velvet",
    amount: 120,
    time: "09:45",
    status: "payment",
    phone: "(85) 98765-4321",
    clubMember: true,
  },
  {
    id: "1042",
    customer: "Ricardo Oliveira",
    product: "Brownies (caixa)",
    amount: 65,
    time: "10:15",
    status: "payment",
    phone: "(85) 99140-2782",
    clubMember: false,
  },
  {
    id: "1041",
    customer: "Ana Beatriz",
    product: "Kit festa",
    amount: 210,
    time: "08:30",
    status: "separating",
    phone: "(85) 99770-1854",
    clubMember: true,
  },
  {
    id: "1040",
    customer: "Lucas Ferreira",
    product: "Bolo de chocolate",
    amount: 95,
    time: "09:00",
    status: "separating",
    phone: "(85) 98811-9025",
    clubMember: false,
  },
  {
    id: "1039",
    customer: "Patrícia Gomes",
    product: "Docinhos gourmet",
    amount: 80,
    time: "09:30",
    status: "separating",
    phone: "(85) 99234-7791",
    clubMember: true,
  },
  {
    id: "1038",
    customer: "Rafael Almeida",
    product: "Torta de morango",
    amount: 110,
    time: "10:00",
    status: "ready",
    phone: "(85) 99910-6623",
    clubMember: true,
    note: "Retirada confirmada para 10:00.",
  },
  {
    id: "1037",
    customer: "Sofia Nascimento",
    product: "Bolo de chocolate",
    amount: 135,
    time: "13:00",
    status: "scheduled",
    phone: "(85) 99665-3047",
    clubMember: false,
  },
];

export const formatOperationCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

