export default class OrderItem {
  constructor({
    prodId,
    name,
    image,
    isVeg,
    catId,
    price,
    status,
    unit,
    quantity,
  }) {
    this.prodId = prodId;
    this.name = name;
    this.image = image;
    this.isVeg = isVeg;
    this.catId = catId;
    this.price = Number(price);
    this.status = status;
    this.unit = unit;
    this.quantity = Number(quantity);
    this.totalPrice = this.price * this.quantity;
  }
}
