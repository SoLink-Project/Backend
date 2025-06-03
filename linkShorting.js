import pool from './database.js';
import axios from 'axios';

const GOOGLE_SAFE_BROWSING_URL = process.env.GOOGLE_SAFE_BROWSING_URL

const ErrorMesssage_1 = "This link already exists in our system, so it cannot be generated as either a unique or standard link. It has been automatically copied to your clipboard. If not, please click the button below to manually copy the link.";
const ErrorMesssage_2 = "The link has been successfully generated. It has been automatically copied to your clipboard. If not, please click the button below to manually copy the link."
const ErrorMesssage_3 = "The custom link you provided already exists. Please choose a different custom text."
const ErrorMesssage_4 = "The provided URL has been identified as unsafe by our security checks and cannot be shortened. This may be due to potential risks such as malware, phishing attempts, or other harmful content. Please verify the URL and try again with a different one.";
const ErrorMesssage_5 = "There was an issue with verifying the URL. Our security systems encountered a problem while checking the URL's safety. This might be due to temporary issues with the external security service or a problem with the request. Please try again later or contact support if the issue persists.";

const domainName = process.env.DOMAIN

const getError = async (req, res) => {
    const { longLink, customLink } = req.body;

    try {
        const response = await axios.post(
            GOOGLE_SAFE_BROWSING_URL,
            {
                client: {
                    clientId: process.env.GOOGLE_SAFE_CLIENT_ID || 'my-client-id',
                    clientVersion: "1.5.2"
                },
                threatInfo: {
                    threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                    platformTypes: ["ANY_PLATFORM"],
                    threatEntryTypes: ["URL"],
                    threatEntries: [{ url: longLink }]
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        if (response.data && response.data.matches) {
            console.log(`[` + new Date().toLocaleString() + `] Someone is trying to shorten a link of unknown origin.`);
            return res.status(400).json({ error: ErrorMesssage_4 });
        }
    } catch (error) {
        console.error(`[` + new Date().toLocaleString() + `] There was a problem with the API connection: ${error}`);
        return res.status(500).json({ error: ErrorMesssage_5 });
    }

    try {
        const SQLGETVALID = `SELECT CREATED_LINK FROM links WHERE LINK = $1`;
        const haveLink = await pool.query(SQLGETVALID, [longLink]);
        if (haveLink.rows.length > 0) {
            console.log(`[` + new Date().toLocaleString() + `] Someone tried to register an existing link! ${longLink} to ${domainName + haveLink.rows[0].CREATED_LINK}`);
            return res.json({ exists: true, link: haveLink.rows[0].CREATED_LINK, error: ErrorMesssage_1 });
        }

        var completeLink = '';

        let shortLink = (Math.random() + 1).toString(36).substring(2);
        if (customLink.length > 0) {
            completeLink = customLink;
        } else {
            completeLink = shortLink;
        }

        const SQLISHAVETHIS = `SELECT * FROM links WHERE CREATED_LINK = $1`;
        const haveLikeLink = await pool.query(SQLISHAVETHIS, [completeLink]);
        if (haveLikeLink.rows.length > 0) {
            console.log(`[` + new Date().toLocaleString() + `] Someone is trying to create an existing link ending. ${completeLink} to ${longLink}`);
            return res.json({ exists: false, link: completeLink, error: ErrorMesssage_3 });
        }

        const SQLINSERTLINK = `INSERT INTO links (LINK, CREATED_LINK, CREATE_DATE, USEFOR) VALUES ($1, $2, $3, $4)`;
        const useDate = new Date();
        const insert = await pool.query(SQLINSERTLINK, [longLink, completeLink, useDate.toLocaleString(), 0]);
        console.log(`[` + new Date().toLocaleString() + `] Someone successfully created a link! ${completeLink} to ${longLink}`);
        return res.json({ exists: true, link: completeLink, error: ErrorMesssage_2 });
    } catch (error) {
        console.error(error)
    }
}

const redirectLink = async (req, res) => {
    const { link } = req.params;
    try {
        const results = await pool.query('SELECT * FROM links WHERE CREATED_LINK = $1', [link]);
        if (results.rows.length > 0) {
            const linkData = results.rows[0];
            return res.json({ goLink: linkData.link });
        } else {
            return res.status(404).json({ error: 'Link not found' });
        }
    } catch (error) {
        console.error('Error handling request:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};


const counterNumber = (req, res) => {
    const SQL = "SELECT * FROM settings WHERE NAME IN ('COUNT_DAY', 'COUNT_WEEK', 'COUNT_YEAR')"
    pool.query(SQL, (error, results) => {
        if (error) {
            console.error(error);
        }
        const counts = {
            day: null,
            week: null,
            year: null,
        };
        results.rows.forEach(row => {
            if (row.name === 'COUNT_DAY') counts.day = row.value;
            if (row.name === 'COUNT_WEEK') counts.week = row.value;
            if (row.name === 'COUNT_YEAR') counts.year = row.value;
        });
        return res.json(counts);
    })
}

const getLINK = async (req, res) => {
    const { link } = req.body;
    const results = await pool.query('SELECT * FROM links WHERE CREATED_LINK = $1', [link]);
    try {
        if (results.rows.length > 0) {
            const linkData = results.rows[0];
            const useDate = new Date();
            const SQLCOUNT = 'UPDATE links SET USEFOR = $1, LAST_VIEW = $2 WHERE CREATED_LINK = $3';
            await pool.query(SQLCOUNT, [linkData.usefor + 1, useDate.toLocaleString(), link]);
            const SQLCOUNTER = 'SELECT * FROM settings WHERE NAME IN ($1, $2, $3)';
            const settings = await pool.query(SQLCOUNTER, ['COUNT_DAY', 'COUNT_WEEK', 'COUNT_YEAR']);
            if (settings.rows.length === 3) {
                const SQLINSERTCOUNT = 'UPDATE settings SET value = $1 WHERE NAME = $2';
                await pool.query(SQLINSERTCOUNT, [settings.rows[0].value + 1, 'COUNT_DAY']);
                await pool.query(SQLINSERTCOUNT, [settings.rows[1].value + 1, 'COUNT_WEEK']);
                await pool.query(SQLINSERTCOUNT, [settings.rows[2].value + 1, 'COUNT_YEAR']);
            } else {
                console.error('Settings table does not contain expected entries');
                return res.status(500).json({ error: 'Settings table does not contain expected entries' });
            }
            console.log(`[${new Date().toLocaleString()}] Someone viewed this link! ${linkData.created_link} It currently has this many views: ${linkData.usefor + 1}`);
            return res.json({ goLink: linkData.link });
        } else {
            return res.status(404).json({ error: 'Link not found' });
        }
    } catch (error) {
        console.error('Error handling request:', error);
    }
}

export { redirectLink, getError, counterNumber, getLINK }
