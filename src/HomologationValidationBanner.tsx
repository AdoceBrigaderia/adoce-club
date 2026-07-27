export function isVisualValidationMode(value: string | undefined) {
  return value === "visual";
}

export default function HomologationValidationBanner() {
  if (!isVisualValidationMode(import.meta.env.VITE_ADOCE_VALIDATION_MODE)) {
    return null;
  }

  return (
    <aside
      className="homologation-validation-banner"
      role="status"
      aria-label="Ambiente de validação visual"
    >
      <strong>Homologação — validação visual</strong>
      <span>
        Navegue e valide as telas em celular, tablet e computador. Ações
        transacionais e integrações externas podem estar indisponíveis neste
        preview.
      </span>
    </aside>
  );
}
