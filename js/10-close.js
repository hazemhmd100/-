// ═══ دفتر المقهى ═══ 10-close.js — إغلاق الفترة
// (مقسوم من app.js — الأسطر 4988-5341)

// ─── Period Close ──────────────────────────────────────────────────────────

function fmtNum(value) {
  const n = Number(value || 0);
  return n.toLocaleString("ar", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function toStdRange(range) {
  // Convert {from, to} ? {minDate, maxDate} for dateMatchesRange
  if (!range) return {};
  return { minDate: range.from || range.minDate, maxDate: range.to || range.maxDate };
}

// المدى المفتوح الحالي = من اليوم اللي بعد آخر إغلاق → اليوم
// (لو ما في إغلاقات: من بداية الشهر الميلادي كنقطة بداية)
function currentPeriodRange() {
  const last = lastPeriodClose();
  let from;
  if (last) {
    const next = new Date(last.to);
    next.setDate(next.getDate() + 1);
    from = next.toISOString().slice(0, 10);
  } else {
    from = monthStartInputValue();
  }
  return { minDate: from, maxDate: todayDateInputValue() };
}

// يستخدم نفس حساب صفحة العمال (موحّد) — راتب نسبي + نفس الخصومات
function workerPeriodAccount(worker, range) {
  return workerAccountForRange(worker, range);
}

function periodFinancialSummary(range) {
  const stdRange = toStdRange(range);
  const invoices = state.invoices.filter((inv) => dateMatchesRange(inv, stdRange));
  const purchases = (state.purchases || []).filter((p) => dateMatchesRange(p, stdRange));
  const supplierPayments = (state.supplierPayments || []).filter((payment) => dateMatchesRange(payment, stdRange));
  const expenses = (state.expenses || []).filter((e) => dateMatchesRange(e, stdRange) && !e.workerId);

  // Cash basis: actual cash/bank/wallet received
  const saleCashReceived = invoices
    .filter((inv) => inv.type === "sale" && !invoiceIsCancelled(inv))
    .reduce((sum, inv) => sum + paymentTotal(invoiceCashboxPayments(inv)), 0);
  const debtCashReceived = invoices
    .filter((inv) => inv.type === "payment" && !invoiceIsCancelled(inv))
    .reduce((sum, inv) => {
      const byMethod = paymentTotal(invoiceCashboxPayments(inv));
      return sum + (byMethod > 0 ? byMethod : Number(inv.paid || inv.amount || 0));
    }, 0);
  const workerDrinksPaid = (state.workerConsumptions || [])
    .filter((entry) => entry.type === "worker_price" && dateMatchesRange(entry, stdRange))
    .reduce((sum, entry) => sum + Number(entry.total || 0), 0);
  const cashReceived = saleCashReceived + debtCashReceived + workerDrinksPaid;

  // دفعات مدفوعة للعملاء (أرصدة رجعناها)
  const payoutsPaid = invoices
    .filter((inv) => inv.type === "payout" && !invoiceIsCancelled(inv))
    .reduce((sum, inv) => sum + paymentTotal(invoiceCashboxPayments(inv)), 0);

  // Accrual: total billed (including debt customers)
  const totalBilled = invoices
    .filter((inv) => inv.type === "sale" && !invoiceIsCancelled(inv))
    .reduce((sum, inv) => sum + Number(inv.total || 0), 0);

  // الدين الحقيقي غير المقبوض من مبيعات الفترة = مجموع المتبقي (delta) الموجب لكل فاتورة
  const periodUnpaid = invoices
    .filter((inv) => inv.type === "sale" && !invoiceIsCancelled(inv))
    .reduce((sum, inv) => {
      const delta = Number(inv.delta);
      const d = Number.isFinite(delta) ? delta : Number(inv.total || 0) - Number(inv.paid || 0);
      return sum + Math.max(0, d);
    }, 0);

  const totalPurchases = purchases.reduce((sum, p) => sum + purchasePaidAmount(p), 0);
  const totalSupplierPayments = supplierPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const workers = (state.workers || []).filter((w) => w.active !== false);
  const totalWorkersDue = workers.reduce((sum, w) => {
    const acc = workerPeriodAccount(w, range);
    return sum + Math.max(0, acc.due);
  }, 0);
  const workerTransactions = activeWorkerTransactions().filter((entry) => dateMatchesRange(entry, stdRange));
  const workerTransactionSummary = workerTransactionTotals(workerTransactions);
  const totalWorkerAdvances = workerTransactionSummary.advances;
  const totalWorkerSalaryPaid = workerTransactionSummary.salaryPaid;
  const totalWorkerCashOut = totalWorkerAdvances + totalWorkerSalaryPaid;

  const totalOut = totalPurchases + totalSupplierPayments + totalExpenses + totalWorkerCashOut + payoutsPaid;

  // فرق الجرد بالفترة: سالب = خسارة (نقص بضاعة)، موجب = زيادة
  const inv = periodInventory(range);

  const netCash = cashReceived - totalOut;
  const netAccrual = totalBilled - totalOut;

  // سحوبات صاحب المحل (حصته) خلال الفترة
  const withdrawals = (state.ownerWithdrawals || [])
    .filter((w) => dateMatchesRange(w, stdRange))
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);

  const netAfterInventory = netCash + inv.diffValue;

  return {
    cashReceived,
    saleCashReceived,
    debtCashReceived,
    workerDrinksPaid,
    totalBilled,
    totalPurchases,
    totalSupplierPayments,
    totalExpenses,
    totalWorkersDue,
    totalWorkerAdvances,
    totalWorkerSalaryPaid,
    totalWorkerCashOut,
    payoutsPaid,
    totalOut,
    netCash,
    netAccrual,
    periodUnpaid,
    inventoryDiff: inv.diffValue,        // سالب = خسارة
    inventoryCount: inv.count,
    netAfterInventory,
    withdrawals,
    netAfterWithdrawals: netAfterInventory - withdrawals
  };
}

// كل عمليات الجرد بالفترة + صافي فرق القيمة
function periodInventoryCounts(range) {
  if (!state.inventoryCounts || !state.inventoryCounts.length) return [];
  const stdRange = toStdRange(range);
  return state.inventoryCounts
    .filter((c) => dateMatchesRange(c, stdRange))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function periodInventory(range) {
  const counts = periodInventoryCounts(range);
  const diffValue = counts.reduce((sum, c) => {
    return sum + (c.lines || []).reduce((s, line) => s + Number(line.value || 0), 0);
  }, 0);
  return { count: counts.length, diffValue };
}

function getLastInventoryCount(range) {
  return periodInventoryCounts(range)[0] || null;
}

function getPeriodRange() {
  const from = els.closePeriodFrom.value;
  const to = els.closePeriodTo.value;
  if (!from || !to) return null;
  if (new Date(from) > new Date(to)) return null;
  return { from, to };
}

// لما يتغير أي تاريخ: حدّث عدّاد الأيام وأخفِ النتيجة القديمة (لازم يضغط احسب من جديد)
function onClosePeriodDateChange() {
  updatePeriodDaysLabel();
  els.closePeriodResult.hidden = true;
  if (els.closeOverlapWarning) els.closeOverlapWarning.hidden = true;
}

function updatePeriodDaysLabel() {
  const range = getPeriodRange();
  if (!range) { els.closePeriodDays.textContent = ""; return; }
  const days = Math.round((new Date(range.to) - new Date(range.from)) / 86400000) + 1;
  els.closePeriodDays.textContent = `${days} يوم`;
}

function renderPeriodClose() {
  const range = getPeriodRange();
  if (!range) {
    els.closePeriodResult.hidden = true;
    return;
  }
  els.closePeriodResult.hidden = false;

  const workers = (state.workers || []).filter((w) => w.active !== false);
  const periodDays = Math.round((new Date(range.to) - new Date(range.from)) / 86400000) + 1;

  // ── Step 1: Workers ──────────────────────────────────────────────────────
  // التسوية تتبع حساب العامل الفعلي (فترته الخاصة حتى اليوم) — نفس اللي بصفحة العمال
  if (els.closeWorkerSubtitle) {
    els.closeWorkerSubtitle.textContent = `حساب كل عامل لفترته الخاصة حتى اليوم`;
  }

  if (!workers.length) {
    els.closeWorkersTable.innerHTML = `<p class="close-empty">لا يوجد عمال مسجلون.</p>`;
    els.closePayAllButton.hidden = true;
  } else {
    let anyDue = false;
    const rows = workers.map((worker) => {
      const acc = workerMonthlyAccount(worker);
      const due = acc.due;
      if (due > 0) anyDue = true;
      const dueClass = due > 0 ? "close-due-positive" : due < 0 ? "close-due-negative" : "";
      const dueLabel = due > 0 ? `متبقي: ${fmtNum(due)} ج` : due < 0 ? `زيادة: ${fmtNum(Math.abs(due))} ج` : "مسوّى";
      return `<tr>
        <td>${escapeHtml(worker.name)}</td>
        <td>${fmtNum(acc.salary)} ج <small>(${acc.periodDays}/30 × ${fmtNum(worker.salary || 0)})</small></td>
        <td>${fmtNum(acc.salaryPaid)} ج</td>
        <td>${fmtNum(acc.deductions)} ج</td>
        <td class="${dueClass}">${dueLabel}</td>
      </tr>`;
    }).join("");

    els.closeWorkersTable.innerHTML = `
      <table class="close-workers-table">
        <thead><tr>
          <th>العامل</th>
          <th>المستحق للفترة</th>
          <th>المدفوع</th>
          <th>سلف / مشروبات</th>
          <th>الرصيد</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    els.closePayAllButton.hidden = !anyDue;
  }

  // ── Step 2: Inventory ────────────────────────────────────────────────────
  if (els.closeInventorySubtitle) {
    els.closeInventorySubtitle.textContent = `آخر جرد في الفترة`;
  }
  const lastCount = getLastInventoryCount(range);
  const inv = periodInventory(range);
  if (!lastCount) {
    els.closeInventoryInfo.innerHTML = `
      <div class="close-inventory-warning">
        ⚠️ ما عملت جرد لهالفترة بعد — اعمل جرد أول عشان خسارة/زيادة البضاعة تنحسب بالصافي.
        <button class="secondary-button" type="button" id="closeGoInventoryInlineButton">📊 روح اعمل جرد الآن</button>
      </div>`;
    const goBtn = document.getElementById("closeGoInventoryInlineButton");
    if (goBtn) goBtn.addEventListener("click", () => { state.view = "inventory"; render(); });
  } else {
    const date = formatDate(lastCount.createdAt);
    const lines = lastCount.lines || [];
    const lastDiff = lines.reduce((sum, l) => sum + Number(l.value || 0), 0);
    const lastDiffClass = lastDiff >= 0 ? "close-due-positive" : "close-due-negative";
    const totalClass = inv.diffValue >= 0 ? "close-due-positive" : "close-due-negative";
    const totalLabel = inv.diffValue >= 0 ? "زيادة" : "خسارة";
    els.closeInventoryInfo.innerHTML = `
      <div class="close-inventory-summary">
        <span>📦 آخر جرد: <strong>${date}</strong></span>
        <span>عدد الأصناف: <strong>${lines.length}</strong></span>
        <span class="${lastDiffClass}">فرق آخر جرد: <strong>${lastDiff >= 0 ? "+" : ""}${fmtNum(lastDiff)} ج</strong></span>
        ${inv.count > 1 ? `<span class="${totalClass}">صافي ${totalLabel} الفترة (${inv.count} جرد): <strong>${inv.diffValue >= 0 ? "+" : ""}${fmtNum(inv.diffValue)} ج</strong></span>` : ""}
      </div>`;
  }

  // ── Step 3: Financial Summary ────────────────────────────────────────────
  const summary = periodFinancialSummary(range);
  // الدين الفعلي الحالي = مجموع أرصدة العملاء الموجبة (اللي عليهم فعلاً الآن، بعد أي تسديد)
  const pendingDebt = customerTotals().debt;
  const invDiff = summary.inventoryDiff;
  const hasInvDiff = Math.abs(invDiff) > 0.001;
  const closeOutParts = [
    { label: "مشتريات مدفوعة", amount: summary.totalPurchases },
    { label: "تسديد موردين", amount: summary.totalSupplierPayments },
    { label: "مصروفات", amount: summary.totalExpenses },
    { label: "سلف عمال", amount: summary.totalWorkerAdvances },
    { label: "قبضات عمال مدفوعة", amount: summary.totalWorkerSalaryPaid },
    { label: "دفعات لعملاء", amount: summary.payoutsPaid }
  ].filter((part) => Number(part.amount || 0) > 0.001);
  const closeOutText = closeOutParts.length
    ? closeOutParts.map((part) => `${part.label} ${money(part.amount)}`).join(" + ")
    : "لا يوجد طالع فعلي";
  els.closeSummary.innerHTML = `
    <div class="cashbox-card ${summary.netCash >= 0 ? "is-positive" : "is-negative"}">
      <div class="cashbox-main">
        <span>💰 صافي الفترة — اللي بضل معك</span>
        <strong>${money(summary.netCash)}</strong>
        <small>بعد المصاريف المدفوعة فعلياً فقط</small>
      </div>
      <div class="cashbox-breakdown">
        <div class="cashbox-flow cashbox-in">
          <strong>⬇ دخل: ${money(summary.cashReceived)}</strong>
          <small>بيع ${money(summary.saleCashReceived)} + تسديد ديون ${money(summary.debtCashReceived)}${Number(summary.workerDrinksPaid || 0) > 0.001 ? ` + مشروبات عمال ${money(summary.workerDrinksPaid)}` : ""}</small>
        </div>
        <div class="cashbox-flow cashbox-out">
          <strong>⬆ طلع: ${money(summary.totalOut)}</strong>
          <small>${closeOutText}</small>
        </div>
      </div>
    </div>
    ${summary.totalWorkersDue > 0.001 ? `
    <p class="close-pending-note">📌 مستحق عمال غير مدفوع: ${money(summary.totalWorkersDue)} — هذا لا يدخل في الطالع إلا لما تسجل قبضة فعلية.</p>
    ` : ""}
    ${hasInvDiff ? `
    <div class="cashbox-card ${summary.netAfterInventory >= 0 ? "is-positive" : "is-negative"}" style="margin-top:12px;">
      <div class="cashbox-main">
        <span>📦 الصافي بعد الجرد (بعد ${invDiff < 0 ? "خسارة" : "زيادة"} البضاعة)</span>
        <strong>${money(summary.netAfterInventory)}</strong>
        <small>صافي الفترة ${money(summary.netCash)} ${invDiff < 0 ? "−" : "+"} ${invDiff < 0 ? "خسارة جرد" : "زيادة جرد"} ${money(Math.abs(invDiff))}</small>
      </div>
      <div class="cashbox-breakdown">
        <div class="cashbox-flow ${invDiff < 0 ? "cashbox-out" : "cashbox-in"}">
          <strong>${invDiff < 0 ? "📉 خسارة جرد" : "📈 زيادة جرد"}: ${money(Math.abs(invDiff))}</strong>
          <small>فرق البضاعة بين النظام والعدّ الفعلي (${summary.inventoryCount} عملية جرد)</small>
        </div>
      </div>
    </div>
    ` : ""}
    ${summary.withdrawals > 0.001 ? `
    <div class="cashbox-card ${summary.netAfterWithdrawals >= 0 ? "is-positive" : "is-negative"}" style="margin-top:12px;">
      <div class="cashbox-main">
        <span>🏦 الباقي بالمشروع بعد سحب حصتك</span>
        <strong>${money(summary.netAfterWithdrawals)}</strong>
        <small>الصافي ${money(summary.netAfterInventory)} − حصتك المسحوبة ${money(summary.withdrawals)}</small>
      </div>
      <div class="cashbox-breakdown">
        <div class="cashbox-flow cashbox-out">
          <strong>💸 سحبت حصتك: ${money(summary.withdrawals)}</strong>
          <small>طلعت من الصندوق لجيبك</small>
        </div>
      </div>
    </div>
    ` : ""}
    ${pendingDebt > 0.001 ? `
    <p class="close-pending-note">📌 عملاؤك عليهم ديون حالياً مجموعها ${money(pendingDebt)} لسا ما انقبضت — لو حصّلتها بيزيد الكاش عندك بمقدارها.</p>
    ` : ""}`;

  // قائمة السحوبات داخل الفترة + حقل الإدخال
  renderCloseWithdrawals(range, summary);
}

function periodWithdrawals(range) {
  const stdRange = toStdRange(range);
  return (state.ownerWithdrawals || [])
    .filter((w) => dateMatchesRange(w, stdRange))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function renderCloseWithdrawals(range, summary) {
  if (!els.closeWithdrawList) return;
  const list = periodWithdrawals(range);
  els.closeWithdrawList.innerHTML = list.length
    ? `<div class="close-withdraw-items">${list.map((w) => `
        <article class="close-withdraw-item">
          <span>💸 ${money(w.amount)} <small>(${paymentLabels[w.method] || w.method})</small></span>
          <small>${formatDate(w.createdAt)}</small>
          <button class="inventory-history-delete" type="button" data-remove-withdrawal="${w.id}" title="حذف السحب">🗑</button>
        </article>
      `).join("")}
      <div class="close-withdraw-total">إجمالي حصتك المسحوبة بالفترة: <strong>${money(summary.withdrawals)}</strong></div>
      </div>`
    : "";
}

function recordCloseWithdrawal() {
  const range = getPeriodRange();
  if (!range) { showToast("احسب الفترة أولاً."); return; }
  const amount = Math.max(Number(els.closeWithdrawAmount.value || 0), 0);
  if (amount <= 0) { showToast("اكتب مبلغ السحب."); els.closeWithdrawAmount.focus(); return; }
  const method = paymentMethods.includes(els.closeWithdrawMethod.value) ? els.closeWithdrawMethod.value : "cash";
  state.ownerWithdrawals = state.ownerWithdrawals || [];
  const withdrawal = {
    id: uid("withdraw"),
    amount,
    method,
    note: "حصة صاحب المحل",
    createdAt: new Date(`${range.to}T12:00:00`).toISOString()
  };
  state.ownerWithdrawals.push(withdrawal);
  auditAction("owner_withdrawal.create", {
    amount,
    method,
    period: `${range.from} — ${range.to}`,
    createdAt: withdrawal.createdAt
  });
  saveState();
  els.closeWithdrawAmount.value = "";
  showToast(`💸 سحبت حصتك ${money(amount)} (${paymentLabels[method]}) — انخصمت من الصندوق.`);
  renderPeriodClose();
  renderCloseInfo();
}

async function removeOwnerWithdrawal(id) {
  const entry = (state.ownerWithdrawals || []).find((w) => w.id === id);
  if (!entry) return;
  if (!guardClosedPeriod(entry.createdAt, "حذف سحب ضمن فترة مغلقة")) return;
  if (!(await appConfirm(`حذف سحب ${money(entry.amount)}؟`))) return;
  state.ownerWithdrawals = state.ownerWithdrawals.filter((w) => w.id !== id);
  auditAction("owner_withdrawal.delete", {
    amount: entry.amount,
    method: entry.method,
    createdAt: entry.createdAt
  });
  saveState();
  showToast("تم حذف السحب.");
  renderPeriodClose();
  renderCloseInfo();
}

function lastPeriodClose() {
  const closes = state.periodCloses || [];
  if (!closes.length) return null;
  return closes.slice().sort((a, b) => String(b.to).localeCompare(String(a.to)))[0];
}

function rangeOverlapsClose(range) {
  return (state.periodCloses || []).some((c) => range.from <= c.to && range.to >= c.from);
}

function closedPeriodFor(dateIso) {
  const day = String(dateIso || "").slice(0, 10);
  if (!day) return null;
  return (state.periodCloses || []).find((c) => day >= c.from && day <= c.to) || null;
}

function guardClosedPeriod(dateIso, actionLabel) {
  const closed = closedPeriodFor(dateIso);
  if (!closed) return true;
  showToast(`🔒 لا يمكن ${actionLabel} — التاريخ ضمن فترة مغلقة (${closed.from} — ${closed.to}). احذف الإغلاق من سجل الإغلاقات أولاً إذا لزم.`);
  return false;
}

function renderCloseInfo() {
  // شريط آخر إغلاق
  const last = lastPeriodClose();
  if (last) {
    els.lastCloseBanner.hidden = false;
    els.lastCloseBanner.innerHTML = `🔒 آخر إغلاق: <strong>${last.to}</strong> (فترة ${last.from} — ${last.to})`;
  } else {
    els.lastCloseBanner.hidden = true;
  }

  // تعبئة التواريخ تلقائياً إذا فاضية
  if (!els.closePeriodFrom.value) {
    if (last) {
      const next = new Date(last.to);
      next.setDate(next.getDate() + 1);
      els.closePeriodFrom.value = next.toISOString().slice(0, 10);
    }
  }
  if (!els.closePeriodTo.value) {
    els.closePeriodTo.value = new Date().toISOString().slice(0, 10);
  }
  updatePeriodDaysLabel();

  // سجل الإغلاقات
  const closes = (state.periodCloses || []).slice().sort((a, b) => String(b.to).localeCompare(String(a.to)));
  els.closeHistoryList.innerHTML = closes.length
    ? closes.map((c) => {
      const expanded = c.id === expandedCloseId;
      return `
      <article class="close-history-row ${expanded ? "is-expanded" : ""}">
        <div class="close-history-head" data-toggle-close="${c.id}">
          <div class="close-history-main">
            <strong>${c.from} — ${c.to}</strong>
            <small>أُغلقت في ${formatDate(c.closedAt)}</small>
          </div>
          <div class="close-history-figures">
            <span>الصافي: <strong class="${Number(c.netCash) >= 0 ? 'close-due-positive' : 'close-due-negative'}">${fmtNum(c.netCash)} ج</strong></span>
            <span>الباقي: <strong class="${closeRemaining(c) >= 0 ? 'close-due-positive' : 'close-due-negative'}">${fmtNum(closeRemaining(c))} ج</strong></span>
            <span class="close-history-caret">${expanded ? "▲" : "▼"}</span>
          </div>
          <button class="inventory-history-delete" type="button" data-remove-period-close="${c.id}" title="حذف الإغلاق" aria-label="حذف الإغلاق">🗑</button>
        </div>
        ${expanded ? closeDetailHtml(c) : ""}
      </article>`;
    }).join("")
    : '<div class="empty-state">لا يوجد إغلاقات بعد.</div>';
}

// الباقي الفعلي بعد الجرد وسحب الحصة (مع توافق للإغلاقات القديمة)
function closeRemaining(c) {
  if (c.netAfterWithdrawals !== undefined) return Number(c.netAfterWithdrawals || 0);
  if (c.netAfterInventory !== undefined) return Number(c.netAfterInventory || 0);
  return Number(c.netCash || 0);
}

function closeDetailHtml(c) {
  const n = (v) => Number(v || 0);
  const row = (label, value, cls = "") => `
    <div class="close-detail-row">
      <span>${label}</span>
      <strong class="${cls}">${fmtNum(value)} ج</strong>
    </div>`;
  const signCls = (v) => (n(v) >= 0 ? "close-due-positive" : "close-due-negative");
  const hasInv = c.inventoryDiff !== undefined && Math.abs(n(c.inventoryDiff)) > 0.001;
  const hasWithdraw = n(c.withdrawals) > 0.001;

  return `
    <div class="close-detail">
      <div class="close-detail-group">
        <h5>⬇ الداخل</h5>
        ${row("المقبوض فعلياً", c.cashReceived, "close-due-positive")}
        ${n(c.saleCashReceived) > 0.001 ? row("مقبوض البيع", c.saleCashReceived, "close-due-positive") : ""}
        ${n(c.debtCashReceived) > 0.001 ? row("تسديد ديون", c.debtCashReceived, "close-due-positive") : ""}
        ${n(c.workerDrinksPaid) > 0.001 ? row("مشروبات عمال مدفوعة", c.workerDrinksPaid, "close-due-positive") : ""}
        ${row("إجمالي المبيعات المفوترة", c.totalBilled)}
      </div>
      <div class="close-detail-group">
        <h5>⬆ الطالع</h5>
        ${row("مشتريات", c.totalPurchases, "close-due-negative")}
        ${row("مصروفات", c.totalExpenses, "close-due-negative")}
        ${row("سلف عمال", c.totalWorkerAdvances, "close-due-negative")}
        ${row("قبضات عمال مدفوعة", c.totalWorkerSalaryPaid, "close-due-negative")}
        ${n(c.payoutsPaid) > 0.001 ? row("دفعات لعملاء", c.payoutsPaid, "close-due-negative") : ""}
      </div>
      <div class="close-detail-group">
        <h5>📊 النتيجة</h5>
        ${row("صافي الفترة (نقدي)", c.netCash, signCls(c.netCash))}
        ${hasInv ? row(n(c.inventoryDiff) < 0 ? "خسارة جرد" : "زيادة جرد", Math.abs(n(c.inventoryDiff)), signCls(c.inventoryDiff)) : ""}
        ${c.netAfterInventory !== undefined ? row("الصافي بعد الجرد", c.netAfterInventory, signCls(c.netAfterInventory)) : ""}
        ${hasWithdraw ? row("حصتك المسحوبة", c.withdrawals, "close-due-negative") : ""}
        ${c.netAfterWithdrawals !== undefined && hasWithdraw ? row("الباقي بالمشروع بعد سحبك", c.netAfterWithdrawals, signCls(c.netAfterWithdrawals)) : ""}
        ${n(c.totalWorkersDue) > 0.001 ? row("مستحق عمال (وقت الإغلاق)", c.totalWorkersDue) : ""}
      </div>
    </div>`;
}

function toggleCloseDetail(id) {
  expandedCloseId = expandedCloseId === id ? null : id;
  renderCloseInfo();
}

async function approvePeriodClose() {
  const range = getPeriodRange();
  if (!range) { showToast("اختر تاريخ البداية والنهاية."); return; }
  if (rangeOverlapsClose(range)) {
    const ok = await appConfirm("هذه الفترة متداخلة مع إغلاق سابق. هل تريد اعتمادها على أي حال؟");
    if (!ok) return;
  }
  const summary = periodFinancialSummary(range);
  state.periodCloses = state.periodCloses || [];
  const closeEntry = {
    id: uid("close"),
    from: range.from,
    to: range.to,
    closedAt: new Date().toISOString(),
    cashReceived: summary.cashReceived,
    saleCashReceived: summary.saleCashReceived,
    debtCashReceived: summary.debtCashReceived,
    workerDrinksPaid: summary.workerDrinksPaid,
    totalBilled: summary.totalBilled,
    totalPurchases: summary.totalPurchases,
    totalExpenses: summary.totalExpenses,
    totalWorkersDue: summary.totalWorkersDue,
    totalWorkerAdvances: summary.totalWorkerAdvances,
    totalWorkerSalaryPaid: summary.totalWorkerSalaryPaid,
    totalWorkerCashOut: summary.totalWorkerCashOut,
    payoutsPaid: summary.payoutsPaid,
    netCash: summary.netCash,
    netAccrual: summary.netAccrual,
    inventoryDiff: summary.inventoryDiff,
    netAfterInventory: summary.netAfterInventory,
    withdrawals: summary.withdrawals,
    netAfterWithdrawals: summary.netAfterWithdrawals
  };
  state.periodCloses.push(closeEntry);
  auditAction("period_close.approve", {
    id: closeEntry.id,
    from: closeEntry.from,
    to: closeEntry.to,
    netCash: closeEntry.netCash,
    netAfterWithdrawals: closeEntry.netAfterWithdrawals
  });
  saveState();
  showToast(`✅ تم اعتماد إغلاق الفترة ${range.from} — ${range.to}.`);
  els.closePeriodResult.hidden = true;
  els.closePeriodFrom.value = "";
  els.closePeriodTo.value = "";
  renderCloseInfo();
}

async function removePeriodClose(id) {
  const entry = (state.periodCloses || []).find((c) => c.id === id);
  if (!entry) return;
  const ok = await appConfirm(`حذف إغلاق الفترة ${entry.from} — ${entry.to}؟`);
  if (!ok) return;
  state.periodCloses = state.periodCloses.filter((c) => c.id !== id);
  auditAction("period_close.delete", {
    id: entry.id,
    from: entry.from,
    to: entry.to,
    netCash: entry.netCash
  });
  saveState();
  showToast("تم حذف الإغلاق.");
  renderCloseInfo();
}

function calcPeriodClose() {
  const range = getPeriodRange();
  if (!range) {
    showToast("اختر تاريخ البداية والنهاية.");
    return;
  }
  els.closeOverlapWarning.hidden = !rangeOverlapsClose(range);
  renderPeriodClose();
}

function closePayAll() {
  const range = getPeriodRange();
  if (!range) return;
  const paidAt = new Date(`${range.to}T12:00:00`).toISOString();
  const workers = (state.workers || []).filter((w) => w.active !== false);
  let count = 0;
  workers.forEach((worker) => {
    const acc = workerPeriodAccount(worker, range);
    if (acc.due <= 0.001) return;
    const transaction = {
      id: uid("wtx"),
      workerId: worker.id,
      workerName: worker.name,
      type: "salary_payment",
      amount: acc.due,
      method: getLastPaymentMethod(),
      note: `تسوية حساب عند إغلاق فترة ${range.from} — ${range.to}`,
      createdAt: paidAt
    };
    state.workerTransactions = state.workerTransactions || [];
    state.workerTransactions.push(transaction);
    count++;
  });
  if (!count) { showToast("لا يوجد عمال برصيد مستحق."); return; }
  auditAction("workers.pay_all", {
    count,
    period: `${range.from} — ${range.to}`,
    createdAt: paidAt
  });
  saveState();
  showToast(`تم تسجيل دفع رواتب ${count} عامل/عمال.`);
  renderPeriodClose();
}
