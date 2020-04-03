import assert from 'assert';
import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import querystring from 'querystring';
import META from './meta.js';

import BlogError from './blog-error.js';
import { compileFunction } from 'vm';

const OK = 200;
const CREATED = 201;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

class Link{
  constructor(href, name, rel){
    this.href = href;
    this.name = name;
    this.rel = rel;
  }
}

export default function serve(port, meta, model) {
  const app = express();
  app.locals.port = port;
  app.locals.meta = meta;
  app.locals.model = model;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });

  for(const blog_type in META){
    let route = "/" + blog_type + "/";
    let specific_route = "/" + blog_type + "/:id"; 


    app.get(route, async function(req, res){
      var params = req.query;
      var results = {};
      results[blog_type] = await app.locals.model.find(blog_type, params); 
      results["links"] = [{"href": requestUrl(req) + "/?" + querystring.stringify(params), "name": "self", "rel":"self"}];

      for(var each of results[blog_type]){
        each["links"] = [{"href": requestUrl(req) + "/" + each['id'], "name": "self", "rel":"self"}];
      }

      if(params["_count"] !== undefined && params["_index"] !== undefined){
        var new_params = params;
        var second_set = params;
        new_params["_index"] = Number(new_params["_index"]);
        new_params["_index"] += Number(params["_count"]);
        results["links"].push({"href": requestUrl(req) + "/?" + querystring.stringify(new_params), "rel": "next", "name": "next"});
        // console.log("here");

        new_params["_index"] -= Number(params["_count"]);


        if(new_params["_index"] - Number(params["_count"]) >= 0){
          new_params["_index"] -= Number(params["_count"]);
        } else {
          new_params["_index"] = 0;
        }
        results["links"].push({"href": requestUrl(req) + "/?" + querystring.stringify(new_params), "rel": "prev", "name": "prev"});

      }

      // console.log(params);
      res.json(results);

    })

    app.get(specific_route, async function(req, res){
      let data = {};
      data[blog_type] = await app.locals.model.find(blog_type, {id: req.params.id});
      data["links"] = [generateLink(req)];
      res.json(data);
    })

    app.post(route, async function(req, res){
      var to_create = req.body;
      var new_id;
      try{
        new_id = await app.locals.model.create(blog_type, to_create);
        var new_url = requestUrl(req) + "/" + new_id;
        res.append('Location', new_url);
        res.status(201).json({})
        // console.log(new_url);
        // res.send(new_url);
      } catch (err){
        res.json(err);
      }
    })

    app.delete(specific_route, async function(req, res){
      var to_delete = req.params.id;
      // console.log("dleteing id: " + to_delete);
      var data = {};
      try{
        await app.locals.model.remove(blog_type, {id: to_delete});
      } catch(err){
        // console.log(err);
        res.status(400).json(err);
      }
      res.json(data);
      
    })

    app.patch(specific_route, async function(req, res){
      var id_to_update = req.params.id;
      var update_params = req.body;
      update_params["id"] = id_to_update;
      try{
        await app.locals.model.update(blog_type, update_params);
      } catch(err){
        res.json(err);
      }

      
      res.send({});
    })

  }

  app.get("/", function(req, res){
    let data = {};
    let meta_link = new Link("/meta-info/", "meta", "describedby");
    data["links"] = [generateLink(req), meta_link, new Link("/users/", "users", "collection"), new Link("/articles/", "articles", "collection"), 
      new Link("/comments/", "comments", "collection")
    ];
    res.json(data);
  });
  app.get("/meta-info/", function(req, res){
    let data = app.locals.meta;
    data["links"] = [generateLink(req)];

    res.json(data);
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
  let link = new Link(requestUrl(req), "self", "self");
  return link;
}


const DEFAULT_COUNT = 5;

//@TODO
