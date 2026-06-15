import type { ReactNode } from 'react';
import { BarChart3, CakeSlice, Home, LogOut, MoreHorizontal, Settings, ShoppingBag, Store, Users } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from '../store';

const clientNav = [
  ['/cliente', Home, 'Início'],
  ['/cliente/cartao', CakeSlice, 'Cartão'],
  ['/cliente/familia', Users, 'Família'],
  ['/cliente/indicacoes', Users, 'Indique'],
  ['/cliente/mais', MoreHorizontal, 'Mais'],
] as const;

const staffNav = [
  ['/admin', Home, 'Painel'],
  ['/admin/vendas', ShoppingBag, 'Vendas'],
  ['/admin/caixa', Store, 'Caixa'],
  ['/admin/relatorios', BarChart3, 'Relatórios'],
  ['/admin/mais', Settings, 'Mais'],
] as const;

export function AppShell({ children, role = 'cliente' }: { children: ReactNode; role?: Role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isClient = role === 'cliente';
  const subtitle = isClient ? 'Doces momentos, mais vantagens!' : role === 'vendedor' ? 'Vendedor' : 'Gestão da Brigaderia';
  const navItems = isClient ? clientNav : staffNav;

  return <div className={`app-shell role-${role}`}>
    <div className="status-bar" aria-hidden="true"><b>9:41</b><span></span><i>▮▮▮⌁▰</i></div>
    <div className="decorative-bg" aria-hidden="true"><i/><i/><i/><span>✦</span><span>♡</span><span>✧</span><em>✦</em></div>
    <header className="brand-header">
      <span className="brand-logo-frame"><img className="brand-logo" src="/assets/logo-adoce.jpeg" alt="Adoce Brigaderia" /></span>
      <div className="brand-copy">
        <h1>Adoce Club <span>♥</span></h1>
        <p><b>❧</b> {subtitle} <b>❧</b></p>
      </div>
      <button className="header-action" aria-label={isClient ? 'Perfil' : 'Sair'} onClick={() => navigate(isClient ? '/cliente/perfil' : '/login')}>{isClient ? <Users /> : <LogOut />}</button>
    </header>
    <main>{children}</main>
    <nav className="bottom-nav">{navItems.map(([href, Icon, label]) => {
      const active = location.pathname === href || (href !== '/cliente' && href !== '/admin' && location.pathname.startsWith(href));
      return <Link className={active ? 'active' : ''} to={href} key={href}><Icon/><span>{label}</span></Link>;
    })}</nav>
  </div>;
}
