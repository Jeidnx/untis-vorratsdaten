/*
This is a modified version of https://github.com/SchoolUtils/WebUntis

Copyright 2019 Nils Bergmann

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */


import axios from 'axios';
import CookieBuilder from 'cookie';
import Base64 from './Base64.js'
import find from 'lodash.find';
import {parse, startOfDay, format} from 'date-fns';

/**
 * WebUntis API Class
 */
class WebUntis {
    /**
     *
     * @constructor
     * @param {string} school The school identifier
     * @param {string} username
     * @param {string} password
     * @param {string} baseurl Just the host name of your WebUntis (Example: mese.webuntis.com)
     * @param {string} [identity="Awesome"] A identity like: MyAwesomeApp
     * @param {boolean} [disableUserAgent=false] If this is true, axios will not send a custom User-Agent
     */
    constructor(school, username, password, baseurl, identity = 'Awesome', disableUserAgent = false) {
        this.school = school;
        this.schoolbase64 = '_' + Base64.btoa(this.school);
        this.username = username;
        this.password = password;
        this.baseurl = 'https://' + baseurl + '/';
        this.cookies = [];
        this.id = identity;
        this.sessionInformation = {};
        this.anonymous = false;

        const additionalHeaders = {};

        if (!disableUserAgent) {
            additionalHeaders['User-Agent'] =
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.79 Safari/537.36';
        }

        this.axios = axios.create({
            baseURL: this.baseurl,
            maxRedirects: 0,
            headers: {
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache',
                'X-Requested-With': 'XMLHttpRequest',
                ...additionalHeaders,
            },
            validateStatus: function (status) {
                return status >= 200 && status < 303; // default
            },
        });
    }

    /**
     * Logout the current session
     * @returns {Promise<boolean>}
     */
    async logout() {
        await this.axios({
            method: 'POST',
            url: `/WebUntis/jsonrpc.do`,
            params: {
                school: this.school,
            },
            data: {
                id: this.id,
                method: 'logout',
                params: {},
                jsonrpc: '2.0',
            },
        });
        this.sessionInformation = null;
        return true;
    }

    /**
     * Login with your credentials
     *
     * **Notice: The server may revoke this session after less than 10min of idle.**
     *
     * *Untis says in the official docs:*
     * > An application should always logout as soon as possible to free system resources on the server.
     * @returns {Promise<Object>}
     */
    async login() {
        const response = await this.axios({
            method: 'POST',
            url: `/WebUntis/jsonrpc.do`,
            params: {
                school: this.school,
            },
            data: {
                id: this.id,
                method: 'authenticate',
                params: {
                    user: this.username,
                    password: this.password,
                    client: this.id,
                },
                jsonrpc: '2.0',
            },
        });
        if (typeof response.data !== 'object') throw new Error('Failed to parse server response.');
        if (!response.data.result) throw new Error('Failed to login. ' + JSON.stringify(response.data));
        if (response.data.result.code) throw new Error('Login returned error code: ' + response.data.result.code);
        if (!response.data.result.sessionId) throw new Error('Failed to login. No session id.');
        this.sessionInformation = response.data.result;
        return response.data.result;
    }

    /**
     * Get the latest WebUntis Schoolyear
     * @param {Boolean} [validateSession=true]
     * @returns {Promise<{name: String, id: Number, startDate: Date, endDate: Date}>}
     */
    async getLatestSchoolyear(validateSession = true) {
        const data = await this._request('getSchoolyears', {}, validateSession);
        data.sort((a, b) => {
            const na = parse(a.startDate, 'yyyyMMdd', new Date());
            const nb = parse(b.startDate, 'yyyyMMdd', new Date());
            return nb - na;
        });
        if (!data[0]) throw new Error('Failed to receive school year');
        return {
            name: data[0].name,
            id: data[0].id,
            startDate: parse(data[0].startDate, 'yyyyMMdd', new Date()),
            endDate: parse(data[0].endDate, 'yyyyMMdd', new Date()),
        };
    }

    /**
     * Get all WebUntis Schoolyear
     * @param {Boolean} [validateSession=true]
     * @returns {Promise<{name: String, id: Number, startDate: Date, endDate: Date}[]>}
     */
    async getAllSchoolYears(validateSession = true) {
        const data = await this._request('getSchoolyears', {}, validateSession);
        data.sort((a, b) => {
            const na = parse(a.startDate, 'yyyyMMdd', new Date());
            const nb = parse(b.startDate, 'yyyyMMdd', new Date());
            return nb - na;
        });
        if (!data[0]) throw new Error('Failed to receive school year');
        return data.map((dp) => {
            return {
                name: dp.name,
                id: dp.id,
                startDate: parse(dp.startDate, 'yyyyMMdd', new Date()),
                endDate: parse(dp.endDate, 'yyyyMMdd', new Date()),
            }
        })
    }
    /**
     * Get News Widget
     * @param {Date} date
     * @param {boolean} [validateSession=true]
     * @returns {Promise<Object>} see index.d.ts NewsWidget
     */
    async getNewsWidget(date, validateSession = true) {
        if (validateSession && !(await this.validateSession())) throw new Error('Current Session is not valid');
        const response = await this.axios({
            method: 'GET',
            url: `/WebUntis/api/public/news/newsWidgetData`,
            params: {
                date: this.convertDateToUntis(date),
            },
            headers: {
                Cookie: this._buildCookies(),
            },
        });
        if (typeof response.data.data !== 'object') throw new Error('Server returned invalid data.');
        return response.data.data;
    }

    /**
     * Get Inbox
     * @returns {Promise<Object>}
     */
    async getInbox(validateSession = true) {
        this._checkAnonymous();
        if (validateSession && !(await this.validateSession())) throw new Error('Current Session is not valid');
        //first get JWT Token
        if (typeof this.sessionInformation.jwt_token != 'string') await this._getJWT();
        const response = await this.axios({
            method: 'GET',
            url: `/WebUntis/api/rest/view/v1/messages`,
            headers: {
                Authorization: `Bearer ${this.sessionInformation.jwt_token}`,
                Cookie: this._buildCookies(),
            },
        });
        if (typeof response.data !== 'object') throw new Error('Server returned invalid data.');
        return response.data;
    }

    _checkAnonymous() {
        if (this.anonymous) {
            throw new Error('This method is not supported with anonymous login');
        }
    }

    /**
     *
     * @returns {string}
     * @private
     */
    _buildCookies() {
        let cookies = [];
        cookies.push(CookieBuilder.serialize('JSESSIONID', this.sessionInformation.sessionId));
        cookies.push(CookieBuilder.serialize('schoolname', this.schoolbase64));
        return cookies.join('; ');
    }

    /**
     * Get JWT Token
     * @returns {Promise<String>}
     */
    async _getJWT(validateSession = true) {
        if (validateSession && !(await this.validateSession())) throw new Error('Current Session is not valid');
        const response = await this.axios({
            method: 'GET',
            url: `/WebUntis/api/token/new`,
            headers: {
                //Authorization: `Bearer ${this._getToken()}`,
                Cookie: this._buildCookies(),
            },
        });

        if (typeof response.data !== 'string') throw new Error('Server returned invalid data.');
        this.sessionInformation.jwt_token = response.data;
        return response.data;
    }

    /**
     * Checks if your current WebUntis Session is valid
     * @returns {Promise<boolean>}
     */
    async validateSession() {
        if (!this.sessionInformation) return false;
        const response = await this.axios({
            method: 'POST',
            url: `/WebUntis/jsonrpc.do`,
            params: {
                school: this.school,
            },
            headers: {
                Cookie: this._buildCookies(),
            },
            data: {
                id: this.id,
                method: 'getLatestImportTime',
                params: {},
                jsonrpc: '2.0',
            },
        });
        return typeof response.data.result === 'number';
    }

    /**
     * Get the time when WebUntis last changed it's data
     * @param {Boolean} [validateSession=true]
     * @returns {Promise<Number>}
     */
    async getLatestImportTime(validateSession = true) {
        return this._request('getLatestImportTime', {}, validateSession);
    }

    /**
     *
     * @param id
     * @param type
     * @param startDate
     * @param endDate
     * @param validateSession
     * @returns {Promise.<Array>}
     * @private
     */
    async _timetableRequest(id, type, startDate, endDate, validateSession = true) {
        const additionalOptions = {};
        if (startDate) {
            additionalOptions.startDate = this.convertDateToUntis(startDate);
        }
        if (endDate) {
            additionalOptions.endDate = this.convertDateToUntis(endDate);
        }

        return this._request(
            'getTimetable',
            {
                options: {
                    id: new Date().getTime(),
                    element: {
                        id,
                        type,
                    },
                    ...additionalOptions,
                    showLsText: true,
                    showStudentgroup: true,
                    showLsNumber: true,
                    showSubstText: true,
                    showInfo: true,
                    showBooking: true,
                    klasseFields: ['id', 'name', 'longname', 'externalkey'],
                    roomFields: ['id', 'name', 'longname', 'externalkey'],
                    subjectFields: ['id', 'name', 'longname', 'externalkey'],
                    teacherFields: ['id', 'name', 'longname', 'externalkey'],
                },
            },
            validateSession
        );
    }

    /**
     * Get your own Timetable for the current day
     * Note: You can't use this with anonymous login
     * @param {Boolean} [validateSession=true]
     * @returns {Promise<Array>}
     */
    async getOwnTimetableForToday(validateSession = true) {
        this._checkAnonymous();
        return await this._timetableRequest(
            this.sessionInformation.personId,
            this.sessionInformation.personType,
            null,
            null,
            validateSession
        );
    }

    /**
     * Get the timetable of today for a specific element.
     * @param {number} id
     * @param {WebUntisElementType} type
     * @param {Boolean} [validateSession=true]
     * @returns {Promise<Array>}
     */
    async getTimetableForToday(id, type, validateSession = true) {
        return await this._timetableRequest(id, type, null, null, validateSession);
    }

    /**
     * Get your own Timetable for the given day
     * Note: You can't use this with anonymous login
     * @param {Date} date
     * @param {Boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getOwnTimetableFor(date, validateSession = true) {
        this._checkAnonymous();
        return await this._timetableRequest(
            this.sessionInformation.personId,
            this.sessionInformation.personType,
            date,
            date,
            validateSession
        );
    }

    /**
     * Get the timetable for a specific day for a specific element.
     * @param {Date} date
     * @param {number} id
     * @param {WebUntisElementType} type
     * @param {Boolean} [validateSession=true]
     * @returns {Promise<Array>}
     */
    async getTimetableFor(date, id, type, validateSession = true) {
        return await this._timetableRequest(id, type, date, date, validateSession);
    }

    /**
     * Get your own timetable for a given Date range
     * Note: You can't use this with anonymous login
     * @param {Date} rangeStart
     * @param {Date} rangeEnd
     * @param {Boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getOwnTimetableForRange(rangeStart, rangeEnd, validateSession = true) {
        this._checkAnonymous();
        return await this._timetableRequest(
            this.sessionInformation.personId,
            this.sessionInformation.personType,
            rangeStart,
            rangeEnd,
            validateSession
        );
    }

    /**
     * Get the timetable for a given Date range for specific element
     * @param {Date} rangeStart
     * @param {Date} rangeEnd
     * @param {number} id
     * @param {WebUntisElementType} type
     * @param {Boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getTimetableForRange(rangeStart, rangeEnd, id, type, validateSession = true) {
        return await this._timetableRequest(id, type, rangeStart, rangeEnd, validateSession);
    }

    /**
     * Get the Timetable of your class for today
     * Note: You can't use this with anonymous login
     * @param {Boolean} [validateSession=true]
     * @returns {Promise<Array>}
     */
    async getOwnClassTimetableForToday(validateSession = true) {
        this._checkAnonymous();
        return await this._timetableRequest(this.sessionInformation.klasseId, 1, null, null, validateSession);
    }

    /**
     * Get the Timetable of your class for the given day
     * Note: You can't use this with anonymous login
     * @param {Date} date
     * @param {Boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getOwnClassTimetableFor(date, validateSession = true) {
        this._checkAnonymous();
        return await this._timetableRequest(this.sessionInformation.klasseId, 1, date, date, validateSession);
    }

    /**
     * Get the Timetable of your class for a given Date range
     * Note: You can't use this with anonymous login
     * @param {Date} rangeStart
     * @param {Date} rangeEnd
     * @param {boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getOwnClassTimetableForRange(rangeStart, rangeEnd, validateSession = true) {
        this._checkAnonymous();
        return await this._timetableRequest(this.sessionInformation.klasseId, 1, rangeStart, rangeEnd, validateSession);
    }

    /**
     *
     * @param {Date} rangeStart
     * @param {Date} rangeEnd
     * @param {boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getHomeWorksFor(rangeStart, rangeEnd, validateSession = true) {
        if (validateSession && !(await this.validateSession())) throw new Error('Current Session is not valid');
        const response = await this.axios({
            method: 'GET',
            url: `/WebUntis/api/homeworks/lessons`,
            params: {
                startDate: this.convertDateToUntis(rangeStart),
                endDate: this.convertDateToUntis(rangeEnd),
            },
            headers: {
                Cookie: this._buildCookies(),
            },
        });
        if (typeof response.data.data !== 'object') throw new Error('Server returned invalid data.');
        if (!response.data.data['homeworks']) throw new Error("Data object doesn't contains homeworks object.");
        return response.data.data;
    }

    /**
     * Converts the untis date string format to a normal JS Date object
     * @param {string} date Untis date string
     * @param {Date} [baseDate=new Date()] Base date. Default beginning of current day
     * @returns {Date}
     * @static
     */
    static convertUntisDate(date, baseDate = startOfDay(new Date())) {
        if (typeof date !== 'string') date = `${date}`;
        return parse(date, 'yyyyMMdd', baseDate);
    }

    /**
     * Convert a untis time string to a JS Date object
     * @param {string|number} time Untis time string
     * @param {Date} [baseDate=new Date()] Day used as base for the time. Default: Current date
     * @returns {Date}
     * @static
     */
    static convertUntisTime(time, baseDate = new Date()) {
        if (typeof time !== 'string') time = `${time}`;
        return parse(time, 'Hmm', baseDate);
    }

    /**
     * Get all known Subjects for the current logged in user
     * @param {boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getSubjects(validateSession = true) {
        return await this._request('getSubjects', {}, validateSession);
    }

    /**
     * Get the timegrid of current school
     * @param {boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getTimegrid(validateSession = true) {
        return await this._request('getTimegridUnits', {}, validateSession);
    }

    /**
     *
     * @param {Date} rangeStart
     * @param {Date} rangeEnd
     * @param {boolean} [validateSession=true]
     * @returns {Promise.<void>}
     */
    async getHomeWorkAndLessons(rangeStart, rangeEnd, validateSession = true) {
        if (validateSession && !(await this.validateSession())) throw new Error('Current Session is not valid');
        const response = await this.axios({
            method: 'GET',
            url: `/WebUntis/api/homeworks/lessons`,
            params: {
                startDate: this.convertDateToUntis(rangeStart),
                endDate: this.convertDateToUntis(rangeEnd),
            },
            headers: {
                Cookie: this._buildCookies(),
            },
        });
        if (typeof response.data.data !== 'object') throw new Error('Server returned invalid data.');
        if (!response.data.data['homeworks']) throw new Error("Data object doesn't contains homeworks object.");
        return response.data.data;
    }

    /**
     * Get Exams for range
     * @param {Date} rangeStart
     * @param {Date} rangeEnd
     * @param {Number} klasseId
     * @param {boolean} withGrades
     * @param {boolean} [validateSession=true]
     * @returns {Promise.<void>}
     */
    async getExamsForRange(rangeStart, rangeEnd, klasseId = -1, withGrades = false, validateSession = true) {
        if (validateSession && !(await this.validateSession())) throw new Error('Current Session is not valid');
        const response = await this.axios({
            method: 'GET',
            url: `/WebUntis/api/exams`,
            params: {
                startDate: this.convertDateToUntis(rangeStart),
                endDate: this.convertDateToUntis(rangeEnd),
                klasseId: klasseId,
                withGrades: withGrades,
            },
            headers: {
                Cookie: this._buildCookies(),
            },
        });
        if (typeof response.data.data !== 'object') throw new Error('Server returned invalid data.');
        if (!response.data.data['exams']) throw new Error("Data object doesn't contains exams object.");
        return response.data.data['exams'];
    }

    /**
     * Get the timetable for the current week for a specific element from the web client API.
     * @param {Date} date one date in the week to query
     * @param {number} id element id
     * @param {WebUntisElementType} type element type
     * @param {Number} [formatId=1] set to 1 to include teachers, 2 omits the teachers in elements response
     * @param {Boolean} [validateSession=true]
     * @returns {Promise<WebAPITimetable[]>}
     */
    async getTimetableForWeek(date, id, type, formatId = 1, validateSession = true) {
        if (validateSession && !(await this.validateSession())) throw new Error('Current Session is not valid');

        const response = await this.axios({
            method: 'GET',
            url: `/WebUntis/api/public/timetable/weekly/data`,
            params: {
                elementType: type,
                elementId: id,
                date: format(date, 'yyyy-MM-dd'),
                formatId: formatId,
            },
            headers: {
                Cookie: this._buildCookies(),
            },
        });

        if (typeof response.data.data !== 'object') throw new Error('Server returned invalid data.');
        if (
            !response.data.data.result ||
            !response.data.data.result.data ||
            !response.data.data.result.data.elementPeriods ||
            !response.data.data.result.data.elementPeriods[id]
        )
            throw new Error('Invalid response');

        const data = response.data.data.result.data;

        const formatElements = (elements, { byType }) => {
            const filteredElements = elements.filter((element) => element.type === byType);

            return filteredElements.map((element) => ({
                ...element,
                element: data.elements.find(
                    (dataElement) => dataElement.type === byType && dataElement.id === element.id
                ),
            }));
        };

        const timetable = data.elementPeriods[id].map((lesson) => ({
            ...lesson,
            classes: formatElements(lesson.elements, { byType: WebUntis.TYPES.CLASS }),
            teachers: formatElements(lesson.elements, { byType: WebUntis.TYPES.TEACHER }),
            subjects: formatElements(lesson.elements, { byType: WebUntis.TYPES.SUBJECT }),
            rooms: formatElements(lesson.elements, { byType: WebUntis.TYPES.ROOM }),
            students: formatElements(lesson.elements, { byType: WebUntis.TYPES.STUDENT }),
        }));

        return timetable;
    }

    /**
     * Get the timetable for the current week for the current element from the web client API.
     * @param {Date} date one date in the week to query
     * @param {Number} [formatId=1] set to 1 to include teachers, 2 omits the teachers in elements response
     * @param {Boolean} [validateSession=true]
     * @returns {Promise<WebAPITimetable[]>}
     */
    async getOwnTimetableForWeek(date, formatId = 1, validateSession = true) {
        this._checkAnonymous();
        return await this.getTimetableForWeek(
            date,
            this.sessionInformation.personId,
            this.sessionInformation.personType,
            formatId,
            validateSession
        );
    }

    /**
     * Get all known teachers by WebUntis
     * @param {boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getTeachers(validateSession = true) {
        return await this._request('getTeachers', {}, validateSession);
    }

    /**
     * Get all known students by WebUntis
     * @param {boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getStudents(validateSession = true) {
        return await this._request('getStudents', {}, validateSession);
    }

    /**
     * Get all known rooms by WebUntis
     * @param {boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getRooms(validateSession = true) {
        return await this._request('getRooms', {}, validateSession);
    }

    /**
     * Get all classes known by WebUntis
     * @param {boolean} [validateSession=true]
     * @param {number} [schoolyear=undefined]
     * @returns {Promise.<Array>}
     */
    async getClasses(schoolyear = undefined,validateSession = true ) {
        const data = typeof schoolyear === 'undefined' ? {} : {schoolyearId: schoolyear};
        return await this._request('getKlassen', data, validateSession);
    }

    /**
     * Get all departments known by WebUntis
     * @param {boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getDepartments(validateSession = true) {
        return await this._request('getDepartments', {}, validateSession);
    }

    /**
     * Get all holidays known by WebUntis
     * @param {boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getHolidays(validateSession = true) {
        return await this._request('getHolidays', {}, validateSession);
    }

    /**
     * Get all status data known by WebUntis
     * @param {boolean} [validateSession=true]
     * @returns {Promise.<Array>}
     */
    async getStatusData(validateSession = true) {
        return await this._request('getStatusData', {}, validateSession);
    }

    /**
     * Convert a JS Date Object to a WebUntis date string
     * @param {Date} date
     * @returns {String}
     */
    convertDateToUntis(date) {
        return (
            date.getFullYear().toString() +
            (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1).toString() +
            (date.getDate() < 10 ? '0' + date.getDate() : date.getDate()).toString()
        );
    }

    /**
     * Make a JSON RPC Request with the current session
     * @param {string} method
     * @param {Object} [parameter={}]
     * @param {string} [url='/WebUntis/jsonrpc.do?school=SCHOOL']
     * @param {boolean} [validateSession=true] Whether the session should be checked first
     * @returns {Promise.<any>}
     * @private
     */
    async _request(method, parameter = {}, validateSession = true, url = `/WebUntis/jsonrpc.do`) {
        if (validateSession && !(await this.validateSession())) throw new Error('Current Session is not valid');
        const response = await this.axios({
            method: 'POST',
            url: url,
            params: {
                school: this.school,
            },
            headers: {
                Cookie: this._buildCookies(),
            },
            data: {
                id: this.id,
                method: method,
                params: parameter,
                jsonrpc: '2.0',
            },
        });
        if (!response.data.result) throw new Error("Server didn't return any result.");
        if (response.data.result.code) throw new Error('Server returned error code: ' + response.data.result.code);
        return response.data.result;
    }
}

class InternalWebuntisSecretLogin extends WebUntis {
    constructor(school, username, password, baseurl, identity = 'Awesome', disableUserAgent = false) {
        super(school, username, password, baseurl, identity, disableUserAgent);
    }

    async _otpLogin(token, username, time, skipSessionInfo = false) {
        const url = `/WebUntis/jsonrpc_intern.do?m=getUserData2017&school=${this.school}&v=i2.2`;
        const response = await this.axios({
            method: 'POST',
            url,
            data: {
                id: this.id,
                method: 'getUserData2017',
                params: [
                    {
                        auth: {
                            clientTime: time,
                            user: username,
                            otp: token,
                        },
                    },
                ],
                jsonrpc: '2.0',
            },
        });
        if (response.data && response.data.error)
            throw new Error('Failed to login. ' + (response.data.error.message || ''));
        if (
            response.headers &&
            response.headers['set-cookie'] &&
            this._getCookieFromSetCookie(response.headers['set-cookie']) === false
        )
            throw new Error("Failed to login. Server didn't return a session id.");
        const sessionId = this._getCookieFromSetCookie(response.headers['set-cookie']);
        // Set session temporary
        this.sessionInformation = {
            sessionId: sessionId,
        };
        if (skipSessionInfo) return true;

        // Get personId & personType
        const appConfigUrl = `/WebUntis/api/app/config`;
        const configResponse = await this.axios({
            method: 'GET',
            url: appConfigUrl,
            headers: {
                Cookie: this._buildCookies(),
            },
        });
        if (typeof configResponse.data !== 'object' || typeof configResponse.data.data !== 'object')
            throw new Error('Failed to fetch app config while login. data (type): ' + typeof response.data);
        // Path -> data.loginServiceConfig.user.persons -> find person with id
        if (
            configResponse.data.data &&
            configResponse.data.data.loginServiceConfig &&
            configResponse.data.data.loginServiceConfig.user &&
            !Number.isInteger(configResponse.data.data.loginServiceConfig.user.personId)
        )
            throw new Error('Invalid personId. personId: ' + configResponse.data.data.loginServiceConfig.user.personId);
        const webUntisLoginServiceUser = configResponse.data.data.loginServiceConfig.user;
        if (!Array.isArray(webUntisLoginServiceUser.persons))
            throw new Error('Invalid person array. persons (type): ' + typeof webUntisLoginServiceUser.persons);
        const person = find(webUntisLoginServiceUser.persons, {
            id: configResponse.data.data.loginServiceConfig.user.personId,
        });
        if (!person) throw new Error('Can not find person in person array.');
        if (!Number.isInteger(person.type)) throw new Error('Invalid person type. type (type): ' + person.type);
        this.sessionInformation = {
            sessionId: sessionId,
            personType: person.type,
            personId: configResponse.data.data.loginServiceConfig.user.personId,
        };
        // Get klasseId
        try {
            const dayConfigUrl = `/WebUntis/api/daytimetable/config`;
            const dayConfigResponse = await this.axios({
                method: 'GET',
                url: dayConfigUrl,
                headers: {
                    Cookie: this._buildCookies(),
                },
            });
            if (typeof dayConfigResponse.data !== 'object' || typeof dayConfigResponse.data.data !== 'object')
                throw new Error();
            if (!Number.isInteger(dayConfigResponse.data.data.klasseId)) throw new Error();
            this.sessionInformation = {
                sessionId: sessionId,
                personType: person.type,
                personId: configResponse.data.data.loginServiceConfig.user.personId,
                klasseId: dayConfigResponse.data.data.klasseId,
            };
        } catch (e) {
            // klasseId is not important. This request can fail
        }
        return true;
    }

    /**
     *
     * @param {Array} setCookieArray
     * @param {string} [cookieName="JSESSIONID"]
     * @return {string|boolean}
     * @private
     */
    _getCookieFromSetCookie(setCookieArray, cookieName = 'JSESSIONID') {
        if (!setCookieArray) return false;
        for (let i = 0; i < setCookieArray.length; i++) {
            const setCookie = setCookieArray[i];
            if (!setCookie) continue;
            let cookieParts = setCookie.split(';');
            if (!cookieParts || !Array.isArray(cookieParts)) continue;
            for (let cookie of cookieParts) {
                cookie = cookie.trim();
                cookie = cookie.replace(/;/gm, '');
                const [Key, Value] = cookie.split('=');
                if (!Key || !Value) continue;
                if (Key === cookieName) return Value;
            }
        }
        return false;
    }
}

class WebUntisAnonymousAuth extends InternalWebuntisSecretLogin {
    /**
     *
     * @param {string} school
     * @param {string} baseurl
     * @param {string} [identity='Awesome']
     * @param {boolean} [disableUserAgent=false] If this is true, axios will not send a custom User-Agent
     */
    constructor(school, baseurl, identity = 'Awesome', disableUserAgent = false) {
        super(school, null, null, baseurl, identity, false, disableUserAgent);
        this.username = '#anonymous#';
        this.anonymous = true;
    }

    async login() {
        // Check whether the school has public access or not
        const url = `/WebUntis/jsonrpc_intern.do`;
        const response = await this.axios({
            method: 'POST',
            url,
            params: {
                m: 'getAppSharedSecret',
                school: this.school,
                v: 'i3.5',
            },
            data: {
                id: this.id,
                method: 'getAppSharedSecret',
                params: [
                    {
                        userName: '#anonymous#',
                        password: '',
                    },
                ],
                jsonrpc: '2.0',
            },
        });

        if (response.data && response.data.error)
            throw new Error('Failed to login. ' + (response.data.error.message || ''));

        // OTP never changes when using anonymous login
        const otp = 100170;
        const time = new Date().getTime();
        return await this._otpLogin(otp, this.username, time, true);
    }
}

class WebUntisSecretAuth extends InternalWebuntisSecretLogin {
    /**
     *
     * @constructor
     * @augments WebUntis
     * @param {string} school The school identifier
     * @param {string} user
     * @param {string} secret
     * @param {string} baseurl Just the host name of your WebUntis (Example: mese.webuntis.com)
     * @param {string} [identity="Awesome"] A identity like: MyAwesomeApp
     * @param {Object} authenticator Custom otplib v12 instance. Default will use the default otplib configuration.
     * @param {boolean} [disableUserAgent=false] If this is true, axios will not send a custom User-Agent
     */
    constructor(school, user, secret, baseurl, identity = 'Awesome', authenticator, disableUserAgent = false) {
        super(school, user, null, baseurl, identity, disableUserAgent);
        this.secret = secret;
        this.authenticator = authenticator;
        if (!authenticator) {
            // React-Native will not eval this expression
            const { authenticator } = eval("require('otplib')");
            this.authenticator = authenticator;
        }
    }

    async login() {
        // Get JSESSION
        const token = this.authenticator.generate(this.secret);
        const time = new Date().getTime();
        return await this._otpLogin(token, this.username, time);
    }
}

class WebUntisQR extends WebUntisSecretAuth {
    /**
     * Use the data you get from a WebUntis QR code
     * @constructor
     * @augments WebUntisSecretAuth
     * @param {string} QRCodeURI A WebUntis uri. This is the data you get from the QR Code from the webuntis webapp under profile->Data access->Display
     * @param {string} [identity="Awesome"]  A identity like: MyAwesomeApp
     * @param {Object} authenticator Custom otplib v12 instance. Default will use the default otplib configuration.
     * @param {Object} URL Custom whatwg url implementation. Default will use the nodejs implementation.
     * @param {boolean} [disableUserAgent=false] If this is true, axios will not send a custom User-Agent
     */
    constructor(QRCodeURI, identity, authenticator, URL, disableUserAgent = false) {
        let URLImplementation = URL;
        if (!URL) {
            // React-Native will not eval this expression
            URLImplementation = eval("require('url').URL");
        }
        const uri = new URLImplementation(QRCodeURI);
        super(
            uri.searchParams.get('school'),
            uri.searchParams.get('user'),
            uri.searchParams.get('key'),
            uri.searchParams.get('url'),
            identity,
            authenticator,
            disableUserAgent
        );
    }
}

WebUntis.WebUntisSecretAuth = WebUntisSecretAuth;
WebUntis.WebUntisQR = WebUntisQR;
WebUntis.WebUntisAnonymousAuth = WebUntisAnonymousAuth;
WebUntis.TYPES = {
    CLASS: 1,
    TEACHER: 2,
    SUBJECT: 3,
    ROOM: 4,
    STUDENT: 5,
};

export default WebUntis