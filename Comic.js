var sqlite3 = require('sqlite3').verbose()
  , Request = require('request')
  , Cheerio = require('cheerio');

var DB_FILEPATH = './comics.sql';

function reinitalizeDatabase(clearExisting) {
  var database = new sqlite3.Database(DB_FILEPATH);
  database.serialize(function() {
    // create the table
    database.exec("CREATE TABLE IF NOT EXISTS comic(num INTEGER PRIMARY KEY, title TEXT, url TEXT, altText TEXT);")

    if (clearExisting === true) {
      // clear it so we don't run into key constraint issues
      database.exec("DELETE FROM comic");
    }

    // scrape the comics (comic 1469 on January 5, 2015 - comic 1781 January 2017)
    for (i = 1; i < 1781; i++) {
        scrapeComic(i, database);
    }
  });
}

function scrapeComic(num, db) {
  Request('http://m.xkcd.com/'+i, function (error, response, body) {
    var imgTag, url, title, altText;

    if (!error && response.statusCode == 200) {
      $ = Cheerio.load(body);
      imgTag = $('img#comic');

      url = imgTag.attr('src');
      altText = imgTag.attr('title');
      title = $('h1#title').text();

      addComic(num, title, url, altText, db);
    }
  });
}

function addComic(num, title, url, altText, db) {
  var sql = db.prepare("INSERT INTO comic(num, title, url, altText) VALUES(?, ?, ?, ?)");
  sql.run([num, title, url, altText], function(err, row) {
    if (err) {
      console.log(err);
    } else {
      console.log('Successfully added comic '+ num);
    }
  });
}

function getDatabase() {
  return new sqlite3.Database(DB_FILEPATH);
}

module.exports = {
  scrape: scrapeComic,
  addComic: addComic,
  getDatabase: getDatabase,
  reinitalize: reinitalizeDatabase
}