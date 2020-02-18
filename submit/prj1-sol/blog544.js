// -*- mode: JavaScript; -*-

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

  constructor(meta, options) {
    //@TODO
    this.meta = meta;
    this.options = options;
    this.validator = new Validator(meta);
    this.users = {};
    this.articles = {};
    this.comments = {};
  }

  static async make(meta, options) {
    var new_blog = new Blog544(meta, options);
    return new_blog;
  }

  /** Remove all data for this blog */
  async clear() {
    this.users = {};
    this.articles = {};
    this.comments = {};
  }

  /** Create a blog object as per createSpecs and 
   * return id of newly created object
   */
  async create(category, createSpecs) {
    const obj = this.validator.validate(category, 'create', createSpecs);
    var new_id = random_id(this, category); // Call our random_id function
    if(category === "comments"){
      if(!(obj.articleId in this.articles)){
        const msg = `invalid id ${obj.articleId} for articles in create comment`;
        throw [ new BlogError('BAD_ID', msg)];
      }

      if(!(obj.commenterId in this.users)){
        const msg = `invalid id ${obj.commenterId} for commenter in create comment`;
        throw [ new BlogError('BAD_ID', msg)];
      }

      this.comments[new_id] = obj;
      this.comments[new_id].id = new_id;

    } else if(category == "articles"){
      if(!(obj.authorId in this.users)){
        const msg =
        `invalid id ${obj.authorId} for users in create articles`;
        throw [ new BlogError('BAD_ID', msg) ];
      }
      this.articles[new_id] = obj;
      this.articles[new_id].id = new_id;
    } else if(category === "users"){
      if(obj.id in this.users){
        const msg =
            `object with id ${obj.id} already exists for ${category}`;
          throw [ new BlogError('EXISTS', msg) ];
      }
      this.users[obj.id] = obj;
      return obj.id;
    }

    

    //@TODO
    return new_id;
  }

  /** Find blog objects from category which meets findSpec.  Returns
   *  list containing up to findSpecs._count matching objects (empty
   *  list if no matching objects).  _count defaults to DEFAULT_COUNT.
   */
  async find(category, findSpecs={}) {
    // this.options["verbose"]


    // NOTE ABOUT VERBOSE

    // i have no idea index is.
    
    const obj = this.validator.validate(category, 'find', findSpecs);
    //@TODO
    if(!findSpecs._count){ // JAVASCRIPT TRUTHYNESS WOAHHHHHH
      findSpecs._count = DEFAULT_COUNT;
    }

    var count = findSpecs._count;
    var found = [];
    // console.log(findSpecs);
    var counted = 0;
    if(category === "users"){
      for(var user in this.users){
        if(counted >= count){continue;}
        if(findSpecs.id){ // If we're searching for a specific ID
          if(this.users[user].id === findSpecs.id){
            found.push(this.users[user]);
            // console.log(user);
            counted++;
          }
        } else { // Not looking for an ID
          found.push(this.users[user]);
          // console.log(user);
          counted++;
        }
      }
    } else if(category === "articles"){
      for(var article in this.articles){
        // console.log(article);
        // console.log(this.articles[article]);
        if(counted >= count){continue};
        if(findSpecs.id){
          if(this.articles[article].id === findSpecs.id){
            found.push(this.articles[article]);
            counted++;
          }
        } else {
          found.push(this.articles[article]);
          counted++;
        }
      }

    } else if(category === "comments"){
      for(var comment in this.comments){
        if(counted >= count){continue};
        if(findSpecs.id){
          if(this.comments[comment].id === findSpecs.id){
            found.push(this.comments[comment]);
            counted++;
          }
        } else {
          found.push(this.comments[comment]);
          counted++;
        }
      }
      
    }
    return found;
  }

  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    const obj = this.validator.validate(category, 'remove', rmSpecs);
    if(category === "comments"){
      for(var comment in this.comments){
        if(this.comments[comment].id === rmSpecs.id){
          delete this.comments[comment];
        }
      }
    } else if(category === "articles"){
      if(!(rmSpecs.id in this.articles)){
        const msg =
        `no articles for id ${rmSpecs.id} in remove`;
        throw [ new BlogError('BAD_ID', msg) ];
      }
      for(var article in this.articles){
        if(this.articles[article].id === rmSpecs.id){
          // This is the article we want to delete. First, check if it's referenced by any comments.
          for(var comment in this.comments){
            if(this.comments[comment].articleId === rmSpecs.id){
              const msg =
              `articles id ${this.comments[comment].articleId} referenced by comments ${this.comments[comment].id}`;
              throw [ new BlogError('BAD_ID', msg) ];
              return;
            }
          }
          delete this.articles[article];
        }
      }
    } else if(category === "users"){
      var ref_articles = [];
      var ref_comments = [];
      for(var article in this.articles){
        if(this.articles[article].authorId === rmSpecs.id){
          ref_articles.push(article);
        }
      }
      for(var comment in this.comments){
        if(this.comments[comment].commenterId === rmSpecs.id){
          ref_comments.push(comment);
        }
      }

      var errors = [];
      if(ref_articles.length != 0){
        const msg =
        `users id=${rmSpecs.id} referenced by authorId for articles ${ref_articles.join(", ")}`;
        errors.push(new BlogError('BAD_ID', msg))
      }

      if(ref_comments.length != 0){
        const msg =
        `users id=${rmSpecs.id} referenced by commenterId for comments ${ref_comments.join(", ")}`;
        errors.push(new BlogError('BAD_ID', msg));
      }


      
      if(ref_articles.length === 0 && ref_comments.length === 0){
        delete this.users[rmSpecs.id];
      } else {
        throw errors;
      }


    }
    //@TODO
  }

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    const obj = this.validator.validate(category, 'update', updateSpecs);
    //@TODO
    if(category === "users"){
      for(var user in this.users){
        if(this.users[user].id == updateSpecs.id){
          Object.assign(this.users[user], updateSpecs);
        }
      }
    } else if(category === "articles"){
      for(var articles in this.articles){
        if(this.articles[article].id === updateSpecs.id){
          Object.assign(this.articles[article], updateSpecs);
        }
      }
    } else if(category === "comments"){
      for(var comments in this.comments){
        if(this.comments[comment].id === updateSpecs.id){
          Object.assign(this.comments[comment], updateSpecs);
        }
      }
    }
    console.log(updateSpecs);
  }
  
}

const DEFAULT_COUNT = 5;

//You can add code here and refer to it from any methods in Blog544.

function random_id(obj, category){
  var preface;
  if(category === 'articles'){
    preface = "A";
  } else if (category === 'comments'){
    preface = "C";
  }

  

  var u_id = preface + Math.floor(Math.random() * Math.floor(10000));

  // While loop to ensure unique

  if(category === "articles"){
    while(u_id in obj.articles){
      u_id = preface + Math.floor(Math.random() * Math.floor(10000));
    }
  } else if(category === "comments"){
    while(u_id in obj.comments){
      u_id = preface + Math.floor(Math.random() * Math.floor(10000));
    }
  }
  
  return u_id;
}