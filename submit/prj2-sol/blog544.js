// -*- mode: JavaScript; -*-

import mongo from 'mongodb';

import BlogError from './blog-error.js';
import Validator from './validator.js';

//debugger; //uncomment to force loading into chrome debugger

/**
A blog contains users, articles and comments.  Each user can have
multiple Role's from [ 'admin', 'author', 'commenter' ]. An author can
create/update/remove articles.  A commenter can comment on a specific
article.

Errors
======

DB:
  Database error

BAD_CATEGORY:
  Category is not one of 'articles', 'comments', 'users'.

BAD_FIELD:
  An object contains an unknown field name or a forbidden field.

BAD_FIELD_VALUE:
  The value of a field does not meet its specs.

BAD_ID:
  Object not found for specified id for update/remove
  Object being removed is referenced by another category.
  Other category object being referenced does not exist (for example,
  authorId in an article refers to a non-existent user).

EXISTS:
  An object being created already exists with the same id.

MISSING_FIELD:
  The value of a required field is not specified.

*/

export default class Blog544 {

  constructor(meta, options, db, db_handler) {
    //@TODO
    this.meta = meta;
    this.options = options;
    this.validator = new Validator(meta);
    this.db = db; // await mongo.connect() result
    this.handler = db_handler;
  }

  /** options.dbUrl contains URL for mongo database */
  static async make(meta, options) {
    let match = /^mongodb:\/\/(\w+):(\d+)/.test(options.dbUrl); // Regex to match
    if( !match){
      const msg = "Bad host !";
      throw [new BlogError('BAD_FIELD_VALUE', msg)];
    }
    const db_connection = await mongo.connect(options.dbUrl, MONGO_CONNECT_OPTIONS);
    const db = db_connection.db('main');
    return new Blog544(meta, options, db, db_connection);
  }

  /** Release all resources held by this blog.  Specifically, close
   *  any database connections.
   */
  async close() {
    await this.handler.close();
    return;
  }

  /** Remove all data for this blog */
  async clear() {
    let collections = ["users", "comments", "articles"];
    for(var collection of collections){
      let this_collection = this.db.collection(collection);
      await this_collection.deleteMany({});
    }
  }

  /** Create a blog object as per createSpecs and 
   * return id of newly created object 
   */
  async create(category, createSpecs) {
    const obj = this.validator.validate(category, 'create', createSpecs);
    var new_id = random_id(this, category); // Call our random_id function
    if(!obj.id){
      obj.id = new_id;
    }

    // Some error checking
    if(category === "commments"){
      // Cant have a comment w/ an invalid commentor id...
      if((await this.db.collection("users").find({id:createSpecs.commenterId}).toArray()).length === 0){
        throw [new BlogError("BAD_FIELD_VALUE", "Need valid user id")];
      }
      if(await this.db.collection("articles").find({articleId: createSpecs.articleId}).toArray().length === 0){
        throw [new BlogError("BAD_FIELD_VALUE", "Need valid article id")];
      }
    }

    if(category === "articles"){
      if(await this.db.collection("users").find({id: createSpecs.authorId}).toArray().length === 0){
        throw [new BlogError("BAD_FIELD_VALUE", "Need valid author id for article")];
      }
    }


    var table = this.db.collection(category);
    var existing = [];
    for(var result in await table.find({id: createSpecs.id}).toArray()){
      if(result.length > 0){
        existing.push(result);
      }
    }

    if(existing.length != 0){
      var msg = `bad ${category} with id: ${createSpecs.id}`;
      throw [new BlogError("BAD_ID", msg)];
    }

    await table.insertOne(obj);
    return new_id;
  }

  /** Find blog objects from category which meets findSpec.  
   *
   *  First returned result will be at offset findSpec._index (default
   *  0) within all the results which meet findSpec.  Returns list
   *  containing up to findSpecs._count (default DEFAULT_COUNT)
   *  matching objects (empty list if no matching objects).  _count .
   *  
   *  The _index and _count specs allow paging through results:  For
   *  example, to page through results 10 at a time:
   *    find() 1: _index 0, _count 10
   *    find() 2: _index 10, _count 10
   *    find() 3: _index 20, _count 10
   *    ...
   *  
   */
  async find(category, findSpecs={}) {
    if(!findSpecs._count){
      findSpecs._count = DEFAULT_COUNT;
    }

    if(!findSpecs._index){
      findSpecs._index = 0;
    }


    var index = findSpecs._index;
    var count = findSpecs._count;

    const obj = this.validator.validate(category, 'find', findSpecs);
    if(!["users", "comments", "articles"].includes(category)){
      throw [new BlogError("BAD_CATEGORY", "Use a real category")];
    }

    var search_criteria = {}; // Dont need the _count or _index variables to be searched for
    for(var k in findSpecs){
      if(k !== "_count" && k !== "_index"){
        search_criteria[k] = findSpecs[k];
      }
      if (k === "creationTime"){
        // Search by less than the current date using query selector
        search_criteria["creationTime"] = {"$lte": new Date(findSpecs[k])};
      }
    }
    // console.log(search_criteria);
    var table = this.db.collection(category);
    let results = [];
    let query_data = await table.find(search_criteria).skip(parseInt(index)).limit(parseInt(count, 10)).toArray();
    // console.log(query_data);
    for(var result of query_data){
      results.push(result);
    }

    return results;
  }

  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    const obj = this.validator.validate(category, 'remove', rmSpecs);
    var table = this.db.collection(category);
    if(!rmSpecs.id){
      throw [ new BlogError("BAD_ID", "Using remove requires a valid id")];
    }


    var to_delete;
    var existing_objects = await table.find(rmSpecs).toArray();
    if(existing_objects.length === 0){
      throw [new BlogError("BAD_ID", "No object found with that id")];
    } else {
      to_delete = existing_objects[0]._id;
    }

    await table.deleteOne({_id: to_delete});
  }

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    const obj = this.validator.validate(category, 'update', updateSpecs);
    var table = this.db.collection(category);
    var existing_object = await table.find({id: updateSpecs.id}).toArray();
    if( existing_object.length === 0){
      throw [new BlogError("BAD_ID", "There is no object with that ID")];
      return;
    }

    // Consistency stuff
    if(category === "comments"){
      if(updateSpecs.articleId){
        if(this.db.collection("articles").find({articleId: updateSpecs.articleId}).toArray().length === 0){
          throw [new BlogError("BAD_FIELD_VALUE", "article for comment update does not exist")];
        }
      }
      if(updateSpecs.commenterId){
        if(this.db.collection("users").find({id:updateSpecs.commenterId}).toArray().length === 0){
          throw [ new BlogError("BAD_FIELD_VALUE", "Need a valid user to update articles...")]
        }
      }
    }

    if(category === "articles"){
      if(updateSpecs.authorId){
        if(this.db.collection("users").find({id:updateSpecs.authorId}).toArray() === 0){
          throw [new BlogError("BAD_FIELD_VALUE", "Invalid author")];
        }
      }
    }


    // Keep track of the update time...
    updateSpecs["updateTime"] = new Date();
    // console.log(existing_object);
    // Update via mongo _id per specs
    var internal_mongo_id = existing_object[0]._id;
    await table.updateOne({_id: internal_mongo_id}, {$set: updateSpecs});
    // console.log(internal_mongo_id);
    
  }
  
}

const DEFAULT_COUNT = 5;

const MONGO_CONNECT_OPTIONS = { useUnifiedTopology: true };

// Taken from me - project 1...
function random_id(obj, category){
  var preface;
  if(category == 'articles'){
    preface = "A";
  } else if (category == 'comments'){
    preface = "C";
  }
  var u_id = preface + Math.floor(Math.random() * Math.floor(10000));
  return u_id;
}