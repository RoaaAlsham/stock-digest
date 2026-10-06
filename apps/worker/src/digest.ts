export type Product = {
  id: number;
  sku: string;
  name: string;
  quantity: number;
  reorder_at: number;
  updated_at: string;
};

export function findLowStock(products: Product[]): Product[] {
  return products.filter((product) => product.quantity <= product.reorder_at);
}
