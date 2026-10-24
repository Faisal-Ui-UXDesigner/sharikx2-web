export function supplierCreditSummary(rows) {
  if (!Array.isArray(rows)) throw new Error('بيانات الرصيد الدائن غير متاحة');
  const credits = rows.filter(row => row && typeof row === 'object').map(row => ({
    id: String(row.id || ''),
    amount: Number(row.amount || 0),
    remaining_amount: Number(row.remaining_amount || 0),
    source_purchase_id: row.source_purchase_id || null,
    created_at: row.created_at || null
  })).filter(row => row.id && Number.isFinite(row.amount) && row.amount > 0 && Number.isFinite(row.remaining_amount) && row.remaining_amount > 0);
  return {credits, available: credits.reduce((sum, row) => sum + row.remaining_amount, 0)};
}
