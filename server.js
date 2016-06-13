var mongodb = require('mongodb');
var express = require('express');
var valid_url = require('valid-url');
var brokenLink = require('broken-link');
var MSON = require('mongoson');
var EJSON = require('mongodb-extended-json');
var jsonQuery = require('json-query')

require('dotenv').config();

var app = express();
var MongoClient = mongodb.MongoClient;
var mongodb_url = process.env.MONGO_URI;
var port = process.env.PORT || 8080;

app.set('views', __dirname + '/html');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');

app.get('/',function(req,res) {
	res.render('default.html');
});

app.get('/:id', function(req,res) {
  var id = req.url.substr(1,req.url.length);
  console.log(id);
  var o_id = new mongodb.ObjectID(id);
  MongoClient.connect(mongodb_url, function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } 
    else {
      console.log('Connection established to', mongodb_url);
      var short_url = db.collection('url');
      short_url.find({
        '_id': o_id
      } , {
        url: 1,
        _id: 0
      }).toArray(function(err, docs) {
        if (err) {
          db.close();
          console.error(err);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(err);
        }
        console.log(docs[0]);
        console.log(MSON.stringify(docs[0]));
        JSON.parse(MSON.stringify(docs[0]), function(key, value) {
          if (key === 'url') {
            console.log(value);
            res.redirect(301,value);
            db.close();
          }
        });
        db.close();
      });
    }
  });
});

app.get('/new/:url*', function(req,res) {
  var url = req.url.substr(5,req.url.length);
  if (valid_url.isWebUri(url)) {
    brokenLink(url)
          .then(function(answer) {
            if (!answer) {
              var json = "";
              MongoClient.connect(mongodb_url, function (err, db) {
                if (err) {
                  console.log('Unable to connect to the mongoDB server. Error:', err);
                } 
                else {
                  console.log('Connection established to', mongodb_url);
                  var short_url = db.collection('url');
                  short_url.findOne({
                    url: url
                  }, function(err, result) {
                    if(err) {
                      db.close();
                      console.error(err);
                      res.writeHead(200, { 'Content-Type': 'application/json' });
                      res.end(err);
                    } 
                    else {
                      console.log(result);
                      if (result != "{}" && result != null) {
                        result = MSON.stringify(result).replace("ObjectId(","").replace(")","");
                        JSON.parse(result, function(key, value) {
                          if (key === '_id') {
                            json = "{" +
                                  "\"original_url\": " + url + ", " +
                                  "\"shortened_url\": " + req.protocol + "://" + req.get('host') + "/" + value +
                                  "}";
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(json);
                            db.close();
                          }
                        });
                      }
                      else {
                        short_url.insert({
                          url: url
                        },function(err,result) {
                          if(err) {
                            db.close();
                            console.error(err);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(err);
                          }
                          else {
                            console.log(result);
                            console.log(jsonQuery('ops._id',{data:result}).value);
                            var id = jsonQuery('ops._id',{data:result}).value;
                            json = "{" +
                                   "\"original_url\": " + url + ", " +
                                   "\"shortened_url\": " + req.protocol + "://" + req.get('host') + "/" + id +
                                   "}";
                            console.log(json);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(json);
                            db.close();
                          }
                        });
                      }
                    }
                  });
                }
              });
              
            }
            else {
              var error = "{\"error\":\"Link is broken.\"}";
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(error);
            }
          });
  }
  else {
    var error = "{\"error\":\"Wrong url format.\"}";
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(error);
  }
});


app.listen(port,  function () {
	console.log('Node.js listening on port ' + port + '...');
});