import type { ReactNode } from 'react';
import { BarChart3, CakeSlice, Home, LogOut, MoreHorizontal, Settings, ShoppingBag, Store, Users } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from '../store';
import { AdoceBackground, AdoceBrandHeader, DecorativeLayer } from './AdoceVisuals';

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

  const surface = isClient ? 'client' : 'gestor';
  return <AdoceBackground surface={surface}><div className={`app-shell role-${role}`}>
    <div className="status-bar" aria-hidden="true"><b>9:41</b><span></span><i>▮▮▮⌁▰</i></div>
    <DecorativeLayer />
    <AdoceBrandHeader subtitle={subtitle} action={<button className="header-action" aria-label={isClient ? 'Perfil' : 'Sair'} onClick={() => navigate(isClient ? '/cliente/perfil' : '/login')}>{isClient ? <Users /> : <LogOut />}</button>} />
    <main>{children}</main>
    <nav className="bottom-nav">{navItems.map(([href, Icon, label], index) => {
      const active = location.pathname === href || (href !== '/cliente' && href !== '/admin' && location.pathname.startsWith(href));
      const iconNames = isClient ? ['home', 'card', 'family', 'referral', 'more'] : ['home', 'sales', 'cash', 'reports', 'settings'];
      const iconPath = `/assets/icons/split/icon-${iconNames[index]}.png`;
      return <Link className={active ? 'active' : ''} to={href} key={href}><img className="nav-asset-icon" src={iconPath} alt="" onError={event => { event.currentTarget.style.display = 'none'; const fallback = event.currentTarget.nextElementSibling as SVGElement | null; if (fallback) fallback.style.display = 'block'; }} /><Icon style={{ display: 'none' }}/><span>{label}</span></Link>;
    })}</nav>
  </div></AdoceBackground>;
}
