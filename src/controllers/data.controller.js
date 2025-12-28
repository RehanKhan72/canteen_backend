import MongoDatasource from "../services/datasource/MongoDatasource.js";

const ds = new MongoDatasource();

export async function query(req, res) {
  const data = await ds.queryCollection(req.body);
  res.json(data);
}

export async function queryPaginated(req, res) {
  const result = await ds.queryCollectionPaginated(req.body);
  res.json(result);
}

export async function getDoc(req, res) {
  const { collection, docId } = req.params;
  const doc = await ds.getDocument({ collection, docId });
  if (!doc) return res.status(404).end();
  res.json(doc);
}

export async function setDoc(req, res) {
  const { collection, docId } = req.params;
  await ds.setDocument({ collection, docId, data: req.body });
  res.json({ success: true });
}

export async function updateDoc(req, res) {
  const { collection, docId } = req.params;
  await ds.updateDocument({ collection, docId, data: req.body });
  res.json({ success: true });
}

export async function deleteDoc(req, res) {
  const { collection, docId } = req.params;
  await ds.deleteDocument({ collection, docId });
  res.json({ success: true });
}

export async function documentExists(req, res) {
  const { collection, docId } = req.params;
  const doc = await ds.getDocument({ collection, docId });
  res.json({ exists: !!doc });
}
