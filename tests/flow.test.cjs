const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function fakeElement() {
  return {
    value: "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    disabled: false,
    dataset: {},
    style: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; }
    },
    appendChild() {},
    remove() {},
    focus() {},
    select() {},
    scrollIntoView() {},
    addEventListener() {},
    removeAttribute() {},
    setAttribute() {},
    querySelector() { return fakeElement(); },
    querySelectorAll() { return []; },
    closest() { return null; },
    matches() { return false; }
  };
}

const elements = new Map();
const context = {
  assert,
  console,
  Intl,
  JSON,
  Math,
  Date,
  Number,
  String,
  Boolean,
  Array,
  Object,
  Map,
  Set,
  Promise,
  clearTimeout() {},
  setTimeout() { return 0; },
  prompt() { return "test reason"; },
  print() {},
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  },
  document: {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, fakeElement());
      return elements.get(selector);
    },
    querySelectorAll() { return []; },
    createElement() { return fakeElement(); },
    body: fakeElement(),
    documentElement: { dataset: {} }
  },
  navigator: {},
  location: { protocol: "http:" },
  window: {}
};

context.window = context;
vm.createContext(context);

const files = [
  "js/01-core.js",
  "js/02-domain.js",
  "js/03-pos.js",
  "js/04-customers-invoices.js",
  "js/08-checkout.js",
  "js/09-actions.js"
];

for (const file of files) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

const scenario = `
(async () => {
render = function () {};
renderMenu = function () {};
renderOrderTotals = function () {};
renderStats = function () {};
renderTables = function () {};
renderCustomerDetail = function () {};
renderCustomers = function () {};
renderInvoices = function () {};
renderActiveView = function () {};
renderBackupReminder = function () {};
applyBusinessName = function () {};
applyAppTheme = function () {};
const confirmMessages = [];
appConfirm = async function (message) {
  confirmMessages.push(message);
  return true;
};

state = defaultState();
state.menu = normalizeMenuItems([
  {
    id: "coffee",
    name: "قهوة",
    price: 8,
    cost: 2,
    category: "مشروبات",
    options: [{ id: "large", label: "كبير", price: 12 }]
  },
  { id: "tea", name: "شاي", price: 6, cost: 1, category: "مشروبات" }
]);
state.customers = [];
state.invoices = [];
state.openOrders = {};
state.auditLog = [];

currentUserRole = "cashier";
assert.strictEqual(canAccessView("pos"), true);
assert.strictEqual(canAccessView("invoices"), true);
assert.strictEqual(canAccessView("customers"), true);
assert.strictEqual(canAccessView("reports"), false);
assert.strictEqual(canUsePermission("invoice.edit"), false);
assert.strictEqual(canUsePermission("invoice.cancel"), false);
assert.strictEqual(canUsePermission("customer.price"), false);
currentUserRole = "manager";
assert.strictEqual(canAccessView("reports"), true);
assert.strictEqual(canUsePermission("invoice.edit"), true);
assert.strictEqual(canUsePermission("invoice.cancel"), true);

state.invoices = [{
  id: "history",
  type: "sale",
  items: [{ id: "tea", name: "شاي", qty: 4, price: 6 }],
  createdAt: new Date().toISOString()
}];
assert.strictEqual(getQuickSaleItems(2)[0].id, "tea");
state.invoices = [];

function resetCheckoutFields() {
  els.customerNameInput.value = "";
  els.customerPhoneInput.value = "";
  els.customerSelect.value = "";
  els.discountInput.value = "";
  els.paymentMethodInput.value = "cash";
  els.paymentAmountInput.value = "";
  els.changeReturnedInput.value = "";
  els.noteInput.value = "";
}

resetCheckoutFields();

state.selectedTable = 1;
addItem("tea");
let mergeSource = getOpenOrder();
mergeSource.payments = { cash: 2, bank: 0, wallet: 0 };
mergeSource.note = "source note";
state.openOrders["2"] = {
  id: "target-order",
  tableId: 2,
  customerId: null,
  customerName: "",
  customerPhone: "",
  items: [{ id: "coffee", name: "ظ‚ظ‡ظˆط©", qty: 1, price: 8, cost: 2 }],
  discount: 1,
  paymentMethod: "bank",
  payments: { cash: 0, bank: 5, wallet: 0 },
  changeReturned: 0,
  note: "target note",
  createdAt: new Date().toISOString()
};
assert.strictEqual(await mergeSelectedTableInto(2), true);
assert.strictEqual(state.selectedTable, 2);
assert.strictEqual(state.openOrders["1"], undefined);
assert.strictEqual(state.openOrders["2"].items.length, 2);
assert.strictEqual(paymentTotal(state.openOrders["2"].payments), 7);
assert(state.openOrders["2"].note.includes("source note"));
assert.strictEqual(state.auditLog[0].action, "table.merge");
confirmMessages.length = 0;
state.openOrders = {};
state.selectedTable = 1;
state.auditLog = [];
resetCheckoutFields();

addMenuItemFromGrid("coffee", "large");
let order = getOpenOrder();
assert.strictEqual(order.items.length, 1);
assert.strictEqual(order.items[0].name, "قهوة - كبير");
assert.strictEqual(order.items[0].price, 12);
addMenuItemFromGrid("coffee");
assert.strictEqual(order.items.length, 1);
assert.strictEqual(order.items[0].qty, 2);

els.paymentAmountInput.value = "24";
await closeInvoice();
assert.strictEqual(state.invoices.length, 1);
assert.strictEqual(state.invoices[0].status, "paid");
assert.strictEqual(state.invoices[0].paid, 24);
assert.strictEqual(confirmMessages.length, 0);

resetCheckoutFields();
addItem("tea");
els.customerNameInput.value = "أبو أحمد";
await closeInvoice();
assert.strictEqual(state.invoices.length, 2);
assert.strictEqual(state.invoices[0].status, "debt");
assert.strictEqual(confirmMessages.length, 1);
assert(confirmMessages[0].includes("مبلغ الدين"));
const customer = state.customers.find((item) => item.name === "أبو أحمد");
assert(customer);
assert.strictEqual(customer.balance, 6);

selectedCustomerId = customer.id;
settlementDebtMode = false;
applySettlementMode(customer);
startCustomerSettlement(customer.id);
assert.strictEqual(Number(els.settlementAmountInput.value), 6);
els.settlementAmountInput.value = "5";
els.settlementDiscountInput.value = "";
els.settlementMethodInput.value = "cash";
recordSettlement({ preventDefault() {} });

assert.strictEqual(state.invoices.length, 3);
assert.strictEqual(state.invoices[0].type, "payment");
assert.strictEqual(customer.balance, 1);
assert.strictEqual(invoiceFinancialType(state.invoices[0]), "payment");
assert.strictEqual(invoiceFinancialType(state.invoices[1]), "sale-debt");
assert.strictEqual(invoiceFinancialType(state.invoices[2]), "sale-paid");
const invoiceSummary = buildInvoiceFinancialSummary(state.invoices);
assert.strictEqual(invoiceSummary.salesTotal, 30);
assert.strictEqual(invoiceSummary.paidNoDebt, 24);
assert.strictEqual(invoiceSummary.salePaidAtSale, 24);
assert.strictEqual(invoiceSummary.saleDebt, 6);
assert.strictEqual(invoiceSummary.debtSettled, 5);
assert.strictEqual(invoiceSummary.netCollected, 29);
const paidInvoiceId = state.invoices[2].id;
await cancelInvoice(paidInvoiceId);
const cancelledInvoice = state.invoices.find((invoice) => invoice.id === paidInvoiceId);
assert.strictEqual(cancelledInvoice.type, "cancelled");
assert.strictEqual(cancelledInvoice.status, "cancelled");
assert.strictEqual(cancelledInvoice.cancelledReason, "test reason");
assert.strictEqual(cancelledInvoice.cancelledOriginal.total, 24);
const afterCancelSummary = buildInvoiceFinancialSummary(state.invoices);
assert.strictEqual(afterCancelSummary.salesTotal, 6);
assert.strictEqual(afterCancelSummary.paidNoDebt, 0);
assert.strictEqual(afterCancelSummary.saleDebt, 6);
assert.strictEqual(afterCancelSummary.debtSettled, 5);
assert.strictEqual(afterCancelSummary.netCollected, 5);
assert.strictEqual(cashOnHand().methods.cash.current, 5);

const cashBeforeLegacyChange = cashOnHand().methods.cash.current;
const legacyChangeInvoice = {
  id: "legacy-change",
  number: "LEGACY-CHANGE",
  type: "sale",
  status: "paid",
  customerName: "زبون نقدي",
  items: [{ id: "tea", name: "شاي", qty: 1, price: 10, cost: 1 }],
  subtotal: 10,
  total: 10,
  paid: 10,
  received: 20,
  changeReturned: 10,
  delta: 0,
  payments: { cash: 20, bank: 0, wallet: 0 },
  createdAt: new Date().toISOString()
};
state.invoices.unshift(legacyChangeInvoice);
assert.strictEqual(invoicePaymentTotals([legacyChangeInvoice]).cash, 10);
assert.strictEqual(cashOnHand().methods.cash.current - cashBeforeLegacyChange, 10);

const cashBeforeCancelledLegacy = cashOnHand().methods.cash.current;
state.invoices.unshift({
  ...legacyChangeInvoice,
  id: "legacy-cancelled",
  number: "LEGACY-CANCELLED",
  status: "cancelled",
  cancelledAt: new Date().toISOString(),
  payments: { cash: 999, bank: 0, wallet: 0 }
});
assert.strictEqual(invoicePaymentTotals([state.invoices[0]]).cash, 0);
assert.strictEqual(cashOnHand().methods.cash.current, cashBeforeCancelledLegacy);

const cashBeforePartialPurchase = cashOnHand().methods.cash.current;
const partialPurchase = {
  id: "partial-purchase",
  method: "cash",
  amount: 20,
  paidAmount: 6,
  createdAt: new Date().toISOString()
};
state.purchases.push(partialPurchase);
assert.strictEqual(purchasePaymentTotals([partialPurchase]).cash, 6);
assert.strictEqual(reportData({}).purchasePaidTotal, 6);
assert.strictEqual(cashOnHand().methods.cash.current, cashBeforePartialPurchase - 6);

const cashBeforeSupplierPayment = cashOnHand().methods.cash.current;
state.supplierPayments = state.supplierPayments || [];
state.supplierPayments.push({
  id: "supplier-payment-test",
  supplier: "مورد تجريبي",
  method: "cash",
  amount: 4,
  createdAt: new Date().toISOString()
});
assert.strictEqual(reportData({}).supplierPaymentsTotal, 4);
assert.strictEqual(cashOnHand().methods.cash.current, cashBeforeSupplierPayment - 4);

const cashBeforeOwnerWithdrawal = cashOnHand().methods.cash.current;
state.ownerWithdrawals = state.ownerWithdrawals || [];
state.ownerWithdrawals.push({
  id: "owner-withdrawal-test",
  method: "cash",
  amount: 3,
  createdAt: new Date().toISOString()
});
assert.strictEqual(reportData({}).ownerWithdrawalsTotal, 3);
assert.strictEqual(cashOnHand().methods.cash.current, cashBeforeOwnerWithdrawal - 3);
printCustomerDebtList();

rebuildCustomerAccountsFromInvoices(state);
assert.strictEqual(customer.balance, 1);

const customerId = customer.id;
assert.strictEqual(updateCustomerInfo(customerId, "أبو محمد", "0591234567"), true);
assert.strictEqual(customer.id, customerId);
assert.strictEqual(customer.name, "أبو محمد");
assert.strictEqual(customer.phone, "0591234567");
assert.strictEqual(customer.balance, 1);
assert(state.invoices.filter((invoice) => invoice.customerId === customerId).every((invoice) => invoice.customerName === "أبو محمد"));

const duplicate = upsertCustomer("أبو محمد مكرر", { phone: "0597654321" });
state.invoices.unshift({
  id: "duplicate-debt",
  number: "DEBT-TEST",
  type: "debt",
  status: "debt",
  customerId: duplicate.id,
  customerName: duplicate.name,
  items: [],
  total: 9,
  paid: 0,
  delta: 9,
  createdAt: new Date().toISOString()
});
state.invoices.unshift({
  id: "duplicate-named-debt",
  number: "DEBT-NAMED-TEST",
  type: "debt",
  status: "debt",
  customerId: null,
  customerName: duplicate.name,
  items: [],
  total: 3,
  paid: 0,
  delta: 3,
  createdAt: new Date().toISOString()
});
state.customerPrices = [
  { customerId, itemId: "tea", price: 4 },
  { customerId: duplicate.id, itemId: "coffee", price: 10 },
  { customerId: duplicate.id, itemId: "tea", price: 5 }
];
state.openOrders[2] = {
  customerId: duplicate.id,
  customerName: duplicate.name,
  customerPhone: duplicate.phone,
  items: [],
  discount: 0,
  payments: {}
};
assert.strictEqual(mergeCustomers(duplicate.id, customerId), true);
assert(!state.customers.some((item) => item.id === duplicate.id));
assert(state.invoices.filter((invoice) => invoice.id.startsWith("duplicate")).every((invoice) => invoice.customerId === customerId));
assert(state.invoices.filter((invoice) => invoice.id.startsWith("duplicate")).every((invoice) => invoice.customerName === "أبو محمد"));
assert.strictEqual(state.openOrders[2].customerId, customerId);
assert.strictEqual(state.openOrders[2].customerName, "أبو محمد");
assert(!state.customerPrices.some((price) => price.customerId === duplicate.id));
assert(state.customerPrices.some((price) => price.customerId === customerId && price.itemId === "coffee" && price.price === 10));
assert(state.customerPrices.some((price) => price.customerId === customerId && price.itemId === "tea" && price.price === 4));
assert.strictEqual(customer.balance, 13);
const posOrder = getOpenOrder();
posOrder.customerId = customerId;
posOrder.customerName = customer.name;
posOrder.customerPhone = customer.phone;
renderPosCustomerAccountCard(posOrder, customer);
assert.strictEqual(els.posCustomerAccountCard.hidden, false);
assert(els.posCustomerAccountCard.className.includes("is-debt"));
assert(els.posCustomerAccountCard.innerHTML.includes(balanceText(customer.balance)));
assert(els.posCustomerAccountCard.innerHTML.includes('data-pos-customer-action="open"'));
assert(els.posCustomerAccountCard.innerHTML.includes('data-pos-customer-action="settle"'));
posOrder.items = [{ id: "tea", name: "شاي", qty: 1, price: 6, cost: 1 }];
posOrder.discount = 0;
posOrder.payments = { cash: 0, bank: 0, wallet: 0 };
posOrder.changeReturned = 0;
renderCustomerAccountProjection(posOrder, customer, orderMath(posOrder));
assert(els.customerAccountBox.className.includes("is-projected-debt"));
assert(els.customerAccountBox.innerHTML.includes(balanceText(customer.balance + 6)));
assert(els.customerAccountBox.innerHTML.includes("بعد الإغلاق"));
assert.strictEqual(normalizeWhatsappPhone("0591234567"), "970591234567");
assert.strictEqual(debtReminderCustomers()[0].id, customerId);
const reminderMessage = debtReminderMessage(customer);
assert(reminderMessage.includes(customer.name));
assert(reminderMessage.includes(money(customer.balance)));
assert(debtReminderUrl(customer).startsWith("https://wa.me/970591234567?text="));

const health = dataHealthReport(state);
assert.strictEqual(health.ok, true, health.issues.join(", "));
})();
`;

(async () => {
  await vm.runInContext(scenario, context, { filename: "flow-scenario.js" });
  console.log("Business flow scenario passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
