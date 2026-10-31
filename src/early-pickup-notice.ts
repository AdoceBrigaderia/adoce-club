export const EARLY_PICKUP_NOTICE =
  "As fatias estarão disponíveis para retirada somente após as 18h30.";

export function shouldShowEarlyPickupNotice(currentTime: string) {
  return currentTime < "18:00";
}
