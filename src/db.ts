import getData from "./getData.js";
import * as fs from "fs";

const obj: {
    [key: string]: unknown
} = {};

getData((lesson, course, year) => {
    obj[lesson.id + 'y' + year.id] = lesson;
    // Handle everything in one cb per lesson
    return Promise.resolve();
}).then(() => {
    fs.writeFile('data.json', JSON.stringify(obj), (err) => {
        if (err) {
            throw err;
        }
        console.log("JSON data is saved.");
    });
})