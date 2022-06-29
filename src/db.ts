import getData from "./getData.js";

import mysql from 'mysql2';

const db = mysql.createPool({
    host: process.env.SQLHOST,
    port: Number(process.env.SQLPORT),
    user: process.env.SQLUSER,
    password: process.env.SQLPASS,
    database: process.env.SQLDB
});

await dbQuery('SHOW TABLES', []).then(() => {
    console.log('DB Connected');
}).catch((err) => {
    console.log(err);
    process.exit(1);
});

const teacherList: number[] = [];

getData(([
    async (lesson) => {
        if ((lesson.teacherId !== null) && !teacherList.includes(lesson.teacherId)) {
            await dbQuery(
                'INSERT IGNORE INTO Teacher (id, name, longName) VALUES (?, ?, ?)',
                [lesson.teacherId, lesson.shortTeacher, lesson.teacher]).then(() => {
            });
            teacherList.push(lesson.teacherId);
        }
        return dbQuery(
            `INSERT IGNORE INTO Lesson
 (id, startTime, endTime, lessonCode, roomId, courseId, subjectId, yearId, teacherId ) 
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                lesson.id, lesson.startTime, lesson.endTime, lesson.code,
                lesson.roomId, lesson.courseNr, lesson.subjectId, lesson.yearId, lesson.teacherId
            ]).then()
    },
    (course) => {
    return dbQuery('INSERT IGNORE INTO Course (id, name, longName, active, yearId) VALUES (?, ?, ?, ?, ?)',
            [course.id, course.name, course.longName, course.active ? 1 : 0, course.yearId]).then()
    },
    (year) => {
        return dbQuery('INSERT IGNORE INTO Year (id, name) VALUES (?, ?)', [year.id, year.name]).then()
    },
    (room) => {
        return dbQuery('INSERT IGNORE INTO Room (id, name, longName) VALUES ( ?, ?, ?)',
            [room.id, room.name, room.longName]).then();
    },
    (teacher) => {
        return dbQuery('INSERT IGNORE INTO Teacher (id, name, longName) VALUES (?, ?, ?)',
            [teacher.id, teacher.name, teacher.longName]).then();
    },
    (subject) => {
        return dbQuery('INSERT IGNORE INTO Subject (id, name, longName) VALUES (?, ?, ?)',
            [subject.id, subject.name, subject.longName]).then()
    }
]))

async function dbQuery(query: string, values: any[]) {
    return new Promise((resolve, reject) => {
        db.query(query, values, (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(result);
        })
    })
}