import FormData = require("form-data");
import axios from "axios";
export const recoveryEmail = async ({ email, recoveryId }) => {
  const endpoint = `${process.env.MAILGUN_DOMAIN}/messages`;

  const payload = {
    from: process.env.MAILGUN_FROM,
    to: email,
    subject: "Perdiste tu password? ",
    html: `<p>Pediste la recuperación de tu password?</p><a href="http://localhost:5173/login/recovery?recoveryId=${recoveryId}">Recuperala aqui...</a>`,
  };

  const form = new FormData();
  form.append("from", "taku <no-reply@colonus.lat>"); //  change mail
  form.append("to", payload.to);
  form.append("subject", payload.subject);
  form.append("html", payload.html);
  const auth = {
    username: "api",
    password: process.env.MAILGUN_API_KEY,
  };

  const headers = form.getHeaders();

  try {
    await axios.post(endpoint, form, {
      auth,
      headers,
    });
  } catch (error) {
    console.log("email error", error);
  }
};
