const express = require("express");
const tokenManager = require("../auth/tokenManager");
const router = express.Router();

module.exports = (config) => {
  router.use((req, res, next) => {
    req.appConfig = config;
    next();
  });

  router.param("id", (req, res, next, id) => {
    if (!id.match(/^[a-zA-Z0-9-]+$/)) {
      return res.status(400).send("ID non valido.");
    }
    next();
  });

  router.get("/initiate", require("../auth/initiate"));

  router.get("/oauth/callback", require("../auth/callback"));

  router.get("/tokens", async (req, res, next) => {
    try {
      const tokens = await tokenManager.getToken("integration");
      if (tokens && tokens.length > 0) {
        const validTokens = tokens.filter((token) => {
          const keys = Object.keys(token);
          return (
            keys.filter((key) => key !== "locationId" && key !== "name")
              .length > 0
          );
        });

        if (validTokens.length > 0) {
          res.json(validTokens);
        } else {
          res.redirect(`/${config.app}/initiate`);
        }
      } else {
        res.redirect(`/${config.app}/initiate`);
    }
    } catch (error) {
      next(error);
    }
  });

  router.get("/removeLocation/:id", async (req, res, next) => {
    const { id: fixedLocationId } = req.params;
    try {
      const message = await tokenManager.removeLocation(
        fixedLocationId,
        config.app
      );
      res.send(message);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
