// ═══ دفتر المقهى ═══ 09-actions.js — التسديد، الطباعة، نسخ احتياطي، حفظ المشتريات والأصناف
// (مقسوم من app.js — الأسطر 4540-4987)

function recordSettlement(event) {
  event.preventDefault();
  const customer = getCustomer(selectedCustomerId);
  const amount = Math.max(Number(els.settlementAmountInput.value || 0), 0);
  const method = paymentMethods.includes(els.settlementMethodInput.value) ? els.settlementMethodInput.value : getLastPaymentMethod();
  const payoutMode = customer && Number(customer.balance || 0) < -0.001;
  const debtMode = settlementDebtMode && !payoutMode;
  const discount = !payoutMode && !debtMode ? Math.max(Number(els.settlementDiscountInput.value || 0), 0) : 0;
  const settlementValue = amount + discount;

  if (!customer) {
    showToast("اختر عميل أولاً.");
    return;
  }
  if (debtMode && !requireManagerPermission("customer.manualDebt", "إضافة دين يدوي")) return;
  if (payoutMode && !requireManagerPermission("customer.payout", "دفع رصيد للعميل")) return;
  if ((debtMode || payoutMode) && amount <= 0) {
    showToast(debtMode ? "اكتب مبلغ الدين." : payoutMode ? "اكتب مبلغ الدفع للعميل." : "اكتب مبلغ الدفعة.");
    return;
  }
  if (!debtMode && !payoutMode && settlementValue <= 0) {
    showToast("اكتب مبلغ الدفعة أو الخصم.");
    return;
  }
  if (payoutMode && amount > Math.abs(Number(customer.balance || 0)) + 0.001) {
    showToast("المبلغ أكبر من رصيد العميل.");
    return;
  }
  if (!debtMode && !payoutMode && discount > 0 && settlementValue > Number(customer.balance || 0) + 0.001) {
    showToast("المبلغ مع الخصم أكبر من دين العميل.");
    return;
  }

  customer.updatedAt = new Date().toISOString();

  if (debtMode) {
    const note = els.settlementNoteInput.value.trim();
    customer.balance += amount;
    customer.totalBilled += amount;
    const invoice = {
      id: uid("debt"),
      number: nextInvoiceNumber(),
      type: "debt",
      customerId: customer.id,
      customerName: customer.name,
      tableLabel: "-",
      items: [],
      subtotal: amount,
      discount: 0,
      total: amount,
      paid: 0,
      delta: amount,
      payments: { cash: 0, bank: 0, wallet: 0 },
      status: "debt",
      note: note || "دين مضاف يدوياً",
      createdAt: new Date().toISOString()
    };
    state.invoices.unshift(invoice);
    lastClosedInvoice = invoice;
    els.settlementAmountInput.value = "";
    els.settlementNoteInput.value = "";
    showToast(`تم تسجيل دين ${money(amount)} على ${customer.name}.`);
    render();
    return;
  }

  setLastPaymentMethod(method);
  if (payoutMode) {
    customer.balance += amount;
    customer.totalPaid = Math.max(0, Number(customer.totalPaid || 0) - amount);
  } else {
    customer.balance -= settlementValue;
    customer.totalPaid += amount;
  }
  const invoice = {
    id: uid(payoutMode ? "payout" : "payment"),
    number: nextInvoiceNumber(),
    type: payoutMode ? "payout" : "payment",
    customerId: customer.id,
    customerName: customer.name,
    tableLabel: "-",
    items: [],
    subtotal: 0,
    discount: payoutMode ? 0 : discount,
    total: 0,
    paid: amount,
    delta: payoutMode ? amount : -settlementValue,
    payments: { cash: method === "cash" ? amount : 0, bank: method === "bank" ? amount : 0, wallet: method === "wallet" ? amount : 0 },
    status: payoutMode ? "payout" : "payment",
    note: payoutMode ? `دفع للعميل عبر ${paymentLabels[method]}` : `تسديد عبر ${paymentLabels[method]}`,
    createdAt: new Date().toISOString()
  };
  state.invoices.unshift(invoice);
  lastClosedInvoice = invoice;
  els.settlementAmountInput.value = "";
  els.settlementDiscountInput.value = "";
  els.settlementMethodInput.value = getLastPaymentMethod();
  showToast(payoutMode ? "تم تسجيل دفع الرصيد للعميل." : discount > 0 ? `تم تسجيل الدفعة مع خصم ${money(discount)}.` : "تم تسجيل الدفعة على الحساب.");
  render();
}

function printInvoice(invoice) {
  if (!invoice) {
    showToast("الفاتورة غير موجودة.");
    return;
  }

  const host = document.createElement("div");
  host.className = "print-host";
  const node = els.printTemplate.content.cloneNode(true);
  const titleEl = node.querySelector("h1");
  if (titleEl) titleEl.textContent = state.businessName || "دفتر المقهى";

  const cancelled = typeof invoiceIsCancelled === "function" && invoiceIsCancelled(invoice);
  const original = cancelled && typeof cancelledInvoiceOriginal === "function" ? cancelledInvoiceOriginal(invoice) : null;
  const customer = getCustomer(invoice.customerId);
  const total = Number(original?.total ?? invoice.total ?? 0);
  const subtotal = Number(original?.subtotal ?? invoice.subtotal ?? total);
  const discount = Number(original?.discount ?? invoice.discount ?? 0);
  const paid = Number(original?.paid ?? invoice.paid ?? 0);
  const changeReturned = Number(original?.changeReturned ?? invoice.changeReturned ?? 0);
  const received = Number(original?.received ?? invoice.received ?? (paid + changeReturned));
  const delta = Number(original?.delta ?? invoice.delta ?? (total - paid));
  const paymentText = cancelled ? "ملغاة" : invoicePaymentText(invoice);

  const metaRows = [
    ["رقم الفاتورة", invoice.number || "-"],
    ["التاريخ", formatDate(invoice.createdAt)],
    ["الطاولة", invoice.tableLabel || "-"],
    ["العميل", invoice.customerName || "زبون نقدي"],
    customer?.phone ? ["الجوال", customer.phone] : null,
    ["الدفع", paymentText]
  ].filter(Boolean);

  node.querySelector(".print-meta").innerHTML = metaRows
    .map(([label, value]) => `<span><b>${escapeHtml(label)}:</b> ${escapeHtml(value)}</span>`)
    .join("");

  node.querySelector(".print-lines").innerHTML = invoice.items?.length
    ? invoice.items.map((item) => `
      <p>
        <span class="pl-name">${escapeHtml(item.name)} <small>×${item.qty} @ ${money(item.price)}</small></span>
        <span class="pl-amt">${money(Number(item.qty || 0) * Number(item.price || 0))}</span>
      </p>
    `).join("")
    : `<p><span class="pl-name">${escapeHtml(invoice.note || (invoice.type === "debt" ? "دين بدون أصناف" : "حركة حساب"))}</span><span class="pl-amt">${money(total || paid)}</span></p>`;

  node.querySelector(".print-total").innerHTML = `
    ${cancelled ? `<p class="print-cancelled">الفاتورة ملغاة${invoice.cancelledReason ? `: ${escapeHtml(invoice.cancelledReason)}` : ""}</p>` : ""}
    ${subtotal > 0 && Math.abs(subtotal - total) > 0.001 ? `<p><span>المجموع قبل الخصم</span><strong>${money(subtotal)}</strong></p>` : ""}
    ${discount > 0 ? `<p><span>الخصم</span><strong>${money(discount)}</strong></p>` : ""}
    <p><span>${cancelled ? "أصل الصافي" : "الصافي"}</span><strong>${money(total)}</strong></p>
    ${received > paid && changeReturned > 0 ? `<p><span>المستلم</span><strong>${money(received)}</strong></p><p><span>الراجع للعميل</span><strong>${money(changeReturned)}</strong></p>` : ""}
    <p><span>${cancelled ? "أصل المدفوع" : "المدفوع"}</span><strong>${money(paid)}</strong></p>
    ${!cancelled && delta > 0.001 ? `<p><span>المتبقي دين</span><strong>${money(delta)}</strong></p>` : ""}
    ${!cancelled && delta < -0.001 ? `<p><span>رصيد للعميل</span><strong>${money(Math.abs(delta))}</strong></p>` : ""}
    <p><span>الحالة</span><strong>${statusText(invoice.status)}</strong></p>
  `;

  host.appendChild(node);
  const invoiceWrap = host.querySelector(".print-invoice");
  if (invoiceWrap) {
    invoiceWrap.classList.toggle("is-cancelled-print", cancelled);
    const footer = document.createElement("p");
    footer.className = "print-footer";
    footer.textContent = cancelled ? "نسخة توثيقية لفاتورة ملغاة" : "شكراً لزيارتكم";
    invoiceWrap.appendChild(footer);
  }
  document.body.appendChild(host);
  window.print();
  host.remove();
}

function printLastInvoice() {
  if (!lastClosedInvoice) {
    showToast("لا توجد فاتورة مطبوعة بعد.");
    return;
  }

  printInvoice(lastClosedInvoice);
}

function printInvoiceById(invoiceId) {
  printInvoice(state.invoices.find((invoice) => invoice.id === invoiceId));
}

function backupPayload() {
  saveState();
  return JSON.stringify({
    ...state,
    exportedAt: new Date().toISOString(),
    backupNote: "نسخة احتياطية كاملة من دفتر المقهى"
  }, null, 2);
}

function backupFileName() {
  const name = (typeof businessName === "function" ? businessName() : "cafe-pos").replace(/[\\/:*?"<>|]/g, "").trim() || "cafe-pos";
  const now = new Date();
  const localDate = new Date(Date.now() - now.getTimezoneOffset() * 60000);
  const datePart = localDate.toISOString().slice(0, 10);
  const suffix = now.getHours() >= 12 ? "PM" : "AM";
  const hour = String(now.getHours() % 12 || 12).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  const timestamp = `${datePart}-${hour}-${minute}-${second}-${suffix}`;
  return `${name}-backup-${timestamp}.json`;
}

async function saveBackupToLocalServer(payload, fileName) {
  if (!location.protocol.startsWith("http")) return false;
  try {
    const response = await fetch("./api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, payload })
    });
    if (!response.ok) return false;
    const result = await response.json();
    return Boolean(result && result.ok);
  } catch (error) {
    return false;
  }
}

function downloadBackupFallback(payload, fileName) {
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 1000);
}

async function exportData() {
  const payload = backupPayload();
  const fileName = backupFileName();
  const serverSaved = await saveBackupToLocalServer(payload, fileName);
  if (serverSaved) markBackupDone();

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: "ملف نسخة احتياطية JSON",
          accept: { "application/json": [".json"] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(payload);
      await writable.close();
      showToast(serverSaved ? "تم حفظ النسخة في مجلد backups وفي المكان الذي اخترته." : "تم حفظ النسخة الاحتياطية في المكان الذي اخترته.");
      markBackupDone();
      renderBackupCenter();
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
      console.warn("save picker failed", error);
      showToast("تعذر فتح اختيار المكان، تم تنزيل النسخة بدل ذلك.");
    }
  } else {
    showToast("متصفحك لا يدعم اختيار مكان الحفظ، تم تنزيل النسخة بدل ذلك.");
  }

  downloadBackupFallback(payload, fileName);
  markBackupDone();
  renderBackupCenter();
}

// ─── نسخة احتياطية تلقائية يومية ────────────────────────────────
function hasAnyData() {
  return Boolean(
    (state.invoices && state.invoices.length) ||
    (state.customers && state.customers.length) ||
    (state.purchases && state.purchases.length) ||
    (state.workers && state.workers.length) ||
    (state.workerConsumptions && state.workerConsumptions.length)
  );
}

async function maybeAutoDailyBackup() {
  try {
    if (state.autoBackup === false) return;
    const today = todayDateInputValue();
    if (state.lastAutoBackup === today) return;
    if (!hasAnyData()) { state.lastAutoBackup = today; saveState(); return; }
    const payload = backupPayload();
    const name = (typeof businessName === "function" ? businessName() : "cafe-pos").replace(/[\\/:*?"<>|]/g, "").trim() || "cafe-pos";
    const serverSaved = await saveBackupToLocalServer(payload, `${name}-auto-${today}.json`);
    if (!serverSaved) downloadBackupFallback(payload, `${name}-auto-${today}.json`);
    state.lastAutoBackup = today;
    saveState();
    renderBackupCenter();
    showToast(serverSaved ? "تم حفظ نسخة احتياطية تلقائية في مجلد backups." : "تم تنزيل نسخة احتياطية تلقائية لليوم 💾");
  } catch (error) {
    console.warn("auto backup failed", error);
  }
}

function renderAutoBackupSetting() {
  const cb = document.getElementById("autoBackupToggle");
  const status = document.getElementById("autoBackupStatus");
  if (cb) cb.checked = state.autoBackup !== false;
  if (status) status.textContent = state.lastAutoBackup ? `آخر نسخة تلقائية: ${state.lastAutoBackup}` : "ما تم أخذ نسخة تلقائية بعد.";
}

async function shareBackup() {
  const payload = backupPayload();
  const fileName = backupFileName();
  const file = new File([payload], fileName, { type: "application/json" });

  // جرّب مشاركة الملف عبر نظام الجهاز (واتساب/درايف/...)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "نسخة احتياطية — دفتر المقهى",
        text: "نسخة احتياطية من بيانات المحل"
      });
      showToast("تم فتح المشاركة — اختر واتساب أو درايف.");
      markBackupDone();
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return; // المستخدم ألغى
      console.warn("share failed", error);
    }
  }

  // الجهاز ما يدعم مشاركة الملفات → ننزّله عادي
  showToast("جهازك لا يدعم المشاركة المباشرة — تم تنزيل النسخة بدلاً من ذلك.");
  await exportData();
}

function isBackupImportCandidate(parsed) {
  return parsed && typeof parsed === "object" && (
    parsed.backupNote ||
    parsed.exportedAt ||
    Array.isArray(parsed.invoices) ||
    Array.isArray(parsed.customers) ||
    Array.isArray(parsed.menu)
  );
}

function importBackupSummaryText(nextState) {
  const health = dataHealthReport(nextState);
  const lines = [
    `فواتير: ${nextState.invoices.length}`,
    `عملاء: ${nextState.customers.length}`,
    `أصناف: ${nextState.menu.length}`,
    `عمال: ${nextState.workers.length}`,
    `إغلاقات: ${(nextState.periodCloses || []).length}`
  ];
  if (!health.ok) lines.push(`ملاحظات: ${health.issues.join("، ")}`);
  return lines.join("\n");
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!isBackupImportCandidate(parsed)) {
        showToast("ملف النسخة لا يشبه نسخة صادرة من البرنامج.");
        return;
      }

      const nextState = normalizeState(parsed);
      const confirmed = await appConfirm(`استيراد النسخة سيستبدل البيانات الحالية.\n\n${importBackupSummaryText(nextState)}\n\nهل تريد المتابعة؟`);
      if (!confirmed) return;

      const beforePayload = backupPayload();
      await saveBackupToLocalServer(beforePayload, `before-import-${backupFileName()}`);
      state = {
        ...nextState,
        view: "invoices",
      };
      auditAction("backup.import", {
        fileName: file.name || "",
        invoices: state.invoices.length,
        customers: state.customers.length,
        menu: state.menu.length
      });
      selectedCustomerId = state.customers[0]?.id || null;
      selectedWorkerId = state.workers[0]?.id || null;
      lastClosedInvoice = state.invoices[0] || null;
      showToast("تم استيراد النسخة.");
      render();
      renderBackupCenter();
    } catch (error) {
      showToast("ملف النسخة غير صحيح.");
    }
  };
  reader.readAsText(file);
}

async function restoreLatestLocalBackup() {
  const snapshot = latestLocalBackupSnapshot();
  const nextState = snapshotState(snapshot);
  if (!snapshot || !nextState) {
    showToast("لا توجد نسخة داخلية صالحة للاسترجاع.");
    renderBackupCenter();
    return;
  }

  const confirmed = await appConfirm(
    `استرجاع آخر نسخة داخلية سيستبدل البيانات الحالية.\n\nآخر نسخة: ${formatDate(snapshot.createdAt)}\n${importBackupSummaryText(nextState)}\n\nهل تريد المتابعة؟`,
    { icon: "↩", yesLabel: "استرجاع", cancelLabel: "إلغاء" }
  );
  if (!confirmed) return;

  const beforePayload = backupPayload();
  await saveBackupToLocalServer(beforePayload, `before-local-restore-${backupFileName()}`);
  state = {
    ...nextState,
    view: "guide"
  };
  auditAction("backup.restore", {
    restoredAt: snapshot.createdAt || "",
    invoices: state.invoices.length,
    customers: state.customers.length,
    menu: state.menu.length
  });
  selectedCustomerId = state.customers[0]?.id || null;
  selectedWorkerId = state.workers[0]?.id || null;
  lastClosedInvoice = state.invoices[0] || null;
  setLastPaymentMethod(getLastPaymentMethod());
  markBackupDone();
  saveState(true);
  showToast("تم استرجاع آخر نسخة داخلية.");
  render();
}

function addPurchase(event) {
  event.preventDefault();
  const menuItemId = ENABLE_LINKING ? els.purchaseMenuItemInput.value || "" : "";
  const typedItem = els.purchaseItemInput.value.trim();
  const menuItem = ENABLE_LINKING ? menuItemId ? findMenuItem(menuItemId) : findMenuItemByName(typedItem) : null;
  const item = typedItem || "";
  const qty = Number(els.purchaseQtyInput.value || 0);
  const unit = normalizeUnit(els.purchaseUnitInput.value || (ENABLE_LINKING ? itemUnit(menuItem) : ""));
  const stockPerUnit = Number(els.purchaseStockQtyInput.value || 0);
  const stockQty = stockPerUnit > 0 ? qty * stockPerUnit : qty;
  const stockUnit = normalizeUnit(els.purchaseStockUnitInput.value || unit);
  const amount = Number(els.purchaseAmountInput.value || 0);
  const unitCost = stockQty > 0 ? amount / stockQty : 0;

  if (!item || amount <= 0 || qty <= 0 || stockQty <= 0) {
    showToast("اكتب اسم الصنف والكمية والمبلغ وكمية المخزون.");
    return;
  }

  purchaseDraftItems.push({
    id: uid("purchase-line"),
    menuItemId: ENABLE_LINKING ? menuItem?.id || null : null,
    linkedItemName: ENABLE_LINKING ? menuItem?.name || "" : "",
    item,
    qty,
    unit,
    stockPerUnit: stockPerUnit > 0 ? stockPerUnit : 1,
    stockQty,
    stockUnit,
    unitCost,
    amount
  });

  resetPurchaseLineInputs();
  showToast("تمت إضافة الصنف لفاتورة المشتريات.");
  render();
}

function purchaseDraftLineFromStoredLine(line) {
  const qty = Number(line.qty || 0);
  const amount = Number(line.amount || 0);
  const stockQty = purchaseLineStockQty(line) || qty;
  const stockPerUnit = purchaseLineStockPerUnit(line) || 1;
  const stockUnit = purchaseLineStockUnit(line) || normalizeUnit(line.unit || "");
  return {
    id: line.id || uid("purchase-line"),
    menuItemId: ENABLE_LINKING ? line.menuItemId || null : null,
    linkedItemName: ENABLE_LINKING ? line.linkedItemName || purchaseLinkedItemName(line) : "",
    item: line.item || "مشتريات",
    qty,
    unit: normalizeUnit(line.unit || (ENABLE_LINKING ? itemUnit(findMenuItem(line.menuItemId)) : "")),
    stockPerUnit,
    stockQty,
    stockUnit,
    unitCost: Number(line.unitCost ?? (stockQty ? amount / stockQty : 0)),
    amount
  };
}

function revertPurchaseStock(purchase) {
  if (!ENABLE_LINKING) return;
  purchaseLines(purchase).forEach((line) => {
    if (line.menuItemId && purchaseLineStockQty(line) > 0) {
      adjustMenuStock(line.menuItemId, -purchaseLineStockQty(line));
    }
  });
}

function applyPurchaseLinesToStock(lines) {
  if (!ENABLE_LINKING) {
    return lines.map((line) => ({
      ...line,
      menuItemId: null,
      linkedItemName: "",
      stockAfter: null
    }));
  }
  return lines.map((line) => {
    const stockQty = purchaseLineStockQty(line);
    const stockUnit = purchaseLineStockUnit(line);
    const stockItem = line.menuItemId ? adjustMenuStock(line.menuItemId, stockQty) : null;
    if (stockItem && stockUnit) {
      stockItem.stockUnit = stockUnit;
    }
    if (stockItem && purchaseLineUnitCost(line) > 0) {
      stockItem.cost = purchaseLineUnitCost(line);
    }
    return {
      ...line,
      stockAfter: stockItem ? stockItem.stockQty : null
    };
  });
}

function resetPurchaseInvoiceForm() {
  editingPurchaseId = null;
  purchaseDraftItems = [];
  els.purchaseSupplierInput.value = "";
  els.purchaseNoteInput.value = "";
  els.purchaseMethodInput.value = getLastPaymentMethod();
  if (els.purchasePaidInput) els.purchasePaidInput.value = "";
  resetPurchaseLineInputs();
}

// ─── تسديد للمورّد + عرض الموردين بالدين ─────────────────────
function renderSupplierDebts() {
  const totalBox = document.getElementById("supplierDebtTotalBox");
  const list = document.getElementById("supplierDebtList");
  const datalist = document.getElementById("supplierNameOptions");
  if (!list) return;
  const balances = supplierBalances();
  const totalOwed = balances.reduce((sum, entry) => sum + Math.max(entry.owed, 0), 0);

  if (totalBox) {
    totalBox.innerHTML = `
      <span>إجمالي الدين للموردين</span>
      <strong>${money(totalOwed)}</strong>
      <small>${balances.filter((b) => b.owed > 0.001).length} مورّد عليهم دين</small>`;
  }
  if (datalist) {
    const names = Array.from(new Set((state.purchases || []).map((p) => String(p.supplier || "").trim()).filter(Boolean)));
    datalist.innerHTML = names.map((n) => `<option value="${escapeAttr(n)}"></option>`).join("");
  }

  list.innerHTML = balances.length
    ? balances.map((entry) => `
        <article class="purchase-line-card supplier-debt-row">
          <div>
            <strong>${escapeHtml(entry.supplier)}</strong>
            <small>${entry.owed > 0 ? "باقي عليك" : "دفعت زيادة (رصيد لك)"}</small>
          </div>
          <span class="${entry.owed > 0 ? "supplier-owed" : "supplier-credit"}">${money(Math.abs(entry.owed))}</span>
          ${entry.owed > 0.001 ? `<button class="secondary-button" type="button" data-pay-supplier="${escapeAttr(entry.supplier)}">تسديد</button>` : ""}
        </article>`).join("")
    : '<div class="empty-state">لا يوجد دين للموردين. أي مشتريات تتركها "المدفوع الآن" أقل من الإجمالي بتظهر هنا.</div>';
}

function paySupplier(event) {
  if (event) event.preventDefault();
  const nameEl = document.getElementById("supplierPayNameInput");
  const amountEl = document.getElementById("supplierPayAmountInput");
  const methodEl = document.getElementById("supplierPayMethodInput");
  const supplier = (nameEl?.value || "").trim();
  const amount = Math.max(Number(amountEl?.value || 0), 0);
  const method = paymentMethods.includes(methodEl?.value) ? methodEl.value : getLastPaymentMethod();
  if (!supplier) { showToast("اكتب اسم المورّد."); return; }
  if (amount <= 0) { showToast("اكتب مبلغ التسديد."); return; }
  state.supplierPayments.unshift({
    id: uid("suppay"),
    supplier,
    amount,
    method,
    note: "",
    createdAt: new Date().toISOString()
  });
  setLastPaymentMethod(method);
  if (nameEl) nameEl.value = "";
  if (amountEl) amountEl.value = "";
  if (typeof auditAction === "function") auditAction("supplier.payment", { supplier, amount, method });
  saveState();
  showToast(`تم تسجيل تسديد ${money(amount)} للمورّد ${supplier}.`);
  render();
}

function savePurchaseInvoice() {
  if (!purchaseDraftItems.length) {
    showToast("أضف صنف واحد على الأقل لفاتورة المشتريات.");
    return;
  }

  const editingPurchase = editingPurchaseId ? state.purchases.find((purchase) => purchase.id === editingPurchaseId) : null;
  if (editingPurchaseId && !editingPurchase) {
    resetPurchaseInvoiceForm();
    showToast("فاتورة المشتريات غير موجودة.");
    render();
    return;
  }

  const method = paymentMethods.includes(els.purchaseMethodInput.value) ? els.purchaseMethodInput.value : getLastPaymentMethod();
  const supplier = els.purchaseSupplierInput.value.trim();
  const note = els.purchaseNoteInput.value.trim();
  setLastPaymentMethod(method);

  if (editingPurchase) revertPurchaseStock(editingPurchase);

  const items = applyPurchaseLinesToStock(purchaseDraftItems);
  const amount = items.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  // المدفوع الآن: فارغ = مدفوع كامل؛ غير ذلك يُقصّ بين 0 والإجمالي، والباقي دين للمورّد.
  const paidRaw = els.purchasePaidInput ? els.purchasePaidInput.value.trim() : "";
  const paidAmount = paidRaw === "" ? amount : Math.min(Math.max(Number(paidRaw || 0), 0), amount);
  const invoice = editingPurchase || {
    id: uid("purchase"),
    number: nextPurchaseNumber()
  };

  Object.assign(invoice, {
    type: "purchase-invoice",
    supplier,
    items,
    qty: items.reduce((sum, line) => sum + Number(line.qty || 0), 0),
    stockQty: items.reduce((sum, line) => sum + purchaseLineStockQty(line), 0),
    amount,
    paidAmount,
    method,
    note,
    createdAt: editingPurchase?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  if (!editingPurchase) state.purchases.unshift(invoice);
  state.purchases.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  resetPurchaseInvoiceForm();
  if (editingPurchase) {
    auditAction("purchase.edit", {
      number: invoice.number,
      amount,
      supplier,
      itemCount: items.length
    });
    showToast(`تم حفظ تعديل فاتورة المشتريات ${invoice.number} وتحديث مخزون الجرد.`);
  } else {
    auditAction("purchase.create", {
      number: invoice.number,
      amount,
      supplier,
      itemCount: items.length
    });
    showToast(`تم تسجيل فاتورة المشتريات ${invoice.number} وإضافتها لمخزون الجرد.`);
  }
  render();
}

async function startEditPurchase(purchaseId) {
  const purchase = state.purchases.find((entry) => entry.id === purchaseId);
  if (!purchase) return;
  if (!guardClosedPeriod(purchase.createdAt, "تعديل فاتورة المشتريات")) return;
  if (purchaseDraftItems.length && editingPurchaseId !== purchaseId) {
    const confirmed = await appConfirm("استبدال فاتورة المشتريات الحالية ببيانات الفاتورة المختارة للتعديل؟");
    if (!confirmed) return;
  }

  editingPurchaseId = purchase.id;
  purchaseDraftItems = purchaseLines(purchase).map(purchaseDraftLineFromStoredLine);
  els.purchaseSupplierInput.value = purchase.supplier || "";
  els.purchaseMethodInput.value = paymentMethods.includes(purchase.method) ? purchase.method : getLastPaymentMethod();
  els.purchaseNoteInput.value = purchase.note || "";
  if (els.purchasePaidInput) {
    const debt = purchaseSupplierDebt(purchase);
    els.purchasePaidInput.value = debt > 0.001 ? inputNumberValue(purchasePaidAmount(purchase)) : "";
  }
  resetPurchaseLineInputs();
  render();
  els.purchaseDraftBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removePurchase(id) {
  const purchase = state.purchases.find((entry) => entry.id === id);
  if (!purchase) return;
  if (!guardClosedPeriod(purchase.createdAt, "حذف فاتورة المشتريات")) return;
  const confirmed = await appConfirm(`حذف فاتورة المشتريات ${purchase.number || ""} بقيمة ${money(purchaseAmount(purchase))}؟`);
  if (!confirmed) return;
  revertPurchaseStock(purchase);
  state.purchases = state.purchases.filter((purchase) => purchase.id !== id);
  auditAction("purchase.delete", {
    number: purchase.number || "",
    amount: purchaseAmount(purchase),
    supplier: purchase.supplier || ""
  });
  if (editingPurchaseId === id) resetPurchaseInvoiceForm();
  showToast("تم حذف فاتورة المشتريات.");
  render();
}

function recordGeneralExpense(event) {
  event.preventDefault();
  const title = els.generalExpenseTitleInput.value.trim();
  const amount = Math.max(Number(els.generalExpenseAmountInput.value || 0), 0);
  const method = paymentMethods.includes(els.generalExpenseMethodInput.value)
    ? els.generalExpenseMethodInput.value
    : getLastPaymentMethod();
  const createdAt = invoiceDateFromInput(els.generalExpenseDateInput.value);

  if (!title) {
    showToast("اكتب اسم المصروف.");
    els.generalExpenseTitleInput.focus();
    return;
  }
  if (amount <= 0) {
    showToast("اكتب مبلغ المصروف.");
    els.generalExpenseAmountInput.focus();
    return;
  }
  if (!guardClosedPeriod(createdAt, "تسجيل مصروف ضمن فترة مغلقة")) return;

  const expense = normalizeExpense({
    id: uid("expense"),
    type: "general",
    title,
    amount,
    method,
    note: els.generalExpenseNoteInput.value.trim(),
    createdAt
  });

  state.expenses = state.expenses || [];
  state.expenses.unshift(expense);
  auditAction("expense.create", {
    id: expense.id,
    title: expense.title,
    amount: expense.amount,
    method: expense.method,
    createdAt: expense.createdAt
  });
  setLastPaymentMethod(method);
  els.generalExpenseForm.reset();
  els.generalExpenseDateInput.value = todayDateInputValue();
  els.generalExpenseMethodInput.value = getLastPaymentMethod();
  showToast(`تم تسجيل مصروف ${expense.title}: ${money(expense.amount)}.`);
  render();
}

async function removeGeneralExpense(expenseId) {
  const expense = (state.expenses || []).find((entry) => entry.id === expenseId);
  if (!expense) return;
  if (!guardClosedPeriod(expense.createdAt, "حذف مصروف ضمن فترة مغلقة")) return;
  const confirmed = await appConfirm(`حذف مصروف "${expense.title}" بقيمة ${money(expense.amount)}؟`);
  if (!confirmed) return;

  state.expenses = (state.expenses || []).filter((entry) => entry.id !== expenseId);
  auditAction("expense.delete", {
    id: expense.id,
    title: expense.title,
    amount: expense.amount,
    method: expense.method,
    createdAt: expense.createdAt
  });
  showToast("تم حذف المصروف العام.");
  render();
}

function setMenuFormMode(item = null) {
  editingMenuItemId = item?.id || null;
  els.menuFormTitle.textContent = item ? "تعديل صنف" : "إضافة صنف";
  els.menuSubmitButton.textContent = item ? "حفظ التعديل" : "إضافة الصنف";
  els.menuCancelEditButton.hidden = !item;

  if (!item) {
    menuComponentDraft = [];
    menuOptionsDraft = [];
    els.menuForm.reset();
    els.menuOperatingCostTypeInput.value = "other";
    renderMenuComponentsEditor();
    renderMenuOptionsEditor();
    return;
  }

  menuComponentDraft = normalizeMenuComponents(item.components || [], item.id);
  menuOptionsDraft = normalizeMenuOptions(item.options || []);
  els.menuNameInput.value = item.name || "";
  els.menuPriceInput.value = inputNumberValue(item.price);
  els.menuCostInput.value = inputNumberValue(item.cost);
  els.menuOperatingCostInput.value = inputNumberValue(item.operatingCost);
  els.menuOperatingCostTypeInput.value = operatingCostTypes.includes(item.operatingCostType) ? item.operatingCostType : "other";
  els.menuCategoryInput.value = item.category || "";
  renderMenuComponentsEditor();
  renderMenuOptionsEditor();
  els.menuNameInput.focus();
}

function editMenuItem(itemId) {
  const item = findMenuItem(itemId);
  if (!item) return;
  setMenuFormMode(item);
  render();
}

function saveMenuItem(event) {
  event.preventDefault();
  const name = els.menuNameInput.value.trim();
  const price = Number(els.menuPriceInput.value || 0);
  const costInput = els.menuCostInput.value.trim();
  const cost = costInput === "" ? 0 : Number(costInput);
  const operatingCostInput = els.menuOperatingCostInput.value.trim();
  const operatingCost = operatingCostInput === "" ? 0 : Number(operatingCostInput);
  const operatingCostType = operatingCostTypes.includes(els.menuOperatingCostTypeInput.value)
    ? els.menuOperatingCostTypeInput.value
    : "other";
  const category = els.menuCategoryInput.value.trim();
  const components = normalizeMenuComponents(menuComponentDraft, editingMenuItemId || "");
  const options = normalizeMenuOptions(menuOptionsDraft);
  if (!name || !category || price <= 0 || cost < 0 || operatingCost < 0 || (!components.length && costInput === "" && operatingCostInput === "")) {
    showToast("أكمل بيانات الصنف أو أضف مكونات من المخزون.");
    return;
  }

  if (editingMenuItemId) {
    const item = findMenuItem(editingMenuItemId);
    if (!item) {
      showToast("الصنف غير موجود.");
      setMenuFormMode();
      render();
      return;
    }

    Object.assign(item, { name, price, cost, operatingCost, operatingCostType, category, components, options });
    setMenuFormMode();
    showToast("تم حفظ تعديل الصنف.");
    render();
    return;
  }

  state.menu.push({ id: uid("item"), name, price, cost, operatingCost, operatingCostType, category, components, options });
  setMenuFormMode();
  showToast("تمت إضافة الصنف.");
  render();
}

async function removeMenuItem(itemId) {
  const usedInOpenOrder = Object.values(state.openOrders).some((order) => order.items.some((item) => item.id === itemId));
  if (usedInOpenOrder) {
    showToast("الصنف موجود في طلب مفتوح، احذفه من الطلب أولاً.");
    return;
  }
  const usedAsComponent = state.menu.some((item) => item.id !== itemId && menuItemComponents(item).some((component) => component.itemId === itemId));
  if (usedAsComponent) {
    showToast("الصنف مستخدم كمكون في صنف آخر. احذفه من المكونات أولاً.");
    return;
  }
  const item = findMenuItem(itemId);
  const confirmed = await appConfirm(`حذف صنف "${item ? item.name : ""}" من المنيو؟`);
  if (!confirmed) return;
  state.menu = state.menu.filter((item) => item.id !== itemId);
  if (editingMenuItemId === itemId) setMenuFormMode();
  showToast("تم حذف الصنف.");
  render();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
