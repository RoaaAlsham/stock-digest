export type Product = {
  id: number;
  sku: string;
  name: string;
  quantity: number;
  reorder_at: number;
  updated_at: string;
};

export type Digest = {
  id: number;
  created_at: string;
  item_count: number;
  items: Product[];
};

type DigestRow = {
  id: number;
  created_at: string;
  item_count: number;
  items_json: string;
};

const PRODUCT_COLUMNS = "id, sku, name, quantity, reorder_at, updated_at";

function toDigest(row: DigestRow): Digest {
  const items = JSON.parse(row.items_json) as Product[];
  return {
    id: row.id,
    created_at: row.created_at,
    item_count: row.item_count,
    items,
  };
}

export async function listProducts(db: D1Database): Promise<Product[]> {
  const result = await db
    .prepare(`SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY sku`)
    .all<Product>();
  return result.results;
}

export async function getProduct(db: D1Database, sku: string): Promise<Product | null> {
  return await db
    .prepare(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE sku = ?`)
    .bind(sku)
    .first<Product>();
}

export async function adjustProduct(
  db: D1Database,
  sku: string,
  delta: number,
): Promise<Product | null> {
  const current = await getProduct(db, sku);
  if (!current) {
    return null;
  }
  const quantity = Math.max(0, current.quantity + delta);
  const updatedAt = new Date().toISOString();
  await db
    .prepare("UPDATE products SET quantity = ?, updated_at = ? WHERE sku = ?")
    .bind(quantity, updatedAt, sku)
    .run();
  return await getProduct(db, sku);
}

export async function createDigest(db: D1Database, items: Product[]): Promise<Digest> {
  const createdAt = new Date().toISOString();
  const itemsJson = JSON.stringify(items);
  const inserted = await db
    .prepare("INSERT INTO digests (created_at, item_count, items_json) VALUES (?, ?, ?)")
    .bind(createdAt, items.length, itemsJson)
    .run();
  const row = await db
    .prepare("SELECT id, created_at, item_count, items_json FROM digests WHERE id = ?")
    .bind(inserted.meta.last_row_id)
    .first<DigestRow>();
  if (!row) {
    throw new Error("digest insert failed");
  }
  return toDigest(row);
}

export async function listDigests(db: D1Database): Promise<Digest[]> {
  const result = await db
    .prepare(
      "SELECT id, created_at, item_count, items_json FROM digests ORDER BY id DESC LIMIT 20",
    )
    .all<DigestRow>();
  return result.results.map((row) => toDigest(row));
}
