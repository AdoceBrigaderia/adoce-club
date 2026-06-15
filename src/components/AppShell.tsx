import type { ReactNode } from 'react';
import { BarChart3, CakeSlice, Gift, Heart, Home, LogOut, Settings, ShoppingBag, Users } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

type Role = 'cliente' | 'vendedor' | 'admin';

const clientNav = [
  ['/cliente', Home, 'Início'], ['/cliente/cartao', CakeSlice, 'Cartão'],
  ['/cliente/familia', Users, 'Família'], ['/cliente/indicacoes', Gift, 'Indique'],
] as const;
const staffNav = [
  ['/vendedor', Home, 'Início'], ['/vendedor/nova-venda', ShoppingBag, 'Vendas'],
  ['/admin/relatorios', BarChart3, 'Relatórios'], ['/admin/configuracoes', Settings, 'Mais'],
] as const;

export function AppShell({ children, role = 'cliente' }: { children: ReactNode; role?: Role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const subtitle = role === 'cliente' ? 'Doces momentos, mais vantagens!' : role === 'vendedor' ? 'Vendedor' : 'Gestão da Brigaderia';
  const navItems = role === 'cliente' ? clientNav : staffNav;

  return <div className={`app-shell role-${role}`}>
    <div className="decorative-bg" aria-hidden="true"><i/><i/><i/><span>✦</span><span>♡</span><span>✧</span></div>
    <header className="brand-header">
      <img className="brand-logo" src="/assets/logo-adoce.jpeg" alt="Adoce Brigaderia" />
      <div className="brand-copy">
        <h1>Adoce Club <Heart size={17} fill="currentColor" /></h1>
        <p><b>❧</b> {subtitle} <b>❧</b></p>
      </div>
      <button className="header-action" aria-label="Sair" onClick={() => navigate('/login')}><LogOut /></button>
    </header>
    <main>{children}</main>
    <nav className="bottom-nav">{navItems.map(([href, Icon, label]) => <Link className={location.pathname === href ? 'active' : ''} to={href} key={href}><Icon/><span>{label}</span></Link>)}</nav>
  </div>;
}
