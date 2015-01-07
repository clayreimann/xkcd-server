var Hapi    = require('hapi')
  , XML     = require('xmlbuilder')
  , Comic   = require('./Comic')
  , Request = require('request')
  , Cheerio = require('cheerio')
  ;

var db
  , comics = {}
  ;

db = Comic.getDatabase();
db.each("SELECT * FROM comic", function(err, row) {
  var num = parseInt(row.num, 10)
    , comic = {
    'num': num,
    'url': row.url,
    'title': row.title,
    'altText': row.altText
  }

  comics[num] = comic;
  if ((num > comics.lastComic) || (comics.lastComic === undefined)) {
    comics.lastComic = num;
  }
});

function getComics(fromComic, toComic) {
  var i
    , requestedComics = { comics: [] }
    ;

    // load up the requested comics
    for (i = fromComic; i < toComic; i++) {
      if (comics[i]) {
        requestedComics.comics.push(comics[i]);
      }
    }

    return requestedComics;
}


// create a server with a host and port
var server = new Hapi.Server();
server.connection({
  host: 'localhost',
  port: 8000
});

// add the XML api
server.route({
  method: 'GET',
  path: '/api/v1/comics',
  handler: function(request, reply) {
    var fromComic = request.query.fr || 1
      , toComic = request.query.to || comics.lastComic
      , requestedComics = getComics(fromComic, toComic)
      , root = XML.create('comics')
      , i, comic, comicNode
      ;

      for (i = 0; i < requestedComics.comics.length; i++) {
        comic = requestedComics.comics[i];
        comicNode = root.ele('comic');
        comicNode.att('title', comic.title);
        comicNode.att('number', comic.num);

        if (!comic.url) {
          console.log('No URL for: '+comic.num);
        } else {
          comicNode.att('url', comic.url);
        }
        
        if (!comic.altText) {
          console.log('No alt text for: '+comic.num);
        } else {
          comicNode.att('altText', comic.altText);
        }
      }
    
    reply(root.end())
      .type('text/xml');
  }
});


// add the JSON api
server.route({
  method: 'GET',
  path: '/api/v2/comics',
  handler: function(request, reply) {
    var fromComic = request.query.fr || 1
      , toComic = request.query.to || comics.lastComic
      , requestedComics = getComics(fromComic, toComic)
      ;

    
    reply(JSON.stringify(requestedComics, null, 2))
      .type('text/json');
  }
});

// start the server
server.start(function (err) {
    console.log('Server started at: ' + server.info.uri);
    // setup a timer that will check for new comics every day
    setInterval(function() {
      Request('http://xkcd.com/atom.xml', function(error, response, body) {
        var $, entries, entry, imgTag, num, title, altText, url;
        $ = Cheerio.load(body);
        $('entry').each(function(i, elem) {
          imgTag = Cheerio.load($(this).children('summary').text())('img');
          num = $(this).children('id').text();
          num = /http:\/\/xkcd.com\/(\d\d\d\d)/.exec(num)[1];

          title = $(this).children('title').text();
          url = imgTag.attr('src');
          altText = imgTag.attr('title');

          Comic.addComic(num, title, url, altText, db);
        });
      });
    }, 24 * 60 * 60 * 1000);
});