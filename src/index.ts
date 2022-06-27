import WebUntis from './WebUntisLib.js';
import {Klasse, Lesson, SchoolYear} from 'webuntis'
import {Client, Entity, Schema,} from "redis-om";
import {performance} from "perf_hooks";

if (
    !(
        process.env.SCHOOL &&
        process.env.USERNAME &&
        process.env.PASSWORD &&
        process.env.DOMAIN)
) throw new Error('Missing env')

const untis = new WebUntis(
    process.env.SCHOOL,
    process.env.USERNAME,
    process.env.PASSWORD,
    process.env.DOMAIN
)
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

untis.login().then(async () => {
    untis.getAllSchoolYears().then((years) => {
        const start = performance.now();
        Promise.all(years.map(async (year) => {
            const startDate = year.startDate;
            const endDate = year.endDate;
            const courses = await untis.getClasses(year.id);

            return Promise.all(courses.map((course) => {
                return untis.getTimetableForRange(startDate, endDate, course.id, 1).then((lessons) => {
                    return Promise.all(lessons.map((lesson) => {
                        return lessonCallback(lesson, course, year);
                    }))
                }).catch((err) => {
                    if(err.message !== 'Server didn\'t retun any result.') throw new Error(err);
                })
            })).then(() => {
                console.log('Finished fetching Data for:', year.name);
            })
        })).then(() => {
            console.log('Finished Everything in:', (performance.now()-start)/1000, 'seconds');
            process.exit();
        })
    })
});

function lessonCallback(lesson: Lesson, course: Klasse, year: SchoolYear){
    return lessonRepository.save(new LessonClass(lessonSchema, String(lesson.id), {
        startTime: convertUntisTimeDateToDate(lesson.date, lesson.startTime),
        endTime: convertUntisTimeDateToDate(lesson.date, lesson.endTime),
        code: lesson['code'] || 'regular',
        courseNr: course.id,
        courseShortName: course.name,
        courseName: course.longName,
        yearId: year.id,
        yearName: year.name,
        shortSubject: lesson['su'][0] ? lesson['su'][0]['name'] : '🤷',
        subject: lesson['su'][0] ? lesson['su'][0]['longname'] : 'no subject',
        teacher: lesson['te'][0] ? lesson['te'][0]['longname'] : 'no teacher',
        shortTeacher: lesson.te[0] ? lesson.te[0].name : '🤷‍',
        room: lesson.ro[0] ? lesson.ro[0].longname : 'no room',
        shortRoom: lesson.ro[0] ? lesson.ro[0].name : '🤷',
        lstext: lesson['lstext'] || '',
        info: lesson['info'] || '',
        subsText: lesson['substText'] || '',
        sg: lesson['sg'] || '',
        bkRemark: lesson['bkRemark'] || '',
        bkText: lesson['bkText'] || '',
    }));
}

function convertUntisTimeDateToDate(date: number, startTime: number): Date {

    const year = Math.round(date / 10000);
    const month = Math.round((date - (year * 10000)) / 100);
    const day = (date - (year * 10000) - month * 100);

    let index;
    if (startTime >= 100) {
        index = 2;
    } else {
        index = 1;
    }
    const hour = Math.round(startTime / Math.pow(10, index));
    const minutes = Math.round(((startTime / 100) - hour) * 100);

    return new Date(year, month - 1, day, hour, minutes);
}