import express, { json, urlencoded } from "express"
import "express-handlebars"
import * as hbs from "express-handlebars"
import sqlite3 from "sqlite3"
import { router } from "./controller.js"
import { __dirname } from "./utils.js"
import { WrappedDb } from "./db.js"
//import * as segfaultHandler from "node-segfault-handler";

//segfaultHandler.registerHandler();

var db = new WrappedDb(new sqlite3.Database("./logs/data.db"));
var app = express();

function tokenMiddleware(correct) {
    return function (req, res, n) {
        if (req.query.token !== undefined) {
            let db = new sqlite3.Database("./logs/data.db");
            db.all("SELECT * FROM token WHERE id = ?", [req.query.token], (e, r) => {
                if (r.length == 0) {
                    return n();
                } else { return correct(req, res, n); }
            });
        } else {
            return n();
        }
    }
}

//set up port
app.set("port", process.env.PORT || 3002);

//set up bind addr
app.set("bind-addr", process.env.BIND_ADDR || "localhost");

//set up static folder
app.use(express.static(__dirname + "/public"));
app.get("/data.db", tokenMiddleware(express.static(__dirname + "/logs")));

//set body-parser to read post request data
app.use(json());
app.use(urlencoded({ extended: true }));

//set up router
app.use("/", router);

//set up handlebars
app.engine("handlebars", hbs.engine());
app.set("view engine", "handlebars");

/**
 * Create DB tables and migrate CSV
 */
(async function() {
    await db.run("CREATE TABLE IF NOT EXISTS enrollments (id TEXT, date INTEGER, type TEXT, course TEXT, year INTEGER, curriculum TEXT, PRIMARY KEY(id))");
    await db.run("CREATE TABLE IF NOT EXISTS requested_lectures (enrollment_id TEXT, lecture_id TEXT, CONSTRAINT fk_enrollment FOREIGN KEY(enrollment_id) REFERENCES enrollments(id))");
    await db.run("CREATE TABLE IF NOT EXISTS hits (date INTEGER, enrollment_id TEXT, user_agent TEXT, PRIMARY KEY(date,enrollment_id), CONSTRAINT fk_enrollment FOREIGN KEY(enrollment_id) REFERENCES enrollments(id))");
    await db.run("CREATE TABLE IF NOT EXISTS token(id TEXT, description TEXT, PRIMARY KEY(id))");
    await db.run("CREATE TABLE IF NOT EXISTS cache(id TEXT, value TEXT, expiration INTEGER, PRIMARY KEY(id), CONSTRAINT fk_enrollment FOREIGN KEY(id) REFERENCES enrollments(id))");
    await db.run("CREATE INDEX IF NOT EXISTS enrollment_lectures ON requested_lectures(enrollment_id)");
    await db.close();
})();

//start server
app.listen(app.get("port"), app.get("bind-addr"), () => {
    console.log(`BeeCal started on http://${app.get("bind-addr")}:${app.get("port")}`);
});
