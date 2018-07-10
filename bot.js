if (!process.env.clientId || !process.env.clientSecret || !process.env.PORT) {
  usage_tip();
}

var Botkit = require('botkit');
const request = require('request');
const session = require('express-session');
//var MongoClient = require('mongodb').MongoClient;
const clientURI = process.env.CLIENT_URI;
const authEndpoint = process.env.OAUTH_ENDPOINT;
const databaseUrl = process.env.DATABASE_URL;
const akaClientId = process.env.AKA_CLIENT_ID;
const akaClientSecret = process.env.AKA_CLIENT_SECRET;
const sessionSecret = process.env.SESSION_SECRET;

var bot_options = {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    // debug: true,
    scopes: ['bot'],
};

// Use a mongo database if specified, otherwise store in a JSON file local to the app.
if (databaseUrl) {
    var mongoStorage = require('botkit-storage-mongo')({mongoUri: databaseUrl});
    bot_options.storage = mongoStorage;
} else {
    usage_tip();
    return -1;
}

// Create the Botkit controller, which controls all instances of the bot.
var controller = Botkit.slackbot(bot_options);

controller.startTicking();

// Set up an Express-powered webserver to expose oauth and webhook endpoints
var webserver = require(__dirname + '/components/express_webserver.js')(controller);

webserver.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'akkeris',
}));

webserver.use((req, res, next) => {
    if (req.session.token || req.path === '/oauth/callback') {
        next();
    } else {
        req.session.redirect = req.originalUrl;
        res.redirect(`${authEndpoint}/authorize?client_id=${akaClientId}&redirect_uri=${encodeURIComponent(`${clientURI}/oauth/callback`)}`);
    }
});

webserver.get('/oauth/callback', (req, res) => {
    console.log(`Client ID: ${akaClientId}`);
    console.log(`Client Secret: ${akaClientSecret}`);
    console.log('req: ' + JSON.stringify(req));
    console.log('res: ' + JSON.stringify(res));
    request.post(`${authEndpoint}/access_token`, {
      form: {
        client_id: akaClientId,
        client_secret: akaClientSecret,
        code: req.query.code,
        grant_type: 'authorization_code',
      },
    }, (err, response, body) => {
      req.session.token = JSON.parse(body).access_token;
      res.redirect(req.session.redirect || '/');
      console.log(`req.session.token = ${req.session.token}`);
      console.log(`req.query.code = ${req.query.code}`);
    });
  });

webserver.get('/', function(req, res){
  res.render('index', {
    domain: req.get('host'),
    protocol: req.protocol,
    layout: 'layouts/default'
  });
})

// Set up a simple storage backend for keeping a record of customers
// who sign up for the app via the oauth
require(__dirname + '/components/user_registration.js')(controller);

// Send an onboarding message when a new team joins
require(__dirname + '/components/onboarding.js')(controller);

const axios = require('axios');

controller.hears(['aka'], 'ambient', function(bot, message) {
    bot.reply(message, `${CLIENT_URI}`);
});



/*
const akkerisApi = process.env.AKKERIS_API;
app.use('/api', proxy(`${akkerisApi}`, {
    proxyReqOptDecorator(reqOpts, srcReq) {
      reqOpts.headers.Authorization = `Bearer ${srcReq.session.token}`;
      return reqOpts;
    },
  }));

  axios.get('/api/apps');

*/

//https://auth.octanner.io/authorize?client_id=adb781ad-a9af-4d0e-9cdf-62e277340968&scope=user&redirect_uri=akkeris.octanner.io


function usage_tip() {
    console.log('~~~~~~~~~~');
    console.log('USAGE');
    console.log('Requred Environment Variables:');
    console.log('CLIENT_URI, OAUTH_ENDPOINT, DATABASE_URL, AKA_CLIENT_ID, AKA_CLIENT_SECRET');
    console.log('clientID, clientSecret, PORT, SESSION_SECRET');
    console.log(' ');
    console.log('CMD: node bot.js');
    console.log('~~~~~~~~~~');
}
