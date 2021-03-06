'use strict';
var attributesHelper = require('./DynamoAttributesHelper');

module.exports = (function () {
    return {
        ':tell': function (speechOutput) {
            if(this.isOverridden()) {
                return;
            }

            this.handler.response = buildSpeechletResponse({
                sessionAttributes: this.attributes,
                output: getSSMLResponse(speechOutput),
                shouldEndSession: true
            });
            this.emit(':responseReady');
        },
        ':ask': function (speechOutput, repromptSpeech) {
            if(this.isOverridden()) {
                return;
            }
            this.handler.response = buildSpeechletResponse({
                sessionAttributes: this.attributes,
                output: getSSMLResponse(speechOutput),
                reprompt: getSSMLResponse(repromptSpeech),
                shouldEndSession: false
            });
            this.emit(':responseReady');
        },
        ':askWithCard': function(speechOutput, repromptSpeech, cardTitle, cardContent, imageObj) {
            if(this.isOverridden()) {
                return;
            }

            this.handler.response = buildSpeechletResponse({
                sessionAttributes: this.attributes,
                output: getSSMLResponse(speechOutput),
                reprompt: getSSMLResponse(repromptSpeech),
                cardTitle: cardTitle,
                cardContent: cardContent,
                cardImage: imageObj,
                shouldEndSession: false
            });
            this.emit(':responseReady');
        },
        ':tellWithCard': function(speechOutput, cardTitle, cardContent, imageObj) {
            if(this.isOverridden()) {
                return;
            }

            this.handler.response = buildSpeechletResponse({
                sessionAttributes: this.attributes,
                output: getSSMLResponse(speechOutput),
                cardTitle: cardTitle,
                cardContent: cardContent,
                cardImage: imageObj,
                shouldEndSession: true
            });
            this.emit(':responseReady');
        },
        ':tellWithLinkAccountCard': function(speechOutput) {
            if(this.isOverridden()) {
                return;
            }

            this.handler.response = buildSpeechletResponse({
                sessionAttributes: this.attributes,
                output: getSSMLResponse(speechOutput),
                cardType: 'LinkAccount',
                shouldEndSession: true
            });
            this.emit(':responseReady');
        },
        ':askWithLinkAccountCard': function(speechOutput, repromptSpeech) {
            if(this.isOverridden()) {
                return;
            }

            this.handler.response = buildSpeechletResponse({
                sessionAttributes: this.attributes,
                output: getSSMLResponse(speechOutput),
                reprompt: getSSMLResponse(repromptSpeech),
                cardType: 'LinkAccount',
                shouldEndSession: false
            });
            this.emit(':responseReady');
        },
        ':responseReady': function () {
            if (this.isOverridden()) {
                return;
            }

            if(this.handler.state) {
                this.handler.response.sessionAttributes['STATE'] = this.handler.state;
            }

            if (this.handler.dynamoDBTableName) {
                return this.emit(':saveState');
            }

            this.context.succeed(this.handler.response);
        },
        ':saveState': function(forceSave) {
            if (this.isOverridden()) {
                return;
            }

            if(forceSave && this.handler.state){
                this.attributes['STATE'] = this.handler.state;
            }

            if(this.saveBeforeResponse || forceSave || this.handler.response.response.shouldEndSession) {
                attributesHelper.set(this.handler.dynamoDBTableName, this.event.session.user.userId, this.attributes,
                    (err) => {
                        if(err) {
                            return this.emit(':saveStateError', err);
                        }
                        this.context.succeed(this.handler.response);
                });
            } else {
                this.context.succeed(this.handler.response);
            }
        },
        ':saveStateError': function(err) {
            if(this.isOverridden()) {
                return;
            }
            console.log(`Error saving state: ${err}\n${err.stack}`);
            this.context.fail(err);
        }
    };
})();

function createSpeechObject(optionsParam) {
    if (optionsParam && optionsParam.type === 'SSML') {
        return {
            type: optionsParam.type,
            ssml: optionsParam['speech']
        };
    } else {
        return {
            type: optionsParam.type || 'PlainText',
            text: optionsParam['speech'] || optionsParam
        };
    }
}

function buildSpeechletResponse(options) {
    var alexaResponse = {
        outputSpeech: createSpeechObject(options.output),
        shouldEndSession: options.shouldEndSession
    };

    if (options.reprompt) {
        alexaResponse.reprompt = {
            outputSpeech: createSpeechObject(options.reprompt)
        };
    }

    if (options.cardTitle && options.cardContent) {
        alexaResponse.card = {
            type: 'Simple',
            title: options.cardTitle,
            content: options.cardContent
        };

        if(options.cardImage && (options.cardImage.smallImageUrl || options.cardImage.largeImageUrl)) {
            alexaResponse.card.type = 'Standard';
            alexaResponse.card['image'] = {};

            delete alexaResponse.card.content;
            alexaResponse.card.text = options.cardContent;

            if(options.cardImage.smallImageUrl) {
                alexaResponse.card.image['smallImageUrl'] = options.cardImage.smallImageUrl;
            }

            if(options.cardImage.largeImageUrl) {
                alexaResponse.card.image['largeImageUrl'] = options.cardImage.largeImageUrl;
            }
        }
    } else if (options.cardType === 'LinkAccount') {
        alexaResponse.card = {
            type: 'LinkAccount'
        };
    }

    var returnResult = {
        version: '1.0',
        response: alexaResponse
    };

    if (options.sessionAttributes) {
        returnResult.sessionAttributes = options.sessionAttributes;
    }
    return returnResult;
}

// TODO: check for ssml content in card
function getSSMLResponse(message) {
    return {
        type: 'SSML',
        speech: `<speak> ${message} </speak>`
    };
}
