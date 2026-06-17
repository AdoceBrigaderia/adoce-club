import { useStore } from '../store';
import { ADOCE_ASSETS } from '../assets/adoceAssets';

export function CakeSliceStamp() {
  return <img className="cake-stamp" src={ADOCE_ASSETS.stamps.alt} alt="Carimbo de fatia de torta de chocolate" />;
}

export function LoyaltyCard({ compact = false, family = false }: { compact?: boolean; family?: boolean }) {
  const stamps = useStore(state => state.stamps);
  const goal = useStore(state => state.settings.stampGoal);
  const safeGoal = Math.max(1, goal || 14);
  return <section className={`soft-card loyalty-card ${compact ? 'compact' : ''}`}>
    <div className="card-sparkles" aria-hidden="true">✦ ♡ ✧</div>
    <div className="section-heading"><span>❧</span><div><h2>{family ? 'Cartão Familiar' : 'Seu cartão fidelidade'}</h2><p>{family ? 'Todos os membros compartilham os carimbos' : `A cada ${safeGoal} carimbos, ganhe 1 fatia grátis`}</p></div><span>❧</span></div>
    <div className="stamp-grid">{Array.from({ length: safeGoal }, (_, index) => <div className={`stamp-slot ${index < stamps ? 'filled' : ''}`} key={index}>{index < stamps && <small>{index + 1}</small>}{index < stamps ? <CakeSliceStamp /> : <b>{index + 1}</b>}</div>)}</div>
    <div className="progress-track" aria-label={`${stamps} de ${safeGoal} carimbos`}><i style={{ width: `${Math.min(100, stamps / safeGoal * 100)}%` }} /></div>
    <strong className="stamp-count"><b>{stamps}</b> de {safeGoal} carimbos</strong>
    {!compact && <p className="progress-note">Faltam {Math.max(0, safeGoal - stamps)} fatias para o próximo mimo.</p>}
  </section>;
}
