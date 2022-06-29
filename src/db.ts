import getData from "./getData.js";
import {Client, Entity, Schema} from "redis-om";

const client = new Client();

class LessonClass extends Entity {
}

const lessonSchema = new Schema(
    LessonClass, {
        startTime: {type: 'date', sortable: true},
        endTime: {type: 'date'},
        code: {type: 'text'},
        courseNr: {type: 'number'},
        courseName: {type: 'text'},
        courseShortName: {type: 'text'},
        yearId: {type: "number"},
        yearName: {type: "text"},
        shortSubject: {type: 'text'},
        subject: {type: 'text'},
        shortTeacher: {type: 'text'},
        teacher: {type: 'text'},
        room: {type: 'text'},
        shortRoom: {type: 'text'},
        lstext: {type: 'text'},
        info: {type: 'text'},
        subsText: {type: 'text'},
        sg: {type: 'text'},
        bkRemark: {type: 'text'},
        bkText: {type: 'text'},
    },
    {
        dataStructure: 'HASH',
    }
);
await client.open(process.env.REDIS_URL);
const lessonRepository = client.fetchRepository(lessonSchema);
await lessonRepository.createIndex();

getData((lesson, course, year) => {
    // Handle everything in one cb per lesson
    // @ts-ignore
    lessonRepository.save(new LessonClass(lessonSchema, String(lesson.id) + 'y' + String(year.name), lesson))
    return Promise.resolve();
})