import { listProducts } from "@/lib/actions/products";
import { ProductManager } from "./product-manager";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await listProducts(undefined, true);
  return <ProductManager initial={products} />;
}
