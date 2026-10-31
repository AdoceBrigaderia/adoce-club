import { BookOpen, ShoppingCart, House, CalendarDays, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import "./public-mobile-nav.css";

export type PublicMobileArea = "home" | "today" | "catalog" | "orders" | "cart" | "club" | "none";

export default function PublicMobileNav({ active = "none" }: { active?: PublicMobileArea }) {
  const [hiddenByFooter, setHiddenByFooter] = useState(false);

  useEffect(() => {
    const footer = document.querySelector(".public-footer-2026");
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHiddenByFooter(entry.isIntersecting),
      { rootMargin: "0px 0px 0px 0px" },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const items = [
    { key: "home", href: "/", label: "Início", icon: House, selected: active === "home" },
    {
      key: "cardapio",
      href: "/cardapio",
      label: "Cardápio semanal",
      icon: CalendarDays,
      selected: active === "today",
    },
    { key: "catalog", href: "/catalogo", label: "Encomendas", icon: BookOpen, selected: active === "catalog" || active === "orders" },
    { key: "orders", href: "/carrinho", label: "Carrinho", icon: ShoppingCart, selected: active === "cart" },
    { key: "account", href: "/minha-conta", label: "Conta", icon: UserRound, selected: active === "club" },
  ] as const;

  return (
    <nav className={`public-mobile-nav public-shell-nav${hiddenByFooter ? " public-mobile-nav-hidden-by-footer" : ""}`} aria-label="Navegação principal">
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
