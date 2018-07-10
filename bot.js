if (!process.env.clientId || !process.env.clientSecret || !process.env.PORT) {
  usage_tip();
}

var Botkit = require('botkit');
const request = require('request');
const session = require('express-session');
const axios = require('axios');
const bodyParser = require('body-parser');
const moment = require('moment-timezone');

const clientURI = process.env.CLIENT_URI;
const authEndpoint = process.env.OAUTH_ENDPOINT;
const databaseUrl = process.env.DATABASE_URL;
const akaClientId = process.env.AKA_CLIENT_ID;
const akaClientSecret = process.env.AKA_CLIENT_SECRET;
const sessionSecret = process.env.SESSION_SECRET;
const akkerisApi = process.env.AKKERIS_API;

var bot_options = {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    // debug: true,
    scopes: ['bot'],
};

var sessionToken;

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

webserver.use(bodyParser.json());

webserver.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'akkeris',
}));

webserver.use((req, res, next) => {
    if (req.session.token || req.path === '/oauth/callback' || req.path === '/slack/receive') {
        next();
    } else {
        req.session.redirect = req.originalUrl;
        res.redirect(`${authEndpoint}/authorize?client_id=${akaClientId}&redirect_uri=${encodeURIComponent(`${clientURI}/oauth/callback`)}`);
    }
});

webserver.get('/oauth/callback', (req, res) => {
    request.post(`${authEndpoint}/access_token`, {
      form: {
        client_id: akaClientId,
        client_secret: akaClientSecret,
        code: req.query.code,
        grant_type: 'authorization_code',
      },
    }, (err, response, body) => {
      req.session.token = JSON.parse(body).access_token;
      sessionToken = req.session.token;
      res.redirect(req.session.redirect || '/');
    });
  });

webserver.get('/', function(req, res){
  res.render('index', {
    domain: req.get('host'),
    protocol: req.protocol,
    layout: 'layouts/default'
  });
})

// Bot Messages

// Set up a simple storage backend for keeping a record of customers
// who sign up for the app via the oauth
require(__dirname + '/components/user_registration.js')(controller);
// Send an onboarding message when a new team joins
require(__dirname + '/components/onboarding.js')(controller);

controller.hears(['aka apps'], 'ambient', function(bot, message) {
   axios.get(`${akkerisApi}/api/apps`, {
       headers: {'Authorization': `Bearer ${sessionToken}`}
   }).then(res => {
       let currentTime = moment().tz('America/Denver').format('MMM-Do-YY-h:mm:ss');

       let formattedApps = '';
       res.data.map(app => {
        formattedApps += `**⬢ ${app.name}** ${app.preview ? '- ^^preview^^' : ''}
        ***Url:*** ${app.web_url}
        ${app.git_url ? ("***GitHub:*** " + app.git_url + ' \n') : ''}`;
       });

       bot.api.files.upload({
            channels: message.channel,
            content: formattedApps,
            filename: `aka-apps_${currentTime}.txt`,
            filetype: 'text',
            title: `Result of 'aka apps' @ ${currentTime}`,
       }, (err, response) => {
           if (err){
            bot.reply(message, JSON.stringify(err));
           }
       });
   }).catch(err => {
        bot.reply(message, JSON.stringify(err));
       //bot.reply(message, `${err}`);
       //bot.reply(message, 'For 401 errors, make sure you\'ve authorized me!');
    });
});


function usage_tip() {
    console.log('~~~~~~~~~~');
    console.log('USAGE');
    console.log('Requred Environment Variables:');
    console.log('CLIENT_URI, OAUTH_ENDPOINT, DATABASE_URL, AKA_CLIENT_ID, AKA_CLIENT_SECRET');
    console.log('clientID, clientSecret, PORT, SESSION_SECRET, AKKERIS_API');
    console.log(' ');
    console.log('CMD: node bot.js');
    console.log('~~~~~~~~~~');
}
