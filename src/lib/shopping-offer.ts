export function compareShoppingOffer(units:number,weight:number,price:number,required:number,stock:number,reference:number|null,scale=1000){
 if(!Number.isSafeInteger(units)||units<=0||!Number.isFinite(weight)||weight<=0||!Number.isFinite(price)||price<=0)return null;
 const size=units*weight;
 if(!Number.isFinite(size)||size<=0)return null;
 const perMeasure=price/size*scale;
 const difference=reference!=null&&reference>0?(perMeasure/reference-1)*100:null;
 return {size,perMeasure,difference,packages:Math.max(0,Math.ceil(Math.max(0,required-stock)/size-1e-10))};
}
