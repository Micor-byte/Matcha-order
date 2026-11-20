
 // ==========================================
 // CAVE MATCHA ORDERING SYSTEM
 // Direct Discord Webhook Version
 // ==========================================


 // ==========================================
 // DISCORD WEBHOOK
 // ==========================================

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1573269280336912484/2-Dm9iJVXaCtuP2WOeka7jYLb3NIBtE9-HZw5Whg3s9sELym_3xDKtaSdeTF5zObzW7N";


 // ==========================================
 // PRODUCT DATA
 // ==========================================

let menu = [];


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
 // ADD-ON PRICES
 // ==========================================

const addonPrices = {
    "Extra matcha": 3,
    "Extra milk": 2
};


 // ==========================================
 // MATCHA POWDER PRICES
 // ==========================================

const powderPrices = {
    "Kiku": 0,
    "Hisui": 2,
    "Tsubaki": 4
};


 // ==========================================
 // MATCHA PRODUCT CHECK
 // ==========================================

function isMatchaProduct(product) {
    return String(product.category || "")
        .trim()
        .toLowerCase() === "matcha";
}


 // ==========================================
 // LOAD PRODUCTS FROM products.json
 // ==========================================

async function loadProducts() {
    try {
        const response = await fetch("./products.json");

        if (!response.ok) {
            throw new Error("Unable to load products.json");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Invalid products.json format");
        }

        menu = data
            .filter(product =>
                product.available !== false &&
                product.category &&
                typeof product.category === "string"
            )
            .map(product => ({
                ...product,
                category: product.category.trim()
            }));

        renderCategories();
        renderProducts(currentCategory);
        updateCart();

    } catch (error) {
        console.error("Product loading failed:", error);

        document.getElementById("products").innerHTML = `
            <div class="empty">
                Unable to load the menu.
                <br><br>
                Please check products.json.
            </div>
        `;
    }
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
            ? "Our menu"
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

    options = {
        size: "Regular",

        sweet: savedOptions.sweet || "Normal",

        ice: savedOptions.ice || "Regular",

        addons: Array.isArray(savedOptions.addons)
            ? savedOptions.addons.filter(
                addon => Object.hasOwn(addonPrices, addon)
            )
            : []
    };

    if (isMatchaProduct(selected)) {
        options.powder =
            powderPrices[savedOptions.powder] !== undefined
                ? savedOptions.powder
                : "Kiku";
    }

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
    const p = selected;

    const addonTotal = options.addons.reduce(
        (sum, addon) => sum + (addonPrices[addon] || 0),
        0
    );

    const powderTotal = powderPrices[options.powder] || 0;

    const unit = Number(p.price) + addonTotal + powderTotal;

    document.getElementById("drawerContent").innerHTML = `

        <div class="drawer-product">

            <img src="${p.image || ""}" alt="${p.name}">

            <div>
                <h3>${p.name}</h3>
                <p>${p.desc || ""}</p>

                <p style="margin-top:8px;color:#526b48;font-weight:bold">
                    ${money(p.price)}
                </p>
            </div>

        </div>

        ${group("Drink size", "size", ["Regular"])}

        ${isMatchaProduct(p) ? group(
            "Matcha powder",
            "powder",
            ["Kiku", "Hisui", "Tsubaki"],
            {
                "Kiku": "Included",
                "Hisui": "+RM2.00",
                "Tsubaki": "+RM4.00"
            }
        ) : ""}

        ${group("Sweetness level", "sweet", [
            "0%", "25%", "50%", "75%", "Normal"
        ])}

        ${group("Ice level", "ice", [
            "No ice", "Less ice", "Regular"
        ])}

        <div class="option-group">

            <div class="option-heading">
                Add-ons
                <span class="required">OPTIONAL</span>
            </div>

            ${Object.keys(addonPrices).map(addon => `
                <label class="addon">

                    <span>
                        ${addon}

                        <small style="color:#858980">
                            · +${money(addonPrices[addon])}
                        </small>
                    </span>

                    <input
                        type="checkbox"
                        ${options.addons.includes(addon) ? "checked" : ""}
                        onchange="toggleAddon('${addon}',this.checked)"
                    >

                </label>
            `).join("")}

        </div>

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
 // OPTION GROUP
 // ==========================================

function group(title, key, values, prices = {}) {
    return `

        <div class="option-group">

            <div class="option-heading">
                ${title}
                <span class="required">REQUIRED</span>
            </div>

            <div class="choices">

                ${values.map(value => `

                    <button
                        class="choice ${options[key] === value ? "selected" : ""}"
                        onclick="selectOption('${key}','${value}')"
                    >

                        ${value}

                        <small>
                            ${prices[value] === undefined ? "" : prices[value]}
                        </small>

                    </button>

                `).join("")}

            </div>

        </div>

    `;
}


 // ==========================================
 // SELECT OPTIONS
 // ==========================================

function selectOption(key, value) {
    options[key] = value;

    renderDrawer();
}


function toggleAddon(addon, on) {
    if (!Object.hasOwn(addonPrices, addon)) return;

    if (on && !options.addons.includes(addon)) {
        options.addons.push(addon);
    }

    if (!on) {
        options.addons = options.addons.filter(
            item => item !== addon
        );
    }

    renderDrawer();
}


function changeQty(n) {
    qty = Math.max(1, Math.min(20, qty + n));

    renderDrawer();
}


 // ==========================================
 // PRICE CALCULATION
 // ==========================================

function unitPrice(p, o) {
    const addonTotal = (o.addons || []).reduce(
        (sum, addon) => sum + (addonPrices[addon] || 0),
        0
    );

    const powderTotal = powderPrices[o.powder] || 0;

    return Number(p.price) + addonTotal + powderTotal;
}


 // ==========================================
 // ADD TO CART
 // ==========================================

function addToCart() {
    const item = {
        id: selected.id,
        name: selected.name,
        image: selected.image || "",
        price: unitPrice(selected, options),

        options: {
            ...options,
            size: "Regular",
            addons: options.addons.filter(
                addon => Object.hasOwn(addonPrices, addon)
            )
        },

        qty
    };

    if (editingIndex >= 0) {
        cart[editingIndex] = item;
    } else {
        cart.push(item);
    }

    updateCart();

    closeDrawer();
}


 // ==========================================
 // UPDATE CART
 // ==========================================

function updateCart() {
    document.getElementById("cartCount").textContent =
        cart.reduce((sum, item) => sum + item.qty, 0);
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
                    const itemOptions = item.options || {};

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

                                <p>
                                    Regular ·
                                    ${itemOptions.sweet || "Normal"} sweetness ·
                                    ${itemOptions.ice || "Regular"} ice
                                </p>

                                ${itemOptions.powder ? `
                                    <p>
                                        Matcha powder: ${itemOptions.powder}
                                    </p>
                                ` : ""}

                                <p>
                                    ${(itemOptions.addons || []).join(", ") || "No add-ons"}
                                </p>

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
 // SEND ORDER DIRECTLY TO DISCORD
 // ==========================================

async function sendDiscordOrder(order) {

    const itemsText = order.items.map(item => {

        const itemOptions = item.options || {};

        const addons = (itemOptions.addons || []).length
            ? `\nAdd-ons: ${itemOptions.addons.join(", ")}`
            : "";

        const powder = itemOptions.powder
            ? `\nMatcha powder: ${itemOptions.powder}`
            : "";

        return [
            `**${item.qty} × ${item.name}**`,
            `Regular | ${itemOptions.sweet || "Normal"} sweetness`,
            `${itemOptions.ice || "Regular"} ice`,
            powder,
            addons
        ].filter(Boolean).join("\n");

    }).join("\n\n");

    const payload = {

        username: "Cave Matcha Orders",

        embeds: [
            {
                title: "NEW ORDER RECEIVED",

                color: 0x526b48,

                fields: [
                    {
                        name: "COLLECTION CODE",
                        value: `# ${order.code}`,
                        inline: false
                    },
                    {
                        name: "ORDER ITEMS",
                        value: itemsText.slice(0, 1024) || "No items",
                        inline: false
                    },
                    {
                        name: "TOTAL",
                        value: `RM${Number(order.total).toFixed(2)}`,
                        inline: true
                    },
                    {
                        name: "STATUS",
                        value: order.status || "Received",
                        inline: true
                    }
                ],

                footer: {
                    text: "Cave Matcha Ordering System"
                },

                timestamp: order.timestamp || new Date().toISOString()
            }
        ],

        allowed_mentions: {
            parse: []
        }
    };

    const response = await fetch(DISCORD_WEBHOOK_URL, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(payload)

    });

    if (!response.ok) {
        throw new Error(
            `Discord error: ${response.status}`
        );
    }

    return true;
}


 // ==========================================
 // CHECKOUT
 // ==========================================

async function checkout() {
    if (!cart.length) return;

    if (
        !DISCORD_WEBHOOK_URL ||
        DISCORD_WEBHOOK_URL.includes("PASTE_YOUR_NEW")
    ) {
        alert("Discord webhook is not configured.");
        return;
    }

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
                        const itemOptions = item.options || {};

                        return `
                            <p style="font-size:12px;line-height:1.6;margin:8px 0">

                                ${item.qty} × ${item.name}

                                <br>

                                Regular ·
                                ${itemOptions.sweet || "Normal"} sweetness ·
                                ${itemOptions.ice || "Regular"} ice

                                ${itemOptions.powder
                                    ? "<br>Matcha powder: " + itemOptions.powder
                                    : ""}

                                ${(itemOptions.addons || []).length
                                    ? "<br>Add-ons: " + itemOptions.addons.join(", ")
                                    : ""}

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

    cart = JSON.parse(JSON.stringify(order.items));

    cart.forEach(item => {
        item.options = item.options || {};

        item.options.size = "Regular";

        item.options.addons = (item.options.addons || []).filter(
            addon => Object.hasOwn(addonPrices, addon)
        );

        const product = menu.find(
            p => String(p.id) === String(item.id)
        );

        if (product) {
            item.image = product.image || "";

            if (isMatchaProduct(product)) {
                if (powderPrices[item.options.powder] === undefined) {
                    item.options.powder = "Kiku";
                }
            } else {
                delete item.options.powder;
            }

            item.price = unitPrice(product, item.options);
        }
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
