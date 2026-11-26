
// ==========================================
// CAVE MATCHA ORDERING SYSTEM
// Cloudflare Pages + Discord Version
// ==========================================


// ==========================================
// CLOUDFLARE PAGES API
// ==========================================

const API_URL = "/api/order";


// ==========================================
// PRODUCT AND OPTION DATA
// ==========================================

let menu = [];
let optionGroups = [];


// ==========================================
// ORDER STATE
// ==========================================

let cart = [];
let selected = null;
let editingIndex = -1;
let qty = 1;
let options = {};

let currentCategory = "all";


// ==========================================
// ORDER HISTORY
// ==========================================

const HISTORY_KEY = "caveMatchaOrders";

let orderHistory = loadOrderHistory();


// ==========================================
// MATCHA PRODUCT CHECK
// ==========================================

function isMatchaProduct(product) {
    return String(product.category || "")
        .trim()
        .toLowerCase() === "matcha";
}


// ==========================================
// LOAD PRODUCTS AND OPTIONS
// ==========================================

async function loadProducts() {
    try {
        const [productResponse, optionResponse] = await Promise.all([
            fetch("./products.json"),
            fetch("./options.json")
        ]);

        if (!productResponse.ok) {
            throw new Error("Unable to load products.json");
        }

        if (!optionResponse.ok) {
            throw new Error("Unable to load options.json");
        }

        const productData = await productResponse.json();
        const optionData = await optionResponse.json();

        if (!Array.isArray(productData)) {
            throw new Error("Invalid products.json format");
        }

        if (!optionData || !Array.isArray(optionData.groups)) {
            throw new Error("Invalid options.json format");
        }

        menu = productData
            .filter(product =>
                product.available !== false &&
                product.category &&
                typeof product.category === "string"
            )
            .map(product => ({
                ...product,
                category: product.category.trim()
            }));

        optionGroups = optionData.groups.filter(group =>
            group.key &&
            group.title &&
            Array.isArray(group.values) &&
            group.values.length > 0
        );

        renderCategories();
        renderProducts(currentCategory);
        updateCart();

    } catch (error) {
        console.error("Loading failed:", error);

        document.getElementById("products").innerHTML = `
            <div class="empty">
                Unable to load the menu.
                <br><br>
                Please check products.json and options.json.
            </div>
        `;
    }
}


// ==========================================
// GET OPTIONS FOR A PRODUCT
// ==========================================

function getApplicableGroups(product) {
    return optionGroups.filter(group => {
        if (!group.categories || !group.categories.length) {
            return true;
        }

        const category = String(product.category || "")
            .trim()
            .toLowerCase();

        return group.categories.some(item =>
            String(item).trim().toLowerCase() === category
        );
    });
}


// ==========================================
// PREPARE PRODUCT OPTIONS
// ==========================================

function prepareOptions(product, savedOptions = {}) {
    const result = {};

    getApplicableGroups(product).forEach(group => {
        const validNames = group.values.map(value => value.name);

        if (group.type === "multiple") {
            const saved = Array.isArray(savedOptions[group.key])
                ? savedOptions[group.key]
                : [];

            result[group.key] = saved.filter(name =>
                validNames.includes(name)
            );

        } else {
            const saved = savedOptions[group.key];

            result[group.key] = validNames.includes(saved)
                ? saved
                : group.values[0].name;
        }
    });

    return result;
}


// ==========================================
// OPTION PRICE CALCULATION
// ==========================================

function getOptionPrice(group, selectedValue) {
    if (group.type === "multiple") {
        if (!Array.isArray(selectedValue)) return 0;

        return selectedValue.reduce((total, name) => {
            const value = group.values.find(item =>
                item.name === name
            );

            return total + Number(value?.price || 0);
        }, 0);
    }

    const value = group.values.find(item =>
        item.name === selectedValue
    );

    return Number(value?.price || 0);
}


// ==========================================
// ORDER HISTORY
// ==========================================

function loadOrderHistory() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(HISTORY_KEY) || "[]"
        );

        return Array.isArray(saved) ? saved : [];

    } catch (error) {
        console.error("History loading failed:", error);
        return [];
    }
}


function saveHistory() {
    try {
        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(orderHistory)
        );

        return true;

    } catch (error) {
        console.error("History saving failed:", error);
        return false;
    }
}


// ==========================================
// GENERATE FOUR-DIGIT COLLECTION CODE
// ==========================================

function generateOrderCode() {
    const random = new Uint32Array(1);

    crypto.getRandomValues(random);

    return String(random[0] % 10000).padStart(4, "0");
}


// ==========================================
// HELPERS
// ==========================================

function money(n) {
    return "RM" + Number(n).toFixed(2);
}


// ==========================================
// BROWSER BACK BUTTON NAVIGATION
// ==========================================

let drawerPage = "menu";


function navigateDrawer(page, mode = "push", data = {}) {
    drawerPage = page;

    const state = {
        caveMatcha: true,
        page,
        ...data
    };

    if (mode === "push") {
        history.pushState(state, "", location.href);

    } else if (mode === "replace") {
        history.replaceState(state, "", location.href);
    }
}


function hideDrawer() {
    document.getElementById("overlay").classList.remove("show");
    document.getElementById("drawer").classList.remove("show");

    drawerPage = "menu";

    updateFloatingOrderButton();
}


function renderPreviousPage(state) {
    if (!state || !state.caveMatcha) {
        hideDrawer();
        return;
    }

    switch (state.page) {
        case "product":
            openProduct(
                state.productId,
                state.editingIndex ?? -1,
                true
            );
            break;

        case "cart":
            openCart(true);
            break;

        case "history":
            openHistory(true);
            break;

        case "confirmation":
            if (state.order) {
                showOrderConfirmation(state.order, true);
            } else {
                hideDrawer();
            }
            break;

        default:
            hideDrawer();
    }
}


window.addEventListener("popstate", event => {
    renderPreviousPage(event.state);
});


// ==========================================
// AUTOMATIC CATEGORY GENERATION
// ==========================================

function renderCategories() {
    const container = document.getElementById("categoryTabs");

    if (!container) return;

    const categories = [
        ...new Set(
            menu
                .map(product => product.category)
                .filter(Boolean)
        )
    ];

    if (
        currentCategory !== "all" &&
        !categories.includes(currentCategory)
    ) {
        currentCategory = "all";
    }

    container.innerHTML = `
        <button
            class="tab ${currentCategory === "all" ? "active" : ""}"
            data-category="all"
        >
            All drinks
        </button>

        ${categories.map(category => `
            <button
                class="tab ${currentCategory === category ? "active" : ""}"
                data-category="${category}"
            >
                ${category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
        `).join("")}
    `;

    container.querySelectorAll(".tab").forEach(button => {
        button.addEventListener("click", () => {
            filter(button.dataset.category, button);
        });
    });
}


// ==========================================
// CATEGORY FILTER
// ==========================================

function filter(category, element) {
    currentCategory = category;

    document.querySelectorAll(".tab").forEach(tab => {
        tab.classList.remove("active");
    });

    if (element) {
        element.classList.add("active");
    }

    document.getElementById("categoryTitle").textContent =
        category === "all"
            ? "Our Menu"
            : category.charAt(0).toUpperCase() + category.slice(1);

    renderProducts(category);
}


// ==========================================
// DISPLAY PRODUCTS
// ==========================================

function renderProducts(category = currentCategory) {
    const productsElement = document.getElementById("products");

    const filteredProducts = menu.filter(product =>
        category === "all" || product.category === category
    );

    if (filteredProducts.length === 0) {
        productsElement.innerHTML = `
            <div class="empty">
                No products available in this category.
            </div>
        `;
        return;
    }

    productsElement.innerHTML = filteredProducts.map(product => `
        <article
            class="product"
            onclick="openProduct(${Number(product.id)})"
        >
            <img
                src="${product.image || ""}"
                alt="${product.name}"
                loading="lazy"
            >

            <div class="product-info">

                <div class="product-name">
                    ${product.name}
                </div>

                <div class="product-desc">
                    ${product.desc || ""}
                </div>

                <div class="product-bottom">

                    <span class="price">
                        ${money(product.price)}
                    </span>

                    <button
                        class="add"
                        aria-label="Add ${product.name}"
                        type="button"
                    >
                        +
                    </button>

                </div>

            </div>
        </article>
    `).join("");
}


// ==========================================
// PRODUCT CUSTOMISATION
// ==========================================

function openProduct(id, index = -1, fromPop = false) {
    selected = menu.find(
        product => String(product.id) === String(id)
    );

    if (!selected) return;

    editingIndex = index;

    qty = index >= 0 ? cart[index].qty : 1;

    const savedOptions = index >= 0
        ? (cart[index].options || {})
        : {};

    options = prepareOptions(selected, savedOptions);

    renderDrawer();

    document.getElementById("drawerTitle").textContent =
        "CUSTOMISE YOUR DRINK";

    navigateDrawer(
        "product",
        fromPop ? "none" : "push",
        {
            productId: selected.id,
            editingIndex
        }
    );

    showDrawer();
}


// ==========================================
// RENDER CUSTOMISATION
// ==========================================

function renderDrawer() {
    const product = selected;

    const unit = unitPrice(product, options);

    const groupsHTML = getApplicableGroups(product)
        .map(group => renderOptionGroup(group))
        .join("");

    document.getElementById("drawerContent").innerHTML = `

        <div class="drawer-product">

            <img
                src="${product.image || ""}"
                alt="${product.name}"
            >

            <div>
                <h3>${product.name}</h3>
                <p>${product.desc || ""}</p>

                <p style="margin-top:8px;color:#526b48;font-weight:bold">
                    ${money(product.price)}
                </p>
            </div>

        </div>

        ${groupsHTML}

        <div class="option-group">

            <div class="option-heading">
                Quantity
            </div>

            <div class="qty-row">

                <button onclick="changeQty(-1)">−</button>

                <strong id="quantity">${qty}</strong>

                <button onclick="changeQty(1)">+</button>

            </div>

        </div>

    `;

    document.getElementById("drawerFooter").innerHTML = `

        <div class="total-row">
            <span>Total</span>
            <span>${money(unit * qty)}</span>
        </div>

        <button class="primary" onclick="addToCart()">
            ${editingIndex >= 0 ? "UPDATE ITEM" : "ADD TO BAG"}
            · ${money(unit * qty)}
        </button>

    `;
}


// ==========================================
// RENDER ONE OPTION GROUP
// ==========================================

function renderOptionGroup(group) {
    const selectedValue = options[group.key];

    const isMultiple = group.type === "multiple";

    const requiredText = group.required
        ? "REQUIRED"
        : "OPTIONAL";

    if (isMultiple) {
        return `
            <div class="option-group">

                <div class="option-heading">
                    ${group.title}
                    <span class="required">${requiredText}</span>
                </div>

                ${group.values.map(value => {
                    const checked = Array.isArray(selectedValue) &&
                        selectedValue.includes(value.name);

                    return `
                        <label class="addon">

                            <span>
                                ${value.name}

                                <small style="color:#858980">
                                    ${Number(value.price) > 0
                                        ? "· +" + money(value.price)
                                        : ""}
                                </small>

                                ${value.description ? `
                                    <small class="choice-description">
                                        ${value.description}
                                    </small>
                                ` : ""}
                            </span>

                            <input
                                type="checkbox"
                                ${checked ? "checked" : ""}
                                onchange="toggleOption('${group.key}','${value.name}',this.checked)"
                            >

                        </label>
                    `;
                }).join("")}

            </div>
        `;
    }

    return `
        <div class="option-group">

            <div class="option-heading">
                ${group.title}
                <span class="required">${requiredText}</span>
            </div>

            <div class="choices">

                ${group.values.map(value => `
                    <button
                        class="choice ${selectedValue === value.name ? "selected" : ""}"
                        onclick="selectOption('${group.key}','${value.name}')"
                    >
                        ${value.name}

                        <small>
                            ${Number(value.price) > 0
                                ? "+" + money(value.price)
                                : Number(value.price) === 0 && group.key === "powder"
                                    ? "Included"
                                    : ""}
                        </small>

                        ${value.description ? `
                            <span class="choice-description">
                                ${value.description}
                            </span>
                        ` : ""}

                    </button>
                `).join("")}

            </div>

        </div>
    `;
}


// ==========================================
// SELECT SINGLE OPTION
// ==========================================

function selectOption(key, value) {
    const group = optionGroups.find(item =>
        item.key === key
    );

    if (!group || group.type === "multiple") return;

    if (!group.values.some(item => item.name === value)) {
        return;
    }

    options[key] = value;

    renderDrawer();
}


// ==========================================
// SELECT MULTIPLE OPTIONS
// ==========================================

function toggleOption(key, value, on) {
    const group = optionGroups.find(item =>
        item.key === key
    );

    if (!group || group.type !== "multiple") return;

    if (!group.values.some(item => item.name === value)) {
        return;
    }

    if (!Array.isArray(options[key])) {
        options[key] = [];
    }

    if (on && !options[key].includes(value)) {
        options[key].push(value);
    }

    if (!on) {
        options[key] = options[key].filter(item =>
            item !== value
        );
    }

    renderDrawer();
}


// ==========================================
// QUANTITY
// ==========================================

function changeQty(n) {
    qty = Math.max(1, Math.min(20, qty + n));

    renderDrawer();
}


// ==========================================
// PRICE CALCULATION
// ==========================================

function unitPrice(product, selectedOptions) {
    const optionTotal = getApplicableGroups(product)
        .reduce((total, group) => {
            return total + getOptionPrice(
                group,
                selectedOptions[group.key]
            );
        }, 0);

    return Number(product.price) + optionTotal;
}


// ==========================================
// OPTION SUMMARY
// ==========================================

function optionSummary(itemOptions = {}) {
    const parts = [];

    optionGroups.forEach(group => {
        const value = itemOptions[group.key];

        if (Array.isArray(value) && value.length) {
            parts.push(`${group.title}: ${value.join(", ")}`);

        } else if (value && !Array.isArray(value)) {
            parts.push(`${group.title}: ${value}`);
        }
    });

    return parts;
}


// ==========================================
// ADD TO CART
// ==========================================

function addToCart() {
    if (!selected) return;

    const item = {
        id: selected.id,
        name: selected.name,
        image: selected.image || "",
        price: unitPrice(selected, options),

        options: JSON.parse(JSON.stringify(options)),

        qty
    };

    const isEditing = editingIndex >= 0;

    if (isEditing) {
        cart[editingIndex] = item;
    } else {
        cart.push(item);
    }

    updateCart();

    closeDrawer();
}


// ==========================================
// FLOATING ORDER NOW BUTTON
// ==========================================

function updateFloatingOrderButton() {
    let button = document.getElementById("floatingOrderButton");

    if (!button) {
        button = document.createElement("button");

        button.id = "floatingOrderButton";
        button.className = "floating-order-button";
        button.type = "button";
        button.setAttribute("aria-label", "Open your order");

        button.innerHTML = `
            <span>ORDER NOW</span>
            <span id="floatingOrderTotal"></span>
            <span id="floatingOrderCount" class="floating-order-count">0</span>
        `;

        button.addEventListener("click", () => openCart());

        document.body.appendChild(button);
    }

    const total = cart.reduce(
        (sum, item) => sum + item.price * item.qty,
        0
    );

    const quantity = cart.reduce(
        (sum, item) => sum + item.qty,
        0
    );

    const drawer = document.getElementById("drawer");
    const drawerOpen = drawer && drawer.classList.contains("show");

    const totalElement = document.getElementById("floatingOrderTotal");
    const countElement = document.getElementById("floatingOrderCount");

    if (totalElement) {
        totalElement.textContent = money(total);
    }

    if (countElement) {
        countElement.textContent = quantity;
    }

    button.classList.toggle(
        "show",
        cart.length > 0 && !drawerOpen
    );
}


// ==========================================
// UPDATE CART
// ==========================================

function updateCart() {
    document.getElementById("cartCount").textContent =
        cart.reduce((sum, item) => sum + item.qty, 0);

    updateFloatingOrderButton();
}


// ==========================================
// OPEN CART
// ==========================================

function openCart(fromPop = false, replace = false) {
    editingIndex = -1;

    document.getElementById("drawerTitle").textContent =
        "YOUR ORDER";

    const total = cart.reduce(
        (sum, item) => sum + item.price * item.qty,
        0
    );

    document.getElementById("drawerContent").innerHTML =
        cart.length
            ? `
                ${cart.map((item, index) => {
                    const product = menu.find(
                        p => String(p.id) === String(item.id)
                    );

                    const image = item.image || product?.image || "";
                    const summary = optionSummary(item.options || {});

                    return `
                        <div class="cart-item">

                            <img
                                src="${image}"
                                alt="${item.name}"
                            >

                            <div class="cart-item-info">

                                <h3>
                                    ${item.name} × ${item.qty}
                                </h3>

                                ${summary.map(text => `
                                    <p>${text}</p>
                                `).join("")}

                                <div class="price">
                                    ${money(item.price * item.qty)}
                                </div>

                                <div class="history-actions">

                                    <button onclick="editCart(${index})">
                                        EDIT
                                    </button>

                                    <button onclick="removeCart(${index})">
                                        REMOVE
                                    </button>

                                </div>

                            </div>

                        </div>
                    `;
                }).join("")}
            `
            : `
                <div class="empty">
                    Your bag is empty.
                    <br><br>
                    Choose a drink to get started.
                </div>
            `;

    document.getElementById("drawerFooter").innerHTML = `

        <div class="total-row">
            <span>Subtotal</span>
            <span>${money(total)}</span>
        </div>

        <button
            class="primary"
            ${cart.length ? "" : "disabled"}
            onclick="checkout()"
        >
            PLACE ORDER · ${money(total)}
        </button>

    `;

    navigateDrawer(
        "cart",
        fromPop ? "none" : replace ? "replace" : "push"
    );

    showDrawer();
}


// ==========================================
// EDIT CART
// ==========================================

function editCart(index) {
    const item = cart[index];

    if (!item) return;

    openProduct(item.id, index);
}


// ==========================================
// REMOVE CART ITEM
// ==========================================

function removeCart(index) {
    cart.splice(index, 1);

    updateCart();

    openCart(false, true);
}


// ==========================================
// SEND ORDER TO CLOUDFLARE PAGES
// ==========================================

async function sendDiscordOrder(order) {
    const response = await fetch(API_URL, {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(order)
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("Invalid server response.");
    }

    if (!response.ok || !result.success) {
        throw new Error(
            result.error || `Server error: ${response.status}`
        );
    }

    return true;
}


// ==========================================
// CHECKOUT
// ==========================================

async function checkout() {
    if (!cart.length) return;

    const button = document.querySelector(
        "#drawerFooter button.primary"
    );

    if (button) {
        button.disabled = true;
        button.textContent = "SENDING ORDER...";
    }

    const orderItems = JSON.parse(JSON.stringify(cart));

    const total = orderItems.reduce(
        (sum, item) => sum + item.price * item.qty,
        0
    );

    const order = {
        id: "CM" + Date.now(),
        code: generateOrderCode(),
        timestamp: new Date().toISOString(),
        items: orderItems,
        total,
        status: "Received"
    };

    try {
        await sendDiscordOrder(order);

        orderHistory.unshift(order);
        saveHistory();

        cart = [];

        updateCart();

        showOrderConfirmation(order);

    } catch (error) {
        console.error("Order submission failed:", error);

        alert(
            "Unable to submit your order.\n" +
            error.message
        );

        openCart(false, true);
    }
}


// ==========================================
// ORDER CONFIRMATION
// ==========================================

function showOrderConfirmation(order, fromPop = false) {
    document.getElementById("drawerTitle").textContent =
        "ORDER CONFIRMED";

    document.getElementById("drawerContent").innerHTML = `

        <div style="text-align:center;padding:35px 10px">

            <p style="color:#526b48;font-weight:bold">
                YOUR ORDER HAS BEEN RECEIVED
            </p>

            <h1 style="
                font-size:52px;
                letter-spacing:8px;
                margin:25px 0;
            ">
                ${order.code}
            </h1>

            <p style="color:#858980;font-size:13px">
                Keep this number for collection.
            </p>

            <div style="
                margin-top:30px;
                padding:15px;
                background:#f1f4ee;
                border-radius:6px;
            ">

                <strong>${money(order.total)}</strong>

                <p style="font-size:12px;color:#858980">
                    Order total
                </p>

            </div>

        </div>

    `;

    document.getElementById("drawerFooter").innerHTML = `

        <button class="primary" onclick="closeDrawer()">
            DONE
        </button>

    `;

    navigateDrawer(
        "confirmation",
        fromPop ? "none" : "replace",
        { order }
    );

    showDrawer();
}


// ==========================================
// ORDER HISTORY
// ==========================================

function openHistory(fromPop = false, replace = false) {
    document.getElementById("drawerTitle").textContent =
        "ORDER HISTORY";

    if (!orderHistory.length) {
        document.getElementById("drawerContent").innerHTML = `

            <div class="empty">
                No previous orders yet.
            </div>

        `;

    } else {
        document.getElementById("drawerContent").innerHTML =

            orderHistory.map((order, index) => `

                <div class="history-order">

                    <div class="history-top">

                        <strong>
                            ${order.code || order.id}
                        </strong>

                        <span class="status">
                            ${order.status}
                        </span>

                    </div>

                    <div class="history-meta">
                        ${new Date(order.timestamp).toLocaleString()}
                    </div>

                    ${order.items.map(item => {
                        const summary = optionSummary(item.options || {});

                        return `
                            <p style="font-size:12px;line-height:1.6;margin:8px 0">

                                ${item.qty} × ${item.name}

                                ${summary.map(text => `
                                    <br>${text}
                                `).join("")}

                            </p>
                        `;
                    }).join("")}

                    <div class="history-top">

                        <strong>Total</strong>

                        <strong>${money(order.total)}</strong>

                    </div>

                    <div class="history-actions">

                        <button onclick="reorder(${index})">
                            ORDER AGAIN
                        </button>

                    </div>

                </div>

            `).join("");
    }

    document.getElementById("drawerFooter").innerHTML = `

        <button
            class="primary"
            onclick="clearHistory()"
            ${orderHistory.length ? "" : "disabled"}
        >
            CLEAR ORDER HISTORY
        </button>

    `;

    navigateDrawer(
        "history",
        fromPop ? "none" : replace ? "replace" : "push"
    );

    showDrawer();
}


// ==========================================
// REORDER
// ==========================================

function reorder(index) {
    const order = orderHistory[index];

    if (!order) return;

    cart = JSON.parse(JSON.stringify(order.items))
        .filter(item => menu.some(product =>
            String(product.id) === String(item.id)
        ));

    cart.forEach(item => {
        const product = menu.find(p =>
            String(p.id) === String(item.id)
        );

        item.options = prepareOptions(
            product,
            item.options || {}
        );

        item.image = product.image || "";

        item.price = unitPrice(
            product,
            item.options
        );
    });

    updateCart();

    openCart();
}


// ==========================================
// CLEAR HISTORY CONFIRMATION MODAL
// ==========================================

function clearHistory() {
    if (!orderHistory.length) return;

    if (document.getElementById("clearHistoryModal")) return;

    const modal = document.createElement("div");

    modal.className = "confirm-overlay";
    modal.id = "clearHistoryModal";

    modal.innerHTML = `

        <div class="confirm-box">

            <h3>Clear Order History</h3>

            <p>
                Are you sure you want to delete all saved order history?
            </p>

            <span>
                This action cannot be undone.
            </span>

            <div class="confirm-actions">

                <button
                    class="confirm-cancel"
                    onclick="closeClearHistory()"
                >
                    CANCEL
                </button>

                <button
                    class="confirm-delete"
                    onclick="confirmClearHistory()"
                >
                    DELETE HISTORY
                </button>

            </div>

        </div>

    `;

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeClearHistory();
        }
    });

    document.body.appendChild(modal);
}


// ==========================================
// CLOSE CLEAR HISTORY MODAL
// ==========================================

function closeClearHistory() {
    const modal = document.getElementById("clearHistoryModal");

    if (modal) {
        modal.remove();
    }
}


// ==========================================
// CONFIRM CLEAR HISTORY
// ==========================================

function confirmClearHistory() {
    const previous = orderHistory;

    orderHistory = [];

    if (!saveHistory()) {
        orderHistory = previous;

        closeClearHistory();

        alert(
            "Unable to clear order history.\nPlease try again."
        );

        return;
    }

    closeClearHistory();

    openHistory(false, true);
}


// ==========================================
// DRAWER
// ==========================================

function showDrawer() {
    document.getElementById("overlay").classList.add("show");

    document.getElementById("drawer").classList.add("show");

    updateFloatingOrderButton();
}


function closeDrawer() {
    if (
        history.state &&
        history.state.caveMatcha
    ) {
        history.back();
        return;
    }

    hideDrawer();
}


// ==========================================
// INITIALISE
// ==========================================

loadProducts();
