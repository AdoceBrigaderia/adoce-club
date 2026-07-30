import React, { type ErrorInfo, type ReactNode } from "react";
import "./app-error-boundary.css";

type Props = { children: ReactNode };
type State = { failed: boolean };

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha não tratada no Portal Adoce", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="app-error-boundary" role="alert">
        <img src="/site/logo.webp" alt="Adoce Brigaderia" />
        <small>Portal Adoce</small>
        <h1>Esta tela não abriu corretamente.</h1>
        <p>
          Seus dados não foram apagados. Atualize a tela para carregar a versão
          mais recente do portal.
        </p>
        <div>
          <button type="button" onClick={this.reload}>
            Atualizar agora
          </button>
          <a href="/">Voltar para a página inicial</a>
        </div>
      </main>
    );
  }
}
