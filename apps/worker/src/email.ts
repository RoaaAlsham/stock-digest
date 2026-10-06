import type { Product } from "./digest.ts";

export type DigestEmail = {
  to: string;
  subject: string;
  html_body: string;
  text_body: string;
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildDigestEmail(to: string, items: Product[]): DigestEmail {
  const subject = `Stock low-stock digest — ${items.length} item(s)`;
  const rows = items
    .map((item) => {
      const cells = [item.sku, item.name, String(item.quantity), String(item.reorder_at)]
        .map((value) => `<td>${escapeHtml(value)}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  const htmlBody = [
    `<h1>${escapeHtml(subject)}</h1>`,
    "<table>",
    "<thead><tr><th>SKU</th><th>Name</th><th>Quantity</th><th>Reorder at</th></tr></thead>",
    `<tbody>${rows}</tbody>`,
    "</table>",
  ].join("");
  const lines = items.map(
    (item) => `${item.sku}\t${item.name}\tqty ${item.quantity}\treorder at ${item.reorder_at}`,
  );
  return {
    to,
    subject,
    html_body: htmlBody,
    text_body: [subject, ...lines].join("\n"),
  };
}
