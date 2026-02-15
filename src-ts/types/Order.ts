export interface OrderItem {
  prodId: string;
  name: string;
  quantity: number;
}

export interface Order {
  _id: string;
  status: number;
  items: OrderItem[];
  pickupMode?: string;
  pickupTime?: string | null;
}
