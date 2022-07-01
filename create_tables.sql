create database untis;

use untis;

create table Room
(
    id  int not null    primary key,
    name    varchar(255) not null,
    longName    varchar(255) not null
);

create table Subject
(
    id  int not null    primary key,
    name    varchar(255) not null,
    longName    varchar(255) not null
);

create table Teacher
(
    id  int not null    primary key,
    name    varchar(255) not null,
    longName    varchar(255) not null
);

create table Year
(
    id  int not null    primary key,
    name varchar(255) not null
);

create table Course
(
    id  int not null    primary key,
    name    varchar(255) not null,
    longName    varchar(255) not null,
    active  tinyint(1)  not null,
    yearId  int not null references Year (id)
);

create table Lesson
(
    id  int not null    primary key,
    startTime   datetime not null,
    endTime datetime not null,
    lessonCode  varchar(15) not null,
    courseId    int not null references Course (id),
    yearId  int not null references Year (id),
    subjectId   int null references Subject (id),
    roomId  int null references Room (id),
    teacherId   int null references Teacher (id)
);

