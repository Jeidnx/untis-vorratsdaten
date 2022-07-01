import WebUntis, {Klasse, Room, SchoolYear, Subject, Teacher} from 'webuntis'
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

type CBtype = singleCb | ArrayCb;

interface SchoolLesson {
    startTime: Date,
    endTime: Date,
    code: "regular" | "cancelled" | "irregular",
    yearId: number,
    yearName: string,
    courseId: number | null,
    courseName: string,
    courseShortName: string,
    subjectId: number | null,
    shortSubject: string,
    subject: string,
    teacherId: number | null,
    shortTeacher: string,
    teacher: string,
    roomId: number | null,
    room: string,
    shortRoom: string,
    lstext: string,
    info: string,
    subsText: string,
    sg: string,
    bkRemark: string,
    bkText: string
}

type singleCb = (lesson: SchoolLesson, course: Klasse, year: SchoolYear) => Promise<void>

type ArrayCb = [
    (lesson: SchoolLesson) => Promise<void>,
    (course: Klasse & {yearId: number}) => Promise<void>,
    (year: SchoolYear) => Promise<void>,
    (room: Room) => Promise<void>,
    (teacher: Teacher) => Promise<void>,
    (subject: Subject) => Promise<void>,
]

const getData = (cb: CBtype) => {
    const isArrayCb = Array.isArray(cb);
    untis.login().then(async () => {
        untis.getSchoolyears().then((years) => {
            const start = performance.now();
            Promise.all(years.map(async (year) => {
                if(isArrayCb){
                    await Promise.all(years.map((year) => {
                        return cb[2](year);
                    }))
                    await untis.getRooms().then((rooms) => {
                        return Promise.all(rooms.map((room) => {
                            return cb[3](room);
                        }))
                    });
                    await untis.getTeachers().then((teachers) => {
                        return Promise.all(teachers.map((teacher) => {
                            return cb[4](teacher);
                        }))
                    }).catch((err) => {
                        // Some users don't have the right to access teachers directly via api
                        if(err.message !== 'Server didn\'t return any result.') throw new Error(err);
                    });
                    await untis.getSubjects().then((subjects) => {
                        return Promise.all(subjects.map((subject) => {
                            return cb[5](subject);
                        }))
                    });
                }
                const startDate = year.startDate;
                const endDate = year.endDate;
                const courses = await untis.getClasses(undefined, year.id);
                return Promise.all(courses.map(async (course) => {
                    if(isArrayCb) await cb[1]({yearId: year.id, ...course});
                    return untis.getTimetableForRange(startDate, endDate, course.id, 1).then((lessons) => {
                        return Promise.all(lessons.map((lesson) => {
                            const nLesson = {
                                id: lesson.id,
                                startTime: convertUntisTimeDateToDate(lesson.date, lesson.startTime),
                                endTime: convertUntisTimeDateToDate(lesson.date, lesson.endTime),
                                //TODO: figur out why typecasting is necessary here
                                code: (lesson.code || 'regular' as 'regular' | 'cancelled' | 'irregular'),
                                courseId: course.id,
                                courseShortName: course.name,
                                courseName: course.longName,
                                yearId: year.id,
                                yearName: year.name,
                                subjectId: lesson.su[0] ? lesson.su[0].id : null,
                                shortSubject: lesson['su'][0] ? lesson['su'][0]['name'] : '🤷',
                                subject: lesson['su'][0] ? lesson['su'][0]['longname'] : 'no subject',
                                teacherId: lesson.te[0] ? lesson.te[0].id : null,
                                teacher: lesson['te'][0] ? lesson['te'][0]['longname'] : 'no teacher',
                                shortTeacher: lesson.te[0] ? lesson.te[0].name : '🤷‍',
                                roomId: lesson.ro[0] ? lesson.ro[0].id : null,
                                room: lesson.ro[0] ? lesson.ro[0].longname : 'no room',
                                shortRoom: lesson.ro[0] ? lesson.ro[0].name : '🤷',
                                lstext: lesson['lstext'] || '',
                                info: lesson['info'] || '',
                                subsText: lesson['substText'] || '',
                                sg: lesson['sg'] || '',
                                bkRemark: lesson['bkRemark'] || '',
                                bkText: lesson['bkText'] || '',
                            }
                            return isArrayCb ? cb[0](nLesson) : cb(nLesson, course, year);
                        }))
                    }).catch((err) => {
                        if(err.message !== 'Server didn\'t return any result.') throw new Error(err);
                    })
                })).then(() => {
                    console.log('Finished fetching Data for:', year.name);
                })
            })).then(() => {
                console.log('Finished Everything in:', (performance.now()-start)/1000, 'seconds');
            })
        })
    });
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
export default getData;
