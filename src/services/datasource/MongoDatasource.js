import BackendDatasource from "./BackendDatasource.js";
import { getDb } from "../../config/mongodb.js";
import { ObjectId } from "mongodb";

class MongoDatasource extends BackendDatasource {
  collection(name) {
    return getDb().collection(name);
  }

  async queryCollection({ collection, where, orderBy, descending }) {
    const query = this._parseWhere(where);
    const sort = orderBy ? { [orderBy]: descending ? -1 : 1 } : {};

    return await this.collection(collection)
      .find(query)
      .sort(sort)
      .toArray();
  }

  async queryCollectionPaginated({
    collection,
    where,
    orderBy,
    descending,
    limit,
    startAfter,
  }) {
    const query = this._parseWhere(where);

    if (startAfter && orderBy) {
      query[orderBy] = {
        ...(descending ? { $lt: startAfter } : { $gt: startAfter }),
      };
    }

    const cursor = this.collection(collection)
      .find(query)
      .sort(orderBy ? { [orderBy]: descending ? -1 : 1 } : {})
      .limit(limit || 20);

    const docs = await cursor.toArray();
    const last = docs.length ? docs[docs.length - 1][orderBy] : null;

    return { docs, cursor: last };
  }

  async getDocument({ collection, docId }) {
    return await this.collection(collection).findOne({ _id: docId });
  }

  async setDocument({ collection, docId, data }) {
    await this.collection(collection).updateOne(
      { _id: docId },
      { $set: data },
      { upsert: true }
    );
  }

  async updateDocument({ collection, docId, data }) {
    await this.collection(collection).updateOne(
      { _id: docId },
      { $set: data }
    );
  }

  async deleteDocument({ collection, docId }) {
    await this.collection(collection).deleteOne({ _id: docId });
  }

  _parseWhere(where = {}) {
    const query = {};

    for (const key in where) {
      if (key.includes(">=")) {
        query[key.replace(">=", "").trim()] = { $gte: where[key] };
      } else if (key.includes("<=")) {
        query[key.replace("<=", "").trim()] = { $lte: where[key] };
      } else if (key.includes(">")) {
        query[key.replace(">", "").trim()] = { $gt: where[key] };
      } else if (key.includes("<")) {
        query[key.replace("<", "").trim()] = { $lt: where[key] };
      } else {
        query[key] = where[key];
      }
    }

    return query;
  }
}

export default MongoDatasource;
