"use strict";

var winston = require("winston"),
    common = require("winston/lib/winston/common"),
    cycle = require("cycle"),
    uuid = require("node-uuid"),
    util = require("util"),
    request = require ("request-json"),
    _ = require("lodash"),
    Groonga,
    createTable,
    createQuery,
    createField,
    postData,
    client,
    createUID,
    logMsgUID;

// ### function Groonga (options)
// #### @options {Object} Options for this instance.
// Constructor function for the Console transport object responsible
// for making arbitrary HTTP requests whenever log messages and metadata
// are received.
Groonga = exports.Groonga = function (options) {
    this.name = "groonga";
    this.protocol = options.protocol || "http";
    this.host = options.host || "localhost";
    this.port = options.port || 1060;
    this.severity = options.severity || "info";
    this.table = options.table || "logs";
};

// Inherit from `winston.Transport`.
util.inherits(Groonga, winston.Transport);

// Expose the name of this Transport on the prototype
Groonga.prototype.name = "groonga";

// Define a getter so that `winston.transports.Couchdb`
// is available and thus backwards compatible.
winston.Transport.Groonga = Groonga;

//
// ### function log (level, msg, [meta], callback)
// #### @level {string} Level at which to log the message.
// #### @msg {string} Message to log
// #### @meta {Object} **Optional** Additional metadata to attach
// #### @callback {function} Continuation to respond to when complete.
// Core logging method exposed to Winston. Metadata is optional.
//
Groonga.prototype.log = function (level, msg, meta, callback) {
    var self,
        params;
    if (this.silent) {
        return callback && callback(null, true);
    }
    self = this;
    params = common.clone(cycle.decycle(meta)) || {};
    params.timestamp = (new Date ().getTime () / 1000).toFixed (0);
    params.message = msg;
    params.level = level;
    createTable(params, this);

    if (callback) {
        callback(null, true);
    }
};

// Creates and returns a random seeded UID to be added to the _key column in Groonga.
createUID = function () {
    return uuid.v4();
};

// Creates a column in Groonga with the specified name when called upon.
createField = function (keys, groonga) {
    _.forEach(keys, function (key, i) {
        var fieldType = "ShortText";
        if (key === "timestamp") {
            fieldType = "Time";
        }
        client.get("/d/column_create?table=" + groonga.table + "&name=" + key + "&type=" + fieldType, function (err) {
            if (err) {
                console.log(err);
            } else {
                client.get("/d/column_create?table=" + groonga.table + "Lex&name=" + key + "_index&flags=COLUMN_INDEX|WITH_POSITION&type=" + groonga.table + "&source=" + key, function (err) {
                    if (err) {
                        console.log (err);
                    }
                });
            }
        });
    });
};

// Posts the log data to Groonga.
postData = function (params, groonga, q) {
    client.post("/d/load?table=" + groonga.table, q, function (err) {
        if (err) {
            console.log("could not write");
        }
    });
};

// Builds the query string to log data to Groonga.
createQuery = function (params, groonga) {
    var existingFields,
        q = [],
        needsCreated = [],
        promise;
    logMsgUID = createUID();
    q[0] = {
        _key: logMsgUID.toString()
    };

    // Gets the columns that can be posted to in Groonga.
    client.get("/d/select?table=" + groonga.table , function (err, res, body) {
        if (!err) {
            existingFields = body[1][0][1];
            _.forEach(params, function (n, key) {
                q[0][key] = params[key].toString();
                // Checks to make sure column exists.
                if (!_.has (_.invert (_.flattenDeep(existingFields)), key)) {
                    // create field
                    needsCreated.push(key);
                }
            });
            if (needsCreated.length > 0) {
                // This promise trys to create the columns in Groonga
                //  and checks to see if the column creation was successful.
                promise = new Promise(function (resolve, reject) {
                    var counter = 0,
                        checkFields;
                    checkFields = function () {
                        var exists = [],
                        fieldCount = 0,
                        timer;
                        client.get("/d/select?table=" + groonga.table , function (err, res, body) {
                            if (!err) {
                                exists = body[1][0][1];
                                _.forEach(params, function (n, key) {
                                    if (_.has (_.invert (_.flattenDeep(exists)), key)) {
                                        fieldCount += 1;
                                        if (fieldCount === Object.keys(params).length) {
                                            resolve(true);
                                            return false;
                                        } else if (fieldCount !== Object.keys(params).length && counter < 20) {
                                            if (timer !== undefined) {
                                                clearTimeout(timer);
                                            }
                                            timer = setTimeout(function () {
                                                checkFields();
                                            }, 50);
                                        } else {
                                            reject(true);
                                            return false;
                                        }
                                    }
                                });
                            }
                        });
                        counter += 1;
                    };
                    createField(needsCreated, groonga);
                    checkFields();
                });
                promise.then(function () {
                    // If the Promise of creating columns was successful post the data.
                    postData(params, groonga, q);
                }).catch(function (error) {
                    // If the Promise was unsuccessful try to post what data there is
                    //  and let the user know data could be missing
                    console.log(error);
                    postData(params, groonga, q);
                    console.log("Something went wrong check your Groonga.");
                });
            } else {
                postData(params, groonga, q);
            }
        } else {
            console.log("problem with groonga, can not log");
        }
    });
};

// Trys to create a table in Groonga with the name
//  specified if it does not exist.
createTable = function (params, groonga) {
    var existingTables = [];
    client = request.createClient(groonga.protocol + "://" + groonga.host + ":" + groonga.port);
    client.get("/d/table_list", function (err, res, body) {
        if (!err) {
            _.forEach (body[1], function (n, key) {
                if (_.isNumber (body[1][key][0])) {
                    existingTables.push (body[1][key][1]);
                }
            });
            if (_.findIndex (existingTables, function (c) {
                    return c === groonga.table;
                }) >= 0) {
                // do nothing the table exists
                createQuery (params, groonga);
            } else {
                // create table
                client.get ("/d/table_create?name=" + groonga.table + "&flags=TABLE_HASH_KEY&key_type=ShortText", function (err, res, body) {
                    if (!err) {
                        createQuery (params, groonga);
                    }
                });
                // create index table
                client.get ("/d/table_create?name=" + groonga.table + "Lex&flags=TABLE_PAT_KEY&key_type=ShortText&default_tokenizer=TokenBigram&normalizer=NormalizerAuto", function (err) {
                    if (err) {
                        console.log(err);
                    }
                });
            }
        }
    });
};
