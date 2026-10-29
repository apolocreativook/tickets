
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    "https://tickets-9p4o.onrender.com",
    "https://apolocreativo.site",
    "https://www.apolocreativo.site"
  ]
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "Apolo Creativo - Pagos" });
});

app.post("/crear-pago", async (req, res) => {
  try {
    const data = req.body || {};
    const amount = Number(data.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Importe inválido" });
    }

    const token = process.env.MP_ACCESS_TOKEN;

    if (!token) {
      return res.status(500).json({
        error: "Falta configurar MP_ACCESS_TOKEN en Render"
      });
    }

    const response = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          items: [{
            title: String(data.title || "Entrada Apolo Creativo"),
            quantity: 1,
            currency_id: "ARS",
            unit_price: amount
          }],
          external_reference: String(data.orderId || ""),
          back_urls: {
            success: "https://tickets-9p4o.onrender.com/",
            failure: "https://tickets-9p4o.onrender.com/",
            pending: "https://tickets-9p4o.onrender.com/"
          },
          auto_return: "approved"
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Mercado Pago:", response.status, result);
      return res.status(502).json({
        error: "Mercado Pago no pudo generar el pago"
      });
    }

    return res.json({ init_point: result.init_point });

  } catch (error) {
    console.error("Error creando pago:", error.message);
    return res.status(500).json({
      error: "No se pudo generar el pago"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor de pagos escuchando en puerto ${PORT}`);
});
