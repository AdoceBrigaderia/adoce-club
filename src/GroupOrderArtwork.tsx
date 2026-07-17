import { Heart, PackageCheck, UserRound, Users } from "lucide-react";
import "./group-order-artwork.css";

export default function GroupOrderArtwork() {
  return (
    <div className="group-art" role="img" aria-label="Grupo de pessoas reunindo cinco fatias em um mesmo pedido">
      <div className="group-art-people" aria-hidden="true">
        {[0, 1, 2, 3].map((person) => (
          <span key={person}><UserRound /></span>
        ))}
        <span className="group-art-more">+</span>
      </div>
      <div className="group-art-box" aria-hidden="true">
        <PackageCheck />
        <strong>5+ fatias</strong>
        <small>um pedido · um endereço</small>
      </div>
      <div className="group-art-caption"><Users /> Compra em grupo <Heart /></div>
    </div>
  );
}
