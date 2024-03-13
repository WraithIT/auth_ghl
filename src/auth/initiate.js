module.exports = (req, res, next) => {
  const appConfig = req.appConfig;
  const options = {
    requestType: appConfig.requestType,
    redirectUri: process.env.callBackUrl + `/${appConfig.app}/oauth/callback`,
    clientId: appConfig.clientId,
    scopes: appConfig.scopes
  };
  return res.redirect(
    `${appConfig.baseUrl}/oauth/chooselocation?response_type=${
      options.requestType
    }&redirect_uri=${options.redirectUri}&client_id=${
      options.clientId
    }&scope=${options.scopes.join(" ")}`
  );
}
