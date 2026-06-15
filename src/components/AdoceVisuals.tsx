import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ScanLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ADOCE_ASSETS } from '../assets/adoceAssets';

export type AdoceSurface = 'client' | 'gestor' | 'portal';

export function AdoceBackground({ surface, children }: { surface: AdoceSurface; children: ReactNode }) {
  return <div className={`adoce-background adoce-background-${surface}`}>{children}</div>;
}

export function DecorativeLayer() {
  return <div className="adoce-decorative-layer" aria-hidden="true" />;
}

export function AdoceBrandHeader({ subtitle, action }: { subtitle: string; action: ReactNode }) {
  return <header className="brand-header">
    <span className="brand-logo-frame"><img className="brand-logo" src={ADOCE_ASSETS.branding.logo} alt="Adoce Brigaderia" /></span>
    <div className="brand-copy">
      <img className="brand-title-image" src={ADOCE_ASSETS.branding.title} alt="Adoce Club" />
      <h1 className="brand-title-fallback">Adoce Club <span>♥</span></h1>
      {subtitle !== 'Doces momentos, mais vantagens!' && <p><b>❧</b> {subtitle} <b>❧</b></p>}
    </div>
    {action}
  </header>;
}

export function AdoceCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`soft-card ${className}`.trim()}>{children}</section>;
}

export function AdoceButton({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return <button className={`${variant}-button ${className}`.trim()} {...props} />;
}

export function QrScanButton() {
  return <Link className="qr-scan-asset-button" to="/cliente/resgatar/DEMO" aria-label="Escanear QR Code">
    <img src={ADOCE_ASSETS.buttons.qr} alt="" aria-hidden="true" />
    <span className="sr-only"><ScanLine /> Escanear QR Code</span>
  </Link>;
}
