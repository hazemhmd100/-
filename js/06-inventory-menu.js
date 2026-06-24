// ═══ دفتر المقهى ═══ 06-inventory-menu.js — الجرد والمخزون + إكسل الأصناف + شاشة الأصناف
// (مقسوم من app.js — الأسطر 3402-3967)

const PURCHASE_INVENTORY_PREFIX = "purchase-stock::";

function purchaseInventoryKey(name, unit = "") {
  return `${String(name || "").trim().toLowerCase()}||${normalizeUnit(unit).toLowerCase()}`;
}

function purchaseInventoryId(key) {
  return `${PURCHASE_INVENTORY_PREFIX}${encodeURIComponent(key)}`;
}

function purchaseInventoryKeyFromId(id) {
  return decodeURIComponent(String(id || "").slice(PURCHASE_INVENTORY_PREFIX.length));
}

function isPurchaseInventoryId(id) {
  return String(id || "").startsWith(PURCHASE_INVENTORY_PREFIX);
}

function purchaseInventoryItems() {
  const rows = new Map();
  state.purchases.forEach((purchase) => {
    purchaseLines(purchase).forEach((line) => {
      const name = String(line.item || "").trim();
      const qty = purchaseLineStockQty(line);
      if (!name || qty <= 0) return;

      const unit = purchaseLineStockUnit(line);
      const key = purchaseInventoryKey(name, unit);
      const existing = rows.get(key) || {
        id: purchaseInventoryId(key),
        inventorySource: "purchase",
        purchaseKey: key,
        name,
        category: "مشتريات",
        stockUnit: unit,
        purchasedQty: 0,
        purchaseQty: 0,
        purchaseUnit: normalizeUnit(line.unit || ""),
        amount: 0,
        lineCount: 0,
        lastPurchasedAt: purchase.createdAt || ""
      };

      existing.purchasedQty += qty;
      existing.purchaseQty += Number(line.qty || 0);
      if (normalizeUnit(line.unit || "") && existing.purchaseUnit !== normalizeUnit(line.unit || "")) {
        existing.purchaseUnit = existing.purchaseUnit ? "متعدد" : normalizeUnit(line.unit || "");
      }
      existing.amount += Number(line.amount || 0);
      existing.lineCount += 1;
      if (new Date(purchase.createdAt || 0) > new Date(existing.lastPurchasedAt || 0)) {
        existing.lastPurchasedAt = purchase.createdAt || "";
      }
      rows.set(key, existing);
    });
  });

  return Array.from(rows.values()).map((row) => {
    const adjustment = state.purchaseInventoryAdjustments?.[row.purchaseKey];
    const purchasedQtyAtCount = Number(adjustment?.purchasedQtyAtCount || 0);
    const actualQtyAtCount = Number(adjustment?.actualQty || 0);
    const stockQty = adjustment
      ? Math.max(actualQtyAtCount + Number(row.purchasedQty || 0) - purchasedQtyAtCount, 0)
      : Number(row.purchasedQty || 0);

    return {
      ...row,
      stockQty,
      cost: Number(row.purchasedQty || 0) ? Number(row.amount || 0) / Number(row.purchasedQty || 0) : 0
    };
  });
}

function adjustPurchaseInventoryStock(itemId, qtyDelta) {
  if (!isPurchaseInventoryId(itemId) || !Number.isFinite(Number(qtyDelta))) return null;
  const item = inventoryItemById(itemId);
  if (!item) return null;

  const nextQty = Math.max(Number(item.stockQty || 0) + Number(qtyDelta || 0), 0);
  state.purchaseInventoryAdjustments = state.purchaseInventoryAdjustments || {};
  state.purchaseInventoryAdjustments[item.purchaseKey] = {
    actualQty: nextQty,
    purchasedQtyAtCount: Number(item.purchasedQty || 0),
    updatedAt: new Date().toISOString()
  };

  return { ...item, stockQty: nextQty };
}

function inventoryItemById(itemId) {
  if (isPurchaseInventoryId(itemId)) {
    return purchaseInventoryItems().find((item) => item.id === itemId) || null;
  }
  return findMenuItem(itemId);
}

function purchaseInventoryItemFromUsage(usage = {}) {
  const byId = usage.itemId && isPurchaseInventoryId(usage.itemId) ? inventoryItemById(usage.itemId) : null;
  if (byId) return byId;

  const name = String(usage.name || usage.purchaseItemName || "").trim().toLowerCase();
  if (!name) return null;

  const unit = normalizeUnit(usage.unit || "").toLowerCase();
  const items = purchaseInventoryItems();
  const sameName = items.filter((item) => String(item.name || "").trim().toLowerCase() === name);
  if (!sameName.length) return null;
  const sameUnit = sameName.find((item) => normalizeUnit(item.stockUnit || "").toLowerCase() === unit);
  return sameUnit || (sameName.length === 1 ? sameName[0] : null);
}

function purchaseInventoryPackageInfo(item = {}) {
  if (item.inventorySource !== "purchase") return null;
  const purchaseQty = Number(item.purchaseQty || 0);
  const purchasedQty = Number(item.purchasedQty || 0);
  const purchaseUnit = normalizeUnit(item.purchaseUnit || "");
  const stockUnit = normalizeUnit(item.stockUnit || "");
  if (!purchaseUnit || purchaseUnit === "متعدد" || purchaseQty <= 0 || purchasedQty <= 0) return null;

  const stockPerPurchase = purchasedQty / purchaseQty;
  if (!Number.isFinite(stockPerPurchase) || stockPerPurchase <= 0) return null;

  const stockQty = Number(item.stockQty || 0);
  const consumedStockQty = Math.max(purchasedQty - stockQty, 0);
  const consumedPurchaseQty = consumedStockQty / stockPerPurchase;
  const remainingPurchaseQty = stockQty / stockPerPurchase;
  const wholeConsumedPurchaseQty = Math.floor(consumedPurchaseQty + 0.000001);

  return {
    purchaseUnit,
    stockUnit,
    stockPerPurchase,
    consumedStockQty,
    consumedPurchaseQty,
    remainingPurchaseQty,
    wholeConsumedPurchaseQty
  };
}

function purchaseInventoryPackageInlineText(item = {}) {
  const info = purchaseInventoryPackageInfo(item);
  if (!info) return "";
  return `استهلكت: ${quantityWithUnit(info.consumedPurchaseQty, info.purchaseUnit)} | المتبقي يعادل: ${quantityWithUnit(info.remainingPurchaseQty, info.purchaseUnit)}`;
}

function purchaseInventoryPackageBadges(item = {}) {
  const info = purchaseInventoryPackageInfo(item);
  if (!info) return "";
  const conversionText = info.stockUnit && info.stockUnit !== info.purchaseUnit
    ? `<span>كل ${escapeHtml(info.purchaseUnit)} = ${quantityWithUnit(info.stockPerPurchase, info.stockUnit)}</span>`
    : "";
  const wholeText = info.wholeConsumedPurchaseQty > 0
    ? `<span>المكتمل: ${quantityWithUnit(info.wholeConsumedPurchaseQty, info.purchaseUnit)}</span>`
    : "";

  return `
    <div class="inventory-stock-usage">
      ${conversionText}
      <span>استهلكت: ${quantityWithUnit(info.consumedPurchaseQty, info.purchaseUnit)} (${quantityWithUnit(info.consumedStockQty, info.stockUnit)})</span>
      <span>المتبقي يعادل: ${quantityWithUnit(info.remainingPurchaseQty, info.purchaseUnit)}</span>
      ${wholeText}
    </div>
  `;
}

function currentStockQty(item) {
  return isStockTracked(item) ? Number(item.stockQty || 0) : 0;
}

function inventoryItemsForView() {
  const query = els.inventorySearchInput.value.trim().toLowerCase();
  const scope = els.inventoryScopeInput.value;
  const purchaseItems = purchaseInventoryItems();
  const menuItems = state.menu.filter((item) => isStockTracked(item));
  const items = scope === "sales" ? menuItems : scope === "all" ? purchaseItems.concat(menuItems) : purchaseItems;

  return items
    .filter((item) => {
      const packageText = purchaseInventoryPackageInlineText(item);
      const haystack = `${item.name || ""} ${item.category || ""} ${item.stockUnit || ""} ${item.purchaseUnit || ""} ${packageText} ${item.cost || ""}`;
      return searchMatch(haystack, query);
    })
    .sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`, "ar"));
}

function inventoryDifferenceText(diff, unit = "") {
  if (Math.abs(diff) <= 0.001) return "مطابق";
  return diff > 0 ? `زيادة ${quantityWithUnit(diff, unit)}` : `نقص ${quantityWithUnit(Math.abs(diff), unit)}`;
}

function renderInventoryStockPanel() {
  const items = purchaseInventoryItems();
  const totalValue = items.reduce((sum, item) => sum + Number(item.stockQty || 0) * Number(item.cost || 0), 0);
  const totalLines = items.reduce((sum, item) => sum + Number(item.lineCount || 0), 0);
  const latestDate = items
    .map((item) => item.lastPurchasedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b || 0) - new Date(a || 0))[0];

  els.inventoryStockSummary.innerHTML = `
    <article><span>مواد المخزون</span><strong>${quantityText(items.length)}</strong></article>
    <article><span>قيمة المخزون</span><strong>${money(totalValue)}</strong></article>
    <article><span>بنود الشراء</span><strong>${quantityText(totalLines)}</strong></article>
    <article><span>آخر شراء</span><strong>${latestDate ? formatDate(latestDate).slice(0, 10) : "-"}</strong></article>
  `;

  els.inventoryStockList.innerHTML = items.length
    ? items.map((item) => {
      const value = Number(item.stockQty || 0) * Number(item.cost || 0);
      const packageInline = purchaseInventoryPackageInlineText(item);
      const packageBadges = purchaseInventoryPackageBadges(item);
      return `
        <article class="inventory-stock-row">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <small>من فواتير المشتريات: ${quantityText(item.lineCount || 0)} | اشتريت: ${quantityWithUnit(item.purchaseQty || 0, item.purchaseUnit)} | حق وحدة المخزون: ${money(item.cost || 0)}${item.stockUnit ? ` / ${escapeHtml(item.stockUnit)}` : ""}${packageInline ? ` | ${escapeHtml(packageInline)}` : ""}</small>
            ${packageBadges}
          </div>
          <div class="inventory-stock-values">
            <span>${quantityWithUnit(item.stockQty, item.stockUnit)}</span>
            <strong>${money(value)}</strong>
          </div>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">لا يوجد مخزون مشتريات بعد. سجل فاتورة مشتريات حتى يظهر هنا.</div>';
}

function renderInventory() {
  renderInventoryStockPanel();
  const items = inventoryItemsForView();
  els.inventoryList.innerHTML = items.length
    ? items.map((item) => {
      const draft = inventoryDraft[item.id] || {};
      const systemQty = currentStockQty(item);
      const unit = itemUnit(item);
      const packageInline = item.inventorySource === "purchase" ? purchaseInventoryPackageInlineText(item) : "";
      const metaText = item.inventorySource === "purchase"
        ? `${escapeHtml(item.category)} | اشتريت: ${quantityWithUnit(item.purchaseQty || 0, item.purchaseUnit)} | النظام: ${stockText(item)} | حق وحدة المخزون: ${money(item.cost || 0)}${packageInline ? ` | ${escapeHtml(packageInline)}` : ""}`
        : `${escapeHtml(item.category)} | النظام: ${stockText(item)} | حق الوحدة: ${item.cost === undefined ? "غير محدد" : money(item.cost)}`;
      return `
        <article class="inventory-row" data-inventory-row="${escapeAttr(item.id)}">
          <header>
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <small>${metaText}</small>
              ${item.inventorySource === "purchase" ? purchaseInventoryPackageBadges(item) : ""}
            </div>
            <span class="inventory-status" data-inventory-diff="${escapeAttr(item.id)}">-</span>
          </header>
          <div class="inventory-fields">
            <label class="inventory-system-field">
              <span>كمية النظام</span>
              <output>${quantityWithUnit(systemQty, unit)}</output>
            </label>
            <label>
              <span>الكمية الفعلية</span>
              <input type="number" min="0" step="any" inputmode="decimal" data-inventory-actual="${escapeAttr(item.id)}" value="${escapeAttr(draft.actual || "")}" placeholder="${quantityText(systemQty)}" />
            </label>
            <label>
              <span>قيمة الفرق</span>
              <output data-inventory-value="${escapeAttr(item.id)}">-</output>
            </label>
            <label class="inventory-reason-field">
              <span>سبب الفرق</span>
              <input type="text" data-inventory-note="${escapeAttr(item.id)}" value="${escapeAttr(draft.note || "")}" placeholder="كسر، ضياع، استخدام داخلي..." />
            </label>
          </div>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">لا توجد عناصر مطابقة للجرد.</div>';

  renderInventoryHistory();
  updateInventoryCalculations();
}

function updateInventoryCalculations() {
  const rows = Array.from(els.inventoryList.querySelectorAll("[data-inventory-row]"));
  let counted = 0;
  let changed = 0;
  let positiveValue = 0;
  let negativeValue = 0;

  rows.forEach((row) => {
    const item = inventoryItemById(row.dataset.inventoryRow);
    if (!item) return;

    const actualInput = row.querySelector("[data-inventory-actual]");
    const noteInput = row.querySelector("[data-inventory-note]");
    const status = row.querySelector("[data-inventory-diff]");
    const valueOutput = row.querySelector("[data-inventory-value]");
    inventoryDraft[item.id] = {
      actual: actualInput.value,
      note: noteInput.value
    };

    if (actualInput.value === "") {
      status.textContent = "-";
      status.className = "inventory-status";
      valueOutput.textContent = "-";
      return;
    }

    const actual = Math.max(Number(actualInput.value || 0), 0);
    const systemQty = currentStockQty(item);
    const diff = actual - systemQty;
    const diffValue = diff * Number(item.cost || 0);
    counted += 1;
    if (Math.abs(diff) > 0.001) changed += 1;
    if (diffValue > 0) positiveValue += diffValue;
    if (diffValue < 0) negativeValue += Math.abs(diffValue);

    status.textContent = inventoryDifferenceText(diff, itemUnit(item));
    status.className = `inventory-status ${diff > 0.001 ? "is-plus" : diff < -0.001 ? "is-minus" : "is-clear"}`;
    valueOutput.textContent = money(diffValue);
  });

  const netValue = positiveValue - negativeValue;
  const netClass = netValue > 0.001 ? "is-plus" : netValue < -0.001 ? "is-minus" : "";
  const netLabel = netValue > 0.001 ? "ربح الجرد" : netValue < -0.001 ? "خسارة الجرد" : "صافي الجرد";

  els.inventorySummary.innerHTML = `
    <article><span>العناصر الظاهرة</span><strong>${quantityText(rows.length)}</strong></article>
    <article><span>تم عدها</span><strong>${quantityText(counted)}</strong></article>
    <article><span>فيها فرق</span><strong>${quantityText(changed)}</strong></article>
    <article class="is-plus"><span>قيمة الزيادة الكلية</span><strong>${money(positiveValue)}</strong></article>
    <article class="is-minus"><span>قيمة النقص الكلية</span><strong>${money(negativeValue)}</strong></article>
    <article class="${netClass}"><span>${netLabel}</span><strong>${money(Math.abs(netValue))}</strong></article>
  `;
}

function fillInventoryFromSystem() {
  inventoryItemsForView().forEach((item) => {
    inventoryDraft[item.id] = {
      ...(inventoryDraft[item.id] || {}),
      actual: String(currentStockQty(item))
    };
  });
  renderInventory();
}

async function saveInventoryCount() {
  const rows = Array.from(els.inventoryList.querySelectorAll("[data-inventory-row]"));
  const lines = rows.map((row) => {
    const item = inventoryItemById(row.dataset.inventoryRow);
    const actualInput = row.querySelector("[data-inventory-actual]");
    const noteInput = row.querySelector("[data-inventory-note]");
    if (!item || actualInput.value === "") return null;

    const systemQty = currentStockQty(item);
    const actualQty = Math.max(Number(actualInput.value || 0), 0);
    const difference = actualQty - systemQty;
    return {
      source: item.inventorySource || "menu",
      menuItemId: item.inventorySource === "purchase" ? null : item.id,
      purchaseKey: item.inventorySource === "purchase" ? item.purchaseKey : "",
      purchasedQtyAtCount: item.inventorySource === "purchase" ? Number(item.purchasedQty || 0) : 0,
      item: item.name,
      category: item.category,
      systemQty,
      actualQty,
      difference,
      unit: itemUnit(item),
      unitCost: Number(item.cost || 0),
      value: difference * Number(item.cost || 0),
      note: noteInput.value.trim()
    };
  }).filter(Boolean);

  if (!lines.length) {
    showToast("اكتب الكمية الفعلية لعنصر واحد على الأقل.");
    return;
  }

  const changedLines = lines.filter((line) => Math.abs(line.difference) > 0.001);
  const totalIncreaseValue = lines.reduce((sum, line) => sum + Math.max(Number(line.value || 0), 0), 0);
  const totalDecreaseValue = lines.reduce((sum, line) => sum + Math.max(-Number(line.value || 0), 0), 0);
  const netInventoryValue = totalIncreaseValue - totalDecreaseValue;
  const netInventoryText = netInventoryValue > 0.001
    ? `ربح الجرد: ${money(netInventoryValue)}`
    : netInventoryValue < -0.001
      ? `خسارة الجرد: ${money(Math.abs(netInventoryValue))}`
      : "صافي الجرد: ₪0";
  const confirmed = await appConfirm(`اعتماد الجرد؟ سيتم تعديل مخزون ${lines.length} عنصر${changedLines.length ? `، منها ${changedLines.length} فيها فرق` : ""}.\n${netInventoryText}`, { icon: "📊", danger: false });
  if (!confirmed) return;

  lines.forEach((line) => {
    if (line.source === "purchase") {
      state.purchaseInventoryAdjustments = state.purchaseInventoryAdjustments || {};
      state.purchaseInventoryAdjustments[line.purchaseKey] = {
        actualQty: line.actualQty,
        purchasedQtyAtCount: line.purchasedQtyAtCount,
        updatedAt: new Date().toISOString()
      };
      return;
    }

    const item = findMenuItem(line.menuItemId);
    if (item) {
      item.stockQty = line.actualQty;
      item.updatedAt = new Date().toISOString();
    }
  });

  const record = {
    id: uid("inventory"),
    number: `INVCOUNT-${String((state.inventoryCounts?.length || 0) + 1).padStart(4, "0")}`,
    note: els.inventoryNoteInput.value.trim(),
    lines,
    changed: changedLines.length,
    totalIncreaseValue,
    totalDecreaseValue,
    createdAt: new Date().toISOString()
  };
  record.netInventoryValue = netInventoryValue;
  record.inventoryProfitValue = Math.max(record.netInventoryValue, 0);
  record.inventoryLossValue = Math.max(-record.netInventoryValue, 0);

  state.inventoryCounts = state.inventoryCounts || [];
  state.inventoryCounts.unshift(record);
  inventoryDraft = {};
  els.inventoryNoteInput.value = "";
  showToast(`تم اعتماد الجرد ${record.number}.`);
  render();
}

function renderInventoryHistory() {
  const records = (state.inventoryCounts || []).slice(0, 10);
  els.inventoryHistoryList.innerHTML = records.length
    ? records.map((record) => {
      const netValue = Number(record.netInventoryValue ?? (Number(record.totalIncreaseValue || 0) - Number(record.totalDecreaseValue || 0)));
      const netLabel = netValue > 0.001 ? "ربح الجرد" : netValue < -0.001 ? "خسارة الجرد" : "صافي الجرد";
      const netClass = netValue > 0.001 ? "is-plus" : netValue < -0.001 ? "is-minus" : "is-clear";
      return `
      <article class="inventory-history-row">
        <header>
          <div>
            <strong>${escapeHtml(record.number || "جرد")}</strong>
            <small>${formatDate(record.createdAt)}${record.note ? ` | ${escapeHtml(record.note)}` : ""}</small>
          </div>
          <div class="inventory-history-actions">
            <span>${quantityText(record.changed || 0)} فروقات</span>
            <button class="inventory-history-delete" type="button" data-remove-inventory-count="${record.id}" title="حذف السجل" aria-label="حذف السجل">🗑</button>
          </div>
        </header>
        <div class="inventory-history-lines">
          ${(record.lines || []).filter((line) => Math.abs(Number(line.difference || 0)) > 0.001).slice(0, 6).map((line) => `
            <span>${escapeHtml(line.item)}: ${inventoryDifferenceText(Number(line.difference || 0), line.unit)}</span>
          `).join("") || "<span>لا توجد فروقات</span>"}
        </div>
        <small>قيمة الزيادة الكلية: ${money(record.totalIncreaseValue || 0)} | قيمة النقص الكلية: ${money(record.totalDecreaseValue || 0)} | <strong class="${netClass}">${netLabel}: ${money(Math.abs(netValue))}</strong></small>
      </article>
    `;
    }).join("")
    : '<div class="empty-state">لا يوجد سجل جرد بعد.</div>';
}

async function removeInventoryCount(id) {
  const record = (state.inventoryCounts || []).find((entry) => entry.id === id);
  if (!record) return;
  const confirmed = await appConfirm(`حذف سجل الجرد ${record.number || ""}؟ (لن يتغير المخزون الحالي)`);
  if (!confirmed) return;
  state.inventoryCounts = state.inventoryCounts.filter((entry) => entry.id !== id);
  saveState();
  showToast("تم حذف سجل الجرد.");
  renderInventoryHistory();
}

function downloadExcelBlob(html, filename) {
  const blob = new Blob(["﻿", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

function exportMenuExcel() {
  if (!state.menu.length) { showToast("لا يوجد أصناف للتصدير."); return; }

  const rows = state.menu.map((item) => `
    <tr>
      ${excelCell(JSON.stringify({ id: item.id, name: item.name, price: item.price, cost: item.cost, operatingCost: item.operatingCost || 0, operatingCostType: item.operatingCostType || "other", category: item.category }), 'data-field="menu-payload" style="display:none;mso-hide:all"')}
      ${excelCell(item.name)}
      ${excelCell(item.category || "")}
      ${excelCell(Number(item.price || 0))}
      ${excelCell(Number(item.cost || 0))}
      ${excelCell(Number(item.operatingCost || 0))}
      ${excelCell(operatingCostLabels[item.operatingCostType] || operatingCostLabels.other)}
      ${excelCell(menuItemRecipeCost(item))}
    </tr>
  `).join("");

  const html = `<!doctype html>
<html dir="rtl" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; font-family: Tahoma, Arial, sans-serif; direction: rtl; }
      th, td { border: 1px solid #999; padding: 6px 10px; text-align: right; vertical-align: middle; }
      th { background: #e8f4f2; font-weight: 700; }
    </style>
  </head>
  <body>
    <table>
      <thead>
        <tr>
          <th data-field="menu-payload" style="display:none;mso-hide:all">بيانات</th>
          <th>اسم الصنف</th>
          <th>التصنيف</th>
          <th>سعر البيع</th>
          <th>سعر الشراء</th>
          <th>تشغيل للوحدة</th>
          <th>نوع التشغيل</th>
          <th>التكلفة المعتمدة</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;

  downloadExcelBlob(html, `cafe-pos-menu-${new Date().toISOString().slice(0, 10)}.xls`);
  showToast(`تم تصدير ${state.menu.length} صنف Excel.`);
}

function importMenuExcel(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const doc = new DOMParser().parseFromString(String(reader.result || ""), "text/html");
      const payloadCells = Array.from(doc.querySelectorAll('td[data-field="menu-payload"]'));

      if (!payloadCells.length) {
        showToast("ملف Excel غير صحيح أو ليس من تصدير الأصناف.");
        return;
      }

      let added = 0;
      let updated = 0;

      payloadCells.forEach((cell) => {
        let data;
        try { data = JSON.parse(cell.textContent.trim()); } catch { return; }
        if (!data || !data.name) return;

        const name = String(data.name).trim();
        const price = Math.max(Number(data.price || 0), 0);
        const cost = Math.max(Number(data.cost || 0), 0);
        const operatingCost = Math.max(Number(data.operatingCost || 0), 0);
        const operatingCostType = operatingCostTypes.includes(data.operatingCostType) ? data.operatingCostType : "other";
        const category = String(data.category || "").trim();

        // ابحث بالـ id أولاً ثم بالاسم
        let existing = data.id ? state.menu.find((m) => m.id === data.id) : null;
        if (!existing) existing = state.menu.find((m) => m.name.trim() === name);

        if (existing) {
          existing.name = name;
          existing.price = price;
          existing.cost = cost;
          existing.operatingCost = operatingCost;
          existing.operatingCostType = operatingCostType;
          if (category) existing.category = category;
          existing.updatedAt = new Date().toISOString();
          updated += 1;
        } else {
          state.menu.push({
            id: data.id || uid("menu"),
            name,
            price,
            cost,
            operatingCost,
            operatingCostType,
            category: category || "عام",
            components: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          added += 1;
        }
      });

      auditAction("menu.import", { added, updated, fileName: file.name || "" });
      showToast(`تم استيراد ${added} صنف جديد${updated ? ` وتحديث ${updated}` : ""}.`);
      saveState();
      render();
    } catch (error) {
      console.warn("Could not import menu Excel", error);
      showToast("حدث خطأ أثناء قراءة الملف.");
    } finally {
      els.menuExcelImportInput.value = "";
    }
  };
  reader.readAsText(file);
}

function renderSettingsMenu() {
  const range = selectedMenuStatsRange();
  const query = els.settingsMenuSearchInput.value.trim().toLowerCase();
  const items = state.menu.filter((item) => menuMatchesSearch(item, query));
  const totals = menuProfitTotals(range, items);
  els.menuStatsRangeText.textContent = range.minDate || range.maxDate
    ? `الفترة: ${range.minDate || "البداية"} - ${range.maxDate || "اليوم"}`
    : "كل الفترات";

  els.menuStatsSummary.innerHTML = `
    <article>
      <span>${query ? "الأصناف المطابقة" : "عدد الأصناف"}</span>
      <strong>${quantityText(items.length)}</strong>
    </article>
    <article>
      <span>سعر البيع</span>
      <strong>${escapeHtml(salePriceSummary(items))}</strong>
    </article>
    <article>
      <span>إجمالي الكمية المباعة</span>
      <strong>${quantityText(totals.qty)}</strong>
    </article>
    <article>
      <span>إجمالي مبيعات الأصناف</span>
      <strong>${money(totals.sales)}</strong>
    </article>
    <article>
      <span>إجمالي ربح الأصناف</span>
      <strong>${money(totals.profit)}</strong>
    </article>
  `;

  els.settingsMenuList.innerHTML = items.length ? items.map((item) => {
    const profitStats = menuItemProfitStats(item.id, range);
    const components = menuItemComponents(item);
    const costLabel = components.length ? "تكلفة المكونات" : "شراء";
    const baseCostValue = menuItemBaseCost(item);
    const totalCostValue = menuItemRecipeCost(item);
    const operatingText = operatingCostText(item);
    const stock = menuItemDisplayStock(item);
    return `
      <article class="settings-row ${editingMenuItemId === item.id ? "is-editing" : ""}" data-menu-id="${item.id}" draggable="true">
        <div>
          <strong><span class="settings-drag-handle" title="اسحب لإعادة الترتيب" aria-hidden="true">⠿</span> ${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.category)} | بيع: ${money(item.price)} | ${costLabel}: ${item.cost === undefined && !components.length ? "غير محدد" : money(baseCostValue)}${operatingText ? ` | تشغيل ${escapeHtml(operatingText)}` : ""} | التكلفة المعتمدة: ${money(totalCostValue)} | المخزون: ${escapeHtml(stock.text)}</small>
          ${menuComponentsSummary(item)}
          <div class="settings-profit-row">
            <span>إجمالي الكمية المباعة: ${quantityText(profitStats.qty)}</span>
            <span>مبيعات الصنف: ${money(profitStats.sales)}</span>
            <span>ربح الصنف: ${money(profitStats.profit)}</span>
          </div>
        </div>
        <div class="settings-row-actions">
          <button class="settings-fav-button ${item.favorite ? "is-fav" : ""}" type="button" data-toggle-favorite="${item.id}" title="${item.favorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}" aria-label="مفضلة">${item.favorite ? "⭐" : "☆"}</button>
          <button class="settings-move-button" type="button" data-move-menu-up="${item.id}" title="تحريك لأعلى" aria-label="تحريك لأعلى">↑</button>
          <button class="settings-move-button" type="button" data-move-menu-down="${item.id}" title="تحريك لأسفل" aria-label="تحريك لأسفل">↓</button>
          <button class="settings-edit-button" type="button" data-edit-menu="${item.id}">تعديل</button>
          <button class="settings-delete-button" type="button" data-remove-menu="${item.id}">حذف</button>
        </div>
      </article>
    `;
  }).join("") : '<div class="empty-state">لا توجد أصناف مطابقة للبحث.</div>';
}

// تحريك صنف لأعلى/أسفل ضمن القائمة المعروضة (يحترم البحث الحالي)
function moveMenuItem(itemId, direction) {
  const query = els.settingsMenuSearchInput.value.trim().toLowerCase();
  const visible = state.menu.filter((item) => menuMatchesSearch(item, query));
  const vIdx = visible.findIndex((item) => item.id === itemId);
  if (vIdx === -1) return;
  const neighbor = direction === "up" ? visible[vIdx - 1] : visible[vIdx + 1];
  if (!neighbor) return; // أول أو آخر عنصر
  const aIdx = state.menu.findIndex((item) => item.id === itemId);
  const bIdx = state.menu.findIndex((item) => item.id === neighbor.id);
  if (aIdx === -1 || bIdx === -1) return;
  const temp = state.menu[aIdx];
  state.menu[aIdx] = state.menu[bIdx];
  state.menu[bIdx] = temp;
  saveState();
  renderSettingsMenu();
  renderMenu();
}

// تبديل حالة "مفضّل" لصنف (يظهر في تصنيف ⭐ المفضلة بشاشة البيع)
function toggleMenuFavorite(itemId) {
  const item = findMenuItem(itemId);
  if (!item) return;
  item.favorite = !item.favorite;
  saveState();
  renderSettingsMenu();
  renderMenu();
  showToast(item.favorite ? "تمت الإضافة للمفضلة ⭐" : "أُزيل من المفضلة.");
}

// إفلات صنف مسحوب قبل صنف الهدف (السحب بالماوس على الكمبيوتر)
function dropMenuItem(draggedId, targetId) {
  if (!draggedId || !targetId || draggedId === targetId) return;
  const from = state.menu.findIndex((item) => item.id === draggedId);
  if (from === -1) return;
  const [moved] = state.menu.splice(from, 1);
  const to = state.menu.findIndex((item) => item.id === targetId);
  if (to === -1) { state.menu.splice(from, 0, moved); return; }
  state.menu.splice(to, 0, moved);
  saveState();
  renderSettingsMenu();
  renderMenu();
}

function menuComponentsSummary(item) {
  const components = menuItemComponents(item);
  const operatingTextValue = operatingCostText(item);
  if (!components.length && !operatingTextValue) return "";
  const componentChips = components.map((component) => {
    const stockItem = inventoryItemById(component.itemId);
    const sourceName = component.purchaseItemName || stockItem?.name || "مكون غير موجود";
    return `<span>${escapeHtml(sourceName)} × ${quantityWithUnit(component.qty, component.unit || itemUnit(stockItem))}</span>`;
  });
  if (operatingTextValue) componentChips.push(`<span class="menu-operating-cost">تشغيل: ${escapeHtml(operatingTextValue)}</span>`);
  return `
    <div class="menu-components-summary">
      ${componentChips.join("")}
    </div>
  `;
}
