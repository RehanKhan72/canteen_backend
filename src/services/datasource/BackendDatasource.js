export default class BackendDatasource {

  // ---------- Generic CRUD ----------
  async queryCollection(params) {
    throw new Error("queryCollection not implemented");
  }

  async queryCollectionPaginated(params) {
    throw new Error("queryCollectionPaginated not implemented");
  }

  async getDocument(params) {
    throw new Error("getDocument not implemented");
  }

  async setDocument(params) {
    throw new Error("setDocument not implemented");
  }

  async updateDocument(params) {
    throw new Error("updateDocument not implemented");
  }

  async deleteDocument(params) {
    throw new Error("deleteDocument not implemented");
  }

  // ---------- Domain-specific ----------
  async getOrdersByDateRange(startDate, endDate) {
    throw new Error("getOrdersByDateRange not implemented");
  }

  async getUsersByIds(userIds) {
    throw new Error("getUsersByIds not implemented");
  }

   // 🔔 Notification-related
  async getAdminTokens() {
    throw new Error("getAdminTokens not implemented");
  }

  async getCustomerToken(orderId) {
    throw new Error("getCustomerToken not implemented");
  }

  // 📦 Orders
  async getOrderById(orderId) {
    throw new Error("getOrderById not implemented");
  }

  async updateOrderStatus(orderId, updateData) {
    throw new Error("updateOrderStatus not implemented");
  }
  
}
