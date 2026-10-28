import { Client } from 'ssh2';
import fs from 'fs';
const PEM = fs.readFileSync('C:/Users/32545/.ssh/workbuddy-deploy.pem', 'utf8');
const client = new Client();
client.on('ready', () => {
    client.sftp((err, sftp) => {
        if (err) { console.log('sftp err', err); client.end(); return; }
        sftp.readdir('/var/www/game/src/systems', (err, list) => {
            if (err) console.log('readdir err', err);
            else console.log('server src/systems:', list.filter(f => f.filename.endsWith('.js')).map(f => f.filename).join(', '));
            client.end();
        });
    });
});
client.connect({
    host: '106.54.31.70',
    port: 22,
    username: 'root',
    privateKey: PEM,
});
