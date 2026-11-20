export async function onRequestPost({ request, env }) {
    try {
        const webhook = env.DISCORD_WEBHOOK_URL;

        if (!webhook) {
            return Response.json(
                { success: false, error: "Webhook secret missing." },
                { status: 500 }
            );
        }

        const order = await request.json();

        if (!order || !Array.isArray(order.items) || !order.items.length) {
            return Response.json(
                { success: false, error: "Invalid order." },
                { status: 400 }
            );
        }

        const itemsText = order.items.map(item => {
            const options = item.options || {};

            return [
                `**${item.qty} × ${item.name}**`,
                `Regular | ${options.sweet || "Normal"} sweetness`,
                `${options.ice || "Regular"} ice`,
                options.powder ? `Matcha powder: ${options.powder}` : "",
                options.addons?.length
                    ? `Add-ons: ${options.addons.join(", ")}`
                    : ""
            ].filter(Boolean).join("\n");
        }).join("\n\n");

        const payload = {
            username: "Cave Matcha Orders",
            embeds: [{
                title: "NEW ORDER RECEIVED",
                color: 0x526b48,
                fields: [
                    {
                        name: "COLLECTION CODE",
                        value: `# ${order.code}`
                    },
                    {
                        name: "ORDER ITEMS",
                        value: itemsText.slice(0, 1024) || "No items"
                    },
                    {
                        name: "TOTAL",
                        value: `RM${Number(order.total).toFixed(2)}`,
                        inline: true
                    },
                    {
                        name: "STATUS",
                        value: "Received",
                        inline: true
                    }
                ],
                footer: {
                    text: "Cave Matcha Ordering System"
                },
                timestamp: new Date().toISOString()
            }],
            allowed_mentions: {
                parse: []
            }
        };

        const discordResponse = await fetch(webhook, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!discordResponse.ok) {
            return Response.json(
                { success: false, error: "Discord rejected the order." },
                { status: 502 }
            );
        }

        return Response.json({ success: true });

    } catch (error) {
        console.error(error);

        return Response.json(
            { success: false, error: "Unable to process order." },
            { status: 400 }
        );
    }
}

export async function onRequest({ request, next }) {
    if (request.method === "POST") {
        return next();
    }

    return Response.json(
        { success: false, error: "Method not allowed." },
        {
            status: 405,
            headers: { Allow: "POST" }
        }
    );
}
