if (!process.env.clientId || !process.env.clientSecret || !process.env.PORT) {
  usage_tip();
}

var Botkit = require('botkit');

var bot_options = {
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    // debug: true,
    scopes: ['bot'],
};

// Use a mongo database if specified, otherwise store in a JSON file local to the app.
if (process.env.DATABASE_URL) {
    var mongoStorage = require('botkit-storage-mongo')({mongoUri: process.env.DATABASE_URL});
    bot_options.storage = mongoStorage;
} else {
    bot_options.json_file_store = __dirname + '/.data/db/'; // store user data in a simple JSON format
}

// Create the Botkit controller, which controls all instances of the bot.
var controller = Botkit.slackbot(bot_options);

controller.startTicking();

// Set up an Express-powered webserver to expose oauth and webhook endpoints
var webserver = require(__dirname + '/components/express_webserver.js')(controller);

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

controller.hears(['aka apps'], 'ambient', function(bot, message) {



    bot.reply(message, );
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


function usage_tip() {
    console.log('~~~~~~~~~~');
    console.log('Usage:');
    console.log('clientId=<MY SLACK CLIENT ID> clientSecret=<MY CLIENT SECRET> PORT=3000 node bot.js');
    console.log('~~~~~~~~~~');
}
