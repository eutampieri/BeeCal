import fetch from "node-fetch";
import { iCalendar } from "./icalendar.js";
import sqlite3 from "sqlite3";
import rb from "randombytes";
import b32 from "base32.js";
import { Tecla } from "./tecla.js";
import { WrappedDb } from "./db.js";

const ONE_UNIX_DAY = 24 * 3600;
const DB_FILE = "./logs/data.db";

// Create a single instance of the database connection
const db = new WrappedDb(new sqlite3.Database(DB_FILE));
process.on("exit", () => {
    db.close();
});

class UniboEventClass {
    constructor(title, start, end, location, url, docente) {
        this.title = title;
        this.start = start;
        this.end = end;
        this.location = location;
        this.url = url;
        if (docente !== null) {
            this.organizer = docente;
        } else {
            this.organizer = null
        }
    }
}

// Generate random id
export function generateId(length) {
    var encoder = new b32.Encoder({ type: "crockford", lc: true });
    return encoder.write(rb(length === undefined ? 3 : length)).finalize();
}

export function log_hit(id, ua) {
    let query = "INSERT INTO hits VALUES (?, ?, ?)";
    return db.run(query, new Date().getTime(), id, ua);
}

export function log_enrollment(params, lectures) {
    let enrollment_query = "INSERT INTO enrollments VALUES(?, ?, ?, ?, ?, ?)";
    let lectures_query = "INSERT INTO requested_lectures VALUES(?, ?)";

    return db.run(enrollment_query, params).then(_ => Promise.all(
        lectures.map((lecture) => { db.run(lectures_query, params[0], lecture); })
    ));
}

export async function getTimetable(universityId, curriculum, year) {
    let university = Tecla.getUniversityById(universityId);
    return university.getTeachingsForCurriculum(curriculum, year)
        .then(x => { return { teachings: x }; })
        .catch(function (err) {
            console.log(err);
            return {};
        });
};

export function generateUrl(origin, universityId, curriculum, year, lectures) {

    let domain = origin.replace(/https?:\/\//, "");
    //Creating URL to get the calendar
    const id = generateId()
    //unibocalendar.duckdns.org
    var url = `webcal://${domain}/get_ical?id=${id}`

    // Writing logs
    var params = [id, new Date().getTime(), universityId, "course", year, curriculum];
    log_enrollment(params, lectures);
    return url;
}

export function checkEnrollment(uuid_value) {
    if (uuid_value === undefined || uuid_value === null) {
        return new Promise((res) => res(false));
    } else {
        let query = "SELECT * FROM enrollments WHERE id = ?";
        return db.get(query, uuid_value).then(x => x !== undefined);
    }
}

export async function getICalendarEvents(id, ua, alert) {
    try {
        let isEnrolled = await checkEnrollment(id);

        if (!isEnrolled) {
            const start = new Date();
            const day = 864e5;
            const end = new Date(+start + day / 24);
            const ask_for_update_event = new UniboEventClass("Aggiorna BeeCal!", start, end, "unknown", "https://unibocalendar.it", "");
            var factory = new iCalendar(alert);
            return factory.ical([ask_for_update_event]);
        } else {
            // Use the existing database connection
            db.run("DELETE FROM cache WHERE expiration < strftime('%s', 'now')");
            let vcalendar = await db.get("SELECT value FROM cache WHERE id = ?", id).then(x => x.value);

            if (vcalendar === false) {
                let query_enrollments = "SELECT * FROM enrollments WHERE id = ?";
                let enrollments_info = await db.get(query_enrollments, id);
                let university = enrollments_info["type"];
                let year = enrollments_info["year"];
                let curriculum = enrollments_info["curriculum"];

                let tecla = Tecla.getUniversityById(university);

                let query_lectures = "SELECT lecture_id FROM requested_lectures WHERE enrollment_id = ?";
                let lectures = await db.all(query_lectures, id);

                let timetable = await tecla.getTimetableWithTeaching(curriculum, lectures.map((x) => x["lecture_id"]), year)

                let calendar = [];
                console.log(timetable);
                for (var l of timetable) {
                    const start = new Date(l.start);
                    const end = new Date(l.end);
                    var location = l.venue;
                    var url = l.online_class_url || null;
                    var prof = l.teacher;
                    const event = new UniboEventClass(l.teaching.name, start, end, location, url, prof);
                    calendar.push(event);
                }

                let cache;
                if(calendar.length === 0) {
                    cache = false;
                    const start = new Date();
                    const day = 864e5;
                    const end = new Date(+start + day / 24);
                    const apologise = new UniboEventClass("Non ho trovato lezioni, riprova più tardi!", start, end, "unknown", "https://unibocalendar.it/get_ical?id=" + id, "");
                    calendar.push(apologise);
                } else {
                    cache = true;
                }
                var factory = new iCalendar(alert);
                vcalendar = factory.ical(calendar);

                if(cache) {
                    db.run(`INSERT INTO cache VALUES(?, ?, strftime("%s", "now") + ${ONE_UNIX_DAY})`, id, vcalendar);
                }
            }

            log_hit(id, ua);
            return vcalendar;
        }
    } catch (error) {
        console.error("Error in getICalendarEvents:", error);
        throw error;
    }
}
