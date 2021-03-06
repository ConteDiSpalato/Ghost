var fs = require('fs'),
    path = require('path'),
    crypto = require('crypto'),
    config = require('../config'),
    storage = require('../storage'),
    utils  = require('../utils'),
    settingsCache = require('../settings/cache'),
    buildContentResponse,
    content;

buildContentResponse = function buildContentResponse(ext, buf) {
    content = {
        headers: {
            'Content-Type': 'image/' + ext,
            'Content-Length': buf.length,
            ETag: '"' + crypto.createHash('md5').update(buf, 'utf8').digest('hex') + '"',
            'Cache-Control': 'public, max-age=' + utils.ONE_DAY_S
        },
        body: buf
    };

    return content;
};

// ### serveFavicon Middleware
// Handles requests to favicon.png and favicon.ico
function serveFavicon() {
    var iconType,
        filePath;

    return function serveFavicon(req, res, next) {
        if (req.path.match(/^\/favicon\.(ico|png)/i)) {
            // CASE: favicon is default
            // confusing: if you upload an icon, it's same logic as storing images
            // we store as /content/images, because this is the url path images get requested via the browser
            // we are using an express route to skip /content/images and the result is a image path
            // based on config.getContentPath('images') + req.path
            // in this case we don't use path rewrite, that's why we have to make it manually
            filePath = settingsCache.get('icon').replace(new RegExp(utils.url.STATIC_IMAGE_URL_PREFIX), '');

            var originalExtension = path.extname(filePath).toLowerCase(),
                requestedExtension = path.extname(req.path).toLowerCase();

            // CASE: custom favicon exists, load it from local file storage
            if (settingsCache.get('icon')) {
                // depends on the uploaded icon extension
                if (originalExtension !== requestedExtension) {
                    return res.redirect(302, utils.url.urlFor({relativeUrl: '/favicon' + originalExtension}));
                }

                storage.getStorage()
                    .read({path: filePath})
                    .then(function readFile(buf) {
                        iconType = settingsCache.get('icon').match(/\.ico$/i) ? 'x-icon' : 'png';
                        content = buildContentResponse(iconType, buf);

                        res.writeHead(200, content.headers);
                        res.end(content.body);
                    })
                    .catch(function (err) {
                        next(err);
                    });
            } else {
                filePath = path.join(config.get('paths:publicFilePath'), 'favicon.ico');
                originalExtension = path.extname(filePath).toLowerCase();

                // CASE: always redirect to .ico for default icon
                if (originalExtension !== requestedExtension) {
                    return res.redirect(302, utils.url.urlFor({relativeUrl: '/favicon.ico'}));
                }

                fs.readFile(filePath, function readFile(err, buf) {
                    if (err) {
                        return next(err);
                    }

                    content = buildContentResponse('x-icon', buf);

                    res.writeHead(200, content.headers);
                    res.end(content.body);
                });
            }
        } else {
            next();
        }
    };
}

module.exports = serveFavicon;
