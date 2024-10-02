export class WrappedDb {
    constructor(db) {
        this.db = db;
    }
    #promisify(fn, query, ...parameters) {
        return new Promise((res, rej) => {
            fn(query, parameters, function (err, result){
                if(err !== null) {
                    rej(err);
                } else {
                    res(result);
                }
            })
        });

    }
    run(query, ...parameters) {
        return this.#promisify(this.db.run, query, parameters);
    }
    get(query, ...parameters){
        return this.#promisify(this.db.get, query, parameters);
    }
    close() {
        return this.db.close();
    }
    all(query, ...parameters) {
        return this.#promisify(this.db.all, query, parameters);
    }
}