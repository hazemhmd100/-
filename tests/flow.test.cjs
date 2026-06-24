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
assert.strictEqual(canAccessView("reports"), false);
currentUserRole = "manager";
assert.strictEqual(canAccessView("reports"), true);

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

addMenuItemFromGrid("coffee", "large");
let order = getOpenOrder();
assert.strictEqual(order.items.length, 1);
assert.strictEqual(order.items[0].name, "قهوة - كبير");
assert.strictEqual(order.items[0].price, 12);
addMenuItemFromGrid("coffee");
assert.strictEqual(order.items.length, 1);
assert.strictEqual(order.items[0].qty, 2);

els.paymentAmountInput.value = "24";
closeInvoice();
assert.strictEqual(state.invoices.length, 1);
assert.strictEqual(state.invoices[0].status, "paid");
assert.strictEqual(state.invoices[0].paid, 24);

resetCheckoutFields();
addItem("tea");
els.customerNameInput.value = "أبو أحمد";
closeInvoice();
assert.strictEqual(state.invoices.length, 2);
assert.strictEqual(state.invoices[0].status, "debt");
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
`;

vm.runInContext(scenario, context, { filename: "flow-scenario.js" });

console.log("Business flow scenario passed.");
