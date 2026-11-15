/* /patient-dashboard/care/cart: the prescription's prefilled medicine cart, the page WhatsApp links to (CartView). */

import type { Metadata } from "next";
import CartView from "./components/CartView";

export const metadata: Metadata = { title: "Your medicines | inrange" };

export default function CartPage() {
  return <CartView />;
}
