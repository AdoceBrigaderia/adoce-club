export type StaffAccessCode = {
  code: string;
  fullName: string;
  email: string;
  phone: string | null;
  loginUrl: string;
};

export async function generateStaffAccessCode(
  accessToken: string,
  profileId: string,
): Promise<StaffAccessCode> {
  const response = await fetch("/api/staff-access-code", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profileId }),
  });
  const body = (await response.json().catch(() => ({}))) as
    | StaffAccessCode
    | { error?: string };
  if (!response.ok || !("code" in body)) {
    throw new Error(
      "error" in body && body.error
        ? body.error
        : "Não foi possível gerar o código de acesso.",
    );
  }
  return body;
}

export function staffAccessMessage(access: StaffAccessCode): string {
  const firstName = access.fullName.trim().split(/\s+/)[0] || "cliente";
  return `Olá, ${firstName}! A Adoce gerou seu acesso ao Clube. Toque neste link para abrir a tela segura e entrar diretamente: ${access.loginUrl}\n\nSe preferir digitar, acesse https://www.adocebrigaderia.com.br/#entrar, informe o e-mail ${access.email} e use o código ${access.code}. O link e o código são temporários e de uso pessoal.`;
}

export function staffAccessWhatsAppUrl(access: StaffAccessCode): string | null {
  const digits = access.phone?.replace(/\D/g, "") || "";
  if (digits.length < 12 || digits.length > 13) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(staffAccessMessage(access))}`;
}
