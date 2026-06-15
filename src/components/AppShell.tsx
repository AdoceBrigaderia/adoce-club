import type { ReactNode } from 'react';
import { BarChart3, CakeSlice, Gift, Heart, Home, LogOut, Settings, ShoppingBag, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

type Role = 'cliente' | 'vendedor' | 'admin';

export function AppShell({ children, role = 'cliente' }: { children: ReactNode; role?: Role }) {
  const navigate = useNavigate();
  return <div className="app-shell">
    <header>
      <img src="/assets/logo-adoce.jpeg" alt="Adoce Brigaderia" />
      <div><h1>Adoce Club <Heart size={20} fill="currentColor" /></h1><p>{role === 'cliente' ? 'Doces momentos, mais vantagens!' : role === 'vendedor' ? 'Painel do Vendedor' : 'Gestão da Brigaderia'}</p></div>
      <button className="icon" aria-label="Sair" onClick={() => navigate('/login')}><LogOut /></button>
    </header>
    <main>{children}</main>
    <nav>{role === 'cliente' ? <>
      <Link to="/cliente"><Home />Início</Link><Link to="/cliente/cartao"><CakeSlice />Cartão</Link><Link to="/cliente/familia"><Users />Família</Link><Link to="/cliente/indicacoes"><Gift />Indique</Link>
    </> : <>
      <Link to={`/${role}`}><Home />Início</Link><Link to="/vendedor/nova-venda"><ShoppingBag />Vendas</Link><Link to="/admin/relatorios"><BarChart3 />Relatórios</Link><Link to="/admin/configuracoes"><Settings />Mais</Link>
    </>}</nav>
  </div>;
}
