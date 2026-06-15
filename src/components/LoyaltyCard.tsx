import { useStore } from '../store';

export function CakeSliceStamp() {
  return <img className="cake-stamp" src="/assets/carimbo-fatia.png" alt="Carimbo de fatia de torta de chocolate" />;
}

export function LoyaltyCard({ compact = false, family = false }: { compact?: boolean; family?: boolean }) {
  const stamps = useStore(state => state.stamps);
  return <section className={`soft-card loyalty-card ${compact ? 'compact' : ''}`}>
    <div className="card-sparkles" aria-hidden="true">✦ ♡ ✧</div>
    <div className="section-heading"><span>❧</span><div><h2>{family ? 'Cartão Familiar' : 'Seu cartão fidelidade'}</h2><p>{family ? 'Todos os membros compartilham os carimbos' : 'A cada 14 carimbos, ganhe 1 fatia grátis'}</p></div><span>❧</span></div>
    <div className="stamp-grid">{Array.from({ length: 14 }, (_, index) => <div className={`stamp-slot ${index < stamps ? 'filled' : ''}`} key={index}>{index < stamps && <small>{index + 1}</small>}{index < stamps ? <CakeSliceStamp /> : <b>{index + 1}</b>}</div>)}</div>
    <div className="progress-track" aria-label={`${stamps} de 14 carimbos`}><i style={{ width: `${stamps / 14 * 100}%` }} /></div>
    <strong className="stamp-count"><b>{stamps}</b> de 14 carimbos</strong>
    {!compact && <p className="progress-note">Faltam {14 - stamps} fatias para o próximo mimo.</p>}
  </section>;
}
