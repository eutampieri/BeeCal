import sqlite3 from "sqlite3";
import { generateId } from "./model.js";
import { WrappedDb } from "./db.js";

var db = new WrappedDb(new sqlite3.Database("./logs/data.db"));

let token_id = generateId(23);
let token_desc = "Created on " + new Date();

db.run("INSERT INTO token VALUES(?, ?)", token_id, token_desc).then(() => db.close());
console.log("Created token with value " + token_id);
