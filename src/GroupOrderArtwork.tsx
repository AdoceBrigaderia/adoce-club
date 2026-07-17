import { Heart, PackageCheck, Users } from "lucide-react";
import "./group-order-artwork.css";

export default function GroupOrderArtwork() {
  return (
    <div className="group-art" role="img" aria-label="Grupo de pessoas reunindo cinco fatias em um mesmo pedido">
      <div className="group-art-people" aria-hidden="true">
        {["R", "A", "E", "M", "+"].map((letter, index) => (
          <span key={`${letter}-${index}`}>{letter}</span>
        ))}
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
