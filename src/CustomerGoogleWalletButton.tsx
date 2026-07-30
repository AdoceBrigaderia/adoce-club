import { LoaderCircle, WalletCards } from "lucide-react";
import { useState } from "react";
import { prepareGoogleWalletPass } from "./services/google-wallet";

type Props = {
  onMessage?: (message: string) => void;
};

export default function CustomerGoogleWalletButton({ onMessage }: Props) {
  const [busy, setBusy] = useState(false);

  const addToWallet = async () => {
    if (busy) return;
    setBusy(true);
    onMessage?.("");
    try {
      const prepared = await prepareGoogleWalletPass();
      const destination = new URL(prepared.save_url);
      if (
        destination.protocol !== "https:" ||
        destination.hostname !== "pay.google.com" ||
        !destination.pathname.startsWith("/gp/v/save/")
      )
        throw new Error("O endereço retornado pela Carteira do Google é inválido.");
      window.location.assign(destination.toString());
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a Carteira do Google.";
      onMessage?.(message);
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={() => void addToWallet()} disabled={busy}>
      {busy ? <LoaderCircle className="spin" /> : <WalletCards />}
      {busy ? "Preparando…" : "Adicionar ao Google Wallet"}
    </button>
  );
}
