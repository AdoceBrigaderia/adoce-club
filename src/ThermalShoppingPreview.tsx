export const brandedThermalLines=(lines:string[])=>["#L ADOCE",...lines];
export default function ThermalShoppingPreview({lines}:{lines:string[]}){
 return <div className="adoce-shopping-thermal-paper"><img src="/site/adoce-logo-thermal.png" alt="Logo Cantinho da Adoce" width="144" height="144"/><pre className="adoce-shopping-receipt">{lines.join("\n")}</pre></div>;
}
