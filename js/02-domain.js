// ═══ دفتر المقهى ═══ 02-domain.js — الحسابات المشتركة: نقود، طلبات، عملاء، عمال، تقارير، مخزون
// (مقسوم من app.js — الأسطر 515-1455)

// مُنسّقات Intl تُنشأ مرة واحدة (إنشاؤها لكل نداء كان يثقّل كل الشاشات).
const _moneyFormatter = new Intl.NumberFormat("ar", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const _qtyFormatterWhole = new Intl.NumberFormat("ar", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const _qtyFormatterFraction = new Intl.NumberFormat("ar", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const _dateFormatter = new Intl.DateTimeFormat("ar", {
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: true
});

function money(value) {
  return `₪${_moneyFormatter.format(Number(value || 0))}`;
}

function inputNumberValue(value) {
  const number = Number(value || 0);
  return number ? String(number) : "";
}

function getLastPaymentMethod() {
  return paymentMethods.includes(state.lastPaymentMethod) ? state.lastPaymentMethod : "cash";
}

function setLastPaymentMethod(method) {
  if (!paymentMethods.includes(method)) return;
  state.lastPaymentMethod = method;
  if (els.settlementMethodInput) els.settlementMethodInput.value = method;
  if (els.purchaseMethodInput) els.purchaseMethodInput.value = method;
  if (els.expenseMethodInput) els.expenseMethodInput.value = method;
  if (els.workerTransactionMethodInput) els.workerTransactionMethodInput.value = method;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultTableLabel(tableId) {
  return `طاولة ${tableId}`;
}

function getTableCount() {
  state.tableCount = Math.max(1, Math.floor(Number(state.tableCount || DEFAULT_TABLE_COUNT)));
  return state.tableCount;
}

function getTableLabel(tableId = state.selectedTable) {
  return state.tableNames?.[String(tableId)]?.trim() || defaultTableLabel(tableId);
}

function setTableLabel(tableId, value) {
  const key = String(tableId);
  const label = String(value || "").trim();
  state.tableNames = state.tableNames || {};

  if (!label || label === defaultTableLabel(tableId)) {
    delete state.tableNames[key];
  } else {
    state.tableNames[key] = label;
  }
}

function getOpenOrder(tableId = state.selectedTable) {
  const key = String(tableId);
  if (!state.openOrders[key]) {
    state.openOrders[key] = {
      id: uid("order"),
      tableId,
      customerId: null,
      customerName: "",
      customerPhone: "",
      items: [],
      discount: 0,
      paymentMethod: getLastPaymentMethod(),
      payments: { cash: 0, bank: 0, wallet: 0 },
      changeReturned: 0,
      note: "",
      createdAt: new Date().toISOString()
    };
  }
  return state.openOrders[key];
}

function getExistingOrder(tableId = state.selectedTable) {
  return state.openOrders[String(tableId)] || null;
}

function getCustomer(id) {
  return state.customers.find((customer) => customer.id === id) || null;
}

function getCustomerItemPrice(customerId, itemId) {
  if (!customerId || !itemId) return null;
  const entry = (state.customerPrices || []).find(
    (cp) => cp.customerId === customerId && cp.itemId === itemId
  );
  return entry ? Number(entry.price) : null;
}

function setCustomerItemPrice(customerId, itemId, price) {
  state.customerPrices = state.customerPrices || [];
  const idx = state.customerPrices.findIndex(
    (cp) => cp.customerId === customerId && cp.itemId === itemId
  );
  if (idx >= 0) {
    state.customerPrices[idx].price = price;
  } else {
    state.customerPrices.push({ customerId, itemId, price });
  }
}

function removeCustomerItemPrice(customerId, itemId) {
  state.customerPrices = (state.customerPrices || []).filter(
    (cp) => !(cp.customerId === customerId && cp.itemId === itemId)
  );
}

function customerPricesFor(customerId) {
  return (state.customerPrices || []).filter((cp) => cp.customerId === customerId);
}

function findCustomerByName(name) {
  const cleanedName = String(name || "").trim().toLowerCase();
  if (!cleanedName) return null;
  return state.customers.find((customer) => customer.name.trim().toLowerCase() === cleanedName) || null;
}

function normalizeWorker(worker = {}) {
  const name = String(worker.name || worker.workerName || worker.title || "").trim();
  return {
    id: worker.id || uid("worker-profile"),
    name: name || "عامل",
    phone: String(worker.phone || "").trim(),
    salary: Math.max(Number(worker.salary || worker.monthlySalary || 0), 0),
    periodFrom: typeof worker.periodFrom === "string" ? worker.periodFrom : "",
    createdAt: normalizeImportedDate(worker.createdAt || new Date().toISOString()),
    updatedAt: normalizeImportedDate(worker.updatedAt || worker.createdAt || new Date().toISOString())
  };
}

function reconcileWorkers(workers = [], entries = [], transactions = []) {
  const normalized = [];
  const byName = new Map();
  const byId = new Map();

  function attachSource(source) {
    if (source.workerDeleted) return;
    const workerName = String(source.workerName || "").trim();
    if (!workerName) return;

    let worker = source.workerId ? byId.get(source.workerId) : null;
    if (!worker) worker = byName.get(workerName.toLowerCase());
    if (!worker) {
      worker = normalizeWorker({
        name: workerName,
        createdAt: source.createdAt || new Date().toISOString()
      });
      normalized.push(worker);
      byName.set(worker.name.trim().toLowerCase(), worker);
      byId.set(worker.id, worker);
    }

    source.workerId = worker.id;
    source.workerName = worker.name;
  }

  workers.map(normalizeWorker).forEach((worker) => {
    const key = worker.name.trim().toLowerCase();
    if (byName.has(key)) return;
    normalized.push(worker);
    byName.set(key, worker);
    byId.set(worker.id, worker);
  });

  entries.forEach(attachSource);
  transactions.forEach(attachSource);

  return normalized;
}

function getWorker(id) {
  return (state.workers || []).find((worker) => worker.id === id) || null;
}

function findWorkerByName(name) {
  const cleanedName = String(name || "").trim().toLowerCase();
  if (!cleanedName) return null;
  return (state.workers || []).find((worker) => worker.name.trim().toLowerCase() === cleanedName) || null;
}

function upsertWorker(name, extra = {}) {
  const cleanedName = String(name || "").trim();
  if (!cleanedName) return null;

  state.workers = Array.isArray(state.workers) ? state.workers : [];
  const existing = findWorkerByName(cleanedName);
  if (existing) {
    Object.assign(existing, extra, { updatedAt: new Date().toISOString() });
    return existing;
  }

  const worker = normalizeWorker({
    name: cleanedName,
    phone: extra.phone || "",
    salary: extra.salary || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  state.workers.push(worker);
  return worker;
}

function workerEntriesFor(worker) {
  if (!worker) return [];
  const workerName = worker.name.trim().toLowerCase();
  return (state.workerConsumptions || [])
    .filter((entry) => !entry.workerDeleted)
    .filter((entry) => {
      return entry.workerId === worker.id || (!entry.workerId && String(entry.workerName || "").trim().toLowerCase() === workerName);
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function workerTransactionsFor(worker) {
  if (!worker) return [];
  const workerName = worker.name.trim().toLowerCase();
  return (state.workerTransactions || [])
    .filter((entry) => !entry.workerDeleted)
    .filter((entry) => {
      return entry.workerId === worker.id || (!entry.workerId && String(entry.workerName || "").trim().toLowerCase() === workerName);
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function isActiveWorkerTransaction(entry = {}) {
  if (entry.workerDeleted) return false;
  if (entry.workerId && getWorker(entry.workerId)) return true;
  const workerName = String(entry.workerName || "").trim();
  return Boolean(workerName && findWorkerByName(workerName));
}

function activeWorkerTransactions(entries = state.workerTransactions || []) {
  return (entries || []).filter(isActiveWorkerTransaction);
}

function workerTransactionTypeLabel(type) {
  return workerTransactionTypeLabels[type] || workerTransactionTypeLabels[WORKER_ADVANCE_TYPE];
}

function workerMonthRange() {
  return {
    minDate: monthStartInputValue(),
    maxDate: todayDateInputValue()
  };
}

function workerTransactionTotals(transactions = []) {
  return transactions.reduce((totals, entry) => {
    const amount = Number(entry.amount || 0);
    if (entry.type === WORKER_SALARY_PAYMENT_TYPE) totals.salaryPaid += amount;
    else totals.advances += amount;
    return totals;
  }, { advances: 0, salaryPaid: 0 });
}

// عدد أيام المدى (يقبل {from,to} أو {minDate,maxDate})
function periodDaysForRange(range) {
  const from = range?.minDate || range?.from;
  const to = range?.maxDate || range?.to;
  if (!from || !to) return 30;
  return Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
}

// المصدر الموحّد لحساب العامل لأي مدى — تستخدمه صفحة العمال وإغلاق الفترة معاً
// الراتب نسبي حسب أيام المدى: (الأيام ÷ 30) × الراتب الشهري
function workerAccountForRange(worker, range) {
  const r = { minDate: range?.minDate || range?.from, maxDate: range?.maxDate || range?.to };
  const consumptions = workerEntriesFor(worker).filter((entry) => dateMatchesRange(entry, r));
  const transactions = workerTransactionsFor(worker).filter((entry) => dateMatchesRange(entry, r));
  const drinkStats = workerConsumptionTotals(consumptions);
  const transactionStats = workerTransactionTotals(transactions);
  const monthlySalary = Number(worker?.salary || 0);
  const periodDays = periodDaysForRange(r);
  const salary = Math.round((periodDays / 30) * monthlySalary); // نسبي
  // يُخصم من الراتب: السلف + المشروبات نوع "خصم من الراتب" فقط
  // (مشروبات "سعر عامل" دفعها كاش، فما تُخصم من الراتب — كانت تُحسب مرتين)
  const deductions = transactionStats.advances + drinkStats.salaryDeductions;
  const due = salary - deductions - transactionStats.salaryPaid;
  return {
    range: r,
    periodDays,
    monthlySalary,
    salary,
    consumptions,
    transactions,
    drinkStats,
    advances: transactionStats.advances,
    salaryPaid: transactionStats.salaryPaid,
    deductions,
    due
  };
}

// مدى العامل: بدايته الخاصة (إن وُجدت) ← وإلا بداية الفترة الحالية (بعد آخر إغلاق). والنهاية مفتوحة لليوم.
function workerRangeFor(worker) {
  const from = (worker && worker.periodFrom) || currentPeriodRange().minDate;
  return { minDate: from, maxDate: todayDateInputValue() };
}

function workerMonthlyAccount(worker) {
  return workerAccountForRange(worker, workerRangeFor(worker));
}

function workerBalanceText(value) {
  if (value > 0.001) return `له ${money(value)}`;
  if (value < -0.001) return `عليه ${money(Math.abs(value))}`;
  return "حسابه صافي";
}

function getOrderCustomerName(order) {
  if (!order) return "";
  return order.customerName?.trim() || getCustomer(order.customerId)?.name || "";
}

function manualDebtAmount(order) {
  if (order.items.length) return 0;
  const amount = paymentTotal(order.payments);
  const hasCustomer = Boolean(order.customerId || order.customerName?.trim());
  return hasCustomer && amount > 0 ? amount : 0;
}

function upsertCustomer(name, extra = {}) {
  const cleanedName = String(name || "").trim();
  if (!cleanedName) return null;

  const existing = state.customers.find((customer) => customer.name.trim() === cleanedName);
  if (existing) {
    Object.assign(existing, extra, { updatedAt: new Date().toISOString() });
    return existing;
  }

  const customer = {
    id: uid("customer"),
    name: cleanedName,
    phone: extra.phone || "",
    balance: 0,
    totalBilled: 0,
    totalPaid: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.customers.unshift(customer);
  return customer;
}

function orderMath(order) {
  const manualDebt = manualDebtAmount(order);
  if (manualDebt > 0) {
    return {
      subtotal: manualDebt,
      discount: 0,
      total: manualDebt,
      cost: 0,
      profit: manualDebt,
      paid: 0,
      rawPaid: manualDebt,
      changeReturned: 0,
      delta: manualDebt,
      manualDebt: true
    };
  }

  const subtotal = order.items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discount = Math.min(Number(order.discount || 0), subtotal);
  const total = Math.max(subtotal - discount, 0);
  const cost = order.items.reduce((sum, item) => sum + Number(item.cost || 0) * Number(item.qty || 0), 0);
  const profit = total - cost;
  const rawPaid = paymentTotal(order.payments);
  const changeReturned = Math.min(Math.max(Number(order.changeReturned || 0), 0), rawPaid);
  const paid = Math.max(rawPaid - changeReturned, 0);
  const delta = total - paid;
  return { subtotal, discount, total, cost, profit, paid, rawPaid, changeReturned, delta };
}

function paymentTotal(payments = {}) {
  return Number(payments.cash || 0) + Number(payments.bank || 0) + Number(payments.wallet || 0);
}

function paymentsAfterChangeReturned(payments = {}, changeReturned = 0, preferredMethod = "cash") {
  const next = {
    cash: Number(payments.cash || 0),
    bank: Number(payments.bank || 0),
    wallet: Number(payments.wallet || 0)
  };
  let remaining = Math.max(Number(changeReturned || 0), 0);
  const methods = [preferredMethod, ...paymentMethods.filter((method) => method !== preferredMethod)]
    .filter((method) => paymentMethods.includes(method));

  methods.forEach((method) => {
    if (remaining <= 0) return;
    const take = Math.min(next[method] || 0, remaining);
    next[method] = Math.max((next[method] || 0) - take, 0);
    remaining -= take;
  });

  return next;
}

function paymentMethodFromPayments(payments = {}) {
  return paymentMethods.find((method) => Number(payments[method] || 0) > 0) || getLastPaymentMethod();
}

function normalizedPaymentMap(payments = {}) {
  return {
    cash: Math.max(Number(payments.cash || 0), 0),
    bank: Math.max(Number(payments.bank || 0), 0),
    wallet: Math.max(Number(payments.wallet || 0), 0)
  };
}

function invoiceCashboxPayments(invoice = {}) {
  if (typeof invoiceIsCancelled === "function" && invoiceIsCancelled(invoice)) return { cash: 0, bank: 0, wallet: 0 };

  const payments = normalizedPaymentMap(invoice.payments || {});
  const byMethod = paymentTotal(payments);
  const paid = Math.max(Number(invoice.paid ?? invoice.amount ?? 0), 0);
  const changeReturned = Math.max(Number(invoice.changeReturned || 0), 0);
  const received = Math.max(Number(invoice.received || 0), 0);

  if (changeReturned > 0.001 && byMethod > paid + 0.001) {
    const expectedReceived = received > 0.001 ? received : paid + changeReturned;
    const looksLikeGrossPayment = Math.abs(byMethod - expectedReceived) <= 0.01
      || Math.abs(byMethod - (paid + changeReturned)) <= 0.01;
    if (looksLikeGrossPayment) {
      return paymentsAfterChangeReturned(payments, changeReturned, paymentMethodFromPayments(payments));
    }
  }

  if (byMethod <= 0.001 && paid > 0.001) return { cash: paid, bank: 0, wallet: 0 };
  return payments;
}

function invoicePaymentText(invoice) {
  const payments = invoiceCashboxPayments(invoice);
  const paidMethods = paymentMethods.filter((method) => Number(payments[method] || 0) > 0);
  const changeReturned = Number(invoice?.changeReturned || 0);
  const changeText = changeReturned > 0 ? ` | راجع ${money(changeReturned)}` : "";
  if (!paidMethods.length) return `بدون دفع${changeText}`;
  if (paidMethods.length === 1) return `${paymentLabels[paidMethods[0]] || paidMethods[0]}${changeText}`;
  return `${paidMethods.map((method) => `${paymentLabels[method] || method}: ${money(payments[method])}`).join("، ")}${changeText}`;
}

function invoiceLineGross(item) {
  return Number(item.price || 0) * Number(item.qty || 0);
}

function invoiceLineNet(invoice, item) {
  const gross = invoiceLineGross(item);
  const subtotal = Number(invoice.subtotal || 0) || (invoice.items || []).reduce((sum, line) => sum + invoiceLineGross(line), 0);
  const discount = Math.min(Number(invoice.discount || 0), subtotal);
  const discountShare = subtotal > 0 && discount > 0 ? discount * (gross / subtotal) : 0;
  return Math.max(gross - discountShare, 0);
}

function invoiceItemProfit(invoice) {
  if (invoice.type !== "sale") return 0;
  return (invoice.items || []).reduce((sum, item) => {
    return sum + invoiceLineNet(invoice, item) - Number(item.cost || 0) * Number(item.qty || 0);
  }, 0);
}

function cloneInvoiceItem(item) {
  return {
    ...item,
    stockUsage: Array.isArray(item.stockUsage) ? item.stockUsage.map((line) => ({ ...line })) : []
  };
}

function cloneInvoice(invoice) {
  return {
    ...invoice,
    items: (invoice.items || []).map(cloneInvoiceItem),
    payments: { ...(invoice.payments || {}) }
  };
}

function invoiceDateInputValue(invoice) {
  return String(invoice.createdAt || new Date().toISOString()).slice(0, 10);
}

function invoiceDateFromInput(dateValue) {
  return dateValue ? `${dateValue}T12:00:00.000Z` : new Date().toISOString();
}

function editedInvoiceDateFromInput(dateValue, originalIso = "") {
  if (!dateValue) return originalIso || new Date().toISOString();
  const originalDate = String(originalIso || "").slice(0, 10);
  if (originalDate === dateValue) return originalIso || invoiceDateFromInput(dateValue);
  const timePart = String(originalIso || "").includes("T")
    ? String(originalIso).slice(10)
    : "T12:00:00.000Z";
  return `${dateValue}${timePart}`;
}

function selectedMenuStatsRange() {
  const dateFrom = els.menuStatsDateFromInput.value;
  const dateTo = els.menuStatsDateToInput.value;
  return {
    minDate: dateFrom && dateTo && dateFrom > dateTo ? dateTo : dateFrom,
    maxDate: dateFrom && dateTo && dateFrom > dateTo ? dateFrom : dateTo
  };
}

function invoiceMatchesDateRange(invoice, range) {
  const invoiceDate = String(invoice.createdAt || "").slice(0, 10);
  return (!range.minDate || invoiceDate >= range.minDate) && (!range.maxDate || invoiceDate <= range.maxDate);
}

function menuItemProfitStats(itemId, range = { minDate: "", maxDate: "" }) {
  return state.invoices.reduce((stats, invoice) => {
    if (invoice.type !== "sale") return stats;
    if (!invoiceMatchesDateRange(invoice, range)) return stats;

    (invoice.items || []).forEach((item) => {
      if (item.id !== itemId) return;
      const qty = Number(item.qty || 0);
      const sales = invoiceLineNet(invoice, item);
      const cost = Number(item.cost || 0) * qty;
      stats.qty += qty;
      stats.sales += sales;
      stats.cost += cost;
      stats.profit += sales - cost;
    });

    return stats;
  }, { qty: 0, sales: 0, cost: 0, profit: 0 });
}

function menuProfitTotals(range = { minDate: "", maxDate: "" }, items = state.menu) {
  return items.reduce((totals, item) => {
    const stats = menuItemProfitStats(item.id, range);
    totals.qty += stats.qty;
    totals.sales += stats.sales;
    totals.cost += stats.cost;
    totals.profit += stats.profit;
    return totals;
  }, { qty: 0, sales: 0, cost: 0, profit: 0 });
}

function menuMatchesSearch(item, query) {
  if (!query) return true;
  const haystack = `${item.name || ""} ${item.category || ""} ${item.price || ""} ${item.cost || ""} ${item.operatingCost || ""} ${operatingCostLabels[item.operatingCostType] || ""} ${stockText(item)}`;
  return searchMatch(haystack, query);
}

function salePriceSummary(items = []) {
  const menuItems = items.filter(Boolean);
  if (!menuItems.length) return "غير مربوط";
  const prices = [...new Set(menuItems.map((item) => Number(item.price || 0)).filter(Number.isFinite))];
  if (prices.length === 1) return money(prices[0]);
  return "متعدد";
}

function customerTotals() {
  return state.customers.reduce((totals, customer) => {
    totals.debt += Math.max(Number(customer.balance || 0), 0);
    totals.credit += Math.max(-Number(customer.balance || 0), 0);
    return totals;
  }, { debt: 0, credit: 0 });
}

function selectedReportRange() {
  const dateFrom = els.reportDateFromInput.value;
  const dateTo = els.reportDateToInput.value;
  return {
    minDate: dateFrom && dateTo && dateFrom > dateTo ? dateTo : dateFrom,
    maxDate: dateFrom && dateTo && dateFrom > dateTo ? dateFrom : dateTo
  };
}

function dateMatchesRange(entry, range) {
  const date = String(entry.createdAt || "").slice(0, 10);
  return (!range.minDate || date >= range.minDate) && (!range.maxDate || date <= range.maxDate);
}

function rangeText(range) {
  return range.minDate || range.maxDate
    ? `الفترة: ${range.minDate || "البداية"} - ${range.maxDate || "اليوم"}`
    : "كل الفترات";
}

function openOrdersCount() {
  return Object.values(state.openOrders).filter((order) => order.items.length).length;
}

function invoicePaymentTotals(invoices = []) {
  return paymentMethods.reduce((totals, method) => {
    totals[method] = invoices.reduce((sum, invoice) => {
      const payments = invoiceCashboxPayments(invoice);
      return sum + Number(payments[method] || 0);
    }, 0);
    return totals;
  }, {});
}

function purchasePaymentTotals(purchases = []) {
  return paymentMethods.reduce((totals, method) => {
    totals[method] = purchases
      .filter((purchase) => purchase.method === method)
      .reduce((sum, purchase) => sum + purchasePaidAmount(purchase), 0);
    return totals;
  }, {});
}

function expensePaymentTotals(expenses = []) {
  return paymentMethods.reduce((totals, method) => {
    totals[method] = expenses
      .filter((expense) => expense.method === method)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    return totals;
  }, {});
}

function normalizeExpense(expense = {}) {
  const amount = Math.max(Number(expense.amount || 0), 0);
  return {
    id: expense.id || uid("expense"),
    type: String(expense.type || "other"),
    title: String(expense.title || expense.name || "مصروف").trim(),
    amount,
    method: paymentMethods.includes(expense.method) ? expense.method : "cash",
    note: String(expense.note || "").trim(),
    createdAt: normalizeImportedDate(expense.createdAt || new Date().toISOString())
  };
}

function normalizeWorkerTransaction(entry = {}) {
  const type = workerTransactionTypeLabels[entry.type] ? entry.type : WORKER_ADVANCE_TYPE;
  return {
    id: entry.id || uid("worker-tx"),
    workerId: entry.workerId || "",
    workerName: String(entry.workerName || entry.title || entry.name || "عامل").trim(),
    type,
    amount: Math.max(Number(entry.amount || 0), 0),
    method: paymentMethods.includes(entry.method) ? entry.method : "cash",
    note: String(entry.note || "").trim(),
    workerDeleted: Boolean(entry.workerDeleted),
    createdAt: normalizeImportedDate(entry.createdAt || new Date().toISOString())
  };
}

function normalizeWorkerConsumption(entry = {}) {
  const type = workerConsumptionTypeLabels[entry.type] ? entry.type : FREE_WORKER_CONSUMPTION_TYPE;
  const qty = Math.max(Number(entry.qty || 1), 0);
  const price = type === FREE_WORKER_CONSUMPTION_TYPE ? 0 : Math.max(Number(entry.price ?? entry.amount ?? 0), 0);
  const itemName = String(entry.itemName || entry.item || "صنف عامل").trim();
  const stockUsage = Array.isArray(entry.stockUsage)
    ? entry.stockUsage.map((line) => ({
      itemId: line.itemId || line.id || "",
      name: String(line.name || "").trim(),
      qty: Number(line.qty || 0),
      unit: normalizeUnit(line.unit || "")
    })).filter((line) => line.itemId && line.qty > 0)
    : [];
  const unitCost = Number(entry.cost || 0);

  return {
    id: entry.id || uid("worker"),
    workerId: entry.workerId || "",
    workerName: String(entry.workerName || entry.title || entry.name || "عامل").trim(),
    type,
    itemId: entry.itemId || "",
    itemName,
    qty,
    price,
    cost: unitCost,
    total: price * qty,
    costTotal: unitCost * qty,
    method: paymentMethods.includes(entry.method) ? entry.method : "cash",
    note: String(entry.note || "").trim(),
    stockUsage,
    workerDeleted: Boolean(entry.workerDeleted),
    createdAt: normalizeImportedDate(entry.createdAt || new Date().toISOString())
  };
}

function workerConsumptionTypeLabel(type) {
  return workerConsumptionTypeLabels[type] || workerConsumptionTypeLabels[FREE_WORKER_CONSUMPTION_TYPE];
}

function workerConsumptionLine(entry) {
  return {
    id: entry.itemId || entry.id,
    name: entry.itemName,
    qty: Number(entry.qty || 0),
    price: Number(entry.price || 0),
    cost: Number(entry.cost || 0),
    temporary: !entry.itemId,
    stockUsage: Array.isArray(entry.stockUsage) ? entry.stockUsage.map((line) => ({ ...line })) : []
  };
}

function workerPaymentTotals(entries = []) {
  return paymentMethods.reduce((totals, method) => {
    totals[method] = entries
      .filter((entry) => entry.type === "worker_price" && entry.method === method)
      .reduce((sum, entry) => sum + Number(entry.total || 0), 0);
    return totals;
  }, {});
}

function workerTransactionPaymentTotals(entries = []) {
  return paymentMethods.reduce((totals, method) => {
    totals[method] = entries
      .filter((entry) => entry.method === method)
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    return totals;
  }, {});
}

function cashEntryPaymentTotals(entries = []) {
  return paymentMethods.reduce((totals, method) => {
    totals[method] = entries
      .filter((entry) => entry.method === method)
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    return totals;
  }, {});
}

function workerConsumptionTotals(entries = []) {
  return entries.reduce((totals, entry) => {
    const total = Number(entry.total || 0);
    const costTotal = Number(entry.costTotal ?? Number(entry.cost || 0) * Number(entry.qty || 0));
    totals.count += 1;
    totals.qty += Number(entry.qty || 0);
    totals.cost += costTotal;
    if (entry.type === FREE_WORKER_CONSUMPTION_TYPE) {
      totals.freeCost += costTotal;
    } else if (entry.type === SALARY_WORKER_CONSUMPTION_TYPE) {
      totals.salaryDeductions += total;
      totals.charged += total;
    } else {
      totals.workerSales += total;
      totals.charged += total;
    }
    totals.net += total - costTotal;
    return totals;
  }, { count: 0, qty: 0, cost: 0, freeCost: 0, workerSales: 0, salaryDeductions: 0, charged: 0, net: 0 });
}

function inventoryCountValue(record = {}) {
  const lines = Array.isArray(record.lines) ? record.lines : [];
  const lineNet = lines.reduce((sum, line) => sum + Number(line.value || 0), 0);
  const increase = Number(record.totalIncreaseValue ?? lines.reduce((sum, line) => sum + Math.max(Number(line.value || 0), 0), 0));
  const decrease = Number(record.totalDecreaseValue ?? lines.reduce((sum, line) => sum + Math.max(-Number(line.value || 0), 0), 0));
  const net = Number(record.netInventoryValue ?? lineNet ?? (increase - decrease));
  return {
    increase,
    decrease,
    net,
    profit: Math.max(net, 0),
    loss: Math.max(-net, 0)
  };
}

function inventoryReportTotals(records = []) {
  return records.reduce((totals, record) => {
    const value = inventoryCountValue(record);
    totals.count += 1;
    totals.increase += value.increase;
    totals.decrease += value.decrease;
    totals.net += value.net;
    totals.profit += value.profit;
    totals.loss += value.loss;
    return totals;
  }, { count: 0, increase: 0, decrease: 0, net: 0, profit: 0, loss: 0 });
}

function reportWorkerDueTotal(range) {
  return (state.workers || [])
    .filter((worker) => worker.active !== false)
    .reduce((sum, worker) => {
      const account = workerAccountForRange(worker, range);
      return sum + Math.max(Number(account.due || 0), 0);
    }, 0);
}

function reportData(range) {
  const invoices = state.invoices.filter((invoice) => dateMatchesRange(invoice, range) && !invoiceIsCancelled(invoice));
  const saleInvoices = invoices.filter((invoice) => invoice.type === "sale");
  const paymentInvoices = invoices.filter((invoice) => invoice.type === "payment");
  const payoutInvoices = invoices.filter((invoice) => invoice.type === "payout");
  const purchases = state.purchases.filter((purchase) => dateMatchesRange(purchase, range));
  const supplierPayments = (state.supplierPayments || []).filter((payment) => dateMatchesRange(payment, range));
  const expenses = (state.expenses || []).filter((expense) => dateMatchesRange(expense, range));
  const ownerWithdrawals = (state.ownerWithdrawals || []).filter((withdrawal) => dateMatchesRange(withdrawal, range));
  const inventoryCounts = (state.inventoryCounts || []).filter((record) => dateMatchesRange(record, range));
  const workerConsumptions = (state.workerConsumptions || []).filter((entry) => dateMatchesRange(entry, range));
  const workerTransactions = activeWorkerTransactions().filter((entry) => dateMatchesRange(entry, range));
  const workerSummary = workerConsumptionTotals(workerConsumptions);
  const workerTransactionSummary = workerTransactionTotals(workerTransactions);
  const inventorySummary = inventoryReportTotals(inventoryCounts);
  const workerDueTotal = reportWorkerDueTotal(range);
  const workerCashOut = workerTransactionSummary.advances + workerTransactionSummary.salaryPaid;
  const customerSummary = customerTotals();
  const salesTotal = saleInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
  const paidTotal = saleInvoices.reduce((sum, invoice) => sum + Number(invoice.paid || 0), 0);
  const paymentDiscountTotal = paymentInvoices.reduce((sum, invoice) => sum + Number(invoice.discount || 0), 0);
  const debtTotal = saleInvoices.reduce((sum, invoice) => sum + Math.max(Number(invoice.delta || 0), 0), 0);
  const creditTotal = saleInvoices.reduce((sum, invoice) => sum + Math.max(-Number(invoice.delta || 0), 0), 0);
  const purchasesTotal = purchases.reduce((sum, purchase) => sum + purchaseAmount(purchase), 0);
  const purchasePaidTotal = purchases.reduce((sum, purchase) => sum + purchasePaidAmount(purchase), 0);
  const supplierPaymentsTotal = supplierPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const expensesTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const ownerWithdrawalsTotal = ownerWithdrawals.reduce((sum, withdrawal) => sum + Number(withdrawal.amount || 0), 0);
  const itemProfit = saleInvoices.reduce((sum, invoice) => sum + invoiceItemProfit(invoice), 0);
  const itemCost = saleInvoices.reduce((sum, invoice) => {
    return sum + (invoice.items || []).reduce((lineSum, item) => {
      return lineSum + Number(item.cost || 0) * Number(item.qty || 0);
    }, 0);
  }, 0);

  return {
    invoices,
    saleInvoices,
    paymentInvoices,
    payoutInvoices,
    purchases,
    supplierPayments,
    expenses,
    ownerWithdrawals,
    inventoryCounts,
    customerSummary,
    salesTotal,
    paidTotal,
    paymentDiscountTotal,
    debtTotal,
    creditTotal,
    purchasesTotal,
    purchasePaidTotal,
    supplierPaymentsTotal,
    expensesTotal,
    ownerWithdrawalsTotal,
    workerConsumptions,
    workerTransactions,
    workerSummary,
    workerTransactionSummary,
    workerDueTotal,
    inventorySummary,
    workerCashOut,
    itemProfit,
    itemCost,
    profitWithWorkers: itemProfit + workerSummary.net - paymentDiscountTotal,
    profitWithWorkersAndPayroll: itemProfit + workerSummary.net - paymentDiscountTotal - workerCashOut - expensesTotal,
    profitWithInventory: itemProfit + workerSummary.net - paymentDiscountTotal - expensesTotal + inventorySummary.net,
    profitWithWorkersPayrollAndInventory: itemProfit + workerSummary.net - paymentDiscountTotal - workerCashOut - expensesTotal + inventorySummary.net,
    netAfterPurchases: salesTotal - purchasesTotal,
    invoicePayments: invoicePaymentTotals(invoices),
    salePayments: invoicePaymentTotals(saleInvoices),
    paymentPayments: invoicePaymentTotals(paymentInvoices),
    purchasePayments: purchasePaymentTotals(purchases),
    supplierPaymentPayments: cashEntryPaymentTotals(supplierPayments),
    expensePayments: expensePaymentTotals(expenses),
    ownerWithdrawalPayments: cashEntryPaymentTotals(ownerWithdrawals),
    workerPayments: workerPaymentTotals(workerConsumptions),
    workerTransactionPayments: workerTransactionPaymentTotals(workerTransactions)
  };
}

function reportItemRows(range) {
  return state.menu
    .map((item) => ({ item, stats: menuItemProfitStats(item.id, range) }))
    .filter((row) => row.stats.qty || row.stats.sales || row.stats.profit)
    .sort((a, b) => b.stats.profit - a.stats.profit)
    .slice(0, 8);
}

function reportCustomerRows() {
  return state.customers
    .filter((customer) => Math.abs(Number(customer.balance || 0)) > 0.001)
    .sort((a, b) => Math.abs(Number(b.balance || 0)) - Math.abs(Number(a.balance || 0)))
    .slice(0, 8);
}

function normalizeCashTransfer(entry = {}) {
  const fromMethod = paymentMethods.includes(entry.fromMethod) ? entry.fromMethod : "cash";
  const toMethod = paymentMethods.includes(entry.toMethod) ? entry.toMethod : "bank";
  return {
    id: entry.id || uid("cashtransfer"),
    fromMethod,
    toMethod: toMethod === fromMethod ? (fromMethod === "cash" ? "bank" : "cash") : toMethod,
    amount: Math.max(Number(entry.amount || 0), 0),
    note: String(entry.note || "").trim(),
    createdAt: normalizeImportedDate(entry.createdAt || new Date().toISOString())
  };
}

// ─── حساب المورّد بالدين ─────────────────────────────────────
// المدفوع الآن لفاتورة مشتريات (افتراضيًا الكل — فالمشتريات القديمة مدفوعة كاملة).
function purchasePaidAmount(purchase) {
  if (purchase.paidAmount === undefined || purchase.paidAmount === null) return purchaseAmount(purchase);
  return Math.max(Number(purchase.paidAmount || 0), 0);
}

// المتبقّي دينًا للمورّد من فاتورة واحدة.
function purchaseSupplierDebt(purchase) {
  return Math.max(purchaseAmount(purchase) - purchasePaidAmount(purchase), 0);
}

// أرصدة الموردين: لكل مورد كم باقي عليك (دين) بعد خصم تسديداتك.
function supplierBalances() {
  const map = new Map();
  (state.purchases || []).forEach((purchase) => {
    const name = String(purchase.supplier || "").trim();
    if (!name) return;
    const debt = purchaseSupplierDebt(purchase);
    if (debt <= 0.001) return;
    const entry = map.get(name) || { supplier: name, owed: 0 };
    entry.owed += debt;
    map.set(name, entry);
  });
  (state.supplierPayments || []).forEach((payment) => {
    const name = String(payment.supplier || "").trim();
    if (!name) return;
    const entry = map.get(name) || { supplier: name, owed: 0 };
    entry.owed -= Number(payment.amount || 0);
    map.set(name, entry);
  });
  return Array.from(map.values())
    .map((entry) => ({ supplier: entry.supplier, owed: Math.round(entry.owed * 100) / 100 }))
    .filter((entry) => Math.abs(entry.owed) > 0.001)
    .sort((a, b) => b.owed - a.owed);
}

function supplierTotalOwed() {
  return supplierBalances().reduce((sum, entry) => sum + Math.max(entry.owed, 0), 0);
}

// النقد الحالي مقسوم حسب الطريقة (كاش / بنك / محفظة)
// = رأس المال الافتتاحي + كل اللي دخل - كل اللي طلع (من بداية البرنامج)
function cashOnHand() {
  const opening = normalizeOpeningCash(state.openingCash);
  const methods = {
    cash: { opening: opening.cash, inflow: 0, outflow: 0, adjustments: 0, transferIn: 0, transferOut: 0 },
    bank: { opening: opening.bank, inflow: 0, outflow: 0, adjustments: 0, transferIn: 0, transferOut: 0 },
    wallet: { opening: opening.wallet, inflow: 0, outflow: 0, adjustments: 0, transferIn: 0, transferOut: 0 }
  };
  const add = (method, field, amount) => {
    if (methods[method]) methods[method][field] += Number(amount || 0);
  };

  // داخل: مقبوض البيع + تسديد ديون
  state.invoices.forEach((inv) => {
    if (invoiceIsCancelled(inv)) return;
    if (inv.type === "sale" || inv.type === "payment") {
      const p = invoiceCashboxPayments(inv);
      add("cash", "inflow", p.cash);
      add("bank", "inflow", p.bank);
      add("wallet", "inflow", p.wallet);
    }
  });

  (state.workerConsumptions || []).forEach((entry) => {
    if (entry.type !== "worker_price") return;
    add(entry.method || "cash", "inflow", entry.total);
  });

  // طالع: دفعات رجعناها لعملاء
  state.invoices.forEach((inv) => {
    if (invoiceIsCancelled(inv)) return;
    if (inv.type === "payout") {
      const p = invoiceCashboxPayments(inv);
      add("cash", "outflow", p.cash);
      add("bank", "outflow", p.bank);
      add("wallet", "outflow", p.wallet);
    }
  });

  // طالع: مشتريات (المدفوع فقط — الباقي دين للمورّد) + تسديدات الموردين + سلف/قبضات + مصروفات
  (state.purchases || []).forEach((p) => add(p.method || "cash", "outflow", purchasePaidAmount(p)));
  (state.supplierPayments || []).forEach((s) => add(s.method || "cash", "outflow", s.amount));
  activeWorkerTransactions().forEach((t) => add(t.method || "cash", "outflow", t.amount));
  (state.expenses || []).forEach((e) => add(e.method || "cash", "outflow", e.amount));

  // طالع: سحوبات صاحب المحل (حصته)
  (state.ownerWithdrawals || []).forEach((w) => add(w.method || "cash", "outflow", w.amount));

  // تسويات الجرد
  (state.cashAdjustments || []).forEach((a) => add(a.method || "cash", "adjustments", a.diff));

  // تحويلات داخلية بين كاش/بنك/محفظة: لا تزيد ولا تنقص مجموع الصندوق.
  (state.cashTransfers || []).map(normalizeCashTransfer).forEach((transfer) => {
    add(transfer.fromMethod, "transferOut", transfer.amount);
    add(transfer.toMethod, "transferIn", transfer.amount);
  });

  const total = { opening: 0, inflow: 0, outflow: 0, adjustments: 0, transferIn: 0, transferOut: 0, current: 0 };
  Object.values(methods).forEach((m) => {
    m.current = m.opening + m.inflow - m.outflow + m.adjustments + m.transferIn - m.transferOut;
    total.opening += m.opening;
    total.inflow += m.inflow;
    total.outflow += m.outflow;
    total.adjustments += m.adjustments;
    total.transferIn += m.transferIn;
    total.transferOut += m.transferOut;
    total.current += m.current;
  });

  return { methods, total };
}

// صافي حركة الصندوق اليوم مقسوم حسب الطريقة
function todayCashBox() {
  const todayKey = todayDateInputValue();
  const isToday = (iso) => String(iso || "").slice(0, 10) === todayKey;
  const methods = {
    cash: { in: 0, out: 0, transferIn: 0, transferOut: 0, saleIn: 0, debtIn: 0, workerIn: 0 },
    bank: { in: 0, out: 0, transferIn: 0, transferOut: 0, saleIn: 0, debtIn: 0, workerIn: 0 },
    wallet: { in: 0, out: 0, transferIn: 0, transferOut: 0, saleIn: 0, debtIn: 0, workerIn: 0 }
  };
  const add = (m, field, amount) => { if (methods[m]) methods[m][field] += Number(amount || 0); };

  state.invoices.forEach((inv) => {
    if (!isToday(inv.createdAt)) return;
    if (invoiceIsCancelled(inv)) return;
    const p = invoiceCashboxPayments(inv);
    if (inv.type === "sale" || inv.type === "payment") {
      const sourceField = inv.type === "sale" ? "saleIn" : "debtIn";
      add("cash", "in", p.cash); add("cash", sourceField, p.cash);
      add("bank", "in", p.bank); add("bank", sourceField, p.bank);
      add("wallet", "in", p.wallet); add("wallet", sourceField, p.wallet);
    } else if (inv.type === "payout") {
      add("cash", "out", p.cash); add("bank", "out", p.bank); add("wallet", "out", p.wallet);
    }
  });
  (state.workerConsumptions || []).forEach((entry) => {
    if (!isToday(entry.createdAt) || entry.type !== "worker_price") return;
    add(entry.method || "cash", "in", entry.total);
    add(entry.method || "cash", "workerIn", entry.total);
  });
  (state.purchases || []).forEach((p) => { if (isToday(p.createdAt)) add(p.method || "cash", "out", purchasePaidAmount(p)); });
  (state.supplierPayments || []).forEach((s) => { if (isToday(s.createdAt)) add(s.method || "cash", "out", s.amount); });
  activeWorkerTransactions().forEach((t) => { if (isToday(t.createdAt)) add(t.method || "cash", "out", t.amount); });
  (state.expenses || []).forEach((e) => { if (isToday(e.createdAt)) add(e.method || "cash", "out", e.amount); });
  (state.ownerWithdrawals || []).forEach((w) => { if (isToday(w.createdAt)) add(w.method || "cash", "out", w.amount); });
  (state.cashTransfers || []).map(normalizeCashTransfer).forEach((transfer) => {
    if (!isToday(transfer.createdAt)) return;
    add(transfer.fromMethod, "transferOut", transfer.amount);
    add(transfer.toMethod, "transferIn", transfer.amount);
  });

  const total = { in: 0, out: 0, net: 0, saleIn: 0, debtIn: 0, workerIn: 0 };
  Object.values(methods).forEach((m) => {
    m.net = m.in - m.out + m.transferIn - m.transferOut;
    total.in += m.in;
    total.out += m.out;
    total.net += m.net;
    total.saleIn += m.saleIn;
    total.debtIn += m.debtIn;
    total.workerIn += m.workerIn;
  });
  return { methods, total };
}

function normalizeMenuItems(items = []) {
  return items.map((item) => {
    const next = { ...item };
    if (next.stockQty !== undefined && next.stockQty !== null && next.stockQty !== "") {
      next.stockQty = Number(next.stockQty || 0);
    }
    next.cost = Math.max(Number(next.cost || 0), 0);
    next.operatingCost = Math.max(Number(next.operatingCost || 0), 0);
    next.operatingCostType = operatingCostTypes.includes(next.operatingCostType) ? next.operatingCostType : "other";
    next.stockUnit = normalizeUnit(next.stockUnit || next.unit || "");
    next.components = normalizeMenuComponents(next.components || [], next.id);
    next.options = normalizeMenuOptions(next.options || []);
    next.favorite = !!next.favorite;
    return next;
  });
}

function normalizeMenuOptions(options = []) {
  if (!Array.isArray(options)) return [];
  return options
    .map((opt) => ({
      id: opt.id || uid("opt"),
      label: String(opt.label || opt.name || "").trim(),
      price: Math.max(Number(opt.price || 0), 0)
    }))
    .filter((opt) => opt.label && opt.price > 0);
}

function normalizeUnit(unit = "") {
  return String(unit || "").trim();
}

function normalizeMenuComponents(components = [], ownerId = "") {
  if (!ENABLE_STOCK_COMPONENTS) return [];
  return components.map((component) => ({
    id: component.id || uid("component"),
    itemId: component.itemId || component.menuItemId || "",
    purchaseItemName: String(component.purchaseItemName || component.sourceName || component.name || "").trim(),
    qty: Number(component.qty || 0),
    unit: normalizeUnit(component.unit || "")
  })).filter((component) => {
    return component.itemId && component.itemId !== ownerId && Number(component.qty || 0) > 0;
  });
}

function isStockTracked(item) {
  return item && item.stockQty !== undefined && item.stockQty !== null && item.stockQty !== "";
}

function quantityText(value) {
  const number = Number(value || 0);
  return (number % 1 ? _qtyFormatterFraction : _qtyFormatterWhole).format(number);
}

function itemUnit(item) {
  return normalizeUnit(item?.stockUnit || item?.unit || "");
}

function quantityWithUnit(value, unit = "") {
  const cleanUnit = normalizeUnit(unit);
  return cleanUnit ? `${quantityText(value)} ${cleanUnit}` : quantityText(value);
}

function stockText(item) {
  const stock = menuItemDisplayStock(item);
  return stock.tracked ? stock.text : "غير متتبع";
}

function menuItemDisplayStock(item) {
  const components = ENABLE_STOCK_COMPONENTS ? menuItemComponents(item) : [];
  if (components.length) {
    const possibleUnits = components.map((component) => {
      const stockItem = inventoryItemById(component.itemId);
      const requiredQty = Number(component.qty || 0);
      const availableQty = stockItem ? Number(stockItem.stockQty || 0) : 0;
      return requiredQty > 0 ? availableQty / requiredQty : 0;
    });
    const stockQty = Math.max(Math.floor(Math.min(...possibleUnits)), 0);
    return {
      tracked: true,
      qty: stockQty,
      unit: "وحدة",
      text: `${quantityWithUnit(stockQty, "وحدة")} من الجرد`,
      isLow: stockQty <= 0,
      source: "inventory"
    };
  }

  if (!isStockTracked(item)) {
    return { tracked: false, qty: 0, unit: "", text: "غير متتبع", isLow: false, source: "none" };
  }

  const stockQty = Number(item.stockQty || 0);
  return {
    tracked: true,
    qty: stockQty,
    unit: itemUnit(item),
    text: quantityWithUnit(stockQty, itemUnit(item)),
    isLow: stockQty <= 0,
    source: "direct"
  };
}

function findMenuItem(itemId) {
  return state.menu.find((item) => item.id === itemId) || null;
}

function findMenuItemByName(name) {
  const cleanedName = String(name || "").trim().toLowerCase();
  if (!cleanedName) return null;
  return state.menu.find((item) => item.name.trim().toLowerCase() === cleanedName) || null;
}

function adjustMenuStock(itemId, qtyDelta) {
  const item = findMenuItem(itemId);
  if (!item || !Number.isFinite(Number(qtyDelta))) return null;
  item.stockQty = (isStockTracked(item) ? Number(item.stockQty || 0) : 0) + Number(qtyDelta);
  item.updatedAt = new Date().toISOString();
  return item;
}

function menuItemComponents(item) {
  return normalizeMenuComponents(item?.components || [], item?.id || "");
}

function menuItemBaseCost(item) {
  if (!ENABLE_STOCK_COMPONENTS) return Number(item?.cost || 0);
  const components = menuItemComponents(item);
  if (!components.length) return Number(item?.cost || 0);
  return components.reduce((sum, component) => {
    const stockItem = inventoryItemById(component.itemId);
    return sum + Number(component.qty || 0) * Number(stockItem?.cost || 0);
  }, 0);
}

function menuItemOperatingCost(item) {
  return Math.max(Number(item?.operatingCost || 0), 0);
}

function menuItemRecipeCost(item) {
  return menuItemBaseCost(item) + menuItemOperatingCost(item);
}

function operatingCostText(item) {
  const amount = menuItemOperatingCost(item);
  if (amount <= 0) return "";
  const label = operatingCostLabels[item?.operatingCostType] || operatingCostLabels.other;
  return `${label}: ${money(amount)}`;
}

function stockUsageFromMenuItem(item) {
  if (!ENABLE_STOCK_COMPONENTS) {
    return isStockTracked(item) ? [{ itemId: item.id, name: item.name, qty: 1, unit: itemUnit(item) }] : [];
  }
  const components = menuItemComponents(item);
  const usage = components.length
    ? components.map((component) => {
      const stockItem = inventoryItemById(component.itemId);
      return {
        itemId: component.itemId,
        name: component.purchaseItemName || stockItem?.name || "",
        qty: Number(component.qty || 0),
        unit: component.unit || itemUnit(stockItem)
      };
    })
    : isStockTracked(item) ? [{ itemId: item.id, name: item.name, qty: 1, unit: itemUnit(item) }] : [];

  return usage.filter((line) => line.itemId && Number(line.qty || 0) > 0);
}

function mergeStockUsage(usage = []) {
  const merged = new Map();
  usage.forEach((line) => {
    const itemId = line.itemId || line.id;
    const qty = Number(line.qty || 0);
    if (!itemId || qty <= 0) return;
    const stockItem = inventoryItemById(itemId);
    const existing = merged.get(itemId) || { itemId, name: line.name || stockItem?.name || "", qty: 0, unit: normalizeUnit(line.unit || itemUnit(stockItem)) };
    existing.qty += qty;
    if (!existing.unit) existing.unit = normalizeUnit(line.unit || itemUnit(stockItem));
    merged.set(itemId, existing);
  });
  return Array.from(merged.values());
}

function stockUsageForSoldLine(line) {
  if (!ENABLE_STOCK_COMPONENTS) {
    return mergeStockUsage(stockUsageFromMenuItem(findMenuItem(line.id)));
  }
  if (Array.isArray(line.stockUsage) && line.stockUsage.length) {
    return mergeStockUsage(line.stockUsage);
  }
  return mergeStockUsage(stockUsageFromMenuItem(findMenuItem(line.id)));
}

function applySoldStockUsage(items = [], direction = -1) {
  const results = [];
  items.forEach((line) => {
    const lineQty = Number(line.qty || 0);
    if (lineQty <= 0) return;
    stockUsageForSoldLine(line).forEach((usage) => {
      const usedQty = lineQty * Number(usage.qty || 0);
      const delta = direction * usedQty;
      let adjusted = null;
      if (isPurchaseInventoryId(usage.itemId)) {
        adjusted = adjustPurchaseInventoryStock(usage.itemId, delta);
        if (!adjusted && typeof purchaseInventoryItemFromUsage === "function") {
          const fallbackItem = purchaseInventoryItemFromUsage(usage);
          if (fallbackItem) adjusted = adjustPurchaseInventoryStock(fallbackItem.id, delta);
        }
      } else {
        adjusted = adjustMenuStock(usage.itemId, delta);
      }
      results.push({
        ...usage,
        itemId: adjusted?.id || usage.itemId,
        name: adjusted?.name || usage.name,
        unit: usage.unit || itemUnit(adjusted),
        qty: usedQty,
        delta,
        applied: Boolean(adjusted)
      });
    });
  });
  return results;
}

function reduceStockForSoldItems(items = []) {
  return applySoldStockUsage(items, -1);
}

function restoreStockForSoldItems(items = []) {
  return applySoldStockUsage(items, 1);
}

function stockUsageAppliedText(results = []) {
  return results
    .filter((line) => line.applied && Number(line.qty || 0) > 0)
    .map((line) => `${line.name || "مخزون"} ${quantityWithUnit(Number(line.qty || 0), line.unit || "")}`)
    .join("، ");
}

function getOrderPayment(order) {
  const payments = order.payments || {};
  const methods = ["cash", "bank", "wallet"];
  const activeMethod = methods.find((method) => Number(payments[method] || 0) > 0);
  const method = order.paymentMethod || activeMethod || getLastPaymentMethod();
  return {
    method,
    amount: paymentTotal(payments) || Number(payments[method] || 0)
  };
}

function invoiceStatus(delta, type = "sale") {
  if (type === "payment") return "payment";
  if (type === "payout") return "payout";
  if (delta > 0.001) return "debt";
  if (delta < -0.001) return "credit";
  return "paid";
}

function statusText(status) {
  return {
    paid: "مدفوعة",
    debt: "دين",
    credit: "رصيد",
    payment: "دفعة حساب",
    payout: "دفع للعميل",
    cancelled: "ملغاة",
    temporary: "صنف مؤقت"
  }[status] || status;
}

function formatDate(iso) {
  return _dateFormatter.format(new Date(iso));
}

function balanceText(balance) {
  if (balance > 0.001) return `عليه ${money(balance)}`;
  if (balance < -0.001) return `له رصيد ${money(Math.abs(balance))}`;
  return "حسابه صافي";
}

function balanceClass(balance) {
  if (balance > 0.001) return "debt";
  if (balance < -0.001) return "credit";
  return "clear";
}

function showToast(message) {
  const undoable = typeof isUndoArmed === "function" && isUndoArmed();
  els.toast.innerHTML = "";
  const text = document.createElement("span");
  text.textContent = message;
  els.toast.appendChild(text);
  let duration = 2400;
  if (undoable) {
    undoArmedAt = 0; // استهلاك التسليح حتى لا يظهر الزر على رسالة لاحقة
    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "toast-undo-button";
    undoBtn.textContent = "↩ تراجع";
    undoBtn.addEventListener("click", () => {
      els.toast.classList.remove("is-visible");
      performUndo();
    });
    els.toast.appendChild(undoBtn);
    duration = 6000;
  }
  els.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("is-visible"), duration);
}
