import { Sparkles } from 'lucide-react';
import { useStore } from '../store';

export function LoyaltyCard({ compact = false }: { compact?: boolean }) {
  const stamps = useStore(state => state.stamps);
  return <section className="card loyalty">
    <div className="section-title"><Sparkles /><div><h2>Seu cartão fidelidade</h2><p>A cada 14 carimbos, ganhe 1 fatia grátis</p></div></div>
    <div className="stamp-grid">{Array.from({ length: 14 }, (_, index) => <div className={`stamp ${index < stamps ? 'filled' : ''}`} key={index}>{index < stamps ? <img src="/assets/carimbo-fatia.png" alt="Carimbo de fatia de torta de chocolate" /> : <span>{index + 1}</span>}</div>)}</div>
    <div className="progress" aria-label={`${stamps} de 14 carimbos`}><i style={{ width: `${stamps / 14 * 100}%` }} /></div>
    <strong className="count"><b>{stamps}</b> de 14 carimbos</strong>
    {!compact && <p className="hint">Faltam {14 - stamps} fatias para o próximo mimo.</p>}
  </section>;
}
