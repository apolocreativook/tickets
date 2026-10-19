exports.handler = async function(event) {
  try {
    console.log("WEBHOOK MERCADO PAGO RECIBIDO");

    const body = event.body ? JSON.parse(event.body) : {};

    console.log("Tipo de evento:", body.type);
    console.log("Acción:", body.action);

    // Obtenemos el ID del pago enviado por Mercado Pago.
    const paymentId = body.data?.id;

    console.log("Payment ID:", paymentId);

    // Si no hay ID de pago, respondemos correctamente
    // para que Mercado Pago no vuelva a intentar indefinidamente.
    if (!paymentId) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          received: true,
          message: "No se recibió payment ID"
        })
      };
    }

    // Consultamos a Mercado Pago para conocer el estado REAL del pago.
    const response = await fetch(
      "https://api.mercadopago.com/v1/payments/" + paymentId,
      {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + process.env.MP_ACCESS_TOKEN
        }
      }
    );

    const payment = await response.json();

    console.log("Estado HTTP Mercado Pago:", response.status);
    console.log("Estado del pago:", payment.status);
    console.log("Monto:", payment.transaction_amount);
    console.log("Referencia externa:", payment.external_reference);

    if (!response.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          received: true,
          error: "No se pudo consultar el pago"
        })
      };
    }

    // Por ahora solamente informamos el resultado.
    // En el siguiente paso vamos a guardar la compra.
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        received: true,
        paymentId: payment.id,
        status: payment.status,
        amount: payment.transaction_amount
      })
    };

  } catch (error) {

    console.error("ERROR WEBHOOK:", error);

    // Respondemos 200 para evitar reintentos innecesarios
    // mientras estamos desarrollando.
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        received: true
      })
    };
  }
};