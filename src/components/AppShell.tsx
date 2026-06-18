import type { ReactNode } from 'react';
import { BarChart3, CakeSlice, Home, LogOut, MoreHorizontal, Settings, ShoppingBag, Store, Users } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { type Role, useStore } from '../store';
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
  const logoutStaff = useStore(state => state.logoutStaff);
  const seasonalTheme = useStore(state => state.seasonalTheme);
  const isClient = role === 'cliente';
  const subtitle = isClient ? 'Doces momentos, mais vantagens!' : role === 'vendedor' ? 'Vendedor' : 'Gestão da Brigaderia';
  const navItems = isClient ? clientNav : staffNav;
  const today = new Date();
  const themeActive = isClient && seasonalTheme.active && seasonalTheme.kind !== 'padrao' && (!seasonalTheme.startsAt || new Date(seasonalTheme.startsAt) <= today) && (!seasonalTheme.endsAt || new Date(seasonalTheme.endsAt) >= today);

  const surface = isClient ? 'client' : 'gestor';
  return <AdoceBackground surface={surface}><div className={`app-shell role-${role}${themeActive ? ` seasonal-${seasonalTheme.kind}` : ''}`}>
    <div className="status-bar" aria-hidden="true"><b>9:41</b><span></span><i>▮▮▮⌁▰</i></div>
    <DecorativeLayer />
    <AdoceBrandHeader subtitle={subtitle} action={<button className="header-action" aria-label={isClient ? 'Perfil' : 'Sair'} onClick={() => { if (isClient) navigate('/cliente/perfil'); else { logoutStaff(); navigate('/equipe'); } }}>{isClient ? <Users /> : <LogOut />}</button>} />
    {themeActive && <div className="seasonal-banner">{seasonalTheme.message || (seasonalTheme.kind === 'brasil' ? 'Garanta sua fatia antes do jogo' : seasonalTheme.kind === 'sao-joao' ? 'Arraiá de fatias Adoce' : 'Semana doce para compartilhar')}</div>}
    <main>{children}</main>
    <nav className="bottom-nav">{navItems.map(([href, Icon, label]) => {
      const active = location.pathname === href || (href !== '/cliente' && href !== '/admin' && location.pathname.startsWith(href));
      return <Link className={active ? 'active' : ''} to={href} key={href}><Icon /><span>{label}</span></Link>;
    })}</nav>
  </div></AdoceBackground>;
}
