var Hapi    = require('hapi')
  , XML     = require('xmlbuilder')
  , Comic   = require('./modules/comic')
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
    ;

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
    for (i = fromComic; i <= toComic ; i++) {
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
        comicNode.ele('title', comic.title);
        comicNode.ele('id', comic.num);

        if (!comic.url) {
          console.log('No URL for: '+comic.num);
        } else {
          comicNode.ele('url', comic.url);
        }
        
        if (!comic.altText) {
          console.log('No alt text for: '+comic.num);
        } else {
          comicNode.ele('alt', comic.altText);
        }
      }
    
    reply(root.end().replace(/&/, '&amp;'))
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

server.route({
  method: '*',
  path: '/{p*}',
  handler: function(request, reply) {
    return reply('The route ' + request.path + ' was not found').code(404);
  }
});

// start the server
server.start(function (err) {
    console.log('Server started at: ' + server.info.uri);

    // setup a timer that will check for new comics every day
    setInterval(function() {
      console.log('Checking for updates at: ' + (new Date()).toTimeString())

      Request('http://xkcd.com/atom.xml', function(error, response, body) {
        var $, entries, entry, imgTag, num, title, altText, url;
        $ = Cheerio.load(body);
        $('entry').each(function(i, elem) {
          imgTag = Cheerio.load($(this).children('summary').text())('img');
          num = $(this).children('id').text();
          num = /http:\/\/xkcd.com\/(\d+)/.exec(num)[1];

          title = $(this).children('title').text();
          url = imgTag.attr('src');
          altText = imgTag.attr('title');

          Comic.addComic(num, title, url, altText, db);
          comics.push({
            'num': num,
            'url': url,
            'title': title,
            'altText': altText
          })
        });
      });
    }, 60 * 60 * 1000);
});