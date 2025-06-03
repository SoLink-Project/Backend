import { schedule } from 'node-cron';
import connection from './database.js';
import genReport from './index.js';

const dailyTask = schedule('0 0 * * *', () => {
    const SQL = `UPDATE settings SET VALUE = 0 WHERE NAME = 'COUNT_DAY'`;
    connection.query(SQL);
    console.log(`[` + new Date().toLocaleString() + `] The daily counter is successfully reset.`);
    const SQLTWO = `SELECT * FROM links WHERE STR_TO_DATE(LAST_VIEW, '%Y-%m-%d') < NOW() - INTERVAL 1 MONTH`;
    connection.query(SQLTWO, (error, results) => {
        if(error) {
            console.error(error);
        }
        if (results.length > 0) {
            results.forEach((row) => {
                const deleteQuery = `DELETE FROM links WHERE ID = ?`;
                connection.query(deleteQuery, [row.id], (err, result) => {
                    if (err) {
                        console.error(err);
                    } else {
                        console.log(`[` + new Date().toLocaleString() + `] Deleted record with id: ${row.id}`);
                    }
                });
            });
        } else console.log(`[` + new Date().toLocaleString() + `] The daily old link has not been deleted.`);
    })
}, {
    scheduled: true
});

const weeklyTask = schedule('0 0 * * 1', () => {
    const SQL = `UPDATE settings SET VALUE = 0 WHERE NAME = 'COUNT_WEEK'`;
    connection.query(SQL);
    console.log(`[` + new Date().toLocaleString() + `] The weekly counter is successfully reset.`);
}, {
    scheduled: true
});

const monthlyTask = schedule('0 0 1 * *', () => {
    genReport();
    console.log(`[` + new Date().toLocaleString() + `] The monthly attendance report has been run successfully.`);
}, {
    scheduled: true
});

const yearlyTask = schedule('0 0 1 1 *', () => {
    const SQL = `UPDATE settings SET VALUE = 0 WHERE NAME = 'COUNT_YEAR'`;
    connection.query(SQL);
    console.log(`[` + new Date().toLocaleString() + `] The yearly counter is successfully reset.`);
}, {
    scheduled: true
});

export {
    weeklyTask,
    monthlyTask,
    yearlyTask,
    dailyTask
};
