const axios = require("axios");
const qs = require("qs");
const tokenManager = require("./tokenManager");
const appConfig = require("../config.json");
const jwt = require("jsonwebtoken");

module.exports = async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send("Codice di autorizzazione mancante.");
  }

  const data = qs.stringify({
    client_id: appConfig.clientId,
    client_secret: appConfig.clientSecret,
    grant_type: "authorization_code",
    code: req.query.code,
    user_type: "Location",
    redirect_uri: process.env.callBackUrl + "/oauth/callback",
  });

  const config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "https://services.leadconnectorhq.com/oauth/token",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: data,
  };

  try {
    const tokenResponse = await axios.request(config);
    const decodedToken = jwt.decode(tokenResponse.data.access_token);
    const expAtTimestamp = decodedToken.exp;
    tokenResponse.data.expiresDate = new Date(
      expAtTimestamp * 1000
    ).toISOString();
    tokenManager.updateClientIntegration(tokenResponse.data);
    res.redirect("/token-integration");
  } catch (error) {
    console.error("Errore durante il recupero del token:", error);
    res.status(500).send("Errore durante il recupero del token.");
  }
};
