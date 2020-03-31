import assert from 'assert';
import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import querystring from 'querystring';
import META from './meta.js';

import BlogError from './blog-error.js';

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

function base_url_handler(req, res){
  res.send("main");
}

class Link{
  constructor(req, name, rel){
    this.href = requestUrl(req); // Use prewritten utility function to generate href
    this.name = name;
    this.rel = rel;
  }
}

export default function serve(port, meta, model) {
  const app = express();
  app.locals.port = port;
  app.locals.meta = meta;
  app.locals.model = model;

  for(const blog_type in META){
    let route = "/" + blog_type + "/";
    let specific_route = "/" + blog_type + "/:id"; 
    app.get(route, function(req, res){
      res.send(route);
    })

    app.get(specific_route, function(req, res){
      app.locals.model.find(blog_type, {id: req.params.id}).then(data => res.json(data));
    })

    app.post(blog_type, function(req, res){
      res.send("testsetsetest");
    })

    app.delete(specific_route, function(req, res){
      res.send("deleting");
    })

    app.patch(specific_route, function(req, res){
      res.send("patching");
    })

  }

  app.get("/", base_url_handler);
  app.get("/meta-info/", function(req, res){
    res.json(app.locals.meta);
  });


  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

function setupRoutes(app) {
  app.use(cors());
  app.use(bodyParser.json());
  //@TODO
}

/****************************** Handlers *******************************/

//@TODO

/**************************** Error Handling ***************************/

/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    res.status(SERVER_ERROR);
    res.json({ code: 'SERVER_ERROR', message: err.message });
    console.error(err);
  };
}

/** Set up error handling for handler by wrapping it in a 
 *  try-catch with chaining to error handler on error.
 */
function errorWrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    }
    catch (err) {
      next(err);
    }
  };
}

const ERROR_MAP = {
  BAD_CATEGORY: NOT_FOUND,
  EXISTS: CONFLICT,
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapError(err) {
  console.error(err);
  return (err instanceof Array && err.length > 0 && err[0] instanceof BlogError)
    ? { status: (ERROR_MAP[err[0].code] || BAD_REQUEST),
	code: err[0].code,
	message: err.map(e => e.message).join('; '),
      }
    : { status: SERVER_ERROR,
	code: 'INTERNAL',
	message: err.toString()
      };
} 

/****************************** Utilities ******************************/

/** Return original URL for req (excluding query params)
 *  Ensures that url does not end with a /
 */
function requestUrl(req) {
  const port = req.app.locals.port;
  const url = req.originalUrl.replace(/\/?(\?.*)?$/, '');
  return `${req.protocol}://${req.hostname}:${port}${url}`;
}

// Given a request, create a self link
function generateLink(req){
  let link = Link(req=req, rel="self", "self");
  return link;
}


const DEFAULT_COUNT = 5;

//@TODO
