// ═══ دفتر المقهى ═══ 07-reports.js — التقارير
// (مقسوم من app.js — الأسطر 3968-4111)

const cashMethodMeta = [
  { key: "cash", label: "كاش", icon: "💵" },
  { key: "bank", label: "تطبيق بنك", icon: "🏦" },
  { key: "wallet", label: "محفظة", icon: "📱" }
];

function renderCashOnHand() {
  if (!els.cashOnHandBox) return;
  const c = cashOnHand();
  const cards = cashMethodMeta.map(({ key, label, icon }) => {
    const m = c.methods[key];
    const lastAdjustment = latestCashAdjustment(key);
    const transferText = (m.transferIn || m.transferOut)
      ? ` | تحويل +${money(m.transferIn)} / -${money(m.transferOut)}`
      : "";
    return `
      <article class="cash-method-card ${m.current >= 0 ? "" : "is-negative"}">
        <div class="cash-method-head">
          <span>${icon} ${label}</span>
          <button class="cash-method-reconcile" type="button" data-reconcile-method="${key}" title="جرد ${label}">⚖</button>
        </div>
        <strong>${money(m.current)}</strong>
        <small>رأس مال ${money(m.opening)} + دخل ${money(m.inflow)} − طلع ${money(m.outflow)}${m.adjustments ? ` ${m.adjustments >= 0 ? "+" : "−"} جرد ${money(Math.abs(m.adjustments))}` : ""}${transferText}</small>
        ${lastAdjustment ? `<small>آخر جرد: ${money(lastAdjustment.counted)} | ${formatDate(lastAdjustment.createdAt)}</small>` : ""}
      </article>
    `;
  }).join("");

  els.cashOnHandBox.innerHTML = `
    <div class="cashbox-onhand-top">
      <div class="cashbox-onhand-total">
        <span>💰 إجمالي الفلوس اللي معك</span>
        <strong class="${c.total.current >= 0 ? "is-positive" : "is-negative"}">${money(c.total.current)}</strong>
      </div>
      <div class="cashbox-onhand-actions">
        <button class="secondary-button" id="transferCashButton" type="button">⇄ تحويل</button>
        <button class="secondary-button" id="setOpeningCashButton" type="button">✎ رأس المال</button>
      </div>
    </div>
    <div class="cash-method-grid">${cards}</div>
    ${renderCashboxActionCard(c)}
  `;

  const setBtn = document.getElementById("setOpeningCashButton");
  if (setBtn) setBtn.addEventListener("click", showOpeningCashCard);
  const transferBtn = document.getElementById("transferCashButton");
  if (transferBtn) transferBtn.addEventListener("click", showTransferCashCard);
  els.cashOnHandBox.querySelectorAll("[data-reconcile-method]").forEach((btn) => {
    btn.addEventListener("click", () => showReconcileCashCard(btn.dataset.reconcileMethod));
  });
  bindCashboxActionCard();
}

function latestCashAdjustment(method) {
  return (state.cashAdjustments || [])
    .filter((entry) => entry.method === method)
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
}

function renderCashboxActionCard(c) {
  if (!cashboxAction) return "";

  if (cashboxAction.type === "opening") {
    const opening = normalizeOpeningCash(state.openingCash);
    return `
      <form class="cashbox-action-card" id="openingCashForm">
        <div>
          <h3>رأس المال داخل البرنامج</h3>
          <p>اكتب المبلغ الأساسي لكل طريقة دفع عند بداية استخدام البرنامج.</p>
        </div>
        <div class="cashbox-action-grid">
          ${cashMethodMeta.map(({ key, label, icon }) => `
            <label class="field compact">
              <span>${icon} ${label}</span>
              <input type="number" min="0" step="any" inputmode="decimal" data-opening-cash="${key}" value="${escapeAttr(inputNumberValue(opening[key]))}" />
            </label>
          `).join("")}
        </div>
        <div class="cashbox-action-buttons">
          <button class="primary-button" type="submit">حفظ رأس المال</button>
          <button class="secondary-button" type="button" data-cashbox-cancel>إلغاء</button>
        </div>
      </form>
    `;
  }

  if (cashboxAction.type === "transfer") {
    const fromMethod = paymentMethods.includes(cashboxAction.fromMethod) ? cashboxAction.fromMethod : "cash";
    const toMethod = paymentMethods.includes(cashboxAction.toMethod) && cashboxAction.toMethod !== fromMethod ? cashboxAction.toMethod : "bank";
    const options = (selected) => cashMethodMeta.map(({ key, label, icon }) => {
      return `<option value="${key}" ${key === selected ? "selected" : ""}>${icon} ${label}</option>`;
    }).join("");

    return `
      <form class="cashbox-action-card" id="cashTransferForm">
        <div>
          <h3>تحويل بين طرق الدفع</h3>
          <p>انقل مبلغ من كاش إلى تطبيق بنك أو محفظة. هذا تحويل داخلي لا يُحسب دخل ولا مصروف.</p>
        </div>
        <div class="cashbox-transfer-grid">
          <label class="field compact">
            <span>من</span>
            <select id="cashTransferFromInput">${options(fromMethod)}</select>
          </label>
          <label class="field compact">
            <span>إلى</span>
            <select id="cashTransferToInput">${options(toMethod)}</select>
          </label>
          <label class="field compact cashbox-transfer-amount">
            <span>المبلغ</span>
            <input id="cashTransferAmountInput" type="number" min="0" step="any" inputmode="decimal" />
          </label>
          <label class="field compact cashbox-transfer-note">
            <span>ملاحظة</span>
            <input id="cashTransferNoteInput" type="text" placeholder="مثال: إيداع كاش في البنك" />
          </label>
        </div>
        <div class="cashbox-transfer-preview" id="cashTransferPreview"></div>
        <div class="cashbox-action-buttons">
          <button class="primary-button" type="submit">تثبيت التحويل</button>
          <button class="secondary-button" type="button" data-cashbox-cancel>إلغاء</button>
        </div>
      </form>
    `;
  }

  if (cashboxAction.type === "reconcile") {
    const method = cashboxAction.method;
    const meta = cashMethodMeta.find((item) => item.key === method);
    const expected = c.methods[method]?.current || 0;
    if (!meta) return "";

    return `
      <form class="cashbox-action-card" id="reconcileCashForm" data-method="${escapeAttr(method)}" data-expected="${escapeAttr(expected)}">
        <div>
          <h3>جرد ${meta.label}</h3>
          <p>عدّ المبلغ الفعلي واكتبه، والبرنامج يسجل الفرق كتسوية صندوق.</p>
        </div>
        <div class="cashbox-reconcile-line">
          <span>المتوقع حسب البرنامج</span>
          <strong>${money(expected)}</strong>
        </div>
        <label class="field compact">
          <span>المبلغ الفعلي الموجود</span>
          <input id="cashboxCountedInput" type="number" min="0" step="any" inputmode="decimal" value="${escapeAttr(inputNumberValue(expected))}" />
        </label>
        <div class="cashbox-diff" id="cashboxDiffText">مطابق</div>
        <div class="cashbox-action-buttons">
          <button class="primary-button" type="submit">تثبيت الجرد</button>
          <button class="secondary-button" type="button" data-cashbox-cancel>إلغاء</button>
        </div>
      </form>
    `;
  }

  return "";
}

function bindCashboxActionCard() {
  els.cashOnHandBox.querySelectorAll("[data-cashbox-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      cashboxAction = null;
      render();
    });
  });

  const openingForm = document.getElementById("openingCashForm");
  if (openingForm) openingForm.addEventListener("submit", setOpeningCash);

  const transferForm = document.getElementById("cashTransferForm");
  if (transferForm) {
    ["cashTransferFromInput", "cashTransferToInput", "cashTransferAmountInput"].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.addEventListener("input", updateCashTransferPreview);
      if (input) input.addEventListener("change", updateCashTransferPreview);
    });
    updateCashTransferPreview();
    transferForm.addEventListener("submit", transferCashboxFunds);
  }

  const reconcileForm = document.getElementById("reconcileCashForm");
  if (reconcileForm) {
    const input = document.getElementById("cashboxCountedInput");
    const update = () => updateCashboxDiff(reconcileForm);
    if (input) input.addEventListener("input", update);
    update();
    reconcileForm.addEventListener("submit", reconcileCashMethod);
  }
}

function showOpeningCashCard() {
  cashboxAction = { type: "opening" };
  render();
}

function showTransferCashCard() {
  cashboxAction = { type: "transfer", fromMethod: "cash", toMethod: "bank" };
  render();
}

function showReconcileCashCard(method) {
  cashboxAction = { type: "reconcile", method };
  render();
}

function cashMethodLabel(method) {
  return cashMethodMeta.find((item) => item.key === method)?.label || method;
}

function updateCashTransferPreview() {
  const fromInput = document.getElementById("cashTransferFromInput");
  const toInput = document.getElementById("cashTransferToInput");
  const amountInput = document.getElementById("cashTransferAmountInput");
  const preview = document.getElementById("cashTransferPreview");
  if (!fromInput || !toInput || !amountInput || !preview) return;

  const fromMethod = paymentMethods.includes(fromInput.value) ? fromInput.value : "cash";
  if (toInput.value === fromMethod) {
    toInput.value = paymentMethods.find((method) => method !== fromMethod) || "bank";
  }
  const toMethod = paymentMethods.includes(toInput.value) ? toInput.value : "bank";
  const amount = Math.max(Number(amountInput.value || 0), 0);
  const box = cashOnHand();
  const fromCurrent = Number(box.methods[fromMethod]?.current || 0);
  const toCurrent = Number(box.methods[toMethod]?.current || 0);
  const hasAmount = amount > 0.001;
  const fromAfter = fromCurrent - amount;
  const toAfter = toCurrent + amount;

  preview.classList.toggle("is-warning", hasAmount && fromAfter < -0.001);
  preview.innerHTML = hasAmount
    ? `
      <span>${cashMethodLabel(fromMethod)}: ${money(fromCurrent)} ← ${money(fromAfter)}</span>
      <span>${cashMethodLabel(toMethod)}: ${money(toCurrent)} ← ${money(toAfter)}</span>
    `
    : `<span>اكتب المبلغ حتى يظهر تأثير التحويل.</span>`;
}

function transferCashboxFunds(event) {
  event.preventDefault();
  const fromMethod = document.getElementById("cashTransferFromInput")?.value || "cash";
  const toMethod = document.getElementById("cashTransferToInput")?.value || "bank";
  const amount = Number(document.getElementById("cashTransferAmountInput")?.value || 0);
  const note = document.getElementById("cashTransferNoteInput")?.value?.trim() || "";

  if (!paymentMethods.includes(fromMethod) || !paymentMethods.includes(toMethod)) {
    showToast("اختار طريقة التحويل بشكل صحيح.");
    return;
  }
  if (fromMethod === toMethod) {
    showToast("اختار وجهة مختلفة عن المصدر.");
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("اكتب مبلغ تحويل صحيح.");
    return;
  }

  const box = cashOnHand();
  const fromCurrent = Number(box.methods[fromMethod]?.current || 0);
  if (amount > fromCurrent + 0.001) {
    showToast(`رصيد ${cashMethodLabel(fromMethod)} لا يكفي. إذا الرقم الحقيقي مختلف اعمل جرد للصندوق أولاً.`);
    return;
  }

  const entry = normalizeCashTransfer({
    id: uid("cashtransfer"),
    fromMethod,
    toMethod,
    amount,
    note,
    createdAt: new Date().toISOString()
  });
  state.cashTransfers = state.cashTransfers || [];
  state.cashTransfers.push(entry);
  cashboxAction = null;
  saveState();
  showToast(`تم تحويل ${money(amount)} من ${cashMethodLabel(fromMethod)} إلى ${cashMethodLabel(toMethod)}.`);
  render();
}

function setOpeningCash(event) {
  event.preventDefault();
  const opening = normalizeOpeningCash(state.openingCash);
  const next = { ...opening };
  for (const { key, label } of cashMethodMeta) {
    const input = event.currentTarget.querySelector(`[data-opening-cash="${key}"]`);
    const raw = input?.value || "0";
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) { showToast(`قيمة ${label} غير صحيحة.`); return; }
    next[key] = value;
  }
  state.openingCash = next;
  cashboxAction = null;
  saveState();
  showToast("تم تحديث رأس المال.");
  render();
}

function updateCashboxDiff(form) {
  const expected = Number(form.dataset.expected || 0);
  const counted = Number(document.getElementById("cashboxCountedInput")?.value || 0);
  const diff = counted - expected;
  const diffText = document.getElementById("cashboxDiffText");
  if (!diffText) return;
  diffText.classList.toggle("is-negative", diff < -0.001);
  diffText.classList.toggle("is-positive", diff > 0.001);
  diffText.textContent = Math.abs(diff) <= 0.001
    ? "مطابق"
    : diff > 0
      ? `زيادة ${money(diff)}`
      : `نقص ${money(Math.abs(diff))}`;
}

function reconcileCashMethod(event) {
  event.preventDefault();
  const method = event.currentTarget.dataset.method;
  const meta = cashMethodMeta.find((m) => m.key === method);
  if (!meta) return;
  const expected = Number(event.currentTarget.dataset.expected || 0);
  const raw = document.getElementById("cashboxCountedInput")?.value || "";
  const counted = Number(raw);
  if (!Number.isFinite(counted) || counted < 0) { showToast("اكتب رقم صحيح."); return; }
  const diff = counted - expected;
  if (Math.abs(diff) <= 0.001) {
    cashboxAction = null;
    showToast(`${meta.label} مطابق.`);
    render();
    return;
  }
  const sign = diff > 0 ? "زيادة" : "نقص";
  state.cashAdjustments = state.cashAdjustments || [];
  state.cashAdjustments.push({
    id: uid("cashadj"),
    method,
    diff,
    counted,
    expected,
    createdAt: new Date().toISOString()
  });
  cashboxAction = null;
  saveState();
  showToast(`تم تثبيت ${meta.label} على ${money(counted)} (${sign} ${money(Math.abs(diff))}).`);
  render();
}

function renderReports() {
  renderCashOnHand();
  const range = selectedReportRange();
  const data = reportData(range);
  const itemRows = reportItemRows(range);
  const customerRows = reportCustomerRows();
  const recentInvoices = data.invoices
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);
  const recentPurchases = data.purchases
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);
  const recentGeneralExpenses = data.expenses
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);
  const recentInventoryCounts = data.inventoryCounts
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);
  const recentWorkerConsumptions = data.workerConsumptions
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);
  const recentWorkerTransactions = data.workerTransactions
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);

  els.reportRangeText.textContent = rangeText(range);

  // ── حساب الصندوق: شو دخل وشو طلع ──
  const paymentsReceived = data.paymentInvoices.reduce((sum, invoice) => sum + Number(invoice.paid || 0), 0);
  const paymentDiscountTotal = Number(data.paymentDiscountTotal || 0);
  const payoutsPaid = data.payoutInvoices.reduce((sum, invoice) => sum + Number(invoice.paid || 0), 0);
  const workerDrinksPaid = paymentMethods.reduce((sum, method) => sum + Number(data.workerPayments[method] || 0), 0);
  const cashIn = data.paidTotal + paymentsReceived + workerDrinksPaid;
  const cashOut = data.purchasesTotal + data.expensesTotal + data.workerTransactionSummary.advances + data.workerTransactionSummary.salaryPaid + payoutsPaid;
  const cashNet = cashIn - cashOut;
  const cashInParts = [
    { label: "مقبوض البيع", amount: data.paidTotal },
    { label: "تسديد ديون", amount: paymentsReceived },
    { label: "مشروبات عمال", amount: workerDrinksPaid }
  ];
  const cashOutParts = [
    { label: "مشتريات", amount: data.purchasesTotal },
    { label: "مصروفات عامة", amount: data.expensesTotal },
    { label: "سلف عمال", amount: data.workerTransactionSummary.advances },
    { label: "قبضات عمال مدفوعة", amount: data.workerTransactionSummary.salaryPaid },
    { label: "دفعات لعملاء", amount: payoutsPaid }
  ];

  const inventoryNet = Number(data.inventorySummary.net || 0);
  const profitAfterInventory = data.profitWithWorkersPayrollAndInventory;
  const saleInvoiceCount = data.saleInvoices.length;
  const averageInvoice = saleInvoiceCount ? data.salesTotal / saleInvoiceCount : 0;
  const itemProfitMargin = data.salesTotal > 0 ? (data.itemProfit / data.salesTotal) * 100 : 0;
  const collectionRate = data.salesTotal > 0 ? (data.paidTotal / data.salesTotal) * 100 : 0;
  const saleMethodRank = paymentMethods
    .map((method) => ({ method, amount: Number(data.salePayments[method] || 0) }))
    .sort((a, b) => b.amount - a.amount);
  const strongestSaleMethod = saleMethodRank[0] || { method: "cash", amount: 0 };
  const outflowRank = [
    { label: "مشتريات", amount: data.purchasesTotal },
    { label: "مصروفات عامة", amount: data.expensesTotal },
    { label: "سلف عمال", amount: data.workerTransactionSummary.advances },
    { label: "قبضات عمال", amount: data.workerTransactionSummary.salaryPaid },
    { label: "دفعات لعملاء", amount: payoutsPaid }
  ].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  const largestOutflow = outflowRank[0] || { label: "لا يوجد", amount: 0 };
  const topProfitItem = itemRows[0] || null;
  const percentText = (value) => `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;

  const card = (label, value, tone = "") => `
    <article class="report-card ${tone ? `is-${tone}` : ""}">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `;
  const amountCard = (label, amount, tone = "") => Number(amount || 0) > 0.001 ? card(label, money(amount), tone) : "";
  const moneyPartsText = (parts, emptyText = "لا توجد حركة") => {
    const visible = parts.filter((part) => Number(part.amount || 0) > 0.001);
    return visible.length
      ? visible.map((part) => `${part.label} ${money(part.amount)}`).join(" + ")
      : emptyText;
  };

  els.reportSummaryGrid.innerHTML = `
    <div class="report-group report-decision-group">
      <h4>قراءة سريعة</h4>
      <div class="report-group-grid">
        ${card("متوسط الفاتورة", saleInvoiceCount ? money(averageInvoice) : "لا يوجد", saleInvoiceCount ? "sales" : "neutral")}
        ${card("نسبة التحصيل", data.salesTotal > 0 ? percentText(collectionRate) : "لا يوجد", collectionRate >= 90 ? "success" : collectionRate >= 60 ? "sales" : data.salesTotal > 0 ? "danger" : "neutral")}
        ${card("هامش ربح الأصناف", data.salesTotal > 0 ? percentText(itemProfitMargin) : "لا يوجد", itemProfitMargin >= 25 ? "success" : itemProfitMargin >= 0 ? "sales" : "danger")}
        ${card("ديون جديدة بالفترة", data.debtTotal > 0.001 ? money(data.debtTotal) : "لا يوجد", data.debtTotal > 0.001 ? "danger" : "success")}
        ${card("أقوى طريقة قبض", strongestSaleMethod.amount > 0.001 ? `${paymentLabels[strongestSaleMethod.method]} ${money(strongestSaleMethod.amount)}` : "لا يوجد", strongestSaleMethod.amount > 0.001 ? "credit" : "neutral")}
        ${card("أكبر خروج نقدي", Number(largestOutflow.amount || 0) > 0.001 ? `${largestOutflow.label} ${money(largestOutflow.amount)}` : "لا يوجد", Number(largestOutflow.amount || 0) > 0.001 ? "danger" : "neutral")}
        ${card("أعلى صنف ربح", topProfitItem ? `${escapeHtml(topProfitItem.item.name)} | ${money(topProfitItem.stats.profit)}` : "لا يوجد", topProfitItem && topProfitItem.stats.profit >= 0 ? "success" : topProfitItem ? "danger" : "neutral")}
      </div>
    </div>

    <div class="cashbox-card ${cashNet >= 0 ? "is-positive" : "is-negative"}">
      <div class="cashbox-main">
        <span>💰 المفروض زاد صندوقي هالفترة</span>
        <strong>${money(cashNet)}</strong>
        <small>اللي بالصندوق الآن = هذا الرقم + اللي كان موجود أول الفترة</small>
      </div>
      <div class="cashbox-breakdown">
        <div class="cashbox-flow cashbox-in">
          <strong>⬇ دخل: ${money(cashIn)}</strong>
          <small>${moneyPartsText(cashInParts, "لا يوجد دخل")}</small>
        </div>
        <div class="cashbox-flow cashbox-out">
          <strong>⬆ طلع: ${money(cashOut)}</strong>
          <small>${moneyPartsText(cashOutParts, "لا يوجد طالع")}</small>
        </div>
      </div>
    </div>

    <div class="report-group">
      <h4>🛒 المبيعات</h4>
      <div class="report-group-grid">
        ${card("عدد الفواتير", quantityText(data.saleInvoices.length))}
        ${card("إجمالي المبيعات", money(data.salesTotal), "sales")}
        ${card("المقبوض منها", money(data.paidTotal), "success")}
        ${card("الدين الحالي للعملاء", data.customerSummary.debt > 0.001 ? money(data.customerSummary.debt) : "لا يوجد", data.customerSummary.debt > 0.001 ? "danger" : "neutral")}
      </div>
    </div>

    <div class="report-group">
      <h4>📉 المصروفات والالتزامات</h4>
      <div class="report-group-grid">
        ${amountCard("مشتريات", data.purchasesTotal, "danger")}
        ${amountCard("مصروفات عامة", data.expensesTotal, "danger")}
        ${amountCard("سلف عمال", data.workerTransactionSummary.advances, "danger")}
        ${amountCard("قبضات عمال مدفوعة", data.workerTransactionSummary.salaryPaid, "danger")}
        ${amountCard("مستحق عمال غير مدفوع", data.workerDueTotal, "neutral")}
        ${Number(data.purchasesTotal || 0) <= 0.001 && Number(data.expensesTotal || 0) <= 0.001 && Number(data.workerTransactionSummary.advances || 0) <= 0.001 && Number(data.workerTransactionSummary.salaryPaid || 0) <= 0.001 && Number(data.workerDueTotal || 0) <= 0.001
          ? card("لا توجد مصروفات", "لا يوجد", "neutral")
          : ""}
      </div>
    </div>

    <div class="report-group">
      <h4>📦 الجرد (خسارة/زيادة البضاعة)</h4>
      <div class="report-group-grid">
        ${data.inventorySummary.count > 0
          ? card(inventoryNet < 0 ? "خسارة الجرد" : inventoryNet > 0 ? "ربح الجرد" : "صافي الجرد", money(Math.abs(inventoryNet)), inventoryNet < 0 ? "danger" : inventoryNet > 0 ? "success" : "neutral")
          : card("عمليات الجرد بالفترة", "لا يوجد جرد", "neutral")}
        ${card("قيمة الزيادة", money(data.inventorySummary.increase), "success")}
        ${card("قيمة النقص", money(data.inventorySummary.decrease), "danger")}
        ${card("عدد عمليات الجرد", quantityText(data.inventorySummary.count), "neutral")}
      </div>
    </div>

    <div class="report-group">
      <h4>📈 الربح</h4>
      <div class="report-group-grid">
        ${card("ربح الأصناف المباعة", money(data.itemProfit), data.itemProfit >= 0 ? "success" : "danger")}
        ${card("صافي استهلاك العمال", money(data.workerSummary.net), data.workerSummary.net >= 0 ? "success" : "danger")}
        ${card("خصومات تسديد العملاء", paymentDiscountTotal > 0.001 ? `-${money(paymentDiscountTotal)}` : money(0), paymentDiscountTotal > 0.001 ? "danger" : "neutral")}
        ${card("الربح قبل الجرد", money(data.profitWithWorkersAndPayroll), data.profitWithWorkersAndPayroll >= 0 ? "success" : "danger")}
        ${card("الربح الصافي النهائي", money(profitAfterInventory), profitAfterInventory >= 0 ? "success" : "danger")}
      </div>
    </div>

    <div class="report-group">
      <h4>👥 ديون العملاء</h4>
      <div class="report-group-grid">
        ${card("إلك عندهم الآن", data.customerSummary.debt > 0.001 ? money(data.customerSummary.debt) : "لا يوجد", data.customerSummary.debt > 0.001 ? "danger" : "neutral")}
        ${card("إلهم عندك الآن", data.customerSummary.credit > 0.001 ? money(data.customerSummary.credit) : "لا يوجد", data.customerSummary.credit > 0.001 ? "credit" : "neutral")}
        ${amountCard("دفعات عملاء بالفترة", paymentsReceived, "success")}
        ${amountCard("خصومات تسديد بالفترة", paymentDiscountTotal, paymentDiscountTotal > 0.001 ? "danger" : "neutral")}
        ${Number(paymentsReceived || 0) <= 0.001 && Number(data.customerSummary.debt || 0) <= 0.001 && Number(data.customerSummary.credit || 0) <= 0.001
          ? card("حسابات العملاء", "لا يوجد أرصدة حالية", "neutral")
          : ""}
      </div>
    </div>
  `;

  const saleMethodTotal = paymentMethods.reduce((sum, method) => sum + Number(data.salePayments[method] || 0), 0);
  els.reportPaymentsList.innerHTML = `
    <div class="pay-method-section">
      <h5>🛒 مقبوض البيع حسب الطريقة</h5>
      <div class="pay-method-grid">
        ${paymentMethods.map((method) => `
          <article class="pay-method-card">
            <span>${paymentLabels[method]}</span>
            <strong>${money(data.salePayments[method])}</strong>
            <small>${saleMethodTotal > 0 ? Math.round((Number(data.salePayments[method] || 0) / saleMethodTotal) * 100) : 0}%</small>
          </article>
        `).join("")}
      </div>
    </div>
    <div class="pay-method-section">
      <h5>📋 تفصيل كل الحركات حسب الطريقة</h5>
      ${paymentMethods.map((method) => `
        <article class="report-row">
          <div>
            <strong>${paymentLabels[method]}</strong>
            <small>${moneyPartsText([
              { label: "بيع", amount: data.salePayments[method] },
              { label: "تسديد ديون", amount: data.paymentPayments[method] },
              { label: "مشروبات عمال", amount: data.workerPayments[method] },
              { label: "سلف/قبضات مدفوعة", amount: data.workerTransactionPayments[method] },
              { label: "مصروفات عامة", amount: data.expensePayments[method] }
            ])}</small>
          </div>
          <span>${Number(data.purchasePayments[method] || 0) > 0.001 ? `مشتريات: ${money(data.purchasePayments[method])}` : ""}</span>
        </article>
      `).join("")}
    </div>`;

  els.reportItemsList.innerHTML = itemRows.length
    ? itemRows.map(({ item, stats }) => `
      <article class="report-row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.category)} | المباعة: ${quantityText(stats.qty)}</small>
        </div>
        <span>${money(stats.sales)} | ربح ${money(stats.profit)}</span>
      </article>
    `).join("")
    : '<div class="empty-state">لا توجد مبيعات أصناف ضمن الفترة.</div>';

  els.reportCustomersList.innerHTML = customerRows.length
    ? customerRows.map((customer) => `
      <article class="report-row ${Number(customer.balance || 0) > 0 ? "is-danger" : "is-credit"}">
        <div>
          <strong>${escapeHtml(customer.name)}</strong>
          <small>${customer.phone ? escapeHtml(customer.phone) : "بدون رقم جوال"}</small>
        </div>
        <span>${balanceText(Number(customer.balance || 0))}</span>
      </article>
    `).join("")
    : '<div class="empty-state">لا توجد أرصدة أو ديون حالية.</div>';

  els.reportInvoicesList.innerHTML = recentInvoices.length
    ? recentInvoices.map((invoice) => `
      <article class="report-row">
        <div>
          <strong>${escapeHtml(invoice.number || "فاتورة")}</strong>
          <small>${formatDate(invoice.createdAt)} | ${escapeHtml(invoice.customerName || "زبون نقدي")}</small>
        </div>
        <span>${money(invoice.total)} | ${statusText(invoice.status)}</span>
      </article>
    `).join("")
    : '<div class="empty-state">لا توجد فواتير ضمن الفترة.</div>';

  els.reportPurchasesList.innerHTML = recentPurchases.length
    ? recentPurchases.map((purchase) => {
      const lines = purchaseLines(purchase);
      const qty = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
      const stockQty = lines.reduce((sum, line) => sum + purchaseLineStockQty(line), 0);
      return `
        <article class="report-row">
          <div>
            <strong>${escapeHtml(purchase.number || "فاتورة مشتريات")}</strong>
            <small>${formatDate(purchase.createdAt)}${purchase.supplier ? ` | ${escapeHtml(purchase.supplier)}` : ""}</small>
          </div>
          <span>${money(purchaseAmount(purchase))} | شراء ${quantityText(qty)} | مخزون ${quantityText(stockQty)}</span>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">لا توجد مشتريات ضمن الفترة.</div>';

  els.reportGeneralExpensesList.innerHTML = recentGeneralExpenses.length
    ? recentGeneralExpenses.map((expense) => `
      <article class="report-row is-danger">
        <div>
          <strong>${escapeHtml(expense.title || "مصروف")}</strong>
          <small>${formatDate(expense.createdAt)} | ${paymentLabels[expense.method] || expense.method}${expense.note ? ` | ${escapeHtml(expense.note)}` : ""}</small>
        </div>
        <span>${money(expense.amount)}</span>
      </article>
    `).join("")
    : '<div class="empty-state">لا توجد مصروفات عامة ضمن الفترة.</div>';

  els.reportInventoryList.innerHTML = recentInventoryCounts.length
    ? recentInventoryCounts.map((record) => {
      const value = inventoryCountValue(record);
      const netLabel = value.net > 0.001 ? "ربح الجرد" : value.net < -0.001 ? "خسارة الجرد" : "صافي الجرد";
      const rowClass = value.net > 0.001 ? "is-credit" : value.net < -0.001 ? "is-danger" : "";
      return `
        <article class="report-row ${rowClass}">
          <div>
            <strong>${escapeHtml(record.number || "جرد")}</strong>
            <small>${formatDate(record.createdAt)}${record.note ? ` | ${escapeHtml(record.note)}` : ""} | فروقات: ${quantityText(record.changed || 0)}</small>
          </div>
          <span>${netLabel}: ${money(Math.abs(value.net))}</span>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">لا توجد عمليات جرد ضمن الفترة.</div>';

  els.reportExpensesList.innerHTML = recentWorkerConsumptions.length
    ? recentWorkerConsumptions.map((entry) => `
      <article class="report-row ${entry.type === FREE_WORKER_CONSUMPTION_TYPE ? "is-danger" : "is-credit"}">
        <div>
          <strong>${escapeHtml(entry.workerName)} - ${escapeHtml(entry.itemName)}</strong>
          <small>${formatDate(entry.createdAt)} | ${workerConsumptionTypeLabel(entry.type)} | الكمية: ${quantityText(entry.qty)}</small>
        </div>
        <span>${entry.type === FREE_WORKER_CONSUMPTION_TYPE ? `تكلفة ${money(entry.costTotal)}` : money(entry.total)}</span>
      </article>
    `).join("")
    : '<div class="empty-state">لا يوجد استهلاك عمال ضمن الفترة.</div>';

  els.reportWorkersList.innerHTML = recentWorkerTransactions.length
    ? recentWorkerTransactions.map((entry) => {
      const isAdvance = entry.type === WORKER_ADVANCE_TYPE;
      return `
        <article class="report-row ${isAdvance ? "is-danger" : "is-credit"}">
          <div>
            <strong>${escapeHtml(entry.workerName)} - ${workerTransactionTypeLabel(entry.type)}</strong>
            <small>${formatDate(entry.createdAt)} | ${paymentLabels[entry.method] || entry.method}${entry.note ? ` | ${escapeHtml(entry.note)}` : ""}</small>
          </div>
          <span>${isAdvance ? "عليه " : "مدفوع له "}${money(entry.amount)}</span>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">لا توجد سلف أو قبضات عمال ضمن الفترة.</div>';
}
