const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());

const ALLOWED_ORIGINS = [
  "https://tickets-9p4o.onrender.com",
  "https://tickets.apolocreativo.site",
  "https://apolocreativo.site",
  "https://www.apolocreativo.site"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Origen no autorizado por CORS"));
  }
}));

const PORT = process.env.PORT || 3000;
const MP_API = "https://api.mercadopago.com";

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "Apolo Creativo - Pagos" });
});

function requireToken(res) {
  if (!process.env.MP_ACCESS_TOKEN) {
    res.status(500).json({ error: "Falta configurar MP_ACCESS_TOKEN en Render." });
    return false;
  }
  return true;
}

app.post("/crear-pago", async (req, res) => {
  if (!requireToken(res)) return;

  try {
    const { title, amount, orderId } = req.body || {};
    const parsedAmount = Number(amount);
    if (!title || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || !orderId) {
      return res.status(400).json({ error: "Faltan datos válidos para crear el pago." });
    }

    const site = "https://tickets-9p4o.onrender.com/";
    const payload = {
      items: [{
        title: String(title).slice(0, 200),
        quantity: 1,
        currency_id: "ARS",
        unit_price: Math.round(parsedAmount * 100) / 100
      }],
      external_reference: String(orderId).slice(0, 200),
      notification_url: "https://apolo-pagos.onrender.com/webhook",
      back_urls: {
        success: site + "?payment=success",
        failure: site + "?payment=failure",
        pending: site + "?payment=pending"
      },
      auto_return: "approved"
    };

    const mpResponse = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const result = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago preference error:", mpResponse.status, result);
      return res.status(mpResponse.status).json({
        error: result.message || "Mercado Pago no pudo crear la preferencia."
      });
    }

    // Return both links because test credentials may require sandbox_init_point.
    res.json({
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
      preference_id: result.id,
      external_reference: payload.external_reference
    });
  } catch (error) {
    console.error("Error creando preferencia:", error);
    res.status(500).json({ error: "No se pudo crear el pago." });
  }
});

app.get("/verificar-pago", async (req, res) => {
  if (!requireToken(res)) return;
  const paymentId = String(req.query.payment_id || "");
  if (!/^\d+$/.test(paymentId)) {
    return res.status(400).json({ error: "Identificador de pago inválido." });
  }

  try {
    const mpResponse = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });
    const payment = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago payment lookup error:", mpResponse.status, payment);
      return res.status(mpResponse.status).json({ error: "No se pudo consultar el pago en Mercado Pago." });
    }

    res.json({
      id: String(payment.id),
      status: payment.status,
      status_detail: payment.status_detail,
      description: payment.description || payment.additional_info?.items?.[0]?.title || "Entrada de teatro",
      external_reference: payment.external_reference || "",
      transaction_amount: payment.transaction_amount,
      currency_id: payment.currency_id
    });
  } catch (error) {
    console.error("Error verificando pago:", error);
    res.status(500).json({ error: "No se pudo verificar el pago." });
  }
});

// Mercado Pago sends notifications here. Verify the payment against its API;
// do not treat the incoming webhook body alone as proof of payment.
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);
  if (!process.env.MP_ACCESS_TOKEN) {
    console.error("Webhook recibido pero MP_ACCESS_TOKEN no está configurado.");
    return;
  }

  const topic = req.query.type || req.query.topic || req.body?.type;
  const paymentId = req.query["data.id"] || req.body?.data?.id || req.body?.id;

  if (topic !== "payment" && !paymentId) {
    console.log("Notificación de Mercado Pago recibida:", { topic });
    return;
  }
  if (!paymentId || !/^\d+$/.test(String(paymentId))) {
    console.log("Webhook sin payment ID válido.");
    return;
  }

  try {
    const response = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });
    const payment = await response.json();
    if (!response.ok) {
      console.error("No se pudo verificar notificación:", response.status, payment);
      return;
    }
    console.log("Pago verificado por webhook:", JSON.stringify({
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      external_reference: payment.external_reference,
      transaction_amount: payment.transaction_amount,
      payer_email: payment.payer?.email,
      payer_name: payment.payer?.first_name,
      payer_surname: payment.payer?.last_name
    }));
    // TODO: persistir esta compra en una base de datos para llevar un listado confiable.
  } catch (error) {
    console.error("Error procesando webhook:", error);
  }
});

app.listen(PORT, () => {
  console.log(`Apolo Pagos escuchando en puerto ${PORT}`);
});
