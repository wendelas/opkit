var CLIENT_EVENTS = require('slack-client').CLIENT_EVENTS;
var RTM_EVENTS = require('slack-client').RTM_EVENTS;
var RTM_CLIENT_EVENTS = require('slack-client').CLIENT_EVENTS.RTM;
var RtmClient = require('slack-client').RtmClient;
var MemoryDataStore = require('slack-client').MemoryDataStore;
var Auth = require('./auth');
var winston = require('winston');
var Promise = require('bluebird');
/**
 * Constructor for an Opkit Bot.
 * @param {string} name: the word to 'listen' for. First word of commands
 * @param {Object} commands: each key is a word to listen for; each value is a function
 * taking parameters message and bot.
 * @param {Object} state: to hold internal variables for the bot. 
 * @param {Opkit} opkit: should be `this`
 */

function OpkitBot(name, commands, state) {
	this.name = name;
	this.commands = commands;
	if (!this.commands.userHasAuthorizationTo){
		this.commands.userHasAuthorizationTo = function(user, command){
			if (process.env.amazonId && process.env.amazonSecret && process.env.amazonRegion){
				var auth = new Auth(process.env.amazonId, process.env.amazonSecret, process.env.amazonRegion);
				return Promise.resolve(auth);
			} else {
				return Promise.resolve(true);
			}
		};
	}
	this.state = state;
	var self = this;
	this.dataStore = new MemoryDataStore();
	this.rtm = new RtmClient(process.env.token, {dataStore : self.dataStore, logLevel : 'debug'});
	this.start = function(){
		self.rtm.start();
	};
	this.sendMessage = function(reply, channel){
		self.rtm.sendMessage(reply, channel);
	};
	this.onEventsMessage = function(message){
		var message_split = message.text.split(' ');
		if (message_split[0]===self.name){
			if (self.commands.hasOwnProperty(message_split[1])){
				self.commands.userHasAuthorizationTo(message.user, message_split[1])
				.then(function(auth){
					return self.commands[message_split[1]](message, self, auth)
					.then(function(response){
						winston.log('info', response);
					});
				})
				.catch(function(err){
					self.sendMessage("Access denied." +
					"See administrator if you feel you should have access.", message.channel);
					winston.log('warn', err);
				});
			}
		} 
	};	

	this.rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED);
	this.rtm.on(RTM_EVENTS.MESSAGE, this.onEventsMessage);

}

module.exports = OpkitBot;