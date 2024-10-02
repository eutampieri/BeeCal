export class WrappedDb {
    constructor(db) {
        this.db = db;
    }
    #promisify(fn, query, ...parameters) {
        return new Promise((res, rej) => {
            fn(query, ...parameters, function (err, result){
                if(err !== null) {
                    rej(err);
                } else {
                    res(result);
                }
            });
        });

    }
    run(query, ...parameters) {
        return this.#promisify((a, b, c) => this.db.run(a, b, c), query, ...parameters);
    }
    get(query, ...parameters){
        return this.#promisify((a, b, c) => this.db.get(a, b, c), query, ...parameters);
    }
    close() {
        return this.db.close();
    }
    all(query, ...parameters) {
        return this.#promisify((a, b, c) => this.db.all(a, b, c), query, ...parameters);
    }
}