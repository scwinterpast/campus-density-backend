/**
 *  Campus Density Backend
 *  Copyright (C) 2018 Cornell Design & Tech Initiative
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License only.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Affero General Public License for more details.
 *
 *   You should have received a copy of the GNU Affero General Public License
 *   along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const Datastore = require('@google-cloud/datastore');
const datastore = Datastore();
const uuidv4 = require('uuid/v4');
const moment = require('moment');

// TODO Validate iOS vendor ids
const UUID_VALIDATE_IOS = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/;

const Util = require('./util');

exports.authenticated = function (route) {
    return (...params) => {
        const [req, res] = params;
        
        if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
            res.status(403).send('Unauthorized');
            return;
        }

        const idToken = req.headers.authorization.split('Bearer ')[1];
        const apiKey = process.env.AUTH_KEY;

        if (idToken === apiKey) {
            const token = req.headers['x-api-key'];
            const query = datastore.createQuery('auth', 'auth_info').filter('token', '=', token);

            datastore.runQuery(query, (err, tokens) => {
                if (err) {
                    res.status(500).send('Failed to access token tables');
                    return;
                }

                if (Array.from(tokens).length == 1) {
                    route(...params);
                } else {
                    res.status(403).send('Unauthorized');
                }
            });

            // TODO Add receipt/instanceId authentication
            //const receipt = req.body.receipt;
            //const instanceId = req.body.instanceId;
        } else {
            res.status(403).send('Unauthorized');
        }
    };
}

exports.handler = function (req, res) {
    if (!req.headers['x-api-key'] || !req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
        res.status(403).send('Unauthorized');
        return;
    }

    if (req.method !== 'PUT') {
        res.status(400).send('Only serves over PUT');
        return;
    }

    const idToken = req.headers.authorization.split('Bearer ')[1];
    const vendorId = req.headers['x-api-key'];
    const apiKey = process.env.AUTH_KEY;
    const uuid = uuidv4();
    const token = Buffer.from(uuid).toString('base64');

    const densityKey = datastore.key({
        namespace: 'auth',
        path: ['auth_info', Util.strip(vendorId)]
    });

    if (idToken === apiKey) {
        datastore.upsert({
            key: densityKey,
            data: {
                instanceId: vendorId,
                uuid,
                token,
                generated: moment().valueOf()
            }
        }, err => {
            if (err) {
                res.status(500).send(err);
            } else {
                res.status(201).send({
                    token
                });
            }
        });
    } else {
        res.status(401).send('Unable to authenticate api key.');
    }
}