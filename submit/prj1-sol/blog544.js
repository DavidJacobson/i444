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
      this.comments[new_id] = obj;
      if(!(obj.articleId in this.articles)){
        const msg = `invalid id ${obj.articleId} for articles in create comment`;
        throw [ new BlogError('BAD_ID', msg)];
      }

      if(!(obj.commenterId in this.users)){
        const msg = `invalid id ${obj.commenterId} for commenter in create comment`;
        throw [ new BlogError('BAD_ID', msg)];
      }
    } else if(category == "articles"){
      if(!(obj.authorId in this.users)){
        const msg =
        `invalid id ${obj.authorId} for users in create articles`;
        throw [ new BlogError('BAD_ID', msg) ];
      }
      this.articles[new_id] = obj;
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
    const obj = this.validator.validate(category, 'find', findSpecs);
    //@TODO
    return [];
  }

  /** Remove up to one blog object from category with id == rmSpecs.id. */
  async remove(category, rmSpecs) {
    const obj = this.validator.validate(category, 'remove', rmSpecs);
    //@TODO
  }

  /** Update blog object updateSpecs.id from category as per
   *  updateSpecs.
   */
  async update(category, updateSpecs) {
    const obj = this.validator.validate(category, 'update', updateSpecs);
    //@TODO
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