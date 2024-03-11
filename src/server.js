const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const tokenManager = require("./auth/tokenManager");
const dotenv = require("dotenv");
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

app.get("/initiate", require("./auth/initiate"));
app.get("/oauth/callback", require("./auth/callback"));

app.get("/token-integration", async (req, res) => {
  const tokenData = await tokenManager.getToken();
  if (tokenData) {
    res.json(tokenData);
  } else {
    res.redirect("/initiate");
  }
});

app.get("/reset-integration", (req, res) => {
  tokenManager.resetTokens();
  res.send("Tokens integration resettati. Reinizzializzali tramite /initiate");
});

app.listen(port, () => {
  const now = new Date();
  const timestamp = now.toISOString();
  console.log(`Auth System generazione tokens - ${timestamp}`);
  tokenManager.checkAndRenewTokens()
});

