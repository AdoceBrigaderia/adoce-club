import { CakeSlice, ChevronRight, ClipboardList, CreditCard, ShoppingCart } from "lucide-react";
import "./adoce-landing-2026.css";

const choices = [
  { title: "Quero saber quais os sabores da semana", href: "/cardapio", icon: CakeSlice },
  { title: "Quero fazer um pedido online", href: "/carrinho", icon: ShoppingCart },
  { title: "Quero fazer uma encomenda", href: "/catalogo", icon: ClipboardList },
  { title: "Quero fazer parte do nosso programa de fidelidade", href: "/clube", icon: CreditCard },
] as const;

export default function AdoceLandingPage() {
  return (
    <main className="landing-2026">
      <header className="landing-hero">
        <div className="landing-welcome">
          <h1>Que bom ver você por aqui, o que você quer fazer hoje?</h1>
          <p>Escolha uma das opções abaixo para continuar.</p>
        </div>
      </header>

      <section className="landing-choices" aria-label="Escolha como a Adoce pode ajudar hoje">
        {choices.map((choice) => (
          <a className="landing-choice" href={choice.href} key={choice.href}>
            <span className="landing-choice-icon" aria-hidden="true"><choice.icon /></span>
            <h2>{choice.title}</h2>
            <ChevronRight className="landing-choice-arrow" aria-hidden="true" />
          </a>
        ))}
      </section>
    </main>
  );
}
