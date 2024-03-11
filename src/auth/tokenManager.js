const fs = require("fs").promises;
const path = require("path");
const clientsPath = path.join(__dirname, "../tokens/integration/clients.json");
const jwt = require("jsonwebtoken");
const qs = require("qs");
const appConfig = require("../config.json");
const axios = require("axios");
const chokidar = require("chokidar");
const schedule = require('node-schedule');

let tokenData = null;

async function setToken(newTokenData) {
  try {
    const tokens = await getToken();
    const index = tokens.findIndex(
      (token) => token.locationId === newTokenData.locationId
    );
    const name = await getClientName(newTokenData.locationId);
    if (index !== -1) {
      tokens[index] = { ...tokens[index], ...newTokenData };
      await fs.writeFile(clientsPath, JSON.stringify(tokens, null, 2), "utf8");
      console.log(`${name} - Token aggiornato`);
    } else {
      console.log(`${name} - Token non trovato`);
    }
  } catch (error) {
    console.error("Errore durante l'aggiornamento del token:", error);
  }
}

async function getSpecificToken(fixedLocationId) {
  try {
    const tokens = await getToken();
    const token = tokens.find((token) => token.locationId === fixedLocationId);
    return token;
  } catch (error) {
    console.error("Errore durante la lettura dei token:", error);
    return null;
  }
}

async function getToken() {
  try {
    const data = await fs.readFile(clientsPath, "utf8");
    const tokens = JSON.parse(data);
    return tokens;
  } catch (error) {
    console.error("Errore durante la lettura dei token:", error);
    return null;
  }
}

function resetTokens() {
  tokenData = tokenData.map(({ name, locationId }) => ({
    name,
    locationId,
  }));
}

async function getLocationId(locationId) {
  const data = await fs.readFile(clientsPath, "utf8");
  const tokens = JSON.parse(data);
  return tokens.find((token) => token.locationId === locationId);
}

async function getIndex(locationId) {
  const data = await fs.readFile(clientsPath, "utf8");
  const clients = JSON.parse(data);
  return clients.findIndex((client) => client.locationId === locationId);
}

async function getClientName(locationId) {
  const data = await fs.readFile(clientsPath, "utf8");
  const clients = JSON.parse(data);
  const client = clients.find((client) => client.locationId === locationId);
  return client ? client.name : null;
}

async function updateClientIntegration(tokenData) {
  try {
    const data = await fs.readFile(clientsPath, "utf8");
    const clients = JSON.parse(data);
    const clientIndex = await getIndex(tokenData.locationId);
    const name = await getClientName(tokenData.locationId);

    if (clientIndex !== -1) {
      clients[clientIndex] = { ...clients[clientIndex], ...tokenData };
      await fs.writeFile(clientsPath, JSON.stringify(clients, null, 2), "utf8");
      console.log(`${name} - Token disponibile`);
    } else {
      console.log(`${name} - Token non trovato.`);
    }
  } catch (error) {
    console.error("Errore durante l'aggiornamento del token:", error);
  }
}

async function checkAndRenewTokens() {
  try {
    console.log("Check token scaduti...");
    const data = await fs.readFile(clientsPath, "utf8");
    const clients = JSON.parse(data);
    clients.forEach(async (client) => {
      const { locationId, name, expiresDate } = client;
      if (expiresDate) {
        const now = new Date();
        const expiration = new Date(expiresDate);
        if (now >= expiration) {
          console.log(`${name} - Token valido.`);
          await handleToken(locationId, name);
        } else {
          console.log(
            `${name} - Token valido. Riprogrammato automatico rinnovo`
          );
          
          schedule.scheduleJob(expiration, () => {
            handleToken(locationId, name)
              .then(() => {})
              .catch((error) => {
                console.log(
                  `${name} - Errore durante il rinnovo del token programmato:`
                );
              });
          });
        }
      } else {
        console.log(`${name} - Token non valido. Da rigenerare`);
      }
    });
  } catch (error) {
    console.error("Errore durante il controllo dei token:", error);
  }
}

async function handleToken(fixedLocationId, name) {
  try {
    let tokenData = await getLocationId(fixedLocationId);
    if (tokenData) {
      console.log(`${name} - Token scaduto, tentativo di refresh...`);
      const refreshSuccess = await refreshToken(fixedLocationId);
      if (!refreshSuccess) {
        console.log(`${name} - Impossibile refreshare il token.`);
        return null;
      }
    } else {
      console.log(`${name} - Token non trovato.`);
      return null;
    }
  } catch (error) {
    console.error("Errore durante la gestione del token:", error);
    return null;
  }
}

async function refreshToken(fixedLocationId) {
  const tokenData = await getSpecificToken(fixedLocationId);
  if (!tokenData || !tokenData.refresh_token) {
    console.log("Token di refresh non disponibile.");
    return false;
  }

  const data = qs.stringify({
    client_id: appConfig.clientId,
    client_secret: appConfig.clientSecret,
    grant_type: "refresh_token",
    refresh_token: tokenData.refresh_token,
  });

  const config = {
    method: "post",
    url: "https://services.leadconnectorhq.com/oauth/token",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: data,
  };

  try {
    const response = await axios.request(config);
    const decodedToken = jwt.decode(response.data.access_token);
    if (decodedToken && decodedToken.exp) {
      const newTokenData = {
        ...response.data,
        refresh_token: response.data.refresh_token || tokenData.refresh_token,
      };
      setToken(newTokenData);
      return true;
    }
  } catch (error) {
    console.error("Errore durante il refresh del token:", error);
    return false;
  }
}

chokidar.watch(clientsPath).on('change', (path) => {
  console.log(`Trigger file aggiornato`);
  checkAndRenewTokens();
});

module.exports = {
  setToken,
  getToken,
  getSpecificToken,
  resetTokens,
  updateClientIntegration,
  getIndex,
  getLocationId,
  getClientName,
  handleToken,
  refreshToken,
  checkAndRenewTokens,
};
