import {describe,it,expect} from 'vitest';
import {compareShoppingOffer} from './shopping-offer';
describe('comparação de embalagens',()=>{
 it('compara por kg e desconta o estoque antes de arredondar',()=>{const result=compareShoppingOffer(12,200,48,6000,1500,25)!;expect(result.perMeasure).toBe(20);expect(result.difference).toBeCloseTo(-20);expect(result.packages).toBe(2);});
 it('não sugere compra com estoque suficiente',()=>expect(compareShoppingOffer(6,500,75,2000,3000,20)?.packages).toBe(0));
 it('permite comparação por unidade sem peso artificial',()=>expect(compareShoppingOffer(100,1,20,150,20,.25,1)?.perMeasure).toBe(.2));
 it('não compara sem preço de referência',()=>expect(compareShoppingOffer(1,500,12,1000,0,null)?.difference).toBeNull());
 it('rejeita entrada incompleta e contagem fracionária',()=>{expect(compareShoppingOffer(0,200,20,1000,0,10)).toBeNull();expect(compareShoppingOffer(1.5,200,20,1000,0,10)).toBeNull();});
});
