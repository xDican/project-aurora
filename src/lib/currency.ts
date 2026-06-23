export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-HN", {
    style: "currency",
    currency: "HNL",
  }).format(amount);
}
