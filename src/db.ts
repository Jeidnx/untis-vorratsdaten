import getData from "./getData.js";
getData(([
    /*
    Handle each type separately
    The call order of theses is:
     - years
     - courses
     - lessons
    */
    (lesson) => {
        return Promise.resolve();
    },
    (course) => {
        return Promise.resolve();
    },
    (year) => {
        return Promise.resolve();
    },
    (room) => {
        return Promise.resolve();
    },
    (teacher) => {
        return Promise.resolve();
    },
    (subject) => {
        return Promise.resolve();
    },
]))
// OR:

getData((lesson, course, year) => {
    // Handle everything in one cb per lesson
    return Promise.resolve();
})