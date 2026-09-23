import {describe,it,expect} from "vitest";
import {orderStageMessage} from "../netlify/functions/_shared/order-stage-message";
describe("avisos das etapas",()=>{
  const order={customer_name:"Maria Teste",order_number:"FAT-TEST",total:32,payment_method_code:"pix",payment_url:null,pickup_label:"Adoce",pickup_address:"Local fictício"};
  it("cobra Pix sem link e com valor",()=>{
    const message=orderStageMessage({...order,status:"awaiting_payment"});
    expect(message).toContain("pagamentos@adocebrigaderia.com.br");expect(message).toContain("32,00");expect(message).toContain("comprovante");
  });
  it("possui mensagem para cada etapa sem dados internos",()=>{
    for(const status of ["awaiting_confirmation","reserved","paid","preparing","ready","completed","cancelled","expired"]){
      expect(orderStageMessage({...order,status})).toContain("FAT-TEST");
    }
    expect(orderStageMessage({...order,status:"preparing"})).not.toMatch(/pagamento confirmado/i);
  });
  it("reserva antecipada informa previsão e não cobra nem afirma separação",()=>{
    const message=orderStageMessage({...order,status:"reserved",available_from:"18:00:00"});
    expect(message).toContain("18:00");expect(message).toContain("Aguarde antes de pagar");
    expect(message).not.toContain("pagamentos@");expect(message).not.toContain("já foram separadas");
  });
});
