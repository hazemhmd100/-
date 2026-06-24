// ═══ دفتر المقهى ═══ 05-workers.js — عرض المشتريات + العمال: رواتب، سلف، استهلاك
// (مقسوم من app.js — الأسطر 2930-3401)

function renderPurchases() {
  const query = els.purchaseSearchInput.value.trim().toLowerCase();
  const purchaseMatches = state.purchases.map((purchase) => purchaseSearchInfo(purchase, query)).filter((match) => match.matches);
  const purchases = purchaseMatches.map((match) => match.purchase);
  const totalAmount = purchaseMatches.reduce((sum, match) => {
    return sum + (query ? purchaseLinesAmount(match.statLines) : purchaseAmount(match.purchase));
  }, 0);
  const searchStats = purchaseSearchSalesStats(purchaseMatches);

  els.purchaseTotalBox.innerHTML = `
    <span>${query ? "نتيجة البحث في المشتريات" : "المجموع الكلي"}</span>
    <strong>${money(totalAmount)}</strong>
    <small>${purchases.length} فاتورة / سجل</small>
    <div class="purchase-search-stats">
      <span>${query ? "الأصناف المطابقة" : "الأصناف"}: ${quantityText(searchStats.itemCount)}</span>
      <span>${query ? "مبلغ الأصناف المطابقة" : "مبلغ المشتريات"}: ${money(totalAmount)}</span>
      <span>الكمية المشتراة: ${quantityText(searchStats.purchaseQty)}</span>
      <span>كمية المخزون الداخلة: ${quantityText(searchStats.stockQty)}</span>
    </div>
  `;

  els.purchasesList.innerHTML = purchases.length
    ? purchaseMatches.map((match) => {
      const purchase = match.purchase;
      const lines = query ? match.statLines : match.lines;
      const qtyTotal = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0);
      const stockQtyTotal = lines.reduce((sum, line) => sum + purchaseLineStockQty(line), 0);
      const rowAmount = query ? purchaseLinesAmount(lines) : purchaseAmount(purchase);
      return `
        <article class="purchase-row ${editingPurchaseId === purchase.id ? "is-editing" : ""}">
          <header>
            <div>
              <strong>${escapeHtml(purchase.number || "سجل مشتريات")}</strong>
              <p>
                ${formatDate(purchase.createdAt)} | ${paymentLabels[purchase.method] || purchase.method}${purchase.supplier ? ` | ${escapeHtml(purchase.supplier)}` : ""}
              </p>
              <div class="purchase-badges">
                <span class="purchase-qty-badge">${query ? "الأصناف المطابقة" : "الأصناف"}: ${lines.length}</span>
                <span>إجمالي الكمية المشتراة: ${quantityText(qtyTotal)}</span>
                <span>إجمالي كمية المخزون: ${quantityText(stockQtyTotal)}</span>
                ${query ? `<span>مبلغ الأصناف المطابقة: ${money(rowAmount)}</span>` : ""}
              </div>
            </div>
            <span class="purchase-amount">${money(rowAmount)}</span>
          </header>
          <div class="purchase-lines">
            ${lines.map((line) => `
              <article class="purchase-line-card">
                <strong>${escapeHtml(line.item)}</strong>
                <div>
                  <span class="purchase-qty-badge">الكمية المشتراة: ${quantityWithUnit(line.qty, line.unit)}</span>
                  <span>${purchaseLineStockPerUnitText(line)}</span>
                  <span class="purchase-stock-badge">دخل المخزون: ${purchaseLineStockText(line)}</span>
                  <span>المبلغ: ${money(line.amount)}</span>
                  <span>حق وحدة المخزون: ${money(purchaseLineUnitCost(line))}</span>
                </div>
              </article>
            `).join("")}
          </div>
          ${purchase.note ? `<p>${escapeHtml(purchase.note)}</p>` : ""}
          <div class="purchase-row-actions">
            <button class="invoice-edit-button" type="button" data-edit-purchase="${purchase.id}">تعديل</button>
            <button class="invoice-delete-button" type="button" data-remove-purchase="${purchase.id}">حذف</button>
          </div>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">لا توجد مشتريات مسجلة بعد.</div>';

  renderGeneralExpenses();
}

function renderGeneralExpenses() {
  if (!els.generalExpensesList) return;
  if (!els.generalExpenseDateInput.value) els.generalExpenseDateInput.value = todayDateInputValue();
  if (els.generalExpenseMethodInput) els.generalExpenseMethodInput.value = paymentMethods.includes(els.generalExpenseMethodInput.value)
    ? els.generalExpenseMethodInput.value
    : getLastPaymentMethod();

  const query = els.purchaseSearchInput.value.trim().toLowerCase();
  const expenses = (state.expenses || [])
    .filter((expense) => {
      if (!query) return true;
      const haystack = `${expense.title || ""} ${expense.note || ""} ${paymentLabels[expense.method] || expense.method || ""}`;
      return searchMatch(haystack, query);
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  els.generalExpenseTotalBox.innerHTML = `
    <span>${query ? "نتيجة البحث في المصروفات" : "إجمالي المصروفات العامة"}</span>
    <strong>${money(total)}</strong>
    <small>${expenses.length} مصروف</small>
  `;

  els.generalExpensesList.innerHTML = expenses.length
    ? expenses.map((expense) => `
      <article class="purchase-row">
        <header>
          <div>
            <strong>${escapeHtml(expense.title || "مصروف")}</strong>
            <p>${formatDate(expense.createdAt)} | ${paymentLabels[expense.method] || expense.method}</p>
          </div>
          <span class="purchase-amount">${money(expense.amount)}</span>
        </header>
        ${expense.note ? `<p>${escapeHtml(expense.note)}</p>` : ""}
        <div class="purchase-row-actions">
          <button class="invoice-delete-button" type="button" data-remove-general-expense="${expense.id}">حذف</button>
        </div>
      </article>
    `).join("")
    : '<div class="empty-state">لا توجد مصروفات عامة مسجلة بعد.</div>';
}

function todayDateInputValue() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function monthStartInputValue(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-01`;
}

function renderWorkerItemSelect() {
  const selected = els.workerItemInput.value;
  els.workerItemInput.innerHTML = ['<option value="">اختر صنف</option>']
    .concat(state.menu.map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)} - ${money(item.price)}</option>`))
    .join("");
  els.workerItemInput.value = state.menu.some((item) => item.id === selected) ? selected : "";
}

function fillWorkerItemCost() {
  const item = findMenuItem(els.workerItemInput.value);
  if (!item) {
    els.expenseAmountInput.value = "";
    return;
  }

  const cost = menuItemRecipeCost(item);
  els.expenseAmountInput.value = inputNumberValue(cost);
}

function workerFilterMatches(worker, stats, account, query, status) {
  const matchesQuery = searchMatch(`${worker.name} ${worker.phone || ""}`, query);
  const matchesStatus =
    status === "all" ||
    (status === "due" && account.due > 0.001) ||
    (status === "advance" && (account.advances > 0.001 || account.due < -0.001)) ||
    (status === "charged" && stats.charged > 0.001) ||
    (status === "free" && stats.freeCost > 0.001) ||
    (status === "active" && (stats.count > 0 || account.transactions.length > 0));
  return matchesQuery && matchesStatus;
}

function workerBadge(account, stats) {
  if (account.due > 0.001) {
    return { className: "credit", text: workerBalanceText(account.due) };
  }
  if (account.due < -0.001) {
    return { className: "debt", text: workerBalanceText(account.due) };
  }
  if (account.salary || account.salaryPaid || account.advances || stats.charged) {
    return { className: "clear", text: "صافي الشهر" };
  }
  if (stats.freeCost > 0.001) {
    return { className: "debt", text: `مجاني ${money(stats.freeCost)}` };
  }
  return { className: "clear", text: "لا حركات" };
}

function addWorkerFromWorkersPage(event) {
  event.preventDefault();
  const phone = els.workerAddPhoneInput.value.trim();
  const salaryValue = els.workerAddSalaryInput.value === "" ? null : Math.max(Number(els.workerAddSalaryInput.value || 0), 0);
  const extra = {};
  if (phone) extra.phone = phone;
  if (salaryValue !== null) extra.salary = salaryValue;
  const worker = upsertWorker(els.workerAddNameInput.value, extra);
  if (!worker) {
    showToast("اكتب اسم العامل أولا.");
    els.workerAddNameInput.focus();
    return;
  }

  selectedWorkerId = worker.id;
  els.workerSearchInput.value = "";
  els.workerStatusFilter.value = "all";
  els.workerAddForm.reset();
  showToast("تم حفظ العامل.");
  render();
}

async function deleteWorker(workerId) {
  const worker = getWorker(workerId);
  if (!worker) return;

  const movementCount = workerEntriesFor(worker).length + workerTransactionsFor(worker).length;
  const movementWarning = movementCount ? `\nحركاته السابقة ستبقى في التقارير لكنها لن تظهر كحساب عامل محفوظ.` : "";
  const confirmed = await appConfirm(`حذف العامل "${worker.name}"؟${movementWarning}`);
  if (!confirmed) return;

  state.workers = (state.workers || []).filter((item) => item.id !== worker.id);
  (state.workerConsumptions || []).forEach((entry) => {
    if (entry.workerId === worker.id) {
      entry.workerId = "";
      entry.workerDeleted = true;
    }
  });
  (state.workerTransactions || []).forEach((entry) => {
    if (entry.workerId === worker.id) {
      entry.workerId = "";
      entry.workerDeleted = true;
    }
  });
  if (selectedWorkerId === worker.id) {
    selectedWorkerId = state.workers[0]?.id || null;
  }
  showToast("تم حذف العامل.");
  render();
}

function renderWorkers() {
  state.workers = reconcileWorkers(state.workers || [], state.workerConsumptions || [], state.workerTransactions || []);
  if (selectedWorkerId && !getWorker(selectedWorkerId)) selectedWorkerId = state.workers[0]?.id || null;
  if (!selectedWorkerId && state.workers.length) selectedWorkerId = state.workers[0].id;

  const overview = (state.workers || []).reduce((totals, worker) => {
    const account = workerMonthlyAccount(worker);
    totals.due += Math.max(account.due, 0);
    totals.advances += account.advances;
    totals.salaryPaid += account.salaryPaid;
    totals.charged += account.drinkStats.charged;
    return totals;
  }, { due: 0, advances: 0, salaryPaid: 0, charged: 0 });
  if (els.workerTotalDue) els.workerTotalDue.textContent = money(overview.due);
  if (els.workerTotalAdvance) els.workerTotalAdvance.textContent = money(overview.advances);
  if (els.workerTotalSalaryPaid) els.workerTotalSalaryPaid.textContent = money(overview.salaryPaid);
  if (els.workerTotalCharged) els.workerTotalCharged.textContent = money(overview.charged);

  const query = els.workerSearchInput.value.trim().toLowerCase();
  const status = els.workerStatusFilter.value;
  const workers = (state.workers || [])
    .map((worker) => ({ worker, entries: workerEntriesFor(worker) }))
    .map((row) => ({ ...row, stats: workerConsumptionTotals(row.entries), account: workerMonthlyAccount(row.worker) }))
    .filter((row) => workerFilterMatches(row.worker, row.stats, row.account, query, status))
    .sort((a, b) => {
      const lastA = Math.max(
        new Date(a.entries[0]?.createdAt || 0).getTime(),
        new Date(a.account.transactions[0]?.createdAt || 0).getTime(),
        new Date(a.worker.updatedAt || 0).getTime()
      );
      const lastB = Math.max(
        new Date(b.entries[0]?.createdAt || 0).getTime(),
        new Date(b.account.transactions[0]?.createdAt || 0).getTime(),
        new Date(b.worker.updatedAt || 0).getTime()
      );
      return lastB - lastA;
    });

  if (!workers.length) {
    els.workersList.innerHTML = state.workers.length
      ? '<div class="empty-state">لا يوجد عمال مطابقين للتصفية.</div>'
      : '<div class="empty-state">لا يوجد عمال بعد. أضف عامل من النموذج بالأعلى.</div>';
    return;
  }

  els.workersList.innerHTML = workers.map(({ worker, entries, stats, account }) => {
    const badge = workerBadge(account, stats);
    const lastMovementDate = [entries[0]?.createdAt, account.transactions[0]?.createdAt]
      .filter(Boolean)
      .sort((a, b) => new Date(b || 0) - new Date(a || 0))[0];
    const lastMovement = lastMovementDate ? ` | آخر حركة: ${formatDate(lastMovementDate)}` : "";
    return `
      <article class="customer-card ${worker.id === selectedWorkerId ? "is-active" : ""}" data-worker-card="${worker.id}">
        <header>
          <strong>${escapeHtml(worker.name)}</strong>
          <span class="customer-badges">
            <span class="balance-badge ${badge.className}">${badge.text}</span>
          </span>
        </header>
        <div class="customer-card-footer">
          <small>${worker.phone ? `${escapeHtml(worker.phone)} | ` : ""}راتب: ${money(account.salary)} | سلف: ${money(account.advances)} | قبضات: ${money(account.salaryPaid)} | مشروبات: ${quantityText(stats.qty)}${lastMovement}</small>
          <button class="customer-delete-button" type="button" data-remove-worker="${worker.id}">حذف</button>
        </div>
      </article>
    `;
  }).join("");
}

function setWorkerFormDisabled(disabled) {
  [els.expenseForm, els.workerTransactionForm].forEach((form) => {
    if (!form) return;
    form.querySelectorAll("input, select, textarea, button").forEach((control) => {
      control.disabled = disabled;
    });
  });
}

function renderWorkerTransactionTypeState(account = null) {
  if (workerTransactionTypeLabels[state.lastWorkerTransactionType]) {
    els.workerTransactionTypeInput.value = state.lastWorkerTransactionType;
  }
  const type = els.workerTransactionTypeInput.value || WORKER_ADVANCE_TYPE;
  els.workerTransactionSubmitButton.textContent = type === WORKER_SALARY_PAYMENT_TYPE ? "تسجيل قبضة" : "تسجيل سلفة";
  if (type === WORKER_SALARY_PAYMENT_TYPE && account?.due > 0.001) {
    els.workerTransactionAmountInput.placeholder = `الصافي ${money(account.due)}`;
  } else {
    els.workerTransactionAmountInput.placeholder = "اكتب المبلغ";
  }
}

function renderWorkerDetail() {
  const worker = getWorker(selectedWorkerId);
  if (!worker) {
    els.workerDetailName.textContent = "اختر عامل";
    els.workerDetailMeta.textContent = "لعرض حساب العامل وحركاته";
    els.workerKpis.innerHTML = '<div class="empty-state">اختر عامل من القائمة أو أضف عامل جديد.</div>';
    els.workerLedgerList.innerHTML = "";
    els.expenseTitleInput.value = "";
    if (els.workerPeriodRow) els.workerPeriodRow.hidden = true;
    setWorkerFormDisabled(true);
    return;
  }

  setWorkerFormDisabled(false);
  els.expenseTitleInput.value = worker.name;
  els.workerDetailName.textContent = worker.name;
  els.workerDetailMeta.textContent = worker.phone
    ? `${worker.phone} | راتبه ${money(worker.salary)} | تم إنشاؤه ${formatDate(worker.createdAt)}`
    : `راتبه ${money(worker.salary)} | تم إنشاؤه ${formatDate(worker.createdAt)}`;

  const entries = workerEntriesFor(worker);
  const stats = workerConsumptionTotals(entries);
  const account = workerMonthlyAccount(worker);
  renderWorkerTransactionTypeState(account);

  // خانة فترة هذا العامل
  if (els.workerPeriodRow) {
    els.workerPeriodRow.hidden = false;
    els.workerOwnPeriodInput.value = worker.periodFrom || workerRangeFor(worker).minDate;
  }
  els.workerKpis.innerHTML = `
    <article class="current-balance-card"><span>رصيد الفترة الحالية</span><strong>${workerBalanceText(account.due)}</strong></article>
    <article><span>مستحق الفترة (${account.periodDays} يوم)</span><strong>${money(account.salary)}</strong></article>
    <article><span>السلف</span><strong>${money(account.advances)}</strong></article>
    <article><span>القبضات</span><strong>${money(account.salaryPaid)}</strong></article>
    <article><span>مشروبات محسوبة</span><strong>${money(account.drinkStats.charged)}</strong></article>
    <article><span>تكلفة المجاني</span><strong>${money(stats.freeCost)}</strong></article>
  `;

  const ledgerRows = [
    ...entries.map((entry) => ({ kind: "drink", createdAt: entry.createdAt, entry })),
    ...workerTransactionsFor(worker).map((entry) => ({ kind: "transaction", createdAt: entry.createdAt, entry }))
  ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  els.workerLedgerList.innerHTML = ledgerRows.length
    ? ledgerRows.slice(0, 16).map((row) => {
      if (row.kind === "transaction") {
        const entry = row.entry;
        const isAdvance = entry.type === WORKER_ADVANCE_TYPE;
        return `
          <article class="ledger-row worker-ledger-row ${isAdvance ? "is-advance" : "is-salary"}">
            <header>
              <div>
                <strong>${workerTransactionTypeLabel(entry.type)}</strong>
                <p>${formatDate(entry.createdAt)} | ${paymentLabels[entry.method] || entry.method}</p>
              </div>
              <span class="balance-badge ${isAdvance ? "debt" : "credit"}">${isAdvance ? "عليه " : "مدفوع له "}${money(entry.amount)}</span>
            </header>
            ${entry.note ? `<p class="ledger-note">${escapeHtml(entry.note)}</p>` : ""}
            <div class="expense-row-actions">
              <button class="invoice-delete-button" type="button" data-remove-worker-transaction="${entry.id}">حذف</button>
            </div>
          </article>
        `;
      }

      const entry = row.entry;
      const isFree = entry.type === FREE_WORKER_CONSUMPTION_TYPE;
      const badgeClass = isFree ? "debt" : "credit";
      const badgeText = isFree ? `تكلفة ${money(entry.costTotal)}` : money(entry.total);
      return `
        <article class="ledger-row worker-ledger-row">
          <header>
            <div>
              <strong>${escapeHtml(entry.itemName)}</strong>
              <p>${formatDate(entry.createdAt)} | ${workerConsumptionTypeLabel(entry.type)} | الكمية: ${quantityText(entry.qty)}${entry.type === "worker_price" ? ` | ${paymentLabels[entry.method] || entry.method}` : ""}</p>
            </div>
            <span class="balance-badge ${badgeClass}">${badgeText}</span>
          </header>
          <p class="ledger-note">تكلفة الصنف: ${money(entry.costTotal)}${!isFree ? ` | يخصم من الحساب: ${money(Number(entry.total || 0))}` : ""}</p>
          ${entry.note ? `<p class="ledger-note">${escapeHtml(entry.note)}</p>` : ""}
          <div class="expense-row-actions">
            <button class="invoice-delete-button" type="button" data-remove-expense="${entry.id}">حذف</button>
          </div>
        </article>
      `;
    }).join("")
    : '<div class="empty-state">لا توجد حركات لهذا العامل.</div>';
}

function renderExpenses() {
  renderWorkerItemSelect();
  if (!els.expenseDateInput.value) els.expenseDateInput.value = todayDateInputValue();
  if (!els.workerTransactionDateInput.value) els.workerTransactionDateInput.value = todayDateInputValue();
  renderConsumptionTypeState();
  renderWorkers();
  renderWorkerDetail();
}

function renderConsumptionTypeState() {
  if (!els.consumptionTypeToggle) return;
  els.consumptionTypeToggle.querySelectorAll("[data-consumption-type]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.consumptionType === workerConsumptionMode);
  });

  const isFree = workerConsumptionMode === FREE_WORKER_CONSUMPTION_TYPE;
  const isSalary = workerConsumptionMode === SALARY_WORKER_CONSUMPTION_TYPE;

  // المبلغ يختفي بالمجاني، ويتغير عنوانه حسب النوع
  if (els.expenseAmountField) els.expenseAmountField.style.display = isFree ? "none" : "";
  if (els.expenseAmountLabel) {
    els.expenseAmountLabel.textContent = isSalary ? "المبلغ اللي ينخصم من راتبه (للوحدة)" : "السعر اللي دفعه للوحدة";
  }
  // طريقة الدفع تظهر بس لما يدفع كاش
  if (els.expenseMethodField) els.expenseMethodField.style.display = workerConsumptionMode === "worker_price" ? "" : "none";
}

function setConsumptionMode(mode) {
  workerConsumptionMode = ["worker_price", SALARY_WORKER_CONSUMPTION_TYPE, FREE_WORKER_CONSUMPTION_TYPE].includes(mode) ? mode : "worker_price";
  state.lastWorkerConsumptionMode = workerConsumptionMode;
  saveState();
  renderConsumptionTypeState();
}

function setWorkerOwnPeriod(value) {
  const worker = getWorker(selectedWorkerId);
  if (!worker) return;
  worker.periodFrom = value || "";
  worker.updatedAt = new Date().toISOString();
  saveState();
  render();
}

function resetWorkerOwnPeriod() {
  const worker = getWorker(selectedWorkerId);
  if (!worker) return;
  worker.periodFrom = "";
  worker.updatedAt = new Date().toISOString();
  saveState();
  showToast("رجعت فترة العامل لبداية الفترة الحالية.");
  render();
}

function recordWorkerTransaction(event) {
  event.preventDefault();
  const worker = getWorker(selectedWorkerId);
  if (!worker) {
    showToast("اختر عامل محفوظ أولا.");
    return;
  }

  const type = workerTransactionTypeLabels[els.workerTransactionTypeInput.value]
    ? els.workerTransactionTypeInput.value
    : WORKER_ADVANCE_TYPE;
  const amount = Math.max(Number(els.workerTransactionAmountInput.value || 0), 0);
  const method = paymentMethods.includes(els.workerTransactionMethodInput.value)
    ? els.workerTransactionMethodInput.value
    : getLastPaymentMethod();

  if (amount <= 0) {
    showToast("اكتب مبلغ السلفة أو القبضة.");
    els.workerTransactionAmountInput.focus();
    return;
  }

  const createdAt = invoiceDateFromInput(els.workerTransactionDateInput.value);
  if (!guardClosedPeriod(createdAt, "التسجيل بتاريخ ضمن فترة مغلقة")) return;

  const entry = normalizeWorkerTransaction({
    id: uid("worker-tx"),
    workerId: worker.id,
    workerName: worker.name,
    type,
    amount,
    method,
    note: els.workerTransactionNoteInput.value.trim(),
    createdAt
  });

  state.workerTransactions.unshift(entry);
  worker.updatedAt = entry.createdAt;
  state.lastWorkerTransactionType = type;
  setLastPaymentMethod(method);
  els.workerTransactionAmountInput.value = "";
  els.workerTransactionNoteInput.value = "";
  els.workerTransactionDateInput.value = todayDateInputValue();
  showToast(type === WORKER_SALARY_PAYMENT_TYPE ? "تم تسجيل القبضة." : "تم تسجيل السلفة.");
  render();
}

async function deleteWorkerTransaction(transactionId) {
  const entry = (state.workerTransactions || []).find((item) => item.id === transactionId);
  if (!entry) return;
  if (!guardClosedPeriod(entry.createdAt, "حذف حركة ضمن فترة مغلقة")) return;
  const confirmed = await appConfirm(`حذف حركة ${workerTransactionTypeLabel(entry.type)} للعامل ${entry.workerName}؟`);
  if (!confirmed) return;

  state.workerTransactions = state.workerTransactions.filter((item) => item.id !== transactionId);
  showToast("تم حذف حركة العامل.");
  render();
}

function recordExpense(event) {
  event.preventDefault();
  const worker = getWorker(selectedWorkerId);
  const workerName = worker?.name || "";
  const item = findMenuItem(els.workerItemInput.value);
  const qty = Math.max(Number(els.workerQtyInput.value || 0), 0);
  const type = ["worker_price", SALARY_WORKER_CONSUMPTION_TYPE, FREE_WORKER_CONSUMPTION_TYPE].includes(workerConsumptionMode) ? workerConsumptionMode : "worker_price";
  const isFree = type === FREE_WORKER_CONSUMPTION_TYPE;
  const price = isFree ? 0 : Math.max(Number(els.expenseAmountInput.value || 0), 0);
  const method = paymentMethods.includes(els.expenseMethodInput.value) ? els.expenseMethodInput.value : getLastPaymentMethod();

  if (!worker) {
    showToast("اختر عامل محفوظ أولا.");
    return;
  }

  if (!item || qty <= 0) {
    showToast("اختر الصنف والكمية.");
    return;
  }

  if (!isFree && price <= 0) {
    showToast(type === SALARY_WORKER_CONSUMPTION_TYPE ? "اكتب المبلغ اللي ينخصم من راتبه." : "اكتب السعر اللي دفعه، أو اختر مجاني.");
    els.expenseAmountInput.focus();
    return;
  }

  const consumptionDate = invoiceDateFromInput(els.expenseDateInput.value);
  if (!guardClosedPeriod(consumptionDate, "التسجيل بتاريخ ضمن فترة مغلقة")) return;

  const stockUsage = stockUsageFromMenuItem(item);
  const entry = normalizeWorkerConsumption({
    id: uid("worker"),
    type,
    workerId: worker.id,
    workerName,
    itemId: item.id,
    itemName: item.name,
    qty,
    price,
    cost: menuItemRecipeCost(item),
    method,
    note: els.expenseNoteInput.value.trim(),
    stockUsage,
    createdAt: consumptionDate
  });

  const stockResult = reduceStockForSoldItems([workerConsumptionLine(entry)]);
  state.workerConsumptions.unshift(entry);
  worker.updatedAt = entry.createdAt;
  state.lastWorkerConsumptionMode = type;
  setLastPaymentMethod(method);
  els.expenseTitleInput.value = worker.name;
  els.expenseAmountInput.value = "";
  els.workerItemInput.value = "";
  els.workerQtyInput.value = "1";
  els.expenseNoteInput.value = "";
  els.expenseDateInput.value = todayDateInputValue();
  const msg = type === SALARY_WORKER_CONSUMPTION_TYPE
    ? `تم التسجيل وخصم ${money(price * qty)} من راتب ${worker.name}.`
    : type === FREE_WORKER_CONSUMPTION_TYPE
      ? "تم التسجيل كمجاني (تتحمّل التكلفة فقط)."
      : `تم التسجيل ودخل ${money(price * qty)} للصندوق.`;
  const stockText = stockUsageAppliedText(stockResult);
  const stockMsg = stockText
    ? ` خصم من المخزون: ${stockText}.`
    : stockUsage.length
      ? " تم التسجيل، لكن لم أجد المخزون المرتبط حتى أخصمه."
      : " تم التسجيل بدون خصم مخزون لأن الصنف غير مربوط بالمخزون.";
  showToast(`${msg}${stockMsg}`);
  render();
}

async function deleteExpense(expenseId) {
  const entry = (state.workerConsumptions || []).find((item) => item.id === expenseId);
  if (!entry) return;
  if (!guardClosedPeriod(entry.createdAt, "حذف حركة ضمن فترة مغلقة")) return;
  const confirmed = await appConfirm(`حذف مشروب ${entry.itemName} للعامل ${entry.workerName}؟`);
  if (!confirmed) return;
  restoreStockForSoldItems([workerConsumptionLine(entry)]);
  state.workerConsumptions = state.workerConsumptions.filter((item) => item.id !== expenseId);
  showToast("تم حذف مشروب العامل ورجوع المخزون.");
  render();
}
