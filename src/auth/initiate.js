const appConfig = require('../config.json');

async function initiateAuth(req, res) {
    const options = {
        requestType: "code",
        redirectUri: process.env.callBackUrl + '/oauth/callback',
        clientId: appConfig.clientId,
        scopes: [
            "contacts.readonly",
            "contacts.write",
            "forms.write",
            "locations.write",
            "locations/customValues.write",
            "locations/customFields.write",
            "locations/tasks.write",
            "locations/tags.write",
            "locations/tags.readonly",
            "locations/customValues.readonly",
            "locations/customFields.readonly"
        ]
    };

    return res.redirect(`${appConfig.baseUrl}/oauth/chooselocation?response_type=${options.requestType}&redirect_uri=${options.redirectUri}&client_id=${options.clientId}&scope=${options.scopes.join(' ')}`);
}

module.exports = initiateAuth;
