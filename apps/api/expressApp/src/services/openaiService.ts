import axios from "axios";

const openAiClient = axios.create({
  baseURL: "https://api.openai.com/v1",
  headers: {
    Authorization: `Bearer ${process.env.OAI_KEY?.trim()}`,
  },
});

const confirmarPedidoFunction = {
  name: "confirmarPedido",
  description: "Confirma un pedido existente utilizando su ID.",
  parameters: {
    type: "object",
    properties: {
      order_id: {
        type: "string",
        description: "Identificador único del pedido a confirmar.",
      },
    },
    required: ["order_id"],
  },
};

export const sendMessageToOpenAI = async (
  message: string,
  context: { role: string; content: string }[],
) => {
  try {
    const response = await openAiClient.post("/chat/completions", {
      model: "gpt-4o",
      messages: [...context, { role: "user", content: message }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "funnel_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              funnel_stage: {
                type: "string",
                enum: ["awareness", "interest", "desire", "action"],
              },
              response_text: {
                type: "string",
              },
              action: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  parameters: {
                    type: "object",
                    additionalProperties: false,
                  },
                },
                required: ["name"],
                additionalProperties: false,
              },
            },
            required: ["funnel_stage", "response_text", "action"], // 👈 Asegúrate de incluir 'action' aquí
            additionalProperties: false,
          },
        },
      },
      temperature: 0.7,
      max_tokens: 150,
    });

    // CORRECCIÓN: gpt-3.5-turbo devuelve respuesta en message.content
    return response.data.choices[0].message.content.trim();
  } catch (error: any) {
    console.error(
      "Error al comunicarse con OpenAI:",
      error?.response?.data || error.message,
    );
    throw new Error("Error al obtener respuesta de OpenAI");
  }
};
