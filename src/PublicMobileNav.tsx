import { ClipboardCheck, House, LayoutGrid, UserRound } from "lucide-react";
import "./public-mobile-nav.css";

export type PublicMobileArea = "home" | "today" | "orders" | "cart" | "club" | "none";

export default function PublicMobileNav({ active = "none" }: { active?: PublicMobileArea }) {
  const items = [
    { key: "home", href: "/#inicio", label: "Início", icon: House, selected: active === "home" },
    {
      key: "catalog",
      href: "/#adoce-hoje",
      label: "Cardápio",
      icon: LayoutGrid,
      selected: active === "today" || active === "orders",
    },
    { key: "orders", href: "/#carrinho", label: "Pedidos", icon: ClipboardCheck, selected: active === "cart" },
    { key: "account", href: "/#minha-conta", label: "Conta", icon: UserRound, selected: active === "club" },
  ] as const;

  return (
    <nav className="public-mobile-nav public-shell-nav" aria-label="Navegação principal">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <a key={item.key} className={item.selected ? "active" : ""} href={item.href} aria-current={item.selected ? "page" : undefined}>
            <Icon />
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
