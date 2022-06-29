# Untis Vorratsdaten

## How to:

 1. Set up an SQL Server and create a database with the tables from [the SQL script](./create_tables.sql)
 2. `git clone https://github.com/Jeidnx/untis-vorratsdaten`
 3. `cd untis-vorratsdaten`
 4. `git checkout sql_normalised`
 5. `npm i`
 6. Set environment variables (The SQL ones have default values)
 7. `npm run start`

## Environment variables:

### Required:
 - `SCHOOL` 
   The Name of your School according to untis
 - `USERNAME` Your untis username
 - `PASSWORD` Your untis password
 - `DOMAIN`
   The domain on which your schools Untis instance is hosted (xyz.webuntis.com)

### Optional:
 - `SQLHOST` SQL Server host
 - `SQLPORT` SQL Server port
 - `SQLUSER` SQL Server usename
 - `SQLPASS` SQL Server password
 - `SQLDB` SQL Server database