const fs = require("fs").promises;
const path = require("path");
const integrationPath = path.join(
  __dirname,
  "../tokens/integration/clients.json"
);
const fatturazionePath = path.join(
  __dirname,
  "../tokens/fatturazione/clients.json"
);
const jwt = require("jsonwebtoken");
const qs = require("qs");
const appConfig = require("../config.json");
const axios = require("axios");
const chokidar = require("chokidar");
const schedule = require("node-schedule");
const { formatDate } = require("../utils/formatter.js");
const exp = require("constants");

let tokenData = null;

async function setToken(newTokenData, appType) {
  try {
    const filePath =
      appType === "integration" ? integrationPath : fatturazionePath;
    const tokens = await getToken(filePath);
    const index = await getIndex(newTokenData.locationId, appType);
    const name = await getClientName(newTokenData.locationId, appType);
    const displayName =
      appType === "integration" && name
        ? name
        : `LocationID: ${newTokenData.locationId}`;
    newTokenData.name = name;
    if (index !== -1) {
      tokens[index] = { ...tokens[index], ...newTokenData };
      console.log(`${displayName} - Token aggiornato in ${appType}.`);
    } else {
      await tokens.push(newTokenData);
      console.log(`${displayName} - Nuovo token inserito in ${appType}.`);
    }
    await fs.writeFile(filePath, JSON.stringify(tokens, null, 2), "utf8");
  } catch (error) {
    console.error(
      `Errore durante l'aggiornamento del token in ${appType}:`,
      error
    );
  }
}

async function getSpecificToken(fixedLocationId, app) {
  try {
    const tokens = await getToken(app);
    const token = tokens.find((token) => token.locationId === fixedLocationId);
    return token;
  } catch (error) {
    console.error("Errore durante la lettura dei token:", error);
    return null;
  }
}

async function getToken(app) {
  const filePath = app === "integration" ? integrationPath : fatturazionePath;
  try {
    const data = await fs.readFile(filePath, "utf8");
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

async function getLocationId(locationId, app) {
  const filePath = app === "integration" ? integrationPath : fatturazionePath;
  const data = await fs.readFile(filePath, "utf8");
  const tokens = JSON.parse(data);
  return tokens.find((token) => token.locationId === locationId);
}

async function getIndex(locationId, app) {
  const filePath = app === "integration" ? integrationPath : fatturazionePath;
  const data = await fs.readFile(filePath, "utf8");
  const clients = JSON.parse(data);
  return clients.findIndex((client) => client.locationId === locationId);
}

async function getClientName(locationId, app) {
  const filePath = app === "integration" ? integrationPath : fatturazionePath;
  const data = await fs.readFile(filePath, "utf8");
  const clients = JSON.parse(data);
  const client = clients.find((client) => client.locationId === locationId);
  return client ? client.name : null;
}

async function updateClientIntegration(tokenData) {
  try {
    const data = await fs.readFile(integrationPath, "utf8");
    const clients = JSON.parse(data);
    const clientIndex = await getIndex(tokenData.locationId, "integration");
    const name = await getClientName(tokenData.locationId, "integration");
    if (clientIndex !== -1) {
      clients[clientIndex] = { ...clients[clientIndex], ...tokenData };
      await fs.writeFile(
        integrationPath,
        JSON.stringify(clients, null, 2),
        "utf8"
      );
      console.log(`Integration - ${name} - Token disponibile`);
    } else {
      console.log(`Integration - ${name} - Token non trovato.`);
    }
  } catch (error) {
    console.error(
      "Integration - Errore durante l'aggiornamento del token:",
      error
    );
  }
}

async function updateClientFatturazione(tokenData) {
  try {
    const data = await fs.readFile(fatturazionePath, "utf8");
    const clients = JSON.parse(data);
    const clientIndex = await getIndex(tokenData.locationId, "integration");
    if (clientIndex !== -1) {
      clients[clientIndex] = { ...clients[clientIndex], ...tokenData };
      console.log(
        `Fatturazione - Token per ${tokenData.locationId} aggiunto in fatturazione.`
      );
    } else {
      clients.push(tokenData);
      console.log(
        `Fatturazione - Nuovo token per ${tokenData.locationId} inserito in fatturazione.`
      );
    }
    await fs.writeFile(
      fatturazionePath,
      JSON.stringify(clients, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error(
      "Fatturazione - Errore durante l'aggiornamento/inserimento del token in fatturazione:",
      error
    );
  }
}

async function checkAndRenewTokens() {
  await checkAndRenewTokensForPath(integrationPath, "integration");
  await checkAndRenewTokensForPath(fatturazionePath, "fatturazione");
}

async function _handleExp(locationId, displayName, appType) {
  console.log(`Rinnovo token per ${displayName} (${appType})`);
  const newExpiration = new Date(Date.now() + 86400 * 1000);
  return newExpiration.toISOString();
}

async function updateClientData(filePath, clients) {
  try {
    await fs.writeFile(filePath, JSON.stringify(clients, null, 2), "utf8");
  } catch (error) {
    console.error(
      `Errore durante l'aggiornamento dei clienti in ${filePath}`,
      error
    );
  }
}

async function checkAndRenewTokensForPath(filePath, appType) {
  try {
    console.log(`Check tokens per ${appType}`);
    const data = await fs.readFile(filePath, "utf8");
    let clients = JSON.parse(data);
    if (!Array.isArray(clients) || clients.length === 0) {
      console.log("Nessun token da controllare.");
      return;
    }
    for (const client of clients) {
      const { locationId, expiresDate } = client;
      if (!expiresDate) continue; 
      const displayName = client.name || `ID: ${locationId}`;
      const expiration = new Date(expiresDate);
      const scheduleRenewal = async () => {
        console.log(`Schedulazione rinnovo per ${displayName}.`);
        try {
          const newExpiresDateISO = await _handleExp(locationId, displayName, appType);
          client.expiresDate = newExpiresDateISO;
          await updateClientData(filePath, clients);
          const newExpiresDate = new Date(newExpiresDateISO);
          schedule.scheduleJob(newExpiresDate, scheduleRenewal);
        } catch (error) {
          console.error(`${displayName} - Errore durante il rinnovo del token programmato: ${error}`);
        }
      };
      
      if (new Date() >= expiration) {
        await scheduleRenewal();
      } else {
        console.log(`${displayName} - Token valido, scadenza ${expiration}. Riprogrammato rinnovo automatico.`);
        schedule.scheduleJob(expiration, scheduleRenewal);
      }
    }
  } catch (error) {
    console.error(`Errore durante il controllo dei token per ${appType}: ${filePath}`, error);
  }
}


async function handleToken(fixedLocationId, name, appType) {
  try {
    let tokenData = await getLocationId(fixedLocationId, appType);
    if (tokenData) {
      console.log(`${name} - Token scaduto, tentativo di refresh...`);
      const refreshSuccess = await refreshToken(fixedLocationId, appType);
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

async function removeLocation(fixedLocationId, app) {
  try {
    const filePath = app === "integration" ? integrationPath : fatturazionePath;
    const clients = await readJSONFile(filePath);
    let modified = false;

    if (app === "integration") {
      const modifiedClients = clients.map((client) => {
        if (
          client.locationId === fixedLocationId &&
          Object.keys(client).length > 2
        ) {
          modified = true;
          return { locationId: client.locationId, name: client.name };
        }
        return client;
      });

      if (modified) {
        await writeJSONFile(filePath, modifiedClients);
        return `LocationID ${fixedLocationId} modificata con successo.`;
      }
    } else if (app === "fatturazione") {
      const filteredClients = clients.filter(
        (client) => client.locationId !== fixedLocationId
      );
      if (filteredClients.length < clients.length) {
        modified = true;
        await writeJSONFile(filePath, filteredClients);
        return `LocationID ${fixedLocationId} rimossa completamente.`;
      }
    }

    if (!modified) {
      return `LocationID ${fixedLocationId} non trovata.`;
    }
  } catch (error) {
    console.error(
      `Errore durante la rimozione/modifica della locationID ${fixedLocationId}:`,
      error
    );
    return `Errore durante la rimozione/modifica della locationID ${fixedLocationId}.`;
  }
}

async function refreshToken(fixedLocationId, appType) {
  const configForApp = appConfig.find((config) => config.app === appType);
  if (!configForApp) {
    console.error(`Configurazione per ${appType} non trovata.`);
    return false;
  }

  const tokenData = await getSpecificToken(fixedLocationId, appType);
  if (!tokenData || !tokenData.refresh_token) {
    console.log("Token di refresh non disponibile.");
    return false;
  }

  const data = qs.stringify({
    client_id: configForApp.clientId,
    client_secret: configForApp.clientSecret,
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
      await setToken(newTokenData, appType);
      return true;
    }
  } catch (error) {
    console.error(`Errore durante il refresh del token per ${appType}:`, error);
    return false;
  }
}

chokidar.watch(integrationPath).on("change", (path) => {
    console.log(`Trigger file integration`);
    checkAndRenewTokensForPath(integrationPath, "integration");
});

chokidar.watch(fatturazionePath).on("change", (path) => {
    console.log(`Trigger file fatturazione`);
    checkAndRenewTokensForPath(fatturazionePath, "fatturazione");
});


module.exports = {
  setToken,
  getToken,
  getSpecificToken,
  resetTokens,
  updateClientIntegration,
  updateClientFatturazione,
  getIndex,
  getLocationId,
  getClientName,
  handleToken,
  refreshToken,
  checkAndRenewTokens,
  removeLocation,
};
