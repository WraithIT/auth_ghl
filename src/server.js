const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const dotenv = require("dotenv");
const tokenManager = require("./auth/tokenManager");
const { formatDate } = require("./utils/formatter.js");

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const appConfig = require("./config.json");

const integration = require("./routers/integration");
const fatturazione = require("./routers/fatturazione");

const integrationConfig = appConfig.find(
  (config) => config.app === "integration"
);
const fatturazioneConfig = appConfig.find(
  (config) => config.app === "fatturazione"
);

const integrationRouter = integration(integrationConfig);
const fatturazioneRouter = fatturazione(fatturazioneConfig);

app.use("/integration", integrationRouter);
app.use("/fatturazione", fatturazioneRouter);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).send(`Si è verificato un errore: ${error.message}`);
});

app.listen(port, () => {
  console.log(
    `Auth System generazione tokens - ${formatDate(new Date().toISOString())}`
  );
  tokenManager.checkAndRenewTokens();
});
