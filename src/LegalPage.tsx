import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import "./legal.css";

export default function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const privacy = kind === "privacy";
  return (
    <main className="legal-page">
      <header>
        <a className="legal-brand" href="/#inicio">
          <img src="/site/logo.webp" alt="Adoce Brigaderia" />
          <strong>Adoce Brigaderia</strong>
        </a>
        <a href="/#inicio"><ArrowLeft /> Voltar ao site</a>
      </header>
      <article>
        <span>{privacy ? "Privacidade e dados pessoais" : "Clube Adoce"}</span>
        <h1>{privacy ? "Política de Privacidade" : "Termos do Clube Adoce"}</h1>
        <p className="legal-version">Versão 1.0 · vigente desde 19 de julho de 2026</p>

        {privacy ? (
          <>
            <h2>Quem cuida dos seus dados</h2>
            <p>
              O tratamento é realizado por 66.349.134 FRANCISCO RUBENS PEREIRA
              BEZERRA FILHO, CNPJ 66.349.134/0001-20, responsável pela Adoce
              Brigaderia, em Fortaleza/CE.
            </p>
            <h2>Dados utilizados</h2>
            <p>
              Podemos utilizar nome, telefone, e-mail, registros de consentimento,
              participação no Clube, compras elegíveis, carimbos, recompensas,
              indicações, solicitações de encomenda, preferências informadas e
              histórico de atendimento. Não solicitamos dados sensíveis para a
              participação comum no Clube.
            </p>
            <h2>Para que utilizamos</h2>
            <ul>
              <li>Criar e proteger seu acesso ao Clube Adoce.</li>
              <li>Registrar carimbos, recompensas, indicações e grupos autorizados.</li>
              <li>Responder solicitações, preparar orçamentos e organizar a agenda.</li>
              <li>Enviar novidades somente quando houver consentimento opcional válido.</li>
              <li>Prevenir fraudes, corrigir falhas e manter auditoria da operação.</li>
            </ul>
            <h2>Compartilhamento e armazenamento</h2>
            <p>
              Utilizamos fornecedores técnicos necessários para hospedagem, banco de
              dados, autenticação e comunicação. Eles recebem somente os dados
              necessários para prestar o serviço e não podem utilizá-los para fins
              próprios incompatíveis. Não vendemos dados pessoais.
            </p>
            <h2>Seus direitos</h2>
            <p>
              Você pode solicitar confirmação, acesso, correção, informação sobre
              compartilhamento, retirada do consentimento de marketing, portabilidade
              quando aplicável e exclusão ou anonimização nos limites legais. Algumas
              informações podem ser mantidas pelo prazo necessário para cumprir
              obrigações legais e proteger a integridade das movimentações.
            </p>
            <h2>Crianças e adolescentes</h2>
            <p>
              Dados e imagens identificáveis de crianças somente serão tratados com
              autorização específica do responsável e conforme o melhor interesse da
              criança. Solicitações do Adoce na Escola devem ser feitas por um adulto.
            </p>
            <h2>Contato</h2>
            <p>
              Para exercer direitos ou tirar dúvidas, escreva para
              <a href="mailto:fcorbz@gmail.com"> fcorbz@gmail.com</a>. Este canal é
              provisório e poderá ser atualizado nesta página.
            </p>
          </>
        ) : (
          <>
            <h2>Participação</h2>
            <p>
              O Clube Adoce é o programa de fidelidade gratuito da Adoce Brigaderia.
              O participante deve informar dados verdadeiros, manter seu acesso seguro
              e comunicar qualquer uso indevido.
            </p>
            <h2>Carimbos e recompensa</h2>
            <ul>
              <li>Cada fatia tradicional ou premium paga gera um carimbo.</li>
              <li>Encomendas, tortas inteiras, docinhos e eventos não geram carimbos.</li>
              <li>Ao completar 14 carimbos, o participante recebe uma fatia tradicional grátis.</li>
              <li>Uma fatia premium pode ser escolhida mediante pagamento da diferença vigente.</li>
              <li>A recompensa fica guardada e um novo cartão começa a acumular normalmente.</li>
            </ul>
            <h2>Cartão em Grupo e Espalhe Doçura</h2>
            <p>
              Pessoas autorizadas podem acumular juntas em um Cartão em Grupo. A
              indicação confirmada na primeira compra elegível pode conceder um
              carimbo a quem entrou e um carimbo na trilha Espalhe Doçura de quem
              convidou. Autoindicação, duplicidade e uso fraudulento não geram bônus.
            </p>
            <h2>Ajustes e cancelamentos</h2>
            <p>
              Compras canceladas, lançamentos duplicados ou erros podem ser corrigidos
              por movimentação de ajuste, sem apagar o histórico. A Adoce pode bloquear
              temporariamente uma conta em caso de indício de abuso, preservando o
              direito de revisão pelo participante.
            </p>
            <h2>Disponibilidade</h2>
            <p>
              Sabores, preços e horários podem mudar. O Adoce Hoje informa a situação
              operacional, mas a disponibilidade final é confirmada no atendimento.
              Integrações identificadas como “em breve” não fazem parte do serviço ativo.
            </p>
            <h2>Contato</h2>
            <p>
              Dúvidas sobre o Clube: WhatsApp (85) 98215-6026 ou
              <a href="mailto:fcorbz@gmail.com"> fcorbz@gmail.com</a>.
            </p>
          </>
        )}

        <aside>
          {privacy ? <ShieldCheck /> : <Mail />}
          <p>
            Ao atualizar este documento, a Adoce registrará uma nova versão e solicitará
            novo aceite quando a alteração afetar direitos ou regras essenciais.
          </p>
        </aside>
      </article>
      <footer>Adoce Brigaderia · Rua Professor Odílio Filho, 227 · Passaré · Fortaleza/CE</footer>
    </main>
  );
}
